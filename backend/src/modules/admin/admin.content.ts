import { Prisma, PublishStatus } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { HttpError } from '../../lib/http'
import { LANGUAGE_NAMES } from '../catalog/catalog.service'
import { publicUrl } from '../../lib/storage'
import { has, str, int, bool, url, date, SLUG_RE, paging } from './validate'

type Body = Record<string, unknown>

// ── shared mapping ──────────────────────────────────────────

const LANGUAGE_CODES = Object.fromEntries(Object.entries(LANGUAGE_NAMES).map(([code, name]) => [name.toLowerCase(), code]))

function languageCode(v: string): string {
  const s = v.trim().toLowerCase()
  if (LANGUAGE_NAMES[s]) return s
  const code = LANGUAGE_CODES[s]
  if (!code) throw new HttpError(400, `Unsupported language: ${v}`)
  return code
}

const STATUS_IN: Record<string, PublishStatus> = {
  draft: 'DRAFT', scheduled: 'SCHEDULED', published: 'PUBLISHED', archived: 'ARCHIVED',
}

function publishStatus(v: unknown): PublishStatus {
  const s = STATUS_IN[String(v).toLowerCase()]
  if (!s) throw new HttpError(400, 'status must be draft, scheduled, published or archived')
  return s
}

// Status + dates move together: publishing stamps publishedAt once;
// scheduling needs a publish time
function statusFields(status: PublishStatus, publishAt: Date | null | undefined, current?: { publishedAt: Date | null }) {
  if (status === 'SCHEDULED' && !publishAt) throw new HttpError(400, 'A publish date/time is required to schedule')
  return {
    status,
    publishAt: status === 'SCHEDULED' ? publishAt : null,
    publishedAt: status === 'PUBLISHED' ? current?.publishedAt ?? new Date() : current?.publishedAt ?? null,
  }
}

const iso = (d: Date | null) => d?.toISOString() ?? null
const day = (d: Date) => d.toISOString().slice(0, 10)

// ── SERIES ──────────────────────────────────────────

const seriesInclude = {
  category: true,
  genres: { include: { genre: true } },
  _count: { select: { episodes: true } },
} satisfies Prisma.SeriesInclude

type SeriesRow = Prisma.SeriesGetPayload<{ include: typeof seriesInclude }>

// Coins spent unlocking each series' episodes — the only revenue signal until payments land
async function coinsSpentBySeries(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map()
  const rows = await prisma.$queryRaw<{ series_id: string; coins: bigint }[]>`
    SELECT e.series_id, COALESCE(SUM(u.coins_spent), 0)::bigint AS coins
    FROM user_unlocked_episodes u JOIN episodes e ON e.id = u.episode_id
    WHERE e.series_id = ANY(${ids}::uuid[])
    GROUP BY e.series_id`
  return new Map(rows.map(r => [r.series_id, Number(r.coins)]))
}

function toAdminSeries(s: SeriesRow, coinsSpent = 0) {
  return {
    id: s.id,
    title: s.title,
    slug: s.slug,
    synopsis: s.synopsis ?? '',
    thumbnail_url: s.thumbnailUrl,
    hero_url: s.bannerUrl ?? '',
    primary_category: s.category?.name ?? '',
    subcategories: s.genres.map(g => g.genre.name),
    tags: s.tags.join(', '),
    language: LANGUAGE_NAMES[s.language] ?? s.language,
    total_episodes: s._count.episodes,
    lock_from_episode: s.lockFromEpisode,
    coin_cost: s.defaultCoinPrice,
    coin_cost_per_episode: s.defaultCoinPrice,
    is_featured: s.isFeatured,
    is_vip_exclusive: s.isVipExclusive,
    status: s.status.toLowerCase(),
    publish_at: iso(s.publishAt),
    published_at: iso(s.publishedAt),
    views: s.viewCount,
    revenue: coinsSpent, // coins spent on this series' episodes
    created_at: day(s.createdAt),
  }
}

export async function listSeries(query: Record<string, unknown>) {
  const { page, pageSize, skip } = paging(query)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const status = typeof query.status === 'string' && query.status !== 'all' ? publishStatus(query.status) : undefined
  const where: Prisma.SeriesWhereInput = {
    ...(status && { status }),
    ...(search && { OR: [{ title: { contains: search, mode: 'insensitive' } }, { slug: { contains: search.toLowerCase() } }] }),
  }
  const [rows, total] = await Promise.all([
    prisma.series.findMany({ where, include: seriesInclude, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    prisma.series.count({ where }),
  ])
  const coins = await coinsSpentBySeries(rows.map(r => r.id))
  return { items: rows.map(r => toAdminSeries(r, coins.get(r.id))), total, page, pageSize }
}

export async function getSeries(id: string) {
  const row = await prisma.series.findUnique({ where: { id }, include: seriesInclude })
  if (!row) throw new HttpError(404, 'Series not found')
  const coins = await coinsSpentBySeries([id])
  return toAdminSeries(row, coins.get(id))
}

async function categoryIdByName(name: string): Promise<number | null> {
  if (!name) return null
  const cat = await prisma.category.findFirst({ where: { OR: [{ name }, { slug: name }] } })
  if (!cat) throw new HttpError(400, `Unknown category: ${name}`)
  return cat.id
}

async function genreIdsByName(names: unknown): Promise<number[]> {
  if (!Array.isArray(names) || names.some(n => typeof n !== 'string')) throw new HttpError(400, 'subcategories must be a list of names')
  if (!names.length) return []
  const genres = await prisma.genre.findMany({ where: { name: { in: names as string[] } } })
  const missing = (names as string[]).filter(n => !genres.some(g => g.name === n))
  if (missing.length) throw new HttpError(400, `Unknown subcategory: ${missing.join(', ')}`)
  return genres.map(g => g.id)
}

function parseTags(v: unknown): string[] | undefined {
  if (v === undefined) return undefined
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : null
  if (!list) throw new HttpError(400, 'tags must be comma-separated text')
  const tags = [...new Set(list.map(t => String(t).trim()).filter(Boolean))]
  if (tags.length > 20 || tags.some(t => t.length > 40)) throw new HttpError(400, 'Up to 20 tags, 40 characters each')
  return tags
}

// Re-applies the series pricing defaults to its episodes (VIP_ONLY untouched)
async function applyPricing(tx: Prisma.TransactionClient, seriesId: string, lockFrom: number, price: number) {
  await tx.episode.updateMany({
    where: { seriesId, episodeNumber: { lt: lockFrom }, accessType: { not: 'VIP_ONLY' } },
    data: { accessType: 'FREE', coinPrice: 0 },
  })
  await tx.episode.updateMany({
    where: { seriesId, episodeNumber: { gte: lockFrom }, accessType: { not: 'VIP_ONLY' } },
    data: { accessType: 'COIN_LOCKED', coinPrice: price },
  })
}

export async function createSeries(body: Body) {
  const title = str(body, 'title', { required: true, max: 255, label: 'Title' })!
  const slug = str(body, 'slug', { required: true, max: 255, pattern: SLUG_RE, label: 'Slug' })!
  const categoryId = await categoryIdByName(str(body, 'primary_category', { required: true, label: 'Primary category' })!)
  const genreIds = has(body, 'subcategories') ? await genreIdsByName(body.subcategories) : []
  const status = has(body, 'status') ? publishStatus(body.status) : 'DRAFT'

  const created = await prisma.series.create({
    data: {
      title,
      slug,
      synopsis: str(body, 'synopsis', { max: 5000 }) || null,
      thumbnailUrl: url(body, 'thumbnail_url', 'Poster URL') ?? '',
      bannerUrl: url(body, 'hero_url', 'Banner URL') ?? null,
      language: languageCode(str(body, 'language') || 'en'),
      categoryId,
      tags: parseTags(body.tags) ?? [],
      isFeatured: bool(body, 'is_featured') ?? false,
      isVipExclusive: bool(body, 'is_vip_exclusive') ?? false,
      lockFromEpisode: int(body, 'lock_from_episode', { min: 1, max: 10000, label: 'Lock from episode' }) ?? 1,
      defaultCoinPrice: int(body, 'coin_cost_per_episode', { min: 0, max: 1000, label: 'Coin cost' }) ?? 5,
      ...statusFields(status, date(body, 'publish_at', 'Publish date')),
      genres: { create: genreIds.map(genreId => ({ genreId })) },
    },
  })
  return getSeries(created.id)
}

export async function updateSeries(id: string, body: Body) {
  const current = await prisma.series.findUnique({ where: { id } })
  if (!current) throw new HttpError(404, 'Series not found')

  const data: Prisma.SeriesUncheckedUpdateInput = {}
  if (has(body, 'title')) data.title = str(body, 'title', { required: true, max: 255, label: 'Title' })
  if (has(body, 'slug')) data.slug = str(body, 'slug', { required: true, max: 255, pattern: SLUG_RE, label: 'Slug' })
  if (has(body, 'synopsis')) data.synopsis = str(body, 'synopsis', { max: 5000 }) || null
  if (has(body, 'thumbnail_url')) data.thumbnailUrl = url(body, 'thumbnail_url', 'Poster URL') ?? ''
  if (has(body, 'hero_url')) data.bannerUrl = url(body, 'hero_url', 'Banner URL') ?? null
  if (has(body, 'language')) data.language = languageCode(str(body, 'language', { required: true })!)
  if (has(body, 'primary_category')) data.categoryId = await categoryIdByName(str(body, 'primary_category')!)
  if (has(body, 'tags')) data.tags = parseTags(body.tags)
  if (has(body, 'is_featured')) data.isFeatured = bool(body, 'is_featured')
  if (has(body, 'is_vip_exclusive')) data.isVipExclusive = bool(body, 'is_vip_exclusive')
  if (has(body, 'status') || has(body, 'publish_at')) {
    const status = has(body, 'status') ? publishStatus(body.status) : current.status
    const publishAt = has(body, 'publish_at') ? date(body, 'publish_at', 'Publish date') : current.publishAt
    Object.assign(data, statusFields(status, publishAt, current))
  }

  const lockFrom = int(body, 'lock_from_episode', { min: 1, max: 10000, label: 'Lock from episode' }) ?? current.lockFromEpisode
  const price = int(body, 'coin_cost_per_episode', { min: 0, max: 1000, label: 'Coin cost' }) ?? current.defaultCoinPrice
  const pricingChanged = lockFrom !== current.lockFromEpisode || price !== current.defaultCoinPrice
  data.lockFromEpisode = lockFrom
  data.defaultCoinPrice = price

  const genreIds = has(body, 'subcategories') ? await genreIdsByName(body.subcategories) : undefined

  await prisma.$transaction(async tx => {
    await tx.series.update({ where: { id }, data })
    if (genreIds) {
      await tx.seriesGenre.deleteMany({ where: { seriesId: id } })
      await tx.seriesGenre.createMany({ data: genreIds.map(genreId => ({ seriesId: id, genreId })) })
    }
    // Only when the admin actually changed pricing — otherwise saving the
    // form would wipe per-episode overrides (e.g. a single free episode)
    if (pricingChanged) await applyPricing(tx, id, lockFrom, price)
  })
  return getSeries(id)
}

export async function setSeriesStatus(id: string, body: Body) {
  return updateSeries(id, { status: body.status, ...(has(body, 'publish_at') && { publish_at: body.publish_at }) })
}

export async function deleteSeries(id: string) {
  await prisma.series.delete({ where: { id } })
  return { id, deleted: true }
}

// ── EPISODES ──────────────────────────────────────────

type EpisodeRow = Prisma.EpisodeGetPayload<object>

function toAdminEpisode(e: EpisodeRow) {
  return {
    id: e.id,
    series_id: e.seriesId,
    number: e.episodeNumber,
    episode_number: e.episodeNumber,
    title: e.title,
    description: e.description ?? '',
    duration_seconds: e.durationSeconds,
    access_type: e.accessType,
    is_free: e.accessType === 'FREE',
    coin_cost: e.coinPrice,
    video_id: e.hlsManifestKey ?? '',
    // Admin preview; viewers go through /playback, which checks access
    video_url: e.hlsManifestKey ? publicUrl(e.hlsManifestKey) : '',
    subtitles_url: e.subtitlesKey ?? '',
    status: e.videoStatus.toLowerCase(), // video pipeline state: pending/uploaded/processing/ready/failed
    transcode_progress: e.transcodeProgress,
    video_error: e.videoError ?? '',
    has_source: !!e.sourceKey,
    publish_status: e.status.toLowerCase(),
    publish_at: iso(e.publishAt),
    views: e.viewCount,
    created_at: day(e.createdAt),
  }
}

export async function listEpisodes(seriesId: string) {
  const rows = await prisma.episode.findMany({ where: { seriesId }, orderBy: { episodeNumber: 'asc' } })
  return rows.map(toAdminEpisode)
}

export async function getEpisode(id: string) {
  const row = await prisma.episode.findUnique({ where: { id } })
  if (!row) throw new HttpError(404, 'Episode not found')
  return toAdminEpisode(row)
}

export async function createEpisode(seriesId: string, body: Body) {
  const series = await prisma.series.findUnique({ where: { id: seriesId } })
  if (!series) throw new HttpError(404, 'Series not found')

  const number = int(body, has(body, 'number') ? 'number' : 'episode_number', { required: true, min: 1, max: 10000, label: 'Episode number' })!
  const isFree = bool(body, 'is_free') ?? number < series.lockFromEpisode
  const coinPrice = isFree ? 0 : int(body, 'coin_cost', { min: 0, max: 1000, label: 'Coin cost' }) ?? series.defaultCoinPrice

  // A future publish date schedules the episode; otherwise it goes live now
  // (the series' own status still controls whether anyone can see it)
  const publishAt = date(body, 'publish_date', 'Publish date')
  const scheduled = !!publishAt && publishAt.getTime() > Date.now()

  const row = await prisma.episode.create({
    data: {
      seriesId,
      episodeNumber: number,
      title: str(body, 'title', { max: 255 }) || `Episode ${number}`,
      description: str(body, 'description', { max: 5000 }) || null,
      durationSeconds: int(body, 'duration_seconds', { min: 0, max: 36000, label: 'Duration' }) ?? 0,
      accessType: isFree ? 'FREE' : 'COIN_LOCKED',
      coinPrice,
      subtitlesKey: str(body, 'subtitles_url', { max: 500 }) || null,
      status: scheduled ? 'SCHEDULED' : 'PUBLISHED',
      publishAt: scheduled ? publishAt : null,
      publishedAt: scheduled ? null : new Date(),
    },
  })
  return toAdminEpisode(row)
}

export async function updateEpisode(id: string, body: Body) {
  const current = await prisma.episode.findUnique({ where: { id }, include: { series: true } })
  if (!current) throw new HttpError(404, 'Episode not found')

  // Video fields are owned by the upload/transcode pipeline (video.service),
  // never by this form — a stale form save must not clobber processing state
  const data: Prisma.EpisodeUncheckedUpdateInput = {}
  const number = int(body, has(body, 'episode_number') ? 'episode_number' : 'number', { min: 1, max: 10000, label: 'Episode number' })
  if (number !== undefined) data.episodeNumber = number
  if (has(body, 'title')) data.title = str(body, 'title', { max: 255 }) || `Episode ${number ?? current.episodeNumber}`
  if (has(body, 'description')) data.description = str(body, 'description', { max: 5000 }) || null
  if (has(body, 'duration_seconds')) data.durationSeconds = int(body, 'duration_seconds', { min: 0, max: 36000, label: 'Duration' }) ?? 0
  if (has(body, 'subtitles_url')) data.subtitlesKey = str(body, 'subtitles_url', { max: 500 }) || null

  if (has(body, 'is_free')) {
    const isFree = bool(body, 'is_free')
    data.accessType = isFree ? 'FREE' : current.accessType === 'VIP_ONLY' ? 'VIP_ONLY' : 'COIN_LOCKED'
    data.coinPrice = isFree ? 0 : int(body, 'coin_cost', { min: 0, max: 1000, label: 'Coin cost' }) ?? (current.coinPrice || current.series.defaultCoinPrice)
  } else if (has(body, 'coin_cost') && body.coin_cost !== null) {
    data.coinPrice = int(body, 'coin_cost', { min: 0, max: 1000, label: 'Coin cost' })
  }

  const row = await prisma.episode.update({ where: { id }, data })
  return toAdminEpisode(row)
}

export async function setEpisodeFree(id: string, body: Body) {
  const isFree = bool(body, 'is_free')
  if (isFree === undefined) throw new HttpError(400, 'is_free is required')
  return updateEpisode(id, { is_free: isFree })
}

export async function deleteEpisode(id: string) {
  await prisma.episode.delete({ where: { id } })
  return { id, deleted: true }
}

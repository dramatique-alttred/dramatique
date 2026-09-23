import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'

/**
 * Public catalog reads. Everything here returns the snake_case `Series`
 * shape the Next.js app already renders (src/types/index.ts), so the
 * frontend swaps mock → real data without touching any page.
 */

const NEW_WINDOW_DAYS = 60
const TRENDING_COUNT = 4
const DEFAULT_COIN_PRICE = 5

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', es: 'Spanish', pt: 'Portuguese',
  de: 'German', fr: 'French', ja: 'Japanese', ar: 'Arabic', ko: 'Korean', id: 'Bahasa',
}

// Live = published, or scheduled with its publish time already passed. This
// makes scheduled publishing work without a cron job flipping the status.
function liveFilter(now = new Date()) {
  return {
    OR: [
      { status: 'PUBLISHED' as const },
      { status: 'SCHEDULED' as const, publishAt: { lte: now } },
    ],
  }
}

const seriesInclude = (now: Date) => ({
  genres: { include: { genre: true } },
  // First paywalled episode → the frontend's series-level "lock from" number
  episodes: {
    where: { ...liveFilter(now), accessType: { not: 'FREE' as const } },
    orderBy: { episodeNumber: 'asc' as const },
    take: 1,
    select: { episodeNumber: true, coinPrice: true },
  },
  _count: { select: { episodes: { where: liveFilter(now) } } },
}) satisfies Prisma.SeriesInclude

type SeriesRow = Prisma.SeriesGetPayload<{ include: ReturnType<typeof seriesInclude> }>

export interface SeriesDto {
  id: string
  title: string
  slug: string
  genre: string
  synopsis: string
  thumbnail_url: string
  hero_url?: string
  language: string
  total_episodes: number
  lock_from_episode: number
  coin_cost_per_episode: number
  is_published: boolean
  created_at: string
  is_new: boolean
  is_vip: boolean
  is_trending: boolean
  views: number
  rating: number
  tags: string[]
}

export interface EpisodeDto {
  id: string
  episode_number: number
  title: string
  description: string | null
  thumbnail_url: string | null
  duration_seconds: number
  access_type: 'FREE' | 'COIN_LOCKED' | 'VIP_ONLY'
  coin_price: number
}

export interface FeedSectionDto {
  id: string
  title: string
  subtitle?: string
  kind: 'standard' | 'ranked'
  series: SeriesDto[]
}

function toDto(row: SeriesRow, trendingIds: Set<string>, now: Date): SeriesDto {
  const liveAt = row.publishedAt ?? row.publishAt ?? row.createdAt
  const firstLocked = row.episodes[0]
  const total = row._count.episodes
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    genre: row.genres[0]?.genre.name ?? 'Drama',
    synopsis: row.synopsis ?? '',
    thumbnail_url: row.thumbnailUrl,
    hero_url: row.bannerUrl ?? undefined,
    language: LANGUAGE_NAMES[row.language] ?? row.language,
    total_episodes: total,
    lock_from_episode: firstLocked?.episodeNumber ?? total + 1,
    coin_cost_per_episode: firstLocked?.coinPrice ?? DEFAULT_COIN_PRICE,
    is_published: true,
    created_at: liveAt.toISOString().slice(0, 10),
    is_new: now.getTime() - liveAt.getTime() < NEW_WINDOW_DAYS * 86_400_000,
    is_vip: row.isVipExclusive,
    is_trending: trendingIds.has(row.id),
    views: row.viewCount,
    rating: Number(row.ratingAvg),
    tags: row.tags,
  }
}

// The catalog is small (hundreds of series, not millions), so most reads load
// the live set once and slice it in memory. When it grows, this is the spot
// to put the Redis cache from the Phase 2 plan.
async function loadLiveSeries(where: Prisma.SeriesWhereInput = {}, take?: number): Promise<SeriesDto[]> {
  const now = new Date()
  const [rows, trending] = await Promise.all([
    prisma.series.findMany({
      where: { ...liveFilter(now), ...where },
      include: seriesInclude(now),
      orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
      take,
    }),
    prisma.series.findMany({
      where: liveFilter(now),
      orderBy: { viewCount: 'desc' },
      take: TRENDING_COUNT,
      select: { id: true },
    }),
  ])
  const trendingIds = new Set(trending.map(t => t.id))
  return rows.map(r => toDto(r, trendingIds, now))
}

/** Live series for the given ids, returned in the same order as `ids` */
export async function loadSeriesByIds(ids: string[]): Promise<SeriesDto[]> {
  if (!ids.length) return []
  const rows = await loadLiveSeries({ id: { in: ids } })
  const byId = new Map(rows.map(s => [s.id, s]))
  return ids.map(id => byId.get(id)).filter((s): s is SeriesDto => !!s)
}

function genreWhere(genre: string): Prisma.SeriesWhereInput {
  return {
    genres: {
      some: { genre: { OR: [{ slug: genre.toLowerCase() }, { name: { equals: genre, mode: 'insensitive' } }] } },
    },
  }
}

export async function listSeries(opts: { genre?: string; q?: string; exclude?: string; limit?: number }) {
  const where: Prisma.SeriesWhereInput = { AND: [] }
  const and = where.AND as Prisma.SeriesWhereInput[]

  if (opts.genre && opts.genre !== 'All') and.push(genreWhere(opts.genre))
  if (opts.exclude) and.push({ id: { not: opts.exclude } })
  if (opts.q?.trim()) {
    const q = opts.q.trim()
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { synopsis: { contains: q, mode: 'insensitive' } },
        { genres: { some: { genre: { name: { contains: q, mode: 'insensitive' } } } } },
        // Postgres array matching is case-sensitive; tags are Title Case in
        // practice, so try the common casings of the query
        { tags: { hasSome: [q, q.toLowerCase(), q.replace(/\b\w/g, c => c.toUpperCase())] } },
      ],
    })
  }
  return loadLiveSeries(where, opts.limit)
}

export async function getHero(): Promise<SeriesDto[]> {
  const featured = await loadLiveSeries({ isFeatured: true }, 5)
  return featured.length ? featured : loadLiveSeries({}, 3)
}

export async function getFeed(): Promise<FeedSectionDto[]> {
  const all = await loadLiveSeries()
  const byRecent = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const sections: FeedSectionDto[] = [
    { id: 'trending', title: 'Trending Now', subtitle: "What everyone's watching", kind: 'ranked', series: all.slice(0, 6) },
    { id: 'new', title: 'New & Hot', subtitle: 'Fresh drops', kind: 'standard', series: byRecent.filter(s => s.is_new) },
    { id: 'vip', title: 'VIP Exclusives', subtitle: 'Unlimited with VIP', kind: 'standard', series: all.filter(s => s.is_vip) },
    { id: 'top-rated', title: 'Top Rated', subtitle: 'Highest rated on Dramatique', kind: 'standard', series: [...all].sort((a, b) => b.rating - a.rating) },
  ]

  // One row per genre that has enough titles to look like a row.
  // Personalised ordering (onboarding genre picks) plugs in here later.
  const byGenre = new Map<string, SeriesDto[]>()
  for (const s of all) byGenre.set(s.genre, [...(byGenre.get(s.genre) ?? []), s])
  for (const [genre, list] of byGenre) {
    if (list.length >= 2) {
      sections.push({ id: `genre-${genre.toLowerCase().replace(/\W+/g, '-')}`, title: genre, kind: 'standard', series: list })
    }
  }

  return sections.filter(s => s.series.length > 0)
}

export async function getSeriesBySlug(slug: string): Promise<(SeriesDto & { episodes: EpisodeDto[] }) | null> {
  const now = new Date()
  const [series] = await loadLiveSeries({ slug }, 1)
  if (!series) return null

  const episodes = await prisma.episode.findMany({
    where: { seriesId: series.id, ...liveFilter(now) },
    orderBy: { episodeNumber: 'asc' },
    // Video keys deliberately excluded — playback URLs come from a separate,
    // entitlement-checked endpoint.
    select: {
      id: true, episodeNumber: true, title: true, description: true,
      thumbnailUrl: true, durationSeconds: true, accessType: true, coinPrice: true,
    },
  })

  return {
    ...series,
    episodes: episodes.map(e => ({
      id: e.id,
      episode_number: e.episodeNumber,
      title: e.title,
      description: e.description,
      thumbnail_url: e.thumbnailUrl,
      duration_seconds: e.durationSeconds,
      access_type: e.accessType,
      coin_price: e.coinPrice,
    })),
  }
}

// Same-genre titles first, then fill with the most popular
export async function getRecommended(seriesId: string, limit = 6): Promise<SeriesDto[]> {
  const source = await prisma.series.findUnique({ where: { id: seriesId }, select: { genres: { select: { genreId: true } } } })
  const genreIds = source?.genres.map(g => g.genreId) ?? []

  const sameGenre = genreIds.length
    ? await loadLiveSeries({ id: { not: seriesId }, genres: { some: { genreId: { in: genreIds } } } }, limit)
    : []
  if (sameGenre.length >= limit) return sameGenre

  const seen = new Set([seriesId, ...sameGenre.map(s => s.id)])
  const fill = await loadLiveSeries({ id: { notIn: [...seen] } }, limit - sameGenre.length)
  return [...sameGenre, ...fill]
}

export async function listGenres() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    include: { genres: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } },
  })
  return categories.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    color: c.color,
    genres: c.genres.map(g => ({ id: g.id, name: g.name, slug: g.slug, icon: g.icon })),
  }))
}

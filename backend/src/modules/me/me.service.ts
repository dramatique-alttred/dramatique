import { prisma } from '../../config/prisma'
import { loadSeriesByIds } from '../catalog/catalog.service'
import { isUniqueViolation } from '../coins/ledger'

// ── My List ──────────────────────────────────────────

export async function getSavedList(userId: string) {
  const saved = await prisma.savedSeries.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { seriesId: true },
  })
  return loadSeriesByIds(saved.map(s => s.seriesId))
}

export async function getSavedIds(userId: string): Promise<string[]> {
  const saved = await prisma.savedSeries.findMany({ where: { userId }, select: { seriesId: true } })
  return saved.map(s => s.seriesId)
}

export async function toggleSaved(userId: string, seriesId: string): Promise<{ saved: boolean } | null> {
  if (!(await prisma.series.count({ where: { id: seriesId } }))) return null
  const where = { userId_seriesId: { userId, seriesId } }
  const existing = await prisma.savedSeries.findUnique({ where })
  if (existing) {
    await prisma.savedSeries.deleteMany({ where: { userId, seriesId } })
    return { saved: false }
  }
  try {
    await prisma.savedSeries.create({ data: { userId, seriesId } })
  } catch (err) {
    if (!isUniqueViolation(err)) throw err // double-tap: already saved
  }
  return { saved: true }
}

// ── Watch progress ──────────────────────────────────────────

/**
 * Durable progress write. Phase 2's Redis layer will sit in front of this
 * (hot writes every few seconds from the player → Redis → periodic flush).
 */
export async function saveProgress(userId: string, episodeId: string, positionSeconds: number, completed?: boolean) {
  const episode = await prisma.episode.findUnique({ where: { id: episodeId }, select: { seriesId: true, durationSeconds: true } })
  if (!episode) return null

  const position = Math.max(0, Math.min(Math.round(positionSeconds), episode.durationSeconds || Number.MAX_SAFE_INTEGER))
  // Treat the last ~5% as finished — credits/cliffhanger card
  const done = completed ?? (episode.durationSeconds > 0 && position >= episode.durationSeconds * 0.95)

  await prisma.watchProgress.upsert({
    where: { userId_episodeId: { userId, episodeId } },
    update: { lastPositionSeconds: position, completed: done },
    create: { userId, episodeId, seriesId: episode.seriesId, lastPositionSeconds: position, completed: done },
  })
  return { saved: true }
}

// Most recent episode per series, newest first
async function latestPerSeries(userId: string, limit: number) {
  return prisma.watchProgress.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    distinct: ['seriesId'],
    take: limit,
    include: { episode: { select: { episodeNumber: true, durationSeconds: true } } },
  })
}

function percent(position: number, duration: number): number {
  return duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0
}

export async function getContinueWatching(userId: string) {
  const rows = await latestPerSeries(userId, 20)
  const series = await loadSeriesByIds(rows.map(r => r.seriesId))
  const bySeries = new Map(rows.map(r => [r.seriesId, r]))

  return series
    .map(s => {
      const p = bySeries.get(s.id)!
      const finishedLast = p.completed && p.episode.episodeNumber >= s.total_episodes
      return finishedLast ? null : {
        ...s,
        // A completed episode means "up next" is the following one
        last_episode: p.completed ? p.episode.episodeNumber + 1 : p.episode.episodeNumber,
        progress: p.completed ? 0 : percent(p.lastPositionSeconds, p.episode.durationSeconds),
      }
    })
    .filter(Boolean)
}

export async function getWatchHistory(userId: string) {
  const rows = await latestPerSeries(userId, 50)
  const series = await loadSeriesByIds(rows.map(r => r.seriesId))
  const bySeries = new Map(rows.map(r => [r.seriesId, r]))
  return series.map(s => {
    const p = bySeries.get(s.id)!
    return {
      ...s,
      last_episode: p.episode.episodeNumber,
      progress: p.completed ? 100 : percent(p.lastPositionSeconds, p.episode.durationSeconds),
      watched_at: p.updatedAt.toISOString(),
    }
  })
}

export async function clearWatchHistory(userId: string) {
  await prisma.watchProgress.deleteMany({ where: { userId } })
}

// ── Per-series access (which episodes this user can play) ──────────────────

export async function getSeriesAccess(userId: string, isVip: boolean, seriesId: string) {
  const [unlocked, last] = await Promise.all([
    prisma.userUnlockedEpisode.findMany({
      where: { userId, episode: { seriesId } },
      select: { episodeId: true },
    }),
    prisma.watchProgress.findFirst({
      where: { userId, seriesId },
      orderBy: { updatedAt: 'desc' },
      include: { episode: { select: { episodeNumber: true } } },
    }),
  ])
  return {
    is_vip: isVip,
    unlocked_episode_ids: unlocked.map(u => u.episodeId),
    last_episode: last?.episode.episodeNumber ?? null,
  }
}

import { Router, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { authMiddleware, AuthedRequest } from '../../middleware/auth.middleware'
import { HttpError, UUID_RE } from '../../lib/http'
import { videoUrl, videoUrlTtlSeconds } from '../../lib/media-token'

/**
 * GET /api/v1/playback/:episodeId
 *
 * The one place that decides whether this viewer may watch an episode.
 * Free → anyone (guests included); COIN_LOCKED → unlocked or VIP;
 * VIP_ONLY → VIP; admins can preview anything, including drafts.
 *
 * The URL it returns carries a short-lived token scoped to this episode; the
 * media Worker (workers/media) refuses video requests without one, so a
 * shared link stops working when the token expires.
 */
export const playbackRouter = Router()
playbackRouter.use(authMiddleware)

const live = (now: Date) => ({ OR: [{ status: 'PUBLISHED' as const }, { status: 'SCHEDULED' as const, publishAt: { lte: now } }] })

playbackRouter.get('/:episodeId', async (req: AuthedRequest, res: Response) => {
  const episodeId = String(req.params.episodeId)
  if (!UUID_RE.test(episodeId)) throw new HttpError(404, 'Episode not found')
  const user = req.user!
  const isAdmin = user.role === 'ADMIN'
  const now = new Date()

  const ep = await prisma.episode.findFirst({
    where: { id: episodeId, ...(isAdmin ? {} : { ...live(now), series: live(now) }) },
    select: { id: true, accessType: true, coinPrice: true, videoStatus: true, hlsManifestKey: true, durationSeconds: true },
  })
  if (!ep) throw new HttpError(404, 'Episode not found')

  if (!isAdmin && ep.accessType !== 'FREE' && !user.isVip) {
    if (ep.accessType === 'VIP_ONLY') throw new HttpError(402, 'This episode is for VIP members', { code: 'VIP_REQUIRED' })
    const unlocked = await prisma.userUnlockedEpisode.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId } } })
    if (!unlocked) throw new HttpError(402, 'Unlock this episode to watch', { code: 'LOCKED', coin_price: ep.coinPrice })
  }

  if (ep.videoStatus !== 'READY' || !ep.hlsManifestKey) {
    throw new HttpError(409, 'This episode is not available to stream yet', { code: 'VIDEO_NOT_READY' })
  }

  // Resume where they left off, unless they finished it
  const progress = await prisma.watchProgress.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId } } })

  res.set('Cache-Control', 'private, no-store')
  res.json({
    episode_id: ep.id,
    url: videoUrl(ep.hlsManifestKey),
    url_expires_in_seconds: videoUrlTtlSeconds,
    duration_seconds: ep.durationSeconds,
    resume_position_seconds: progress && !progress.completed ? progress.lastPositionSeconds : 0,
  })
})

playbackRouter.use((err: Error, _req: AuthedRequest, res: Response, next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra })
  next(err)
})

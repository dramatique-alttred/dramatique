import { Router, Response } from 'express'
import { authMiddleware, AuthedRequest } from '../../middleware/auth.middleware'
import * as me from './me.service'

// Everything here is per-user; guests (anonymous Firebase sessions) are
// allowed so My List and progress work before sign-up and carry over after.
export const meRouter = Router()
meRouter.use(authMiddleware)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/v1/me/list */
meRouter.get('/list', async (req: AuthedRequest, res: Response) => {
  res.json(await me.getSavedList(req.user!.id))
})

/** GET /api/v1/me/list/ids — cheap lookup for bookmark icons */
meRouter.get('/list/ids', async (req: AuthedRequest, res: Response) => {
  res.json(await me.getSavedIds(req.user!.id))
})

/** POST /api/v1/me/list/:seriesId/toggle */
meRouter.post('/list/:seriesId/toggle', async (req: AuthedRequest, res: Response) => {
  const { seriesId } = req.params as { seriesId: string }
  if (!UUID_RE.test(seriesId)) return res.status(404).json({ error: 'Series not found' })
  const result = await me.toggleSaved(req.user!.id, seriesId)
  if (!result) return res.status(404).json({ error: 'Series not found' })
  res.json(result)
})

/** GET /api/v1/me/continue-watching */
meRouter.get('/continue-watching', async (req: AuthedRequest, res: Response) => {
  res.json(await me.getContinueWatching(req.user!.id))
})

/** GET /api/v1/me/history */
meRouter.get('/history', async (req: AuthedRequest, res: Response) => {
  res.json(await me.getWatchHistory(req.user!.id))
})

/** DELETE /api/v1/me/history */
meRouter.delete('/history', async (req: AuthedRequest, res: Response) => {
  await me.clearWatchHistory(req.user!.id)
  res.status(204).end()
})

/** PUT /api/v1/me/progress  { episodeId, positionSeconds, completed? } */
meRouter.put('/progress', async (req: AuthedRequest, res: Response) => {
  const { episodeId, positionSeconds, completed } = req.body ?? {}
  if (typeof episodeId !== 'string' || !UUID_RE.test(episodeId) || typeof positionSeconds !== 'number' || !Number.isFinite(positionSeconds)) {
    return res.status(400).json({ error: 'episodeId and positionSeconds are required' })
  }
  const result = await me.saveProgress(req.user!.id, episodeId, positionSeconds, typeof completed === 'boolean' ? completed : undefined)
  if (!result) return res.status(404).json({ error: 'Episode not found' })
  res.json(result)
})

/** GET /api/v1/me/series/:seriesId/access */
meRouter.get('/series/:seriesId/access', async (req: AuthedRequest, res: Response) => {
  const { seriesId } = req.params as { seriesId: string }
  if (!UUID_RE.test(seriesId)) return res.status(404).json({ error: 'Series not found' })
  res.json(await me.getSeriesAccess(req.user!.id, req.user!.isVip, seriesId))
})

import { Router, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { authMiddleware, requireAdmin, AuthedRequest } from '../../middleware/auth.middleware'
import { HttpError, UUID_RE } from '../../lib/http'
import { InsufficientCoinsError } from '../coins/ledger'
import * as content from './admin.content'
import * as taxonomy from './admin.taxonomy'
import * as users from './admin.users'
import * as reports from './admin.reports'
import * as settings from './admin.settings'

// Everything here is ADMIN-only, enforced server-side (the admin UI's own
// check is just UX). Mounted at /api/v1/admin.
export const adminRouter = Router()
adminRouter.use(authMiddleware, requireAdmin)

type Handler = (req: AuthedRequest) => Promise<unknown>
const route = (fn: Handler) => async (req: AuthedRequest, res: Response) => { res.json(await fn(req)) }

const body = (req: AuthedRequest) => (req.body ?? {}) as Record<string, unknown>
const q = (req: AuthedRequest) => req.query as Record<string, unknown>
const uuid = (req: AuthedRequest, name: string) => {
  const v = String(req.params[name])
  if (!UUID_RE.test(v)) throw new HttpError(404, 'Not found')
  return v
}
const param = (req: AuthedRequest, name: string) => String(req.params[name])
const adminId = (req: AuthedRequest) => req.user!.id

// ── Dashboard & analytics ──
adminRouter.get('/dashboard/stats', route(() => reports.getStats()))
adminRouter.get('/dashboard/revenue-chart', route(() => reports.getRevenueChart()))
adminRouter.get('/dashboard/top-series', route(() => reports.getTopSeries()))
adminRouter.get('/analytics/genres', route(() => reports.getGenrePerformance()))
adminRouter.get('/analytics/vip-split', route(() => reports.getVipSplit()))
adminRouter.get('/analytics/providers', route(() => reports.getProviderBreakdown()))
adminRouter.get('/analytics/revenue-by-pack', route(() => reports.getRevenueByPack()))
adminRouter.get('/analytics/revenue-by-gateway', route(() => reports.getRevenueByGateway()))
adminRouter.get('/transactions', route(req => reports.listTransactions(q(req))))

// ── Series & episodes ──
adminRouter.get('/series', route(req => content.listSeries(q(req))))
adminRouter.post('/series', route(req => content.createSeries(body(req))))
adminRouter.get('/series/:id', route(req => content.getSeries(uuid(req, 'id'))))
adminRouter.patch('/series/:id', route(req => content.updateSeries(uuid(req, 'id'), body(req))))
adminRouter.post('/series/:id/status', route(req => content.setSeriesStatus(uuid(req, 'id'), body(req))))
adminRouter.delete('/series/:id', route(req => content.deleteSeries(uuid(req, 'id'))))
adminRouter.get('/series/:id/episodes', route(req => content.listEpisodes(uuid(req, 'id'))))
adminRouter.post('/series/:id/episodes', route(req => content.createEpisode(uuid(req, 'id'), body(req))))
adminRouter.get('/episodes/:id', route(req => content.getEpisode(uuid(req, 'id'))))
adminRouter.patch('/episodes/:id', route(req => content.updateEpisode(uuid(req, 'id'), body(req))))
adminRouter.post('/episodes/:id/free', route(req => content.setEpisodeFree(uuid(req, 'id'), body(req))))
adminRouter.delete('/episodes/:id', route(req => content.deleteEpisode(uuid(req, 'id'))))

// ── Categories & genres ("subcategories") ──
adminRouter.get('/categories', route(() => taxonomy.listCategories()))
adminRouter.post('/categories', route(req => taxonomy.createCategory(body(req))))
adminRouter.patch('/categories/:id', route(req => taxonomy.updateCategory(param(req, 'id'), body(req))))
adminRouter.delete('/categories/:id', route(req => taxonomy.deleteCategory(param(req, 'id'))))
adminRouter.get('/genres', route(req => taxonomy.listGenres(typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined)))
adminRouter.post('/genres', route(req => taxonomy.createGenre(body(req))))
adminRouter.patch('/genres/:id', route(req => taxonomy.updateGenre(param(req, 'id'), body(req))))
adminRouter.delete('/genres/:id', route(req => taxonomy.deleteGenre(param(req, 'id'))))

// ── Users ──
adminRouter.get('/users', route(req => users.listUsers(q(req))))
adminRouter.get('/users/:id', route(req => users.getUser(uuid(req, 'id'))))
adminRouter.post('/users/:id/coins', route(req => users.adjustCoins(adminId(req), uuid(req, 'id'), body(req))))
adminRouter.post('/users/:id/vip', route(req => users.grantVip(uuid(req, 'id'), body(req))))
adminRouter.delete('/users/:id/vip', route(req => users.revokeVip(uuid(req, 'id'))))
adminRouter.post('/users/:id/ban', route(req => users.setBanned(adminId(req), uuid(req, 'id'), body(req))))
adminRouter.get('/users/:id/ledger', route(req => users.getLedger(uuid(req, 'id'))))
adminRouter.get('/users/:id/history', route(req => users.getWatchHistory(uuid(req, 'id'))))

// ── Settings & notifications ──
adminRouter.get('/settings', route(() => settings.getSettings()))
adminRouter.put('/settings', route(req => settings.updateSettings(body(req))))
adminRouter.get('/notifications', route(() => settings.listNotifications()))
adminRouter.get('/notifications/reach', route(async req => ({ reach: await settings.estimateReach(req.query.segment) })))
adminRouter.post('/notifications', route(req => settings.sendNotification(adminId(req), body(req))))

// Domain + database errors → clean JSON the admin UI can show
adminRouter.use((err: Error, _req: AuthedRequest, res: Response, next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra })
  if (err instanceof InsufficientCoinsError) {
    return res.status(402).json({ error: `User only has ${err.balance} coins`, code: 'INSUFFICIENT_COINS' })
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value'
      const friendly = target.includes('slug') ? 'That slug is already taken'
        : target.includes('episode_number') ? 'That episode number already exists in this series'
        : target.includes('name') ? 'That name is already taken'
        : `Duplicate ${target}`
      return res.status(409).json({ error: friendly })
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' })
  }
  next(err)
})

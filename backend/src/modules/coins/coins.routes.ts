import { Router, Response, NextFunction } from 'express'
import { authMiddleware, AuthedRequest } from '../../middleware/auth.middleware'
import { InsufficientCoinsError } from './ledger'
import * as coins from './coins.service'

export const coinsRouter = Router()
coinsRouter.use(authMiddleware)

/** GET /api/v1/coins/balance */
coinsRouter.get('/balance', async (req: AuthedRequest, res: Response) => {
  res.json({ balance: await coins.getBalance(req.user!.id) })
})

/** GET /api/v1/coins/transactions */
coinsRouter.get('/transactions', async (req: AuthedRequest, res: Response) => {
  res.json(await coins.listTransactions(req.user!.id))
})

/** POST /api/v1/coins/unlock  { episodeId } */
coinsRouter.post('/unlock', async (req: AuthedRequest, res: Response) => {
  const episodeId = req.body?.episodeId
  if (typeof episodeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(episodeId)) {
    return res.status(400).json({ error: 'episodeId is required' })
  }
  res.json(await coins.unlockEpisode(req.user!, episodeId))
})

/** GET /api/v1/coins/daily-reward — today's status + streak */
coinsRouter.get('/daily-reward', async (req: AuthedRequest, res: Response) => {
  res.json(await coins.getDailyRewardStatus(req.user!.id))
})

/** POST /api/v1/coins/daily-reward — claim today's coins */
coinsRouter.post('/daily-reward', async (req: AuthedRequest, res: Response) => {
  res.json(await coins.claimDailyReward(req.user!))
})

// Turn domain errors into clean HTTP responses
coinsRouter.use((err: Error, _req: AuthedRequest, res: Response, next: NextFunction) => {
  if (err instanceof InsufficientCoinsError) {
    return res.status(402).json({ error: 'Insufficient coins', code: 'INSUFFICIENT_COINS', needed: err.needed, balance: err.balance })
  }
  if (err instanceof coins.HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra })
  }
  next(err)
})

import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { authRouter } from './modules/auth/auth.routes'
import { catalogRouter } from './modules/catalog/catalog.routes'
import { meRouter } from './modules/me/me.routes'
import { coinsRouter } from './modules/coins/coins.routes'
import { adminRouter } from './modules/admin/admin.routes'
import { playbackRouter } from './modules/video/playback.routes'
import { resumePendingJobs } from './modules/video/video.service'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/catalog', catalogRouter)
app.use('/api/v1/me', meRouter)
app.use('/api/v1/coins', coinsRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/playback', playbackRouter)

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// Express 5 forwards rejected async handlers here — never leak internals to clients
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  resumePendingJobs().catch(err => console.error('[video] could not resume jobs:', err))
})

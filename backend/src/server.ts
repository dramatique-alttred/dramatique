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
app.set('trust proxy', 1) // behind DigitalOcean's load balancer: real client IP + https

// CORS_ORIGIN: comma-separated origins; "*" matches one DNS label, so Vercel
// preview URLs can be allowed with e.g. https://dramatique-*-dramatique-team.vercel.app
const originPattern = (origin: string) => {
  const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '[a-z0-9-]+')}$`, 'i')
}
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean).map(originPattern)

app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.some(re => re.test(origin))), credentials: true }))
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
const server = app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`)
  resumePendingJobs().catch(err => console.error('[video] could not resume jobs:', err))
})

// Deploys stop the old container with SIGTERM: finish in-flight requests,
// then exit. An interrupted transcode stays PROCESSING in the database and is
// picked up again by resumePendingJobs() on the next boot.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`[server] ${signal} received, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 10_000).unref()
  })
}

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { authRouter } from './modules/auth/auth.routes'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/v1/auth', authRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`))

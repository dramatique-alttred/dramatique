import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { verifyFirebase } from './auth.controller'

export const authRouter = Router()

authRouter.post('/verify-firebase', authMiddleware, verifyFirebase)

import { Request, Response, NextFunction } from 'express'
import { firebaseAuth } from '../config/firebase'
import { prisma } from '../config/prisma'

export interface AuthedRequest extends Request {
  user?: {
    id: string
    firebaseUid: string
    role: 'USER' | 'ADMIN'
    isVip: boolean
  }
}

/**
 * Verifies the Firebase ID token on every protected request, then resolves
 * it to the matching MySQL `users` row (creating one on first sign-in).
 * Downstream handlers read `req.user` instead of touching Firebase directly.
 */
export async function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }
  if (!firebaseAuth) {
    return res.status(500).json({ error: 'Firebase Admin not configured on server' })
  }

  const idToken = header.slice('Bearer '.length)

  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken)

    let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? null,
          phone: decoded.phone_number ?? null,
          wallet: { create: { balance: 0 } },
        },
      })
    }

    req.user = { id: user.id, firebaseUid: user.firebaseUid, role: user.role, isVip: user.isVip }
    next()
  } catch (err) {
    console.error('[auth] token verification failed:', err)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

import { randomBytes } from 'node:crypto'
import { Request, Response, NextFunction } from 'express'
import { firebaseAuth } from '../config/firebase'
import { prisma } from '../config/prisma'

export interface AuthedRequest extends Request {
  user?: {
    id: string
    firebaseUid: string
    role: 'USER' | 'ADMIN'
    isGuest: boolean
    isVip: boolean
  }
}

// No 0/O/1/I — referral codes get read aloud and typed by hand
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateReferralCode(length = 8): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, b => REFERRAL_ALPHABET[b % REFERRAL_ALPHABET.length]).join('')
}

export function isVipActive(vipUntil: Date | null): boolean {
  return !!vipUntil && vipUntil.getTime() > Date.now()
}

/**
 * Verifies the Firebase ID token on every protected request, then resolves
 * it to the matching Postgres `users` row (creating one on first sign-in).
 * Anonymous Firebase sessions become guest users; when a guest later links
 * Google/phone/email, Firebase keeps the same uid and we flip isGuest here.
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
    const isGuest = decoded.firebase.sign_in_provider === 'anonymous'
    const email = decoded.email ?? null
    const phone = decoded.phone_number ?? null

    // upsert so two parallel first requests can't both try to insert
    let user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {},
      create: {
        firebaseUid: decoded.uid,
        isGuest,
        email,
        phone,
        displayName: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
        referralCode: generateReferralCode(),
        wallet: { create: { balance: 0 } },
      },
    })

    if (user.isGuest && !isGuest) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          isGuest: false,
          email: user.email ?? email,
          phone: user.phone ?? phone,
          displayName: user.displayName ?? decoded.name ?? null,
          avatarUrl: user.avatarUrl ?? decoded.picture ?? null,
        },
      })
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is suspended' })
    }

    req.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      role: user.role,
      isGuest: user.isGuest,
      isVip: isVipActive(user.vipUntil),
    }
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

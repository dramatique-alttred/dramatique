import { Response } from 'express'
import { AuthedRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../config/prisma'

/**
 * POST /api/v1/auth/verify-firebase
 * authMiddleware has already verified the token and resolved/created the
 * user row — this just returns that user's profile + wallet balance so the
 * frontend can hydrate its auth store right after login.
 */
export async function verifyFirebase(req: AuthedRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { wallet: true },
  })
  if (!user) return res.status(404).json({ error: 'User not found' })

  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVip: user.isVip,
    vipExpiresAt: user.vipExpiresAt,
    coins: user.wallet?.balance ?? 0,
  })
}

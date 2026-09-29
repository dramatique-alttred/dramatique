import { Response } from 'express'
import { AuthedRequest, isVipActive } from '../../middleware/auth.middleware'
import { prisma } from '../../config/prisma'
import { grantWelcomeBonus } from '../coins/ledger'

/**
 * POST /api/v1/auth/verify-firebase
 * authMiddleware has already verified the token and resolved/created the
 * user row — this just returns that user's profile + wallet balance so the
 * frontend can hydrate its auth store right after login.
 */
export async function verifyFirebase(req: AuthedRequest, res: Response) {
  // UX flow: "Account Created → Welcome Bonus". Runs on every login but pays
  // out once (idempotency key), including when a guest upgrades their account.
  const welcomeBonusGranted = req.user!.isGuest ? false : await grantWelcomeBonus(req.user!.id)

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { lastLoginAt: new Date() },
    include: { wallet: true },
  })

  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isGuest: user.isGuest,
    isVip: isVipActive(user.vipUntil),
    vipExpiresAt: user.vipUntil,
    referralCode: user.referralCode,
    coins: user.wallet?.balance ?? 0,
    welcomeBonusGranted,
  })
}

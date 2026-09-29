import { prisma } from '../../config/prisma'
import { HttpError } from '../../lib/http'
import { applyLedgerEntry, getNumberSetting, isUniqueViolation } from './ledger'

export { HttpError }

// ── Balance & history ──────────────────────────────────────────

export async function getBalance(userId: string): Promise<number> {
  const wallet = await prisma.coinWallet.findUnique({ where: { userId } })
  return wallet?.balance ?? 0
}

export async function listTransactions(userId: string, limit = 50) {
  const rows = await prisma.coinTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map(t => ({
    id: t.id,
    type: t.type,
    description: t.description,
    amount: t.amount,
    balance_after: t.balanceAfter,
    created_at: t.createdAt.toISOString(),
  }))
}

// ── Episode unlock ──────────────────────────────────────────

/**
 * Unlocks one episode with coins. Idempotent: FREE episodes, VIP users and
 * already-unlocked episodes succeed without charging. The debit, the unlock
 * row and the ledger entry commit together or not at all; a double-tap race
 * hits the (user, episode) unique index and rolls the second debit back.
 */
export async function unlockEpisode(user: { id: string; isVip: boolean }, episodeId: string) {
  const now = new Date()
  const episode = await prisma.episode.findFirst({
    where: {
      id: episodeId,
      OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishAt: { lte: now } }],
      series: { OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishAt: { lte: now } }] },
    },
    include: { series: { select: { title: true } } },
  })
  if (!episode) throw new HttpError(404, 'Episode not found')

  const free = { unlocked: true, charged: 0, balance: await getBalance(user.id) }
  if (episode.accessType === 'FREE') return free
  if (user.isVip) return free
  if (episode.accessType === 'VIP_ONLY') throw new HttpError(403, 'This episode is for VIP members only', { code: 'VIP_REQUIRED' })

  const existing = await prisma.userUnlockedEpisode.findUnique({
    where: { userId_episodeId: { userId: user.id, episodeId } },
  })
  if (existing) return free

  try {
    const balance = await prisma.$transaction(async tx => {
      await tx.userUnlockedEpisode.create({
        data: { userId: user.id, episodeId, method: 'COINS', coinsSpent: episode.coinPrice },
      })
      return applyLedgerEntry(tx, {
        userId: user.id,
        amount: -episode.coinPrice,
        type: 'EPISODE_UNLOCK',
        description: `${episode.series.title} — Episode ${episode.episodeNumber}`,
        referenceId: episode.id,
      })
    })
    return { unlocked: true, charged: episode.coinPrice, balance }
  } catch (err) {
    // Lost a double-tap race — the other request already unlocked and charged
    if (isUniqueViolation(err)) return { ...free, balance: await getBalance(user.id) }
    throw err
  }
}

// ── Daily check-in ──────────────────────────────────────────

// Audience is India-first, so "a day" rolls over at IST midnight
function istDate(offsetDays = 0): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
    .format(new Date(Date.now() + offsetDays * 86_400_000))
  return new Date(`${ymd}T00:00:00Z`)
}

export async function getDailyRewardStatus(userId: string) {
  const [today, latest, reward] = await Promise.all([
    prisma.dailyCheckIn.findUnique({ where: { userId_checkInDate: { userId, checkInDate: istDate() } } }),
    prisma.dailyCheckIn.findFirst({ where: { userId }, orderBy: { checkInDate: 'desc' } }),
    getNumberSetting('coins.daily_reward', 5),
  ])
  // Streak survives only if the last check-in was today or yesterday
  const alive = latest && latest.checkInDate.getTime() >= istDate(-1).getTime()
  return { claimed_today: !!today, streak: alive ? latest!.streak : 0, reward }
}

export async function claimDailyReward(user: { id: string; isGuest: boolean }) {
  // Guests are free to create, so free coins would be farmable — require an account
  if (user.isGuest) throw new HttpError(403, 'Sign in to claim daily rewards', { code: 'ACCOUNT_REQUIRED' })

  const reward = await getNumberSetting('coins.daily_reward', 5)
  const today = istDate()
  const yesterday = await prisma.dailyCheckIn.findUnique({
    where: { userId_checkInDate: { userId: user.id, checkInDate: istDate(-1) } },
  })
  const streak = (yesterday?.streak ?? 0) + 1

  try {
    const balance = await prisma.$transaction(async tx => {
      const checkIn = await tx.dailyCheckIn.create({
        data: { userId: user.id, checkInDate: today, streak, coinsAwarded: reward },
      })
      return applyLedgerEntry(tx, {
        userId: user.id,
        amount: reward,
        type: 'DAILY_REWARD',
        description: `Daily check-in (day ${streak})`,
        referenceId: checkIn.id,
      })
    })
    return { coins: reward, streak, balance }
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'Already claimed today', { code: 'ALREADY_CLAIMED' })
    throw err
  }
}

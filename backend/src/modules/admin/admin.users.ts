import { Prisma, CoinTransactionType } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { HttpError } from '../../lib/http'
import { isVipActive } from '../../middleware/auth.middleware'
import { applyLedgerEntry } from '../coins/ledger'
import { str, int, bool, date, paging } from './validate'

type Body = Record<string, unknown>

const userInclude = { wallet: true } satisfies Prisma.UserInclude
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>

// Real money in: successful payment orders, in rupees (0 until payments land)
async function spentByUser(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map()
  const rows = await prisma.paymentOrder.groupBy({
    by: ['userId'],
    where: { userId: { in: ids }, status: 'SUCCESS', currency: 'INR' },
    _sum: { amountMinor: true },
  })
  return new Map(rows.map(r => [r.userId, (r._sum.amountMinor ?? 0) / 100]))
}

function toAdminUser(u: UserRow, spent = 0) {
  return {
    id: u.id,
    display_name: u.displayName || u.email?.split('@')[0] || (u.isGuest ? 'Guest' : 'User'),
    email: u.email ?? '',
    phone: u.phone ?? '',
    avatar_url: u.avatarUrl ?? '',
    role: u.role,
    is_guest: u.isGuest,
    coins: u.wallet?.balance ?? 0,
    is_vip: isVipActive(u.vipUntil),
    vip_until: u.vipUntil ? u.vipUntil.toISOString().slice(0, 10) : null,
    total_spent: spent,
    referral_code: u.referralCode,
    joined: u.createdAt.toISOString().slice(0, 10),
    last_login: u.lastLoginAt?.toISOString() ?? null,
    status: u.status.toLowerCase(),
  }
}

export async function listUsers(query: Record<string, unknown>) {
  const { page, pageSize, skip } = paging(query)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const segment = typeof query.segment === 'string' ? query.segment : 'all'
  const now = new Date()

  const where: Prisma.UserWhereInput = {
    // Anonymous guest sessions vastly outnumber accounts — hidden unless asked for
    isGuest: segment === 'guests',
    ...(segment === 'vip' && { vipUntil: { gt: now } }),
    ...(segment === 'non-vip' && { OR: [{ vipUntil: null }, { vipUntil: { lte: now } }] }),
    ...(search && {
      AND: [{
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { referralCode: { equals: search.toUpperCase() } },
        ],
      }],
    }),
  }
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, include: userInclude, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    prisma.user.count({ where }),
  ])
  const spent = await spentByUser(rows.map(r => r.id))
  return { items: rows.map(r => toAdminUser(r, spent.get(r.id))), total, page, pageSize }
}

async function loadUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, include: userInclude })
  if (!u) throw new HttpError(404, 'User not found')
  return u
}

export async function getUser(id: string) {
  const u = await loadUser(id)
  const spent = await spentByUser([id])
  return toAdminUser(u, spent.get(id))
}

/** Manual credit/debit (refunds, goodwill, corrections) — goes through the ledger like everything else */
export async function adjustCoins(adminId: string, id: string, body: Body) {
  const amount = int(body, 'amount', { required: true, min: -100000, max: 100000, label: 'Amount' })!
  if (amount === 0) throw new HttpError(400, 'Amount must not be zero')
  const reason = str(body, 'reason', { required: true, max: 200, label: 'Reason' })!
  await loadUser(id)

  await prisma.$transaction(tx => applyLedgerEntry(tx, {
    userId: id,
    amount,
    type: 'ADMIN_ADJUSTMENT',
    description: reason,
    referenceId: `admin:${adminId}`,
  }))
  return getUser(id)
}

// Admin-granted VIP is a plain entitlement date, not a billed subscription
export async function grantVip(id: string, body: Body) {
  const until = date(body, 'until', 'VIP end date')
  if (!until || until.getTime() <= Date.now()) throw new HttpError(400, 'VIP end date must be in the future')
  await prisma.user.update({ where: { id }, data: { vipUntil: until } })
  return getUser(id)
}

export async function revokeVip(id: string) {
  await prisma.user.update({ where: { id }, data: { vipUntil: null } })
  return getUser(id)
}

export async function setBanned(adminId: string, id: string, body: Body) {
  const banned = bool(body, 'banned')
  if (banned === undefined) throw new HttpError(400, 'banned is required')
  if (id === adminId) throw new HttpError(400, "You can't ban your own account")
  const target = await loadUser(id)
  if (banned && target.role === 'ADMIN') throw new HttpError(400, 'Remove admin access before banning this account')
  await prisma.user.update({ where: { id }, data: { status: banned ? 'BANNED' : 'ACTIVE' } })
  return getUser(id)
}

// Ledger → the admin page's icon buckets
const SOURCE: Record<CoinTransactionType, string> = {
  PURCHASE: 'purchase', EPISODE_UNLOCK: 'unlock', DAILY_REWARD: 'checkin', REFERRAL_BONUS: 'referral',
  WELCOME_BONUS: 'bonus', AD_REWARD: 'ad', ADMIN_ADJUSTMENT: 'admin', REFUND: 'refund',
}

export async function getLedger(id: string) {
  const rows = await prisma.coinTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 })
  return rows.map(t => ({
    source: SOURCE[t.type],
    desc: t.description ?? t.type,
    amount: t.amount,
    balance_after: t.balanceAfter,
    date: t.createdAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  }))
}

export async function getWatchHistory(id: string) {
  const rows = await prisma.watchProgress.findMany({
    where: { userId: id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { series: { select: { title: true } }, episode: { select: { episodeNumber: true } } },
  })
  return rows.map(r => ({
    series: r.series.title,
    ep: r.episode.episodeNumber,
    when: r.updatedAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    completed: r.completed,
  }))
}

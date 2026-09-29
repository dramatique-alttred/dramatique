import { Prisma, PaymentStatus, PaymentGateway, PaymentType } from '@prisma/client'
import { prisma } from '../../config/prisma'

// All "today / this week" numbers use IST calendar days (India-first audience)
function istDayStart(daysAgo = 0): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
    .format(new Date(Date.now() - daysAgo * 86_400_000))
  return new Date(`${ymd}T00:00:00+05:30`)
}

const rupees = (minor: number | null | undefined) => Math.round((minor ?? 0) / 100)
const realUsers = { isGuest: false } satisfies Prisma.UserWhereInput

async function revenueSince(since: Date) {
  const r = await prisma.paymentOrder.aggregate({
    where: { status: 'SUCCESS', currency: 'INR', createdAt: { gte: since } },
    _sum: { amountMinor: true },
  })
  return rupees(r._sum.amountMinor)
}

// ── DASHBOARD ──────────────────────────────────────────

export async function getStats() {
  const today = istDayStart(0)
  const weekAgo = istDayStart(6)
  const monthAgo = istDayStart(29)
  const now = new Date()

  const [
    usersTotal, usersToday, usersWeek,
    seriesTotal, seriesPublished, seriesDraft, episodesTotal,
    revToday, revWeek, revMonth, vipActive, coinTxToday,
  ] = await Promise.all([
    prisma.user.count({ where: realUsers }),
    prisma.user.count({ where: { ...realUsers, createdAt: { gte: today } } }),
    prisma.user.count({ where: { ...realUsers, createdAt: { gte: weekAgo } } }),
    prisma.series.count(),
    prisma.series.count({ where: { status: 'PUBLISHED' } }),
    prisma.series.count({ where: { status: 'DRAFT' } }),
    prisma.episode.count(),
    revenueSince(today), revenueSince(weekAgo), revenueSince(monthAgo),
    prisma.user.count({ where: { vipUntil: { gt: now } } }),
    prisma.coinTransaction.count({ where: { createdAt: { gte: today } } }),
  ])

  return {
    users: { total: usersTotal, today: usersToday, week: usersWeek },
    series: { total: seriesTotal, published: seriesPublished, draft: seriesDraft },
    episodes: { total: episodesTotal },
    revenue: { today: revToday, week: revWeek, month: revMonth },
    vip: { active: vipActive },
    // Need playback/paywall/ad event tracking (Phase 4 analytics) — not measured yet
    paywallHitRate: null,
    adUnlockRate: null,
    coinTransactions: { today: coinTxToday },
  }
}

/** Last 30 IST days: rupee revenue + new (non-guest) sign-ups per day */
export async function getRevenueChart() {
  const since = istDayStart(29)
  const [revenue, signups] = await Promise.all([
    prisma.$queryRaw<{ d: string; minor: bigint }[]>`
      SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS d,
             SUM(amount_minor)::bigint AS minor
      FROM payment_orders
      WHERE status = 'SUCCESS' AND currency = 'INR' AND created_at >= ${since}
      GROUP BY 1`,
    prisma.$queryRaw<{ d: string; n: bigint }[]>`
      SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS d,
             COUNT(*)::bigint AS n
      FROM users
      WHERE is_guest = false AND created_at >= ${since}
      GROUP BY 1`,
  ])
  const revByDay = new Map(revenue.map(r => [r.d, rupees(Number(r.minor))]))
  const usersByDay = new Map(signups.map(r => [r.d, Number(r.n)]))

  return Array.from({ length: 30 }, (_, i) => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(istDayStart(29 - i))
    return { day: i + 1, date, revenue: revByDay.get(date) ?? 0, users: usersByDay.get(date) ?? 0 }
  })
}

export async function getTopSeries() {
  const top = await prisma.series.findMany({ orderBy: { viewCount: 'desc' }, take: 5, select: { id: true, title: true, viewCount: true } })
  const coins = top.length ? await prisma.$queryRaw<{ series_id: string; coins: bigint }[]>`
    SELECT e.series_id, COALESCE(SUM(u.coins_spent), 0)::bigint AS coins
    FROM user_unlocked_episodes u JOIN episodes e ON e.id = u.episode_id
    WHERE e.series_id = ANY(${top.map(t => t.id)}::uuid[])
    GROUP BY e.series_id` : []
  const bySeries = new Map(coins.map(c => [c.series_id, Number(c.coins)]))
  return top.map(t => ({ title: t.title, views: t.viewCount, revenue: bySeries.get(t.id) ?? 0 }))
}

// ── TRANSACTIONS (real-money payment orders) ──────────────────────────

export async function listTransactions(query: Record<string, unknown>) {
  const s = (k: string) => (typeof query[k] === 'string' && query[k] !== 'all' ? String(query[k]) : undefined)
  const status = s('status')?.toUpperCase() as PaymentStatus | undefined
  const gateway = s('gateway')?.toUpperCase() as PaymentGateway | undefined
  const type = s('type') === 'vip' ? 'SUBSCRIPTION' : s('type') === 'purchase' ? 'COIN_PACK' : undefined
  const search = s('search')?.trim()

  const rows = await prisma.paymentOrder.findMany({
    where: {
      ...(status && Object.values(PaymentStatus).includes(status) && { status }),
      ...(gateway && Object.values(PaymentGateway).includes(gateway) && { gateway }),
      ...(type && { type: type as PaymentType }),
      ...(search && {
        OR: [
          { gatewayOrderId: { contains: search } },
          { user: { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } },
        ],
      }),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { displayName: true, email: true } }, coinPack: true, plan: true },
  })

  return rows.map(o => ({
    id: o.gatewayOrderId,
    user_name: o.user.displayName || o.user.email || 'User',
    type: o.type === 'SUBSCRIPTION' ? 'vip' : 'purchase',
    desc: o.type === 'SUBSCRIPTION' ? o.plan?.name ?? 'VIP' : `${o.coinPack?.coins ?? o.coinsCredited ?? 0} Coins Pack`,
    amount_inr: o.currency === 'INR' ? rupees(o.amountMinor) : 0,
    coins: o.coinsCredited ?? 0,
    gateway: o.gateway.toLowerCase(),
    status: o.status.toLowerCase(),
    date: o.createdAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  }))
}

// ── ANALYTICS ──────────────────────────────────────────

const withPercent = <T extends Record<string, unknown>>(rows: T[], key: keyof T) => {
  const total = rows.reduce((a, r) => a + Number(r[key]), 0) || 1
  return rows.map(r => ({ ...r, percent: Math.round((Number(r[key]) / total) * 100) }))
}

export async function getGenrePerformance() {
  const rows = await prisma.series.groupBy({ by: ['categoryId'], _sum: { viewCount: true } })
  const cats = await prisma.category.findMany({ select: { id: true, name: true } })
  const name = new Map(cats.map(c => [c.id, c.name]))
  return withPercent(
    rows.map(r => ({ genre: r.categoryId ? name.get(r.categoryId) ?? 'Other' : 'Uncategorised', views: r._sum.viewCount ?? 0 }))
      .sort((a, b) => b.views - a.views),
    'views',
  )
}

export async function getVipSplit() {
  const [total, vip] = await Promise.all([
    prisma.user.count({ where: realUsers }),
    prisma.user.count({ where: { ...realUsers, vipUntil: { gt: new Date() } } }),
  ])
  return { vip, free: total - vip, total }
}

export async function getProviderBreakdown() {
  const rows = await prisma.paymentOrder.groupBy({ by: ['gateway'], _count: { _all: true } })
  return rows.map(r => ({ provider: r.gateway.toLowerCase(), count: r._count._all }))
}

export async function getRevenueByPack() {
  const rows = await prisma.paymentOrder.groupBy({
    by: ['coinPackId'],
    where: { status: 'SUCCESS', type: 'COIN_PACK', currency: 'INR' },
    _sum: { amountMinor: true },
  })
  const packs = await prisma.coinPack.findMany()
  const label = new Map(packs.map(p => [p.id, `${p.coins} Coins Pack`]))
  return withPercent(rows.map(r => ({ pack: (r.coinPackId && label.get(r.coinPackId)) || 'Other', revenue: rupees(r._sum.amountMinor) })), 'revenue')
}

export async function getRevenueByGateway() {
  const rows = await prisma.paymentOrder.groupBy({
    by: ['gateway'],
    where: { status: 'SUCCESS', currency: 'INR' },
    _sum: { amountMinor: true },
  })
  return withPercent(rows.map(r => ({ gateway: r.gateway.toLowerCase(), amount: rupees(r._sum.amountMinor) })), 'amount')
}

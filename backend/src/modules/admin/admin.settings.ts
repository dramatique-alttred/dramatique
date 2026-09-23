import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { HttpError } from '../../lib/http'
import { str, int, bool } from './validate'

type Body = Record<string, unknown>

// Admin settings form field → app_settings key. The coin/ad keys are the
// same ones the backend reads at runtime (ledger.getNumberSetting), so a
// change here takes effect on the next request — no deploy.
const FIELDS = {
  app_name:            { key: 'app.name',               kind: 'text',   fallback: 'Dramatique' },
  tagline:             { key: 'app.tagline',            kind: 'text',   fallback: 'Short dramas. Big emotions.' },
  support_email:       { key: 'app.support_email',      kind: 'email',  fallback: '' },
  maintenance_mode:    { key: 'app.maintenance_mode',   kind: 'bool',   fallback: false },
  instagram:           { key: 'social.instagram',       kind: 'url',    fallback: '' },
  tiktok:              { key: 'social.tiktok',          kind: 'url',    fallback: '' },
  youtube:             { key: 'social.youtube',         kind: 'url',    fallback: '' },
  free_episodes:       { key: 'episodes.default_free',  kind: 'int',    fallback: 3 },
  ad_unlock_count:     { key: 'ads.unlock_count',       kind: 'int',    fallback: 2 },
  daily_ad_limit:      { key: 'ads.daily_limit',        kind: 'int',    fallback: 3 },
  daily_checkin_coins: { key: 'coins.daily_reward',     kind: 'int',    fallback: 5 },
  referrer_coins:      { key: 'coins.referral_reward',  kind: 'int',    fallback: 30 },
  referred_coins:      { key: 'coins.referred_reward',  kind: 'int',    fallback: 10 },
  welcome_bonus:       { key: 'coins.welcome_bonus',    kind: 'int',    fallback: 10 },
} as const

type Field = keyof typeof FIELDS

export async function getSettings() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.values(FIELDS).map(f => f.key) } } })
  const stored = new Map(rows.map(r => [r.key, r.value]))
  return Object.fromEntries(
    Object.entries(FIELDS).map(([field, f]) => [field, stored.has(f.key) ? stored.get(f.key) : f.fallback]),
  )
}

function parseField(body: Body, field: Field): Prisma.InputJsonValue {
  const { kind } = FIELDS[field]
  switch (kind) {
    case 'int': return int(body, field, { required: true, min: 0, max: 100000 })!
    case 'bool': {
      const b = bool(body, field)
      if (b === undefined) throw new HttpError(400, `${field} is required`)
      return b
    }
    case 'email': return str(body, field, { max: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, label: 'Support email' }) ?? ''
    case 'url': return str(body, field, { max: 300, pattern: /^https?:\/\/\S+$/, label: field }) ?? ''
    default: return str(body, field, { max: 200 }) ?? ''
  }
}

export async function updateSettings(body: Body) {
  const updates = (Object.keys(FIELDS) as Field[])
    .filter(field => body[field] !== undefined)
    .map(field => ({ key: FIELDS[field].key, value: parseField(body, field) }))

  await prisma.$transaction(updates.map(({ key, value }) =>
    prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } })))
  return getSettings()
}

// ── NOTIFICATIONS ──────────────────────────────────────────

const AUDIENCES = ['all', 'vip', 'non-vip'] as const
type Audience = typeof AUDIENCES[number]

function audience(v: unknown): Audience {
  const a = String(v ?? 'all') as Audience
  if (!AUDIENCES.includes(a)) throw new HttpError(400, 'Target must be all, vip or non-vip')
  return a
}

export async function estimateReach(segment: unknown): Promise<number> {
  const now = new Date()
  const a = audience(segment)
  return prisma.user.count({
    where: {
      isGuest: false,
      status: 'ACTIVE',
      ...(a === 'vip' && { vipUntil: { gt: now } }),
      ...(a === 'non-vip' && { OR: [{ vipUntil: null }, { vipUntil: { lte: now } }] }),
    },
  })
}

export async function listNotifications() {
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  return rows.map(n => ({
    title: n.title,
    body: n.body,
    target: n.audience,
    deep_link: n.deepLink ?? '',
    sent: (n.sentAt ?? n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    reach: n.recipients,
  }))
}

/**
 * Records the campaign. Actual delivery to devices needs Firebase Cloud
 * Messaging (Phase 5 in the UX flow) — until then this is a log only.
 */
export async function sendNotification(adminId: string, body: Body) {
  const title = str(body, 'title', { required: true, max: 150, label: 'Title' })!
  const text = str(body, 'body', { required: true, max: 500, label: 'Message' })!
  const target = audience(body.target_segment)
  const deepLink = str(body, 'deep_link', { max: 500 }) || null
  if (deepLink && !deepLink.startsWith('/')) throw new HttpError(400, 'Deep link must be an in-app path like /series/forbidden-ceo')

  const recipients = await estimateReach(target)
  await prisma.notification.create({
    data: { type: 'PROMO', title, body: text, deepLink, audience: target, sentById: adminId, sentAt: new Date(), recipients },
  })
  return { recipients, delivered: false }
}

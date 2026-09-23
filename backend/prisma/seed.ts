/**
 * Seeds reference data + the demo catalog the frontend mocks currently show,
 * so the UI looks the same once src/lib/api.ts is switched to the real API.
 *
 * Idempotent: safe to re-run (`npm run db:seed`) — everything is upserted by
 * a natural key, and episodes use skipDuplicates.
 */
import { Prisma, PrismaClient, EpisodeAccessType } from '@prisma/client'

const prisma = new PrismaClient()

// ── Categories → genres (sub-categories) ─────────────────────────────
const CATEGORIES = [
  { name: 'Romance', slug: 'romance', icon: '❤️', color: '#e8001d', description: 'Love stories of all kinds', genres: [
    { name: 'CEO Romance', slug: 'ceo-romance', icon: '💼' },
    { name: 'Forbidden Love', slug: 'forbidden-love', icon: '❤️‍🔥' },
    { name: 'Arranged Marriage', slug: 'arranged-marriage', icon: '💍' },
    { name: 'Second Chance Love', slug: 'second-chance', icon: '🔄' },
  ] },
  { name: 'Thriller', slug: 'thriller', icon: '🔍', color: '#f59e0b', description: 'Edge-of-your-seat drama', genres: [
    { name: 'Crime Thriller', slug: 'crime-thriller', icon: '🔫' },
    { name: 'Revenge', slug: 'revenge', icon: '⚔️' },
    { name: 'Psychological Thriller', slug: 'psychological', icon: '🧠' },
  ] },
  { name: 'Fantasy & Supernatural', slug: 'fantasy-supernatural', icon: '🌙', color: '#8b5cf6', description: 'Magic, werewolves, dragons', genres: [
    { name: 'Supernatural', slug: 'supernatural', icon: '👻' },
    { name: 'Werewolf', slug: 'werewolf', icon: '🐺' },
    { name: 'Fantasy', slug: 'fantasy', icon: '🐉' },
    { name: 'Reincarnation', slug: 'reincarnation', icon: '✨' },
  ] },
  { name: 'Drama', slug: 'drama', icon: '🎭', color: '#3b82f6', description: 'Real life, real emotions', genres: [
    { name: 'Family Drama', slug: 'family-drama', icon: '👨‍👩‍👧' },
    { name: 'Office Drama', slug: 'office-drama', icon: '🏢' },
    { name: 'School Drama', slug: 'school-drama', icon: '🏫' },
  ] },
  { name: 'Action', slug: 'action', icon: '⚔️', color: '#10b981', description: 'High stakes and fast pace', genres: [] },
]

// ── Monetisation (prices from the UX flow) ─────────────────────────────
const COIN_PACKS = [
  { id: 1, name: 'Starter', coins: 30, priceInrPaise: 8900, priceUsdCents: 99, displayOrder: 1 },
  { id: 2, name: 'Popular', coins: 100, priceInrPaise: 28500, priceUsdCents: 299, displayOrder: 2, isPopular: true },
  { id: 3, name: 'Binge', coins: 350, priceInrPaise: 95000, priceUsdCents: 999, displayOrder: 3 },
  { id: 4, name: 'Mega', coins: 1200, priceInrPaise: 285000, priceUsdCents: 2999, displayOrder: 4 },
]

const PLANS = [
  { id: 1, name: 'VIP Monthly', interval: 'MONTH' as const, priceInrPaise: 95000, priceUsdCents: 999, displayOrder: 1,
    features: ['Unlock every episode', 'No ads', 'Early access to new episodes'] },
  { id: 2, name: 'VIP Yearly', interval: 'YEAR' as const, priceInrPaise: 570000, priceUsdCents: 5999, displayOrder: 2,
    features: ['Everything in Monthly', 'Save 50% vs monthly'] },
]

const SETTINGS: Record<string, unknown> = {
  'coins.welcome_bonus': 10,
  'coins.daily_reward': 5,
  'coins.referral_reward': 30,
  'coins.ad_reward_per_view': 0, // ads unlock an episode directly rather than paying coins
  'ads.daily_limit': 3,
  'episodes.default_coin_price': 5,
}

// ── Demo catalog (mirrors src/lib/mock-data.ts) ─────────────────────────────
const IMG = (id: string, w: number, h: number) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop`
const P = ['1536440136628-849c177e76a1', '1509347528160-9a9e33742cdb', '1519699047748-de8e457a634e', '1506794778202-cad84cf45f1d',
  '1494790108377-be9c29b29330', '1534528741775-53994a69daeb', '1507003211169-0a1dd7228f2d', '1531746020798-e6953c6e8e04']

const SERIES = [
  { slug: 'forbidden-ceo', title: 'Forbidden CEO', genre: 'ceo-romance', img: P[0], hero: true, episodes: 45, lockFrom: 7, createdAt: '2026-08-01', views: 2400000, rating: 4.8, tags: ['Billionaire', 'Fake Marriage', 'Slow Burn'],
    synopsis: 'She vowed never to love again. He vowed never to feel. One contract changes everything.' },
  { slug: 'revenge-at-dawn', title: 'Revenge at Dawn', genre: 'revenge', img: P[1], hero: true, episodes: 32, lockFrom: 5, createdAt: '2026-08-05', views: 1800000, rating: 4.9, tags: ['Comeback', 'Empire', 'Betrayal'],
    synopsis: "They destroyed her family. She spent 10 years building her empire. Now it's her turn." },
  { slug: 'the-alphas-secret', title: "The Alpha's Secret", genre: 'supernatural', img: P[2], hero: true, episodes: 60, lockFrom: 10, createdAt: '2026-07-20', views: 3200000, rating: 4.7, tags: ['Werewolf', 'Curse', 'Fated Mates'],
    synopsis: 'He is the most powerful werewolf in the city. She is the only human who can break his curse.' },
  { slug: 'midnight-prosecutor', title: 'Midnight Prosecutor', genre: 'crime-thriller', img: P[3], episodes: 28, lockFrom: 6, createdAt: '2026-08-10', views: 980000, rating: 4.6, tags: ['Vigilante', 'Courtroom', 'Mystery'],
    synopsis: "The city's most feared lawyer by day. A vigilante by night. Until she becomes the suspect." },
  { slug: 'love-in-exile', title: 'Love in Exile', genre: 'forbidden-love', img: P[4], vip: true, episodes: 38, lockFrom: 8, createdAt: '2026-07-15', views: 2100000, rating: 4.5, tags: ['Arranged', 'Forbidden', 'Family'],
    synopsis: 'Arranged to marry his brother. Falling for him instead. Some rules were made to be broken.' },
  { slug: 'dragons-bride', title: "Dragon's Bride", genre: 'fantasy', img: P[5], episodes: 55, lockFrom: 12, createdAt: '2026-06-01', views: 4500000, rating: 4.9, tags: ['Dragon', 'Sacrifice', 'Epic'],
    synopsis: 'She was sacrificed to the dragon king. He was cursed to destroy everything he loves.' },
  { slug: 'the-billionaires-lie', title: "The Billionaire's Lie", genre: 'ceo-romance', img: P[6], vip: true, episodes: 40, lockFrom: 7, createdAt: '2026-05-20', views: 3800000, rating: 4.8, tags: ['Billionaire', 'Contract', 'Enemies'],
    synopsis: 'A fake marriage for business. Real feelings were never part of the deal.' },
  { slug: 'ghost-of-regret', title: 'Ghost of Regret', genre: 'supernatural', img: P[7], episodes: 25, lockFrom: 5, createdAt: '2026-08-12', views: 760000, rating: 4.4, tags: ['Ghost', 'Mystery', 'Bittersweet'],
    synopsis: 'She can see the dead. He is the ghost who refuses to leave. Neither expected this.' },
]

async function seedTaxonomy() {
  for (const [i, { genres, ...cat }] of CATEGORIES.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { ...cat, displayOrder: i + 1 },
      create: { ...cat, displayOrder: i + 1 },
    })
    for (const [j, g] of genres.entries()) {
      const data = { ...g, categoryId: category.id, displayOrder: j + 1 }
      await prisma.genre.upsert({ where: { slug: g.slug }, update: data, create: data })
    }
  }
}

async function seedMonetisation() {
  for (const pack of COIN_PACKS) {
    await prisma.coinPack.upsert({ where: { id: pack.id }, update: pack, create: pack })
  }
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({ where: { id: plan.id }, update: plan, create: plan })
  }
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value: value as Prisma.InputJsonValue } })
  }
  // Explicit ids above don't advance Postgres sequences — bump them so the
  // admin panel can create new packs/plans without a PK collision.
  await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('coin_packs','id'), (SELECT MAX(id) FROM coin_packs))`)
  await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('subscription_plans','id'), (SELECT MAX(id) FROM subscription_plans))`)
}

async function seedCatalog() {
  const genres = await prisma.genre.findMany({ include: { category: true } })
  const genreBySlug = new Map(genres.map(g => [g.slug, g]))

  for (const s of SERIES) {
    const genre = genreBySlug.get(s.genre)
    if (!genre) throw new Error(`Seed genre not found: ${s.genre}`)
    const publishedAt = new Date(s.createdAt)

    const data = {
      title: s.title,
      synopsis: s.synopsis,
      thumbnailUrl: IMG(s.img, 400, 600),
      bannerUrl: IMG(s.img, 1400, 800),
      categoryId: genre.categoryId,
      tags: s.tags,
      status: 'PUBLISHED' as const,
      publishedAt,
      isFeatured: !!s.hero,
      isVipExclusive: !!s.vip,
      viewCount: s.views,
      ratingAvg: s.rating,
      ratingCount: Math.round(s.views / 400),
    }
    const series = await prisma.series.upsert({
      where: { slug: s.slug },
      update: data,
      create: { slug: s.slug, createdAt: publishedAt, ...data, genres: { create: { genreId: genre.id } } },
    })

    await prisma.episode.createMany({
      skipDuplicates: true,
      data: Array.from({ length: s.episodes }, (_, i) => {
        const n = i + 1
        const accessType: EpisodeAccessType = n < s.lockFrom ? 'FREE' : 'COIN_LOCKED'
        return {
          seriesId: series.id,
          episodeNumber: n,
          title: `Episode ${n}`,
          durationSeconds: 60 + ((n * 7) % 30), // short-drama episodes run ~1-1.5 min
          accessType,
          coinPrice: accessType === 'FREE' ? 0 : 5,
          status: 'PUBLISHED' as const,
          publishedAt,
        }
      }),
    })
  }
}

async function main() {
  await seedTaxonomy()
  await seedMonetisation()
  await seedCatalog()

  const [series, episodes, genres] = await Promise.all([prisma.series.count(), prisma.episode.count(), prisma.genre.count()])
  console.log(`[seed] done — ${genres} genres, ${series} series, ${episodes} episodes, ${COIN_PACKS.length} coin packs, ${PLANS.length} plans`)
}

main()
  .catch(err => {
    console.error('[seed] failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

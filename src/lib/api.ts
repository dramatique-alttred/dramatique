/**
 * API Layer — Dramatiqué (consumer-facing)
 *
 * Single source of truth for all consumer data calls. Runs on the bundled
 * mock catalog for now — there's no live backend/MySQL to query yet (see
 * /backend). Every export here keeps the same name/signature/shape the
 * pages and hooks already call, so swapping these bodies for real
 * `apiClient` calls to Express later needs zero page changes.
 */

import { MOCK_SERIES, MOCK_FEED, HERO_SERIES, MOCK_CONTINUE } from './mock-data'
import { firebaseAuth } from './firebase'
import { Series, FeedSection } from '@/types'

const wait = (ms = 200) => new Promise(r => setTimeout(r, ms))

function requireUserId(): string {
  const uid = firebaseAuth?.currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  return uid
}

// Per-user mock state, keyed by Firebase uid — resets on page reload since
// there's no persistence layer until the real backend is wired in.
const savedSeriesByUser = new Map<string, Set<string>>()
const unlockedEpisodesByUser = new Map<string, Set<string>>()
const coinBalanceByUser = new Map<string, number>()
const coinTxByUser = new Map<string, { id: string; type: string; desc: string; coins: number; date: string; status: string }[]>()

function getBalanceRef(uid: string): number {
  if (!coinBalanceByUser.has(uid)) coinBalanceByUser.set(uid, 50) // starter balance
  return coinBalanceByUser.get(uid)!
}

// ── SERIES ──────────────────────────────────────────────
export const seriesApi = {
  getFeed: async (): Promise<FeedSection[]> => {
    await wait()
    return MOCK_FEED
  },

  getHero: async (): Promise<Series[]> => {
    await wait()
    return HERO_SERIES
  },

  getContinueWatching: async (): Promise<Series[]> => {
    await wait()
    if (!firebaseAuth?.currentUser) return []
    return MOCK_CONTINUE
  },

  getAll: async (): Promise<Series[]> => {
    await wait()
    return MOCK_SERIES
  },

  getBySlug: async (slug: string): Promise<Series> => {
    await wait()
    const series = MOCK_SERIES.find(s => s.slug === slug)
    if (!series) throw new Error(`Series not found: ${slug}`)
    return series
  },

  search: async (query: string): Promise<Series[]> => {
    await wait()
    if (!query.trim()) return MOCK_SERIES
    const q = query.toLowerCase()
    return MOCK_SERIES.filter(s => s.title.toLowerCase().includes(q) || s.synopsis.toLowerCase().includes(q))
  },

  getByGenre: async (genre: string): Promise<Series[]> => {
    await wait()
    if (genre === 'All') return MOCK_SERIES
    return MOCK_SERIES.filter(s => s.genre === genre)
  },

  getRecommended: async (excludeId: string): Promise<Series[]> => {
    await wait()
    return MOCK_SERIES.filter(s => s.id !== excludeId).slice(0, 6)
  },
}

// ── USER ──────────────────────────────────────────────
export const userApi = {
  getProfile: async () => {
    const uid = requireUserId()
    const user = firebaseAuth!.currentUser!
    return { id: uid, display_name: user.displayName, email: user.email, phone: user.phoneNumber, avatar_url: user.photoURL, coins: getBalanceRef(uid) }
  },

  getSavedList: async (): Promise<Series[]> => {
    await wait()
    const uid = requireUserId()
    const saved = savedSeriesByUser.get(uid) || new Set()
    return MOCK_SERIES.filter(s => saved.has(s.id))
  },

  getWatchHistory: async () => {
    await wait()
    requireUserId()
    return MOCK_CONTINUE.map(s => ({ ...s, watchedEp: s.last_episode, watchedAt: 'Today', progress: s.progress }))
  },

  toggleSave: async (seriesId: string): Promise<{ saved: boolean }> => {
    await wait()
    const uid = requireUserId()
    const saved = savedSeriesByUser.get(uid) || new Set<string>()
    const nowSaved = !saved.has(seriesId)
    if (nowSaved) saved.add(seriesId); else saved.delete(seriesId)
    savedSeriesByUser.set(uid, saved)
    return { saved: nowSaved }
  },

  isSaved: async (seriesId: string): Promise<boolean> => {
    const uid = firebaseAuth?.currentUser?.uid
    if (!uid) return false
    return (savedSeriesByUser.get(uid) || new Set()).has(seriesId)
  },

  // Real write needs a live video player + backend — plumbing is ready for
  // whenever that lands (see backend /api/v1/playback/progress).
  saveProgress: async (_seriesId: string, _episodeId: string, _episodeNumber: number, _progressPercent: number): Promise<void> => {
    requireUserId()
  },

  claimDailyReward: async (): Promise<{ coins: number; streak: number }> => {
    await wait()
    const uid = requireUserId()
    const reward = 5
    coinBalanceByUser.set(uid, getBalanceRef(uid) + reward)
    return { coins: reward, streak: 1 }
  },
}

// ── COINS ──────────────────────────────────────────────
export const coinApi = {
  getBalance: async (): Promise<number> => {
    await wait()
    const uid = requireUserId()
    return getBalanceRef(uid)
  },

  getTransactions: async () => {
    await wait()
    const uid = requireUserId()
    return coinTxByUser.get(uid) || []
  },

  unlockEpisode: async (episodeId: string): Promise<{ success: boolean; newBalance?: number }> => {
    await wait()
    const uid = requireUserId()
    const unlocked = unlockedEpisodesByUser.get(uid) || new Set<string>()
    unlocked.add(episodeId)
    unlockedEpisodesByUser.set(uid, unlocked)

    const cost = 5
    const newBalance = Math.max(0, getBalanceRef(uid) - cost)
    coinBalanceByUser.set(uid, newBalance)

    const tx = coinTxByUser.get(uid) || []
    tx.unshift({ id: `tx-${Date.now()}`, type: 'EPISODE_UNLOCK', desc: `Unlocked episode`, coins: -cost, date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), status: 'success' })
    coinTxByUser.set(uid, tx)

    return { success: true, newBalance }
  },

  checkUnlocked: async (episodeId: string): Promise<boolean> => {
    const uid = firebaseAuth?.currentUser?.uid
    if (!uid) return false
    return (unlockedEpisodesByUser.get(uid) || new Set()).has(episodeId)
  },
}

// ── PAYMENTS ──────────────────────────────────────────────
// NOT CONNECTED — needs a real payment gateway (Razorpay for India, Stripe
// for international) plus the backend's /api/v1/payments routes and webhook.
export const paymentApi = {
  createOrder: async (_packId: number, _currency: string) => {
    throw new Error('Payments are not connected yet — needs Razorpay/Stripe setup.')
  },
  verifyPayment: async (_paymentId: string, _orderId: string, _signature: string) => {
    throw new Error('Payments are not connected yet — needs Razorpay/Stripe setup.')
  },
}

// ── ADS ──────────────────────────────────────────────
// NOT CONNECTED — needs a real ad network SDK (e.g. Google AdMob) integrated
// into the app to actually serve and confirm rewarded-ad views.
export const adApi = {
  recordAdWatch: async (_episodeId: string, _adNumber: number): Promise<{ adsWatched: number; unlocked: boolean }> => {
    throw new Error('Ad network is not connected yet — needs AdMob (or similar) setup.')
  },
  getDailyAdLimit: async (): Promise<{ used: number; limit: number }> => {
    await wait()
    return { used: 0, limit: 3 }
  },
}

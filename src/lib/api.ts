/**
 * API Layer — Dramatique (consumer-facing)
 *
 * Single source of truth for all consumer data calls. Every export keeps the
 * name/signature/shape the pages and hooks already call.
 *
 * - seriesApi: public catalog (/catalog) + per-user continue watching
 * - userApi / coinApi: per-user endpoints (/me, /coins), authenticated with
 *   the Firebase ID token by apiClient
 * - paymentApi / adApi: not connected yet (Phase 4)
 */

import { apiClient } from './apiClient'
import { Series, SeriesDetail, FeedSection, GenreCategory, WatchedSeries, SeriesAccess, DailyRewardStatus, CoinTransaction } from '@/types'

// ── SERIES ──────────────────────────────────────────────
const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const seriesApi = {
  getFeed: (): Promise<FeedSection[]> => apiClient.get('/catalog/feed'),

  getHero: (): Promise<Series[]> => apiClient.get('/catalog/hero'),

  getContinueWatching: (): Promise<WatchedSeries[]> => apiClient.get('/me/continue-watching'),

  getAll: (): Promise<Series[]> => apiClient.get('/catalog/series'),

  getBySlug: (slug: string): Promise<SeriesDetail> => apiClient.get(`/catalog/series/${encodeURIComponent(slug)}`),

  search: (query: string): Promise<Series[]> => apiClient.get(`/catalog/series${qs({ q: query.trim() })}`),

  getByGenre: (genre: string): Promise<Series[]> =>
    apiClient.get(`/catalog/series${qs({ genre: genre === 'All' ? undefined : genre })}`),

  getRecommended: (excludeId: string): Promise<Series[]> =>
    apiClient.get(`/catalog/series/${encodeURIComponent(excludeId)}/recommended`),

  getGenres: (): Promise<GenreCategory[]> => apiClient.get('/catalog/genres'),
}

// ── USER ──────────────────────────────────────────────
// Works for guests too (anonymous Firebase session) — see AuthProvider
export const userApi = {
  getSavedList: (): Promise<Series[]> => apiClient.get('/me/list'),

  getSavedIds: (): Promise<string[]> => apiClient.get('/me/list/ids'),

  getWatchHistory: (): Promise<WatchedSeries[]> => apiClient.get('/me/history'),

  clearWatchHistory: (): Promise<void> => apiClient.delete('/me/history'),

  toggleSave: (seriesId: string): Promise<{ saved: boolean }> =>
    apiClient.post(`/me/list/${encodeURIComponent(seriesId)}/toggle`),

  saveProgress: (episodeId: string, positionSeconds: number, completed?: boolean): Promise<{ saved: boolean }> =>
    apiClient.put('/me/progress', { episodeId, positionSeconds, completed }),

  getSeriesAccess: (seriesId: string): Promise<SeriesAccess> =>
    apiClient.get(`/me/series/${encodeURIComponent(seriesId)}/access`),

  getDailyReward: (): Promise<DailyRewardStatus> => apiClient.get('/coins/daily-reward'),

  claimDailyReward: (): Promise<{ coins: number; streak: number; balance: number }> =>
    apiClient.post('/coins/daily-reward'),
}

// ── COINS ──────────────────────────────────────────────
export const coinApi = {
  getBalance: async (): Promise<number> => (await apiClient.get<{ balance: number }>('/coins/balance')).balance,

  getTransactions: (): Promise<CoinTransaction[]> => apiClient.get('/coins/transactions'),

  // Server is authoritative: checks access, debits and records atomically
  unlockEpisode: (episodeId: string): Promise<{ unlocked: boolean; charged: number; balance: number }> =>
    apiClient.post('/coins/unlock', { episodeId }),
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
  getDailyAdLimit: async (): Promise<{ used: number; limit: number }> => ({ used: 0, limit: 3 }),
}

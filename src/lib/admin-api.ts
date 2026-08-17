/**
 * Admin API Layer — Dramatiqué
 *
 * Runs entirely on in-memory mock data for now (no backend admin endpoints
 * exist yet — building those is a separate phase, and there's no live MySQL
 * to query even once they do). Every export here keeps the exact same
 * name/signature/return-shape the admin pages already call, so swapping
 * these bodies for real `apiClient` calls to Express later needs zero page
 * changes — only this file changes.
 *
 * Mutations (create/update/delete) mutate the in-memory arrays below, so
 * they behave correctly within a session but reset on page reload — there's
 * no persistence layer until the real backend + MySQL are wired in.
 */

import {
  MOCK_CATEGORIES, MOCK_SUBCATEGORIES, ADMIN_SERIES, ADMIN_EPISODES,
  ADMIN_USERS, ADMIN_TRANSACTIONS, DASHBOARD_STATS, REVENUE_CHART, TOP_SERIES,
} from './admin-mock-data'

// Simulated latency so loading states are real and testable
const wait = (ms = 300) => new Promise(r => setTimeout(r, ms))
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

// Mutable in-memory copies — mutations here don't touch the original mock arrays
let categories = MOCK_CATEGORIES.map(c => ({ ...c }))
let subcategories = MOCK_SUBCATEGORIES.map(s => ({ ...s }))
let seriesStore = ADMIN_SERIES.map(s => ({ ...s, subcategories: [...s.subcategories] }))
let episodeStore = ADMIN_EPISODES.map(e => ({ ...e }))
let userStore = ADMIN_USERS.map(u => ({ ...u }))
let transactionStore = ADMIN_TRANSACTIONS.map(t => ({ ...t }))
let notificationStore: { title: string; body: string; target: string; sent: string; reach: number }[] = []
let settingsStore = {
  app_name: 'Dramatiqué', tagline: 'Binge the drama.', support_email: 'support@dramatique.app',
  maintenance_mode: false, free_episodes: 3, ad_unlock_count: 1, daily_ad_limit: 3,
  daily_checkin_coins: 5, referrer_coins: 20, referred_coins: 10, welcome_bonus: 20,
  instagram: '', tiktok: '', youtube: '',
}

// Generic list envelope — mirrors how a paginated backend responds
export interface ListResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

function paginate<T>(all: T[], page = 1, pageSize = 50): ListResult<T> {
  const start = (page - 1) * pageSize
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize }
}

// ── DASHBOARD ──────────────────────────────────────────
export const adminDashboardApi = {
  getStats: async () => {
    await wait()
    return DASHBOARD_STATS
  },
  getRevenueChart: async () => {
    await wait()
    return REVENUE_CHART
  },
  getTopSeries: async () => {
    await wait()
    return TOP_SERIES
  },
}

// ── SERIES ──────────────────────────────────────────
export interface SeriesFilters { search?: string; status?: string; page?: number; pageSize?: number }

export const adminSeriesApi = {
  list: async (filters: SeriesFilters = {}): Promise<ListResult<any>> => {
    await wait()
    let rows = [...seriesStore]
    if (filters.search) {
      const q = filters.search.toLowerCase()
      rows = rows.filter(s => s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))
    }
    if (filters.status && filters.status !== 'all') rows = rows.filter(s => s.status === filters.status)
    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return paginate(rows, filters.page, filters.pageSize)
  },

  getById: async (id: string) => {
    await wait()
    const row = seriesStore.find(s => s.id === id)
    if (!row) throw new Error(`Series not found: ${id}`)
    return row
  },

  create: async (payload: any) => {
    await wait()
    const coinCost = payload.coin_cost_per_episode ?? payload.coin_cost ?? 5
    const row = {
      id: uid('series'),
      title: payload.title,
      slug: payload.slug,
      synopsis: payload.synopsis || '',
      thumbnail_url: payload.thumbnail_url || '',
      hero_url: payload.hero_url || '',
      primary_category: payload.primary_category || '',
      subcategories: payload.subcategories || [],
      tags: payload.tags || '',
      language: payload.language || 'English',
      total_episodes: 0,
      lock_from_episode: payload.lock_from_episode ?? 3,
      coin_cost: coinCost,
      coin_cost_per_episode: coinCost,
      is_featured: !!payload.is_featured,
      status: payload.status || 'draft',
      views: 0,
      revenue: 0,
      created_at: new Date().toISOString().slice(0, 10),
    }
    seriesStore = [row, ...seriesStore]
    return row
  },

  update: async (id: string, payload: any) => {
    await wait()
    const idx = seriesStore.findIndex(s => s.id === id)
    if (idx === -1) throw new Error(`Series not found: ${id}`)
    const merged = { ...seriesStore[idx], ...payload }
    const coinCost = payload.coin_cost_per_episode ?? payload.coin_cost ?? merged.coin_cost
    merged.coin_cost = coinCost
    merged.coin_cost_per_episode = coinCost
    seriesStore[idx] = merged
    return seriesStore[idx]
  },

  setStatus: async (id: string, status: 'published' | 'draft' | 'archived') => {
    await wait()
    const idx = seriesStore.findIndex(s => s.id === id)
    if (idx === -1) throw new Error(`Series not found: ${id}`)
    seriesStore[idx] = { ...seriesStore[idx], status }
    return seriesStore[idx]
  },

  remove: async (id: string) => {
    await wait()
    seriesStore = seriesStore.filter(s => s.id !== id)
    return { id, deleted: true }
  },

  duplicate: async (id: string) => {
    const original = await adminSeriesApi.getById(id)
    return adminSeriesApi.create({ ...original, title: `${original.title} (Copy)`, slug: `${original.slug}-copy-${Date.now()}`, status: 'draft' })
  },
}

// ── EPISODES ──────────────────────────────────────────
export const adminEpisodeApi = {
  listBySeries: async (seriesId: string) => {
    await wait()
    return episodeStore.filter(e => e.series_id === seriesId).sort((a, b) => a.number - b.number)
  },

  getById: async (id: string) => {
    await wait()
    const row = episodeStore.find(e => e.id === id)
    if (!row) throw new Error(`Episode not found: ${id}`)
    return row
  },

  create: async (seriesId: string, payload: any) => {
    await wait()
    const number = payload.number ?? payload.episode_number
    const row = {
      id: uid('ep'),
      series_id: seriesId,
      number,
      episode_number: number,
      title: payload.title || `Episode ${number}`,
      duration_seconds: payload.duration_seconds || 60,
      is_free: !!payload.is_free,
      coin_cost: payload.coin_cost ?? 5,
      video_id: payload.video_id || '',
      video_url: payload.video_id || '',
      subtitles_url: payload.subtitles_url || '',
      status: payload.video_id ? 'ready' : 'pending',
      views: 0,
      created_at: new Date().toISOString().slice(0, 10),
    }
    episodeStore = [...episodeStore, row]
    const series = seriesStore.find(s => s.id === seriesId)
    if (series) series.total_episodes += 1
    return row
  },

  update: async (id: string, payload: any) => {
    await wait()
    const idx = episodeStore.findIndex(e => e.id === id)
    if (idx === -1) throw new Error(`Episode not found: ${id}`)
    const merged = { ...episodeStore[idx], ...payload }
    if (payload.episode_number !== undefined) merged.number = payload.episode_number
    if (payload.number !== undefined) merged.episode_number = payload.number
    if (payload.video_id !== undefined) {
      merged.video_id = payload.video_id || ''
      merged.video_url = payload.video_id || ''
    }
    episodeStore[idx] = merged
    return episodeStore[idx]
  },

  setFree: async (id: string, isFree: boolean) => {
    await wait()
    const idx = episodeStore.findIndex(e => e.id === id)
    if (idx === -1) throw new Error(`Episode not found: ${id}`)
    episodeStore[idx] = { ...episodeStore[idx], is_free: isFree, coin_cost: isFree ? 0 : episodeStore[idx].coin_cost }
    return episodeStore[idx]
  },

  remove: async (id: string) => {
    await wait()
    const row = episodeStore.find(e => e.id === id)
    episodeStore = episodeStore.filter(e => e.id !== id)
    if (row) {
      const series = seriesStore.find(s => s.id === row.series_id)
      if (series) series.total_episodes = Math.max(0, series.total_episodes - 1)
    }
    return { id, deleted: true }
  },
}

// ── CATEGORIES ──────────────────────────────────────────
export const adminCategoryApi = {
  listCategories: async () => {
    await wait()
    return categories
  },

  listSubcategories: async (categoryId?: string) => {
    await wait()
    return categoryId ? subcategories.filter(s => s.category_id === categoryId) : subcategories
  },

  createCategory: async (payload: any) => {
    await wait()
    const row = { id: uid('cat'), display_order: categories.length + 1, is_active: true, series_count: 0, ...payload }
    categories = [...categories, row]
    return row
  },
  updateCategory: async (id: string, payload: any) => {
    await wait()
    const idx = categories.findIndex(c => c.id === id)
    if (idx === -1) throw new Error(`Category not found: ${id}`)
    categories[idx] = { ...categories[idx], ...payload }
    return categories[idx]
  },
  removeCategory: async (id: string) => {
    await wait()
    categories = categories.filter(c => c.id !== id)
    return { id, deleted: true }
  },
  createSubcategory: async (payload: any) => {
    await wait()
    const row = { id: uid('sub'), display_order: subcategories.length + 1, is_active: true, series_count: 0, ...payload }
    subcategories = [...subcategories, row]
    return row
  },
  updateSubcategory: async (id: string, payload: any) => {
    await wait()
    const idx = subcategories.findIndex(s => s.id === id)
    if (idx === -1) throw new Error(`Subcategory not found: ${id}`)
    subcategories[idx] = { ...subcategories[idx], ...payload }
    return subcategories[idx]
  },
  removeSubcategory: async (id: string) => {
    await wait()
    subcategories = subcategories.filter(s => s.id !== id)
    return { id, deleted: true }
  },
}

// ── USERS ──────────────────────────────────────────
export interface UserFilters { search?: string; segment?: 'all' | 'vip' | 'non-vip'; page?: number; pageSize?: number }

export const adminUserApi = {
  list: async (filters: UserFilters = {}): Promise<ListResult<any>> => {
    await wait()
    let rows = [...userStore]
    if (filters.search) {
      const q = filters.search.toLowerCase()
      rows = rows.filter(u => u.display_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q))
    }
    if (filters.segment === 'vip') rows = rows.filter(u => u.is_vip)
    if (filters.segment === 'non-vip') rows = rows.filter(u => !u.is_vip)
    return paginate(rows, filters.page, filters.pageSize)
  },

  getById: async (id: string) => {
    await wait()
    const row = userStore.find(u => u.id === id)
    if (!row) throw new Error(`User not found: ${id}`)
    return row
  },

  creditCoins: async (id: string, amount: number, _reason: string) => {
    await wait()
    const idx = userStore.findIndex(u => u.id === id)
    if (idx === -1) throw new Error(`User not found: ${id}`)
    userStore[idx] = { ...userStore[idx], coins: userStore[idx].coins + amount }
    return userStore[idx]
  },
  deductCoins: async (id: string, amount: number, _reason: string) => {
    await wait()
    const idx = userStore.findIndex(u => u.id === id)
    if (idx === -1) throw new Error(`User not found: ${id}`)
    userStore[idx] = { ...userStore[idx], coins: Math.max(0, userStore[idx].coins - amount) }
    return userStore[idx]
  },
  grantVIP: async (id: string, until: string) => {
    await wait()
    const idx = userStore.findIndex(u => u.id === id)
    if (idx === -1) throw new Error(`User not found: ${id}`)
    userStore[idx] = { ...userStore[idx], is_vip: true, vip_until: until }
    return userStore[idx]
  },
  revokeVIP: async (id: string) => {
    await wait()
    const idx = userStore.findIndex(u => u.id === id)
    if (idx === -1) throw new Error(`User not found: ${id}`)
    userStore[idx] = { ...userStore[idx], is_vip: false, vip_until: null }
    return userStore[idx]
  },
  setBanned: async (id: string, banned: boolean) => {
    await wait()
    const idx = userStore.findIndex(u => u.id === id)
    if (idx === -1) throw new Error(`User not found: ${id}`)
    userStore[idx] = { ...userStore[idx], status: banned ? 'banned' : 'active' }
    return userStore[idx]
  },
  getLedger: async (id: string) => {
    await wait()
    return transactionStore
      .filter(t => t.user_name === userStore.find(u => u.id === id)?.display_name)
      .map(t => ({ source: t.type, desc: t.desc, amount: t.coins, date: t.date }))
  },
  getWatchHistory: async (_id: string) => {
    await wait()
    // No real watch_progress source until the backend lands — empty until then
    return [] as { series: string; ep: number; when: string }[]
  },
}

// ── TRANSACTIONS ──────────────────────────────────────────
export interface TxnFilters { search?: string; status?: string; gateway?: string; type?: string }

export const adminTransactionApi = {
  list: async (filters: TxnFilters = {}) => {
    await wait()
    let rows = [...transactionStore]
    if (filters.status && filters.status !== 'all') rows = rows.filter(t => t.status === filters.status)
    if (filters.gateway && filters.gateway !== 'all') rows = rows.filter(t => t.gateway === filters.gateway)
    if (filters.type && filters.type !== 'all') rows = rows.filter(t => t.type === filters.type)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      rows = rows.filter(t => t.user_name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
    }
    return rows
  },
  exportCsv: async () => { await wait(400); return { url: 'mock://export.csv' } },
}

// ── ANALYTICS ──────────────────────────────────────────
export const adminAnalyticsApi = {
  getGenrePerformance: async () => {
    await wait()
    const viewsByCategory = new Map<string, number>()
    seriesStore.forEach(s => {
      if (!s.primary_category) return
      viewsByCategory.set(s.primary_category, (viewsByCategory.get(s.primary_category) || 0) + (s.views || 0))
    })
    const totalViews = Array.from(viewsByCategory.values()).reduce((a, b) => a + b, 0) || 1
    return Array.from(viewsByCategory.entries())
      .map(([genre, views]) => ({ genre, views, percent: Math.round((views / totalViews) * 100) }))
      .sort((a, b) => b.views - a.views)
  },

  getVipSplit: async () => {
    await wait()
    const vip = userStore.filter(u => u.is_vip).length
    const total = userStore.length
    return { vip, free: total - vip, total }
  },

  getProviderBreakdown: async () => {
    await wait()
    const byProvider = new Map<string, number>()
    transactionStore.forEach(t => byProvider.set(t.gateway, (byProvider.get(t.gateway) || 0) + 1))
    return Array.from(byProvider.entries()).map(([provider, count]) => ({ provider, count }))
  },

  getRevenueByPack: async () => {
    await wait()
    const byPack = new Map<string, number>()
    transactionStore.filter(t => t.status === 'success' && t.type === 'purchase').forEach(t => byPack.set(t.desc, (byPack.get(t.desc) || 0) + t.amount_inr))
    const total = Array.from(byPack.values()).reduce((a, b) => a + b, 0) || 1
    return Array.from(byPack.entries()).map(([pack, revenue]) => ({ pack, revenue, percent: Math.round((revenue / total) * 100) }))
  },

  getRevenueByGateway: async () => {
    await wait()
    const byGateway = new Map<string, number>()
    transactionStore.filter(t => t.status === 'success').forEach(t => byGateway.set(t.gateway, (byGateway.get(t.gateway) || 0) + t.amount_inr))
    const total = Array.from(byGateway.values()).reduce((a, b) => a + b, 0) || 1
    return Array.from(byGateway.entries()).map(([gateway, amount]) => ({ gateway, amount, percent: Math.round((amount / total) * 100) }))
  },
}

// ── SETTINGS ──────────────────────────────────────────
export const adminSettingsApi = {
  get: async () => {
    await wait()
    return settingsStore
  },
  update: async (settings: any) => {
    await wait()
    settingsStore = { ...settingsStore, ...settings }
  },
}

// ── NOTIFICATIONS ──────────────────────────────────────────
export interface NotificationPayload { title: string; body: string; target_segment: string; deep_link?: string }

export const adminNotificationApi = {
  list: async () => {
    await wait()
    return notificationStore
  },
  send: async (payload: NotificationPayload, reachEstimate: number) => {
    await wait()
    notificationStore = [{
      title: payload.title, body: payload.body, target: payload.target_segment,
      sent: new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      reach: reachEstimate,
    }, ...notificationStore]
    // NOT CONNECTED: this records the notification locally but doesn't push it
    // to devices — that needs a push provider (Firebase Cloud Messaging or
    // OneSignal) wired in once the real backend exists.
  },
  estimateReach: async (segment: string): Promise<number> => {
    await wait()
    if (segment === 'vip') return userStore.filter(u => u.is_vip).length
    if (segment === 'non-vip') return userStore.filter(u => !u.is_vip).length
    return userStore.length
  },
}

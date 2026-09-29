/**
 * Admin API Layer — Dramatique
 *
 * Thin client for the Express admin API (/api/v1/admin/*, ADMIN-only and
 * enforced server-side). Every export keeps the name/signature/shape the
 * admin pages already call, so the pages didn't need rewriting when this
 * moved off mock data.
 */

import { apiClient } from './apiClient'

// Generic list envelope — how the paginated admin endpoints respond
export interface ListResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}
const enc = encodeURIComponent

// ── DASHBOARD ──────────────────────────────────────────
export const adminDashboardApi = {
  getStats: () => apiClient.get<any>('/admin/dashboard/stats'),
  getRevenueChart: () => apiClient.get<{ day: number; date: string; revenue: number; users: number }[]>('/admin/dashboard/revenue-chart'),
  getTopSeries: () => apiClient.get<{ title: string; views: number; revenue: number }[]>('/admin/dashboard/top-series'),
}

// ── SERIES ──────────────────────────────────────────
export interface SeriesFilters { search?: string; status?: string; page?: number; pageSize?: number }

export const adminSeriesApi = {
  list: (filters: SeriesFilters = {}) => apiClient.get<ListResult<any>>(`/admin/series${qs({ ...filters })}`),
  getById: (id: string) => apiClient.get<any>(`/admin/series/${enc(id)}`),
  create: (payload: any) => apiClient.post<any>('/admin/series', payload),
  update: (id: string, payload: any) => apiClient.patch<any>(`/admin/series/${enc(id)}`, payload),
  setStatus: (id: string, status: 'published' | 'draft' | 'archived' | 'scheduled', publishAt?: string) =>
    apiClient.post<any>(`/admin/series/${enc(id)}/status`, { status, ...(publishAt && { publish_at: publishAt }) }),
  remove: (id: string) => apiClient.delete<{ id: string; deleted: boolean }>(`/admin/series/${enc(id)}`),
  duplicate: async (id: string) => {
    const original = await adminSeriesApi.getById(id)
    return adminSeriesApi.create({ ...original, title: `${original.title} (Copy)`, slug: `${original.slug}-copy-${Date.now()}`, status: 'draft' })
  },
}

// ── EPISODES ──────────────────────────────────────────
export const adminEpisodeApi = {
  listBySeries: (seriesId: string) => apiClient.get<any[]>(`/admin/series/${enc(seriesId)}/episodes`),
  getById: (id: string) => apiClient.get<any>(`/admin/episodes/${enc(id)}`),
  create: (seriesId: string, payload: any) => apiClient.post<any>(`/admin/series/${enc(seriesId)}/episodes`, payload),
  update: (id: string, payload: any) => apiClient.patch<any>(`/admin/episodes/${enc(id)}`, payload),
  setFree: (id: string, isFree: boolean) => apiClient.post<any>(`/admin/episodes/${enc(id)}/free`, { is_free: isFree }),
  remove: (id: string) => apiClient.delete<{ id: string; deleted: boolean }>(`/admin/episodes/${enc(id)}`),

  // Video: browser uploads straight to R2 in parts, then the server transcodes
  startVideoUpload: (id: string, file: { size: number; contentType: string; filename: string }) =>
    apiClient.post<{ key: string; uploadId: string; partSize: number; parts: { partNumber: number; url: string }[] }>(
      `/admin/episodes/${enc(id)}/video/upload`, file),
  completeVideoUpload: (id: string, body: { key: string; uploadId: string; parts: { PartNumber: number; ETag: string }[] }) =>
    apiClient.post<{ queued: boolean }>(`/admin/episodes/${enc(id)}/video/complete`, body),
  abortVideoUpload: (id: string, body: { key: string; uploadId: string }) =>
    apiClient.post<{ aborted: boolean }>(`/admin/episodes/${enc(id)}/video/abort`, body),
  retryVideo: (id: string) => apiClient.post<{ queued: boolean }>(`/admin/episodes/${enc(id)}/video/retry`),
}

// ── MEDIA (posters / banners) ──────────────────────────
export const adminMediaApi = {
  createImageUpload: (body: { kind: 'poster' | 'banner'; contentType: string; size: number; seriesId?: string }) =>
    apiClient.post<{ uploadUrl: string; headers: Record<string, string>; url: string; key: string }>('/admin/uploads/image', body),
}

// ── CATEGORIES ("subcategories" = genres) ──────────────────────────
export const adminCategoryApi = {
  listCategories: () => apiClient.get<any[]>('/admin/categories'),
  listSubcategories: (categoryId?: string) => apiClient.get<any[]>(`/admin/genres${qs({ categoryId })}`),
  createCategory: (payload: any) => apiClient.post<any>('/admin/categories', payload),
  updateCategory: (id: string, payload: any) => apiClient.patch<any>(`/admin/categories/${enc(id)}`, payload),
  removeCategory: (id: string) => apiClient.delete<any>(`/admin/categories/${enc(id)}`),
  createSubcategory: (payload: any) => apiClient.post<any>('/admin/genres', payload),
  updateSubcategory: (id: string, payload: any) => apiClient.patch<any>(`/admin/genres/${enc(id)}`, payload),
  removeSubcategory: (id: string) => apiClient.delete<any>(`/admin/genres/${enc(id)}`),
}

// ── USERS ──────────────────────────────────────────
export interface UserFilters { search?: string; segment?: 'all' | 'vip' | 'non-vip' | 'guests'; page?: number; pageSize?: number }

export const adminUserApi = {
  list: (filters: UserFilters = {}) => apiClient.get<ListResult<any>>(`/admin/users${qs({ ...filters })}`),
  getById: (id: string) => apiClient.get<any>(`/admin/users/${enc(id)}`),
  // Server writes an ADMIN_ADJUSTMENT ledger entry; reason is required
  creditCoins: (id: string, amount: number, reason: string) =>
    apiClient.post<any>(`/admin/users/${enc(id)}/coins`, { amount: Math.abs(amount), reason }),
  deductCoins: (id: string, amount: number, reason: string) =>
    apiClient.post<any>(`/admin/users/${enc(id)}/coins`, { amount: -Math.abs(amount), reason }),
  grantVIP: (id: string, until: string) => apiClient.post<any>(`/admin/users/${enc(id)}/vip`, { until }),
  revokeVIP: (id: string) => apiClient.delete<any>(`/admin/users/${enc(id)}/vip`),
  setBanned: (id: string, banned: boolean) => apiClient.post<any>(`/admin/users/${enc(id)}/ban`, { banned }),
  getLedger: (id: string) => apiClient.get<{ source: string; desc: string; amount: number; date: string }[]>(`/admin/users/${enc(id)}/ledger`),
  getWatchHistory: (id: string) => apiClient.get<{ series: string; ep: number; when: string }[]>(`/admin/users/${enc(id)}/history`),
}

// ── TRANSACTIONS (real-money payment orders) ──────────────────────────
export interface TxnFilters { search?: string; status?: string; gateway?: string; type?: string }

export const adminTransactionApi = {
  list: (filters: TxnFilters = {}) => apiClient.get<any[]>(`/admin/transactions${qs({ ...filters })}`),
  // Built in the browser from the current list — no server round-trip needed
  exportCsv: async (filters: TxnFilters = {}) => {
    const rows = await adminTransactionApi.list(filters)
    const cols = ['id', 'date', 'user_name', 'type', 'desc', 'amount_inr', 'coins', 'gateway', 'status']
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n')
    return { url: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })) }
  },
}

// ── ANALYTICS ──────────────────────────────────────────
export const adminAnalyticsApi = {
  getGenrePerformance: () => apiClient.get<{ genre: string; views: number; percent: number }[]>('/admin/analytics/genres'),
  getVipSplit: () => apiClient.get<{ vip: number; free: number; total: number }>('/admin/analytics/vip-split'),
  getProviderBreakdown: () => apiClient.get<{ provider: string; count: number }[]>('/admin/analytics/providers'),
  getRevenueByPack: () => apiClient.get<{ pack: string; revenue: number; percent: number }[]>('/admin/analytics/revenue-by-pack'),
  getRevenueByGateway: () => apiClient.get<{ gateway: string; amount: number; percent: number }[]>('/admin/analytics/revenue-by-gateway'),
}

// ── SETTINGS ──────────────────────────────────────────
export const adminSettingsApi = {
  get: () => apiClient.get<any>('/admin/settings'),
  update: (settings: any) => apiClient.put<any>('/admin/settings', settings),
}

// ── NOTIFICATIONS ──────────────────────────────────────────
export interface NotificationPayload { title: string; body: string; target_segment: string; deep_link?: string }

export const adminNotificationApi = {
  list: () => apiClient.get<{ title: string; body: string; target: string; sent: string; reach: number }[]>('/admin/notifications'),
  // Server records the campaign and counts the audience itself. Delivery to
  // devices needs Firebase Cloud Messaging — not connected yet.
  send: (payload: NotificationPayload, _reachEstimate?: number) =>
    apiClient.post<{ recipients: number; delivered: boolean }>('/admin/notifications', payload),
  estimateReach: async (segment: string): Promise<number> =>
    (await apiClient.get<{ reach: number }>(`/admin/notifications/reach${qs({ segment })}`)).reach,
}

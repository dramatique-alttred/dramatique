import { useQuery } from '@tanstack/react-query'
import { userApi, coinApi } from '@/lib/api'
import { useAuthStore } from '@/store'

// Everything under ['user'] is per-identity — AuthProvider invalidates it
// whenever the session changes (guest → account, sign-out, switch account)
export const userKeys = {
  all: ['user'] as const,
  savedList: () => [...userKeys.all, 'savedList'] as const,
  savedIds: () => [...userKeys.all, 'savedIds'] as const,
  watchHistory: () => [...userKeys.all, 'watchHistory'] as const,
  coinBalance: () => [...userKeys.all, 'coinBalance'] as const,
  transactions: () => [...userKeys.all, 'transactions'] as const,
  seriesAccess: (seriesId: string) => [...userKeys.all, 'access', seriesId] as const,
  dailyReward: () => [...userKeys.all, 'dailyReward'] as const,
}

// Guests have a session too, so per-user data loads for them
const useSessionReady = () => useAuthStore(s => s.sessionReady)

// ── COIN BALANCE ──────────────────────────────────────────
export function useCoinBalance() {
  return useQuery({
    queryKey: userKeys.coinBalance(),
    queryFn: coinApi.getBalance,
    enabled: useSessionReady(),
    staleTime: 30 * 1000, // 30 seconds — balance changes frequently
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  })
}

// ── MY LIST ──────────────────────────────────────────
export function useSavedList() {
  return useQuery({
    queryKey: userKeys.savedList(),
    queryFn: userApi.getSavedList,
    enabled: useSessionReady(),
    staleTime: 2 * 60 * 1000,
  })
}

// Just the ids — cheap, for bookmark icons on detail pages
export function useSavedIds() {
  return useQuery({
    queryKey: userKeys.savedIds(),
    queryFn: userApi.getSavedIds,
    enabled: useSessionReady(),
    staleTime: 2 * 60 * 1000,
  })
}

// ── WATCH HISTORY ──────────────────────────────────────────
export function useWatchHistory() {
  return useQuery({
    queryKey: userKeys.watchHistory(),
    queryFn: userApi.getWatchHistory,
    enabled: useSessionReady(),
    staleTime: 60 * 1000,
  })
}

// ── PER-SERIES ACCESS (unlocked episodes, VIP, resume point) ──────────────
export function useSeriesAccess(seriesId: string | undefined) {
  const ready = useSessionReady()
  return useQuery({
    queryKey: userKeys.seriesAccess(seriesId ?? ''),
    queryFn: () => userApi.getSeriesAccess(seriesId!),
    enabled: ready && !!seriesId,
    staleTime: 30 * 1000,
  })
}

// ── DAILY REWARD ──────────────────────────────────────────
export function useDailyReward() {
  return useQuery({
    queryKey: userKeys.dailyReward(),
    queryFn: userApi.getDailyReward,
    // Guests can't claim, so don't bother asking for them
    enabled: useAuthStore(s => s.sessionReady && s.isLoggedIn),
    staleTime: 60 * 1000,
  })
}

// ── TRANSACTIONS ──────────────────────────────────────────
export function useTransactions() {
  return useQuery({
    queryKey: userKeys.transactions(),
    queryFn: coinApi.getTransactions,
    enabled: useSessionReady(),
    staleTime: 60 * 1000,
  })
}

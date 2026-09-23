import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi, coinApi } from '@/lib/api'
import { ApiError } from '@/lib/apiClient'
import { useCoinStore, usePaywallStore, useUIStore } from '@/store'
import { userKeys } from '../queries/useUser'

const errorCode = (err: unknown): string | undefined =>
  err instanceof ApiError ? err.code : undefined

// ── UNLOCK EPISODE ──────────────────────────────────────────
export function useUnlockEpisode() {
  const { hasEnough, setBalance } = useCoinStore()
  const { markUnlocked } = usePaywallStore()
  const { showToast } = useUIStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ episodeId, coinCost }: { episodeId: string; coinCost: number; seriesId: string }) => {
      // Client-side check first — fast feedback before hitting the server
      if (!hasEnough(coinCost)) {
        throw new ApiError(402, 'Insufficient coins', 'INSUFFICIENT_COINS')
      }
      // Server does the real, authoritative deduction — atomic and audit-logged
      return coinApi.unlockEpisode(episodeId)
    },

    onSuccess: (data, variables) => {
      // Sync local balance to the server-confirmed value, not a local guess
      setBalance(data.balance)
      markUnlocked(variables.episodeId)
      queryClient.invalidateQueries({ queryKey: userKeys.seriesAccess(variables.seriesId) })
      queryClient.invalidateQueries({ queryKey: userKeys.coinBalance() })
      queryClient.invalidateQueries({ queryKey: userKeys.transactions() })
      showToast(data.charged > 0 ? `Episode unlocked! −${data.charged} coins 🎬` : 'Episode unlocked! Enjoy 🎬', 'success')
    },

    onError: (error) => {
      const code = errorCode(error)
      if (code === 'INSUFFICIENT_COINS') {
        showToast('Not enough coins. Buy more to continue.', 'error')
      } else if (code === 'VIP_REQUIRED') {
        showToast('This episode is for VIP members only.', 'info')
      } else {
        showToast('Failed to unlock. Please try again.', 'error')
      }
    },
  })
}

// ── TOGGLE SAVE SERIES ──────────────────────────────────────────
export function useToggleSave() {
  const { showToast } = useUIStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (seriesId: string) => userApi.toggleSave(seriesId),

    // Optimistic: flip the bookmark immediately, roll back on failure
    onMutate: async (seriesId) => {
      await queryClient.cancelQueries({ queryKey: userKeys.savedIds() })
      const previous = queryClient.getQueryData<string[]>(userKeys.savedIds())
      queryClient.setQueryData<string[]>(userKeys.savedIds(), ids =>
        ids?.includes(seriesId) ? ids.filter(id => id !== seriesId) : [...(ids ?? []), seriesId])
      return { previous }
    },

    onSuccess: (data) => {
      showToast(data.saved ? 'Added to My List ✅' : 'Removed from My List', 'success')
    },

    onError: (_error, _seriesId, context) => {
      if (context?.previous) queryClient.setQueryData(userKeys.savedIds(), context.previous)
      showToast('Failed to update list. Try again.', 'error')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.savedIds() })
      queryClient.invalidateQueries({ queryKey: userKeys.savedList() })
    },
  })
}

// ── CLAIM DAILY REWARD ──────────────────────────────────────────
export function useClaimReward() {
  const { setBalance } = useCoinStore()
  const { showToast } = useUIStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: userApi.claimDailyReward,

    onSuccess: (data) => {
      setBalance(data.balance)
      queryClient.invalidateQueries({ queryKey: userKeys.dailyReward() })
      queryClient.invalidateQueries({ queryKey: userKeys.coinBalance() })
      queryClient.invalidateQueries({ queryKey: userKeys.transactions() })
      showToast(`Daily reward claimed! +${data.coins} coins 🎁`, 'success')
    },

    onError: (error) => {
      const code = errorCode(error)
      if (code === 'ALREADY_CLAIMED') {
        showToast('Already claimed today. Come back tomorrow!', 'info')
        queryClient.invalidateQueries({ queryKey: userKeys.dailyReward() })
      } else if (code === 'ACCOUNT_REQUIRED') {
        showToast('Sign in to claim daily rewards.', 'info')
      } else {
        showToast('Failed to claim reward. Try again.', 'error')
      }
    },
  })
}

// ── SAVE WATCH PROGRESS ──────────────────────────────────────────
export function useSaveProgress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ episodeId, positionSeconds, completed }: { episodeId: string; positionSeconds: number; completed?: boolean }) =>
      userApi.saveProgress(episodeId, positionSeconds, completed),
    // Silent — no toast for progress saves
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', 'continue'] })
      queryClient.invalidateQueries({ queryKey: userKeys.watchHistory() })
    },
  })
}

// ── CLEAR WATCH HISTORY ──────────────────────────────────────────
export function useClearHistory() {
  const { showToast } = useUIStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: userApi.clearWatchHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.watchHistory() })
      queryClient.invalidateQueries({ queryKey: ['series', 'continue'] })
      showToast('Watch history cleared', 'success')
    },
  })
}

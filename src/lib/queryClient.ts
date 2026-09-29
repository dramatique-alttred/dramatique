import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './apiClient'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes — no unnecessary refetches
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes after component unmounts
      gcTime: 10 * 60 * 1000,
      // Retry network/5xx failures once; 4xx (not found, unauthorised) won't
      // change on retry, so fail fast
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
      // Don't refetch when user switches tabs — saves bandwidth
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

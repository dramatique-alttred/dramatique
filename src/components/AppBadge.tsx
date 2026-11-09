'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useDailyReward } from '@/hooks'

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }

/**
 * Puts a badge on the installed app's icon while today's daily reward is waiting
 * (Badging API: Android/desktop Chrome and Edge, and iPhone home-screen apps).
 * Mounted once at the app root; does nothing where the browser has no badges.
 */
export default function AppBadge() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const { data: reward } = useDailyReward()
  const waiting = isLoggedIn && !!reward && !reward.claimed_today

  useEffect(() => {
    const nav = navigator as BadgeNavigator
    if (!nav.setAppBadge || !nav.clearAppBadge) return
    ;(waiting ? nav.setAppBadge(1) : nav.clearAppBadge()).catch(() => { /* not allowed here (e.g. not installed) */ })
  }, [waiting])

  return null
}

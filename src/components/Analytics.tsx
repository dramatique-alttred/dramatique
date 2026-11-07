'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { initAnalytics, trackPageview, identifyUser, resetAnalytics } from '@/lib/analytics'

function PageviewTracker() {
  const pathname = usePathname()
  const search = useSearchParams()

  useEffect(() => {
    // The admin panel is the team's own back office, not audience traffic
    if (!pathname || pathname.startsWith('/admin')) return
    const qs = search?.toString()
    trackPageview(window.location.origin + pathname + (qs ? `?${qs}` : ''))
  }, [pathname, search])

  return null
}

/** PostHog: page views, plus who is signed in. Mounted once at the app root. */
export default function Analytics() {
  const user = useAuthStore(s => s.user)

  useEffect(() => { initAnalytics() }, [])

  // Only a real sign-out resets: guests keep one anonymous id across visits
  const wasIdentified = useRef(false)
  useEffect(() => {
    if (user) {
      identifyUser(user.id, { is_vip: !!user.vip_until })
      wasIdentified.current = true
    } else if (wasIdentified.current) {
      resetAnalytics()
      wasIdentified.current = false
    }
  }, [user])

  return <Suspense fallback={null}><PageviewTracker /></Suspense>
}

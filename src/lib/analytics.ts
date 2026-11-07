import posthog from 'posthog-js'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

let started = false

/** Starts PostHog once, in the browser. Without a project key every call below is a no-op. */
export function initAnalytics() {
  if (started || typeof window === 'undefined' || !KEY) return
  started = true
  posthog.init(KEY, {
    api_host: HOST,
    // Pages are captured by hand (App Router navigations aren't full page loads)
    capture_pageview: false,
    capture_pageleave: true,
    // Anonymous visitors are counted, but only signed-in people get a profile
    person_profiles: 'identified_only',
    respect_dnt: true,
  })
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!started) return
  posthog.capture(event, props)
}

export function trackPageview(url: string) {
  if (!started) return
  posthog.capture('$pageview', { $current_url: url })
}

export function identifyUser(id: string, props?: Record<string, unknown>) {
  if (!started) return
  posthog.identify(id, props)
}

export function resetAnalytics() {
  if (!started) return
  posthog.reset()
}

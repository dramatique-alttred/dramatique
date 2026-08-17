'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { completeEmailLinkSignIn } from '@/lib/auth'

/**
 * Landing page after clicking an email magic link. Firebase's email-link
 * flow needs the original email address (stored in localStorage when the
 * link was sent) to exchange the URL for a real session — see
 * completeEmailLinkSignIn in lib/auth.ts. The actual profile sync into
 * Zustand happens in AuthProvider (global listener), same as every other
 * sign-in method.
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    completeEmailLinkSignIn(window.location.href)
      .catch(err => console.error('Email link sign-in failed:', err))
      .finally(() => router.replace('/'))
  }, [router])

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-brand-subtle text-sm">Signing you in...</p>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { onIdTokenChanged, User as FirebaseUser } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { fetchProfile, ensureGuestSession } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'
import { useCoinStore } from '@/store/coinStore'
import { useUIStore } from '@/store/uiStore'

/**
 * Keeps Zustand in sync with the Firebase session — mounted once at the app
 * root. Every visitor gets a session: an anonymous guest until they sign in
 * (UX flow: no sign-up wall; auth is deferred until first purchase).
 *
 * Listens to ID-token changes rather than auth-state changes because linking
 * a guest to Google/email keeps the same Firebase user — only the token
 * changes — and the backend needs that new token to see the real account.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const login = useAuthStore(s => s.login)
  const logout = useAuthStore(s => s.logout)
  const setSessionReady = useAuthStore(s => s.setSessionReady)
  const setBalance = useCoinStore(s => s.setBalance)
  const showToast = useUIStore(s => s.showToast)

  useEffect(() => {
    if (!firebaseAuth) return
    // Token events can arrive back-to-back (e.g. link + forced refresh);
    // only the newest sync is allowed to write state
    let latest = 0

    const syncFromFirebaseUser = async (firebaseUser: FirebaseUser) => {
      const run = ++latest
      try {
        const profile = await fetchProfile()
        if (run !== latest) return

        if (profile.isGuest) {
          logout() // guest: no "logged in" UI, but API calls work
        } else {
          login({
            id: profile.id,
            display_name: profile.displayName || firebaseUser.displayName || profile.email?.split('@')[0] || 'User',
            email: profile.email ?? undefined,
            phone: profile.phone ?? undefined,
            avatar_url: profile.avatarUrl ?? firebaseUser.photoURL ?? undefined,
            vip_until: profile.vipExpiresAt,
            referral_code: profile.referralCode,
          })
          if (profile.welcomeBonusGranted) showToast('Welcome to Dramatique! +10 free coins 🎁', 'success')
        }
        setBalance(profile.coins)
        setSessionReady(true)
        // User switched (guest → account, or a different account): drop any
        // per-user data cached for the previous identity
        queryClient.invalidateQueries({ queryKey: ['user'] })
        queryClient.invalidateQueries({ queryKey: ['series', 'continue'] })
      } catch (err) {
        console.error('Failed to load profile after auth change (is the backend running?):', err)
      }
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        syncFromFirebaseUser(firebaseUser)
      } else {
        latest++
        logout()
        setBalance(0)
        setSessionReady(false)
        queryClient.removeQueries({ queryKey: ['user'] })
        // Signed out (or first visit) → start a fresh guest session
        ensureGuestSession().catch(err => console.error('Guest session failed:', err))
      }
    })

    return unsubscribe
  }, [login, logout, setBalance, setSessionReady, showToast])

  return <>{children}</>
}

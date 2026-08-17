'use client'

import { useEffect } from 'react'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { fetchProfile } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import { useCoinStore } from '@/store/coinStore'

/**
 * Keeps Zustand in sync with the real Firebase session — mounted once at
 * the app root. Firebase restores the session locally and fires this
 * listener immediately on load, then again on every login/logout, anywhere
 * in the app.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const login = useAuthStore(s => s.login)
  const logout = useAuthStore(s => s.logout)
  const setBalance = useCoinStore(s => s.setBalance)

  useEffect(() => {
    if (!firebaseAuth) return

    const syncFromFirebaseUser = async (firebaseUser: FirebaseUser) => {
      try {
        const profile = await fetchProfile()
        login({
          id: profile.id,
          display_name: firebaseUser.displayName || profile.email?.split('@')[0] || 'User',
          email: profile.email ?? undefined,
          phone: profile.phone ?? undefined,
          avatar_url: firebaseUser.photoURL ?? undefined,
          vip_until: profile.vipExpiresAt,
        })
        setBalance(profile.coins)
      } catch (err) {
        console.error('Failed to load profile after auth change (is the backend running?):', err)
      }
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        syncFromFirebaseUser(firebaseUser)
      } else {
        logout()
        setBalance(0)
      }
    })

    return unsubscribe
  }, [login, logout, setBalance])

  return <>{children}</>
}

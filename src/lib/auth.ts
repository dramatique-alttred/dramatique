import {
  signInWithPopup, signInWithEmailAndPassword, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink, signOut as firebaseSignOut,
} from 'firebase/auth'
import { firebaseAuth, googleProvider, firebaseConfigured } from './firebase'
import { apiClient } from './apiClient'

const EMAIL_LINK_STORAGE_KEY = 'dramatique_email_for_signin'

function requireConfigured() {
  if (!firebaseConfigured || !firebaseAuth) {
    throw new Error('Sign-in is not configured yet — missing NEXT_PUBLIC_FIREBASE_* env vars.')
  }
  return firebaseAuth
}

// ── EMAIL + PASSWORD (used by admin login) ──────────────────────────────────────
export async function signInWithPassword(email: string, password: string) {
  const auth = requireConfigured()
  return signInWithEmailAndPassword(auth, email, password)
}

// ── EMAIL (magic link — no password to manage) ──────────────────────────────────────
export async function signInWithEmail(email: string) {
  const auth = requireConfigured()
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/auth/callback`,
    handleCodeInApp: true,
  })
  // The callback page needs the email back to complete the link — Firebase
  // deliberately doesn't round-trip it through the URL for security reasons.
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email)
}

// ── GOOGLE ──────────────────────────────────────
export async function signInWithGoogle() {
  const auth = requireConfigured()
  await signInWithPopup(auth, googleProvider)
}

// ── PHONE OTP — not yet implemented; UI marks this "Coming soon" ──────────────────────────────────────
export async function signInWithPhone(_phone: string): Promise<never> {
  throw new Error('Phone sign-in is not implemented yet.')
}
export async function verifyPhoneOtp(_phone: string, _token: string): Promise<never> {
  throw new Error('Phone sign-in is not implemented yet.')
}

// ── EMAIL LINK COMPLETION — called from /auth/callback ──────────────────────────────────────
export async function completeEmailLinkSignIn(url: string) {
  const auth = requireConfigured()
  if (!isSignInWithEmailLink(auth, url)) return false

  let email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY)
  if (!email) {
    // Link opened on a different device/browser than it was requested from
    email = window.prompt('Confirm your email to finish signing in')
  }
  if (!email) return false

  await signInWithEmailLink(auth, email, url)
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY)
  return true
}

// ── SIGN OUT ──────────────────────────────────────
export async function signOut() {
  const auth = requireConfigured()
  await firebaseSignOut(auth)
}

// ── PROFILE FETCH — hits the Express backend, which verifies the Firebase
// token and returns the matching MySQL user row (creating it on first login) ──
export interface Profile {
  id: string
  email: string | null
  phone: string | null
  role: 'USER' | 'ADMIN'
  isVip: boolean
  vipExpiresAt: string | null
  coins: number
}

export async function fetchProfile(): Promise<Profile> {
  return apiClient.post<Profile>('/auth/verify-firebase')
}

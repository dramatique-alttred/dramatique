import { initializeApp, getApps, FirebaseOptions } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const isConfigured = !!(config.apiKey && config.authDomain && config.projectId)

if (!isConfigured && typeof window !== 'undefined') {
  console.warn('[firebase] NEXT_PUBLIC_FIREBASE_* env vars not set — sign-in will fail until configured in .env.local')
}

// Guarded like the backend's config/firebase.ts — importing this file must
// never crash the app just because Firebase hasn't been set up yet. Callers
// check `isConfigured` (via authNotConfiguredError) and surface a clean,
// in-context error instead of a white-screen crash.
const app = isConfigured ? (getApps()[0] ?? initializeApp(config)) : null

export const firebaseAuth = app ? getAuth(app) : null
export const googleProvider = new GoogleAuthProvider()
export const firebaseConfigured = isConfigured

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env

const hasCredentials = FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY

if (hasCredentials && !getApps().length) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // .env stores the key with literal \n escapes — convert back to real newlines
      privateKey: FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
} else {
  console.warn('[firebase] FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY not set — auth verification will fail until configured in .env')
}

export const firebaseAuth: Auth | null = hasCredentials ? getAuth() : null

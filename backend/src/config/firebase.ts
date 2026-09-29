import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env

// Verifying ID tokens only needs the project ID — firebase-admin checks them
// against Google's public signing certs. A service-account key is optional and
// only required for privileged calls (custom tokens, user management, sending
// FCM pushes). Our Workspace org blocks key creation by policy, so the default
// setup is key-less; in production on Google Cloud, Application Default
// Credentials cover the privileged calls without a key file.
const hasServiceAccount = !!(FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY)

if (FIREBASE_PROJECT_ID && !getApps().length) {
  initializeApp(
    hasServiceAccount
      ? {
          credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            // .env stores the key with literal \n escapes — convert back to real newlines
            privateKey: FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          }),
        }
      : { projectId: FIREBASE_PROJECT_ID },
  )
} else if (!FIREBASE_PROJECT_ID) {
  console.warn('[firebase] FIREBASE_PROJECT_ID not set — auth verification will fail until configured in .env')
}

export const firebaseAuth: Auth | null = FIREBASE_PROJECT_ID ? getAuth() : null

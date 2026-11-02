import { FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { Auth, getAuth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { firestoreFor } from '@/lib/firebase/firestoreInstance'
import { FirebaseStorage, getStorage } from 'firebase/storage'
import { getFirebaseConfigError, isFirebaseConfigured } from '@/lib/firebase/env'
import { ensureAppCheck } from '@/lib/firebase/appCheck'

let app: FirebaseApp | null = null

function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
}

export function ensureFirebaseApp(): FirebaseApp {
  const configError = getFirebaseConfigError()
  if (configError) {
    throw new Error(configError)
  }
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.')
  }

  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig())
    ensureAppCheck(app)
  }
  return app
}

export function getFirebaseAuth(): Auth {
  return getAuth(ensureFirebaseApp())
}

export function getFirebaseDb(): Firestore {
  return firestoreFor(ensureFirebaseApp())
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(ensureFirebaseApp())
}

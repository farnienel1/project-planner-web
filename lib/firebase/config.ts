import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { isFirebaseConfigured } from './env';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function initFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApps()[0] ?? null;
}

const app = initFirebaseApp();

// Initialize services only when Firebase env vars are present (avoids SSR crashes).
export const auth: Auth = app ? getAuth(app) : (null as unknown as Auth);
export const db: Firestore = app ? getFirestore(app) : (null as unknown as Firestore);
export const storage: FirebaseStorage = app ? getStorage(app) : (null as unknown as FirebaseStorage);

export default app;





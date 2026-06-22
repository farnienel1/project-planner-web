import { getFirebaseConfigError } from '@/lib/firebase/env'

type FirebaseLikeError = {
  code?: string
  message?: string
}

export function formatSetupError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as FirebaseLikeError).code ?? '')
      : ''
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Setup failed'

  if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
    return 'An account with this email already exists. Sign in instead, or use a different email.'
  }

  if (
    code === 'auth/invalid-api-key' ||
    code === 'auth/api-key-not-valid' ||
    message.includes('api-key-not-valid') ||
    message.includes('invalid-api-key')
  ) {
    return (
      getFirebaseConfigError() ||
      'Firebase authentication failed. Check NEXT_PUBLIC_FIREBASE_* values in .env.local, run rm -rf .next, then restart npm run dev.'
    )
  }

  if (code === 'permission-denied' || message.includes('Missing or insufficient permissions')) {
    return (
      'Firestore blocked this setup (permission denied). Sign-up needs security rules that allow a ' +
      'signed-in user to create organizations/{id} and users/{their uid}. Check Firebase Console → Firestore → Rules.'
    )
  }

  if (message.includes('Firebase is not configured')) {
    return getFirebaseConfigError() || message
  }

  return message
}

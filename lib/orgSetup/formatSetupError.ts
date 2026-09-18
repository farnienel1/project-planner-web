import { getFirebaseConfigError } from '@/lib/firebase/env'
import { isChunkLoadError } from '@/lib/client/chunkLoadError'
import { isTimeoutError } from '@/lib/client/withTimeout'
import { authErrorCode, errorMessageOf, isExistingAccountSignInError } from '@/lib/orgSetup/authSetupErrors'

export function formatSetupError(err: unknown): string {
  const code = authErrorCode(err)
  const message = errorMessageOf(err) || 'Setup failed'

  if (isChunkLoadError(err)) {
    return 'The site was just updated. Refresh this page, then click Activate again.'
  }

  if (isTimeoutError(err) || /taking too long/i.test(message)) {
    return (
      message && message !== 'Setup failed' && !/^timeout$/i.test(message)
        ? message
        : 'Activation is taking too long. Refresh this page, then click Activate again. If it still sticks, try a private window so you are not on an old copy of the site.'
    )
  }

  if (isExistingAccountSignInError(err)) {
    return (
      'This email already has a Project Planner account. Use the password for that login — Activate will add another ' +
      'organisation to it. You can belong to as many organisations as you need.'
    )
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
      'Firestore blocked this setup (permission denied). Your Firebase security rules need to allow a ' +
      'signed-in user to create organizations/{id} and users/{their uid}. ' +
      'Copy firestore.rules from this repo into Firebase Console → Firestore → Rules → Publish, ' +
      'or run: firebase deploy --only firestore:rules (see DEPLOY_FIRESTORE_RULES.md).'
    )
  }

  if (
    message.includes('RESEND_API_KEY') ||
    (/resend/i.test(message) && /not configured/i.test(message))
  ) {
    return (
      'The organisation was created, but the confirmation email could not be sent. ' +
      'Tap Resend on the Check your email page. Web mail uses the same Outlook Cloud Function as iOS.'
    )
  }

  if (message.includes('Firebase is not configured')) {
    return getFirebaseConfigError() || message
  }

  return message
}

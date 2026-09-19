import { isTimeoutError } from '@/lib/client/withTimeout'
import { ACCOUNT_UNCONFIRMED_MESSAGE } from '@/lib/orgSetup/accountConfirmation'

export function formatLoginError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message === ACCOUNT_UNCONFIRMED_MESSAGE) return ACCOUNT_UNCONFIRMED_MESSAGE
  if (isTimeoutError(error) || /taking too long/i.test(message)) {
    return (
      message ||
      'Sign in is taking too long. Check your connection, refresh this page, then try again.'
    )
  }
  if (message.includes('user profile') || message.includes('Firestore')) return message
  return 'Sign in failed. Please check your email/password and try again.'
}

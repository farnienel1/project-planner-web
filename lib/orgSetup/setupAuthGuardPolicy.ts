import { isAccountConfirmed } from '@/lib/orgSetup/accountConfirmation'

function setupPath(path: string): string {
  const withoutQuery = path.split('?')[0] || ''
  const trimmed = withoutQuery.replace(/\/+$/, '')
  return trimmed || '/'
}

/**
 * Unconfirmed founders must stay on the setup wizard through Stripe.
 * Check-email is after payment (`/setup/success`) and on the dashboard.
 */
export function shouldSendUnconfirmedFounderToCheckEmail(input: {
  accountConfirmed?: boolean
  path: string
}): boolean {
  if (isAccountConfirmed({ accountConfirmed: input.accountConfirmed })) return false
  return setupPath(input.path) !== '/setup'
}

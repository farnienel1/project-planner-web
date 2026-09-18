export const ACCOUNT_UNCONFIRMED_MESSAGE =
  'Please confirm your account using the link we sent to your email before signing in.'

export function isAccountConfirmed(user: { accountConfirmed?: boolean } | null | undefined): boolean {
  return user?.accountConfirmed !== false
}

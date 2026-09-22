export const EMAIL_ACTION_MODES = ['resetPassword', 'verifyEmail', 'recoverEmail', 'signIn'] as const
export type EmailActionMode = (typeof EMAIL_ACTION_MODES)[number]

export type ParsedEmailAction = {
  mode: EmailActionMode | null
  oobCode: string
  continueUrl: string
}

export function parseEmailActionSearch(search: { get(name: string): string | null }): ParsedEmailAction {
  const modeRaw = (search.get('mode') || '').trim()
  const mode = EMAIL_ACTION_MODES.includes(modeRaw as EmailActionMode) ? (modeRaw as EmailActionMode) : null
  return {
    mode,
    oobCode: (search.get('oobCode') || search.get('oobcode') || '').trim(),
    continueUrl: (search.get('continueUrl') || search.get('continueurl') || '').trim(),
  }
}

export function isPasswordResetAction(action: ParsedEmailAction): boolean {
  return action.mode === 'resetPassword' && action.oobCode.length > 0
}

import { isPlatformOwnerEmail } from '@/lib/platform/owner'

export function loginPathForResetEmail(email: string): '/developer-login' | '/login' {
  return isPlatformOwnerEmail(email) ? '/developer-login' : '/login'
}

export function minPasswordLengthForEmail(email: string): number {
  return loginPathForResetEmail(email) === '/developer-login' ? 10 : 8
}

export function formatPasswordResetError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  const message = error instanceof Error ? error.message : ''
  if (code === 'auth/expired-action-code' || /expired/i.test(message)) {
    return 'This reset link has expired. Request a new one from the sign-in page.'
  }
  if (code === 'auth/invalid-action-code' || /invalid-action-code/i.test(message)) {
    return 'This reset link is invalid or has already been used. Request a new one from the sign-in page.'
  }
  if (code === 'auth/weak-password' || /weak-password/i.test(message)) {
    return 'Choose a stronger password (at least 8 characters).'
  }
  return message || 'Could not update the password. Request a new reset link and try again.'
}

export function emailActionRecoveryHref(pathname: string, search: string): string | null {
  const query = search.startsWith('?') ? search.slice(1) : search
  const action = parseEmailActionSearch(new URLSearchParams(query))
  if (!action.oobCode) return null
  if (pathname === '/auth/action') return null
  return `/auth/action${search.startsWith('?') ? search : search ? `?${search}` : ''}`
}

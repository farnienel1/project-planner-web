import { isPlatformOwnerEmail } from '@/lib/platform/owner'

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

const HANDLED_EMAIL_ACTION_PATHS = new Set(['/auth/action', '/reset-password'])

export function normalizeEmailActionPathname(pathname: string): string {
  if (!pathname) return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function emailActionRecoveryHref(pathname: string, search: string): string | null {
  const path = normalizeEmailActionPathname(pathname)
  const query = search.startsWith('?') ? search : search ? `?${search}` : ''
  const action = parseEmailActionSearch(new URLSearchParams(query.startsWith('?') ? query.slice(1) : query))
  if (!action.oobCode) return null
  if (HANDLED_EMAIL_ACTION_PATHS.has(path)) return null
  return `/auth/action${query}`
}

/** Runs in <head> before React hydrates. Firebase links keep /__/auth/action in the URL. */
export const EMAIL_ACTION_BOOT_SCRIPT =
  "(function(){try{var p=(location.pathname||'/').replace(/\\/+$/,'')||'/';var s=location.search||'';if(!/[?&]oobCode=/i.test(s))return;if(p==='/auth/action'||p==='/reset-password')return;location.replace('/auth/action'+s+location.hash)}catch(e){}})();"

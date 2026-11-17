import { loginPathForResetEmail } from '@/lib/auth/emailAction'

/**
 * The branded password reset (owner request 17 Nov). `POST /api/auth/password-reset` asks Firebase for the reset
 * link server-side (`returnOobLink: true`, so Firebase sends no email of its own) and sends our own email through
 * the email function. Every outcome that depends on whether the account exists answers the caller the same way.
 *
 * Kept free of Next imports so the route's decisions are tested directly.
 */

/** Hosts a reset link may send the person back to (the login page after the password is changed). */
export const PASSWORD_RESET_CONTINUE_HOSTS = ['www.projectplanner.us', 'projectplanner.us'] as const

/** The only paths a reset may send the person back to. */
export const PASSWORD_RESET_CONTINUE_PATHS = ['/login', '/developer-login'] as const

/** One email address gets at most this many reset emails in the window; later requests are answered but not sent. */
export const PASSWORD_RESET_PER_EMAIL_LIMIT = 3
export const PASSWORD_RESET_PER_EMAIL_WINDOW_MS = 60 * 60 * 1000

/** One address (IP) may ask this many times in the window before it gets 429. */
export const PASSWORD_RESET_PER_IP_LIMIT = 10
export const PASSWORD_RESET_PER_IP_WINDOW_MS = 15 * 60 * 1000

/**
 * The route never answers sooner than this, so a sent email (link + email function call) and an unknown address
 * (one quick lookup) take a similar time. It narrows the timing gap; it does not close it on a slow email send.
 */
export const PASSWORD_RESET_MIN_RESPONSE_MS = 1500

/** The one answer for a valid request, whatever happened to it. */
export const PASSWORD_RESET_GENERIC_RESPONSE = { ok: true } as const

/** The answer when this server cannot make reset links or send email at all (before any account is looked at). */
export const PASSWORD_RESET_FALLBACK_RESPONSE = { ok: false, fallback: 'firebase' } as const

function originOf(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function allowedOrigin(url: URL, appBaseUrl: string): boolean {
  if (url.username || url.password) return false
  if (url.protocol === 'https:' && (PASSWORD_RESET_CONTINUE_HOSTS as readonly string[]).includes(url.hostname) && !url.port) {
    return true
  }
  const base = originOf(appBaseUrl)
  return Boolean(base && base.origin === url.origin)
}

/**
 * Where the reset link sends the person back to. The path is always the login page for that email
 * (`loginPathForResetEmail`: the developer login for the platform owner). A `requested` URL is used only for its
 * origin, only when that origin is projectplanner.us (https) or this server's own base URL, and only when its path
 * is one of `PASSWORD_RESET_CONTINUE_PATHS` with no query or fragment; anything else falls back to the default.
 */
export function passwordResetContinueUrl(email: string, requested: unknown, appBaseUrl: string): string {
  const path = loginPathForResetEmail(email)
  const fallbackBase = (originOf(appBaseUrl)?.origin || 'https://www.projectplanner.us').replace(/\/$/, '')
  if (typeof requested !== 'string' || !requested.trim() || requested.length > 500) return `${fallbackBase}${path}`
  const url = originOf(requested.trim())
  if (!url || !allowedOrigin(url, appBaseUrl)) return `${fallbackBase}${path}`
  if (!(PASSWORD_RESET_CONTINUE_PATHS as readonly string[]).includes(url.pathname) || url.search || url.hash) {
    return `${fallbackBase}${path}`
  }
  return `${url.origin}${path}`
}

/** What happened, for the log only. Never the address, the link or the code. */
export type PasswordResetStatus =
  | 'sent'
  | 'no_account'
  | 'email_throttled'
  | 'link_failed'
  | 'send_failed'
  | 'not_configured'

export type PasswordResetDeps = {
  /** True when this server can make reset links and send email (service account and email key set). */
  configured: () => boolean
  /** Per-email budget: true while this address may get another email. */
  allowEmail: (email: string) => boolean
  /** The Firebase reset link (`returnOobLink: true`: Firebase sends nothing itself). */
  generateLink: (email: string, continueUrl: string) => Promise<string>
  /** The link failed because the account is missing or disabled. */
  isAccountMissing: (error: unknown) => boolean
  /** True when the error means the server cannot make links at all (setup), checked before any account is known. */
  isSetupError: (error: unknown) => boolean
  sendEmail: (input: { to: string; link: string }) => Promise<void>
}

/**
 * Makes the link and sends the email. Returns the status for the log; the route turns every status except
 * `not_configured` into the same 200 answer.
 */
export async function runPasswordReset(
  input: { email: string; continueUrl: string },
  deps: PasswordResetDeps
): Promise<PasswordResetStatus> {
  if (!deps.configured()) return 'not_configured'
  if (!deps.allowEmail(input.email)) return 'email_throttled'
  let link: string
  try {
    link = await deps.generateLink(input.email, input.continueUrl)
  } catch (error) {
    if (deps.isAccountMissing(error)) return 'no_account'
    if (deps.isSetupError(error)) return 'not_configured'
    return 'link_failed'
  }
  try {
    await deps.sendEmail({ to: input.email, link })
  } catch {
    return 'send_failed'
  }
  return 'sent'
}

/**
 * Passkey (WebAuthn) sign-in: the switch and the relying party.
 *
 * The switch is the build-time variable `NEXT_PUBLIC_PASSKEYS_ENABLED` ("true" or "1"). Missing or anything else is
 * off: no button, no autofill, no settings section, and every passkey API route answers 404. Next inlines a
 * `NEXT_PUBLIC_` value into the browser and server bundles at build time, so both always agree; turning it on or off
 * is a Netlify variable plus a redeploy (a "clear cache and deploy" is not needed).
 *
 * The relying party id is the registrable domain the passkeys belong to. Production is `projectplanner.us`, so a
 * passkey made on www.projectplanner.us also works on projectplanner.us. Only origins listed in
 * `PASSKEYS_ALLOWED_ORIGINS` (or the production defaults) are accepted; a local `http://localhost:<port>` is accepted
 * only outside production builds, with `localhost` as its relying party. Netlify deploy previews are never accepted:
 * `netlify.app` is a public suffix, so a passkey cannot be scoped to one preview, and a preview is not our domain.
 */

export const PASSKEY_DEFAULT_RP_ID = 'projectplanner.us'
export const PASSKEY_DEFAULT_ORIGINS = ['https://www.projectplanner.us', 'https://projectplanner.us'] as const
export const PASSKEY_RP_NAME = 'Project Planner'

/** How long a sign-in or enrolment challenge lives (single use; see passkeyChallenge.ts). */
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000
/** Adding a passkey needs a second step (emailed code or passkey) within this time. */
export const PASSKEY_ENROL_FRESH_MS = 30 * 60 * 1000
/** Most passkeys one account may hold. */
export const PASSKEY_MAX_PER_USER = 10
/** Every signed-out (email) password-changed answer takes at least this long, so timing reveals nothing. */
export const PASSWORD_CHANGED_EMAIL_MIN_MS = 1500
/** The browser prompt's own timeout. */
export const PASSKEY_PROMPT_TIMEOUT_MS = 120 * 1000

type Env = Record<string, string | undefined>

function defaultEnv(): Env {
  // Literal reads so the Next build inlines the public value into both bundles.
  return {
    NEXT_PUBLIC_PASSKEYS_ENABLED: process.env.NEXT_PUBLIC_PASSKEYS_ENABLED,
    PASSKEYS_RP_ID: process.env.PASSKEYS_RP_ID,
    PASSKEYS_ALLOWED_ORIGINS: process.env.PASSKEYS_ALLOWED_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
  }
}

/** Off unless the variable is exactly "true" or "1". */
export function passkeysEnabled(env: Env = defaultEnv()): boolean {
  const value = (env.NEXT_PUBLIC_PASSKEYS_ENABLED || '').trim().toLowerCase()
  return value === 'true' || value === '1'
}

function normaliseOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export type PasskeyRelyingParty = { rpID: string; origin: string }

/**
 * The relying party for a request's `Origin` header, or null when that origin may not use passkeys.
 * - production (`https:`): the origin must be listed, and its host must be the rp id or a subdomain of it;
 * - `http://localhost:<port>` (and 127.0.0.1): only when NODE_ENV is not production, rp id `localhost`.
 */
export function passkeyRelyingParty(requestOrigin: string | null | undefined, env: Env = defaultEnv()): PasskeyRelyingParty | null {
  if (!requestOrigin) return null
  const origin = normaliseOrigin(requestOrigin)
  if (!origin) return null
  const url = new URL(origin)
  if (isLoopbackHost(url.hostname)) {
    if ((env.NODE_ENV || '').trim() === 'production') return null
    // WebAuthn treats http://localhost as a secure context; 127.0.0.1 is not a valid rp id, so it is refused.
    return url.hostname === 'localhost' ? { rpID: 'localhost', origin } : null
  }
  if (url.protocol !== 'https:') return null
  const rpID = (env.PASSKEYS_RP_ID || PASSKEY_DEFAULT_RP_ID).trim().toLowerCase()
  const configured = (env.PASSKEYS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((row) => normaliseOrigin(row))
    .filter((row): row is string => Boolean(row))
  const allowed = configured.length ? configured : [...PASSKEY_DEFAULT_ORIGINS]
  if (!allowed.includes(origin)) return null
  const host = url.hostname.toLowerCase()
  if (host !== rpID && !host.endsWith(`.${rpID}`)) return null
  return { rpID, origin }
}

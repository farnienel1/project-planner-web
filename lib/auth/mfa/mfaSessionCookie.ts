/**
 * The server session cookie that binds the MFA pass to the signed-in Firebase user (owner decision 17 Nov:
 * "server-side session cookie before launch").
 *
 * The cookie is a Firebase Auth **session cookie**: a JWT minted by Firebase (`projects/{id}:createSessionCookie`)
 * from the caller's verified ID token, only by a Node API route that has also checked the MFA "ok" cookie belongs to
 * that same uid (lib/auth/mfa/mfaSessionCookieMint.ts). It is signed by Google, not by our MFA secret, so a leaked
 * `MFA_SIGNING_SECRET` alone can no longer open the dashboard: the middleware needs both cookies and the same uid.
 *
 * Everything in this file is edge-safe (Web Crypto and `fetch` only) so the Next.js middleware can verify the cookie
 * itself: RS256 against Google's published session-cookie keys, issuer `https://session.firebase.google.com/{projectId}`,
 * audience = the project id, not expired, issued and signed in (`auth_time`) in the past, a non-empty `sub` (the uid)
 * — the checks firebase-admin's `verifySessionCookie` makes. Revocation is not checked here (that needs an Admin call
 * per request); the cookie is short-lived and is cleared on sign-out, idle sign-out, user switch and MFA reset.
 *
 * Keys: firebase-admin reads them as X.509 PEM certificates from
 * `https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys` (max-age=86400). This file reads the same
 * keys as a JWKS from `https://identitytoolkit.googleapis.com/v1/sessionCookiePublicKeys` instead, because Web Crypto
 * at the edge imports a JWK directly but cannot import an X.509 certificate without an ASN.1 parser (checked
 * 17 Nov 2026: both endpoints list the same five key ids). The v1 endpoint answers `max-age=0`, so the cache keeps
 * the keys for at least an hour (see `maxAgeMs`); a rotated key is still picked up because an unseen `kid` forces a
 * refetch.
 */

export const SESSION_COOKIE_KEYS_URL = 'https://identitytoolkit.googleapis.com/v1/sessionCookiePublicKeys'
/** The session cookie lives as long as an MFA pass (MFA_OK_TTL_MS); the middleware needs both, so the shorter wins. */
export const MFA_SESSION_TTL_MS = 12 * 60 * 60 * 1000
/** A status check re-mints the cookie when less than this is left, so an active session does not bounce. */
export const MFA_SESSION_REFRESH_BEFORE_MS = 60 * 60 * 1000
/** Clock skew allowed on `iat` / `auth_time` between Google and this server. */
export const MFA_SESSION_SKEW_MS = 5 * 60 * 1000

export type SessionCookieClaims = {
  uid: string
  /** ms */
  exp: number
  /** ms */
  iat: number
  /** When the person signed in to Firebase (ms). */
  authTime: number
}

export type SessionCookieCheck =
  | { status: 'ok'; claims: SessionCookieClaims }
  | { status: 'missing' }
  | { status: 'invalid'; reason: string }
  /** The signing keys could not be fetched (network, Google 5xx): try again, never "signed out". */
  | { status: 'unavailable' }

export type SessionKeyLookup = { status: 'ok'; key: CryptoKey } | { status: 'unknown' } | { status: 'unavailable' }

export type SessionKeyFetcher = { getKey(kid: string): Promise<SessionKeyLookup> }

type Jwk = { kid?: string; kty?: string; n?: string; e?: string; alg?: string; use?: string }

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null
  try {
    const pad = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function base64UrlJson(value: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(value)
  if (!bytes) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Checks the claims (no signature): Firebase's session-cookie rules. Returns the uid and times in ms, or why not. */
export function sessionCookieClaims(
  payload: Record<string, unknown>,
  projectId: string,
  nowMs = Date.now()
): { ok: true; claims: SessionCookieClaims } | { ok: false; reason: string } {
  if (!projectId) return { ok: false, reason: 'no-project' }
  if (payload.iss !== `https://session.firebase.google.com/${projectId}`) return { ok: false, reason: 'issuer' }
  if (payload.aud !== projectId) return { ok: false, reason: 'audience' }
  const sub = payload.sub
  if (typeof sub !== 'string' || !sub || sub.length > 128) return { ok: false, reason: 'subject' }
  const exp = payload.exp
  const iat = payload.iat
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp * 1000 <= nowMs) return { ok: false, reason: 'expired' }
  if (typeof iat !== 'number' || !Number.isFinite(iat) || iat * 1000 > nowMs + MFA_SESSION_SKEW_MS) {
    return { ok: false, reason: 'issued-at' }
  }
  // Required, as firebase-admin requires it: when the person signed in to Firebase, in the past.
  const authTimeRaw = payload.auth_time
  if (typeof authTimeRaw !== 'number' || !Number.isFinite(authTimeRaw) || authTimeRaw * 1000 > nowMs + MFA_SESSION_SKEW_MS) {
    return { ok: false, reason: 'auth-time' }
  }
  return { ok: true, claims: { uid: sub, exp: exp * 1000, iat: iat * 1000, authTime: authTimeRaw * 1000 } }
}

/**
 * Verifies a Firebase session cookie. `allowUnsigned` is only for the local Auth emulator, which mints `alg: none`
 * cookies (see `sessionCookieAllowsUnsigned`); production never passes it.
 */
export async function verifyFirebaseSessionCookie(
  raw: string | null | undefined,
  options: { projectId: string; keys: SessionKeyFetcher; nowMs?: number; allowUnsigned?: boolean }
): Promise<SessionCookieCheck> {
  if (!raw) return { status: 'missing' }
  const parts = raw.split('.')
  if (parts.length !== 3) return { status: 'invalid', reason: 'format' }
  const [headerPart, payloadPart, signaturePart] = parts
  const header = base64UrlJson(headerPart)
  const payload = base64UrlJson(payloadPart)
  if (!header || !payload) return { status: 'invalid', reason: 'format' }

  const checked = sessionCookieClaims(payload, options.projectId, options.nowMs ?? Date.now())
  if (!checked.ok) return { status: 'invalid', reason: checked.reason }

  if (header.alg === 'none') {
    return options.allowUnsigned && signaturePart === ''
      ? { status: 'ok', claims: checked.claims }
      : { status: 'invalid', reason: 'unsigned' }
  }
  if (header.alg !== 'RS256') return { status: 'invalid', reason: 'algorithm' }
  if (typeof header.kid !== 'string' || !header.kid) return { status: 'invalid', reason: 'key-id' }

  const signature = base64UrlToBytes(signaturePart)
  if (!signature || signature.length === 0) return { status: 'invalid', reason: 'signature' }

  const lookup = await options.keys.getKey(header.kid)
  if (lookup.status === 'unavailable') return { status: 'unavailable' }
  if (lookup.status === 'unknown') return { status: 'invalid', reason: 'key-id' }

  let valid = false
  try {
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      lookup.key,
      signature as BufferSource,
      new TextEncoder().encode(`${headerPart}.${payloadPart}`) as BufferSource
    )
  } catch {
    valid = false
  }
  return valid ? { status: 'ok', claims: checked.claims } : { status: 'invalid', reason: 'signature' }
}

/**
 * How long fetched keys count as fresh. Google answers `max-age=0` today, so the header is a floor of one hour and a
 * cap of six (firebase-admin caches these keys for six hours); a rotated key is still picked up at once because an
 * unknown `kid` forces a refetch (at most once a minute).
 */
function maxAgeMs(cacheControl: string | null): number {
  const match = /max-age=(\d+)/i.exec(cacheControl || '')
  const seconds = match ? Number(match[1]) : 0
  return Math.min(6 * 3600, Math.max(3600, seconds)) * 1000
}

/**
 * Fetches and caches Google's session-cookie keys. A key that was valid stays usable when a refresh fails (a
 * passing network error never signs anyone out); an unknown `kid` forces at most one refetch a minute.
 */
export function createSessionKeyFetcher(
  options: { url?: string; fetchImpl?: typeof fetch; now?: () => number } = {}
): SessionKeyFetcher {
  const url = options.url || SESSION_COOKIE_KEYS_URL
  const now = options.now || (() => Date.now())
  let keys = new Map<string, CryptoKey>()
  let freshUntil = 0
  let lastAttempt = 0
  let inflight: Promise<boolean> | null = null

  async function load(): Promise<boolean> {
    try {
      const doFetch = options.fetchImpl || fetch
      // No fetch options: an edge runtime that rejects one (e.g. `cache`) would turn every page into the 503.
      // Freshness is this module's own in-memory cache and its TTL (review of #359).
      const response = await doFetch(url)
      if (!response.ok) return false
      const body = (await response.json()) as { keys?: Jwk[] }
      const next = new Map<string, CryptoKey>()
      for (const jwk of body.keys || []) {
        if (!jwk.kid || jwk.kty !== 'RSA' || !jwk.n || !jwk.e) continue
        const key = await crypto.subtle.importKey(
          'jwk',
          { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify']
        )
        next.set(jwk.kid, key)
      }
      if (next.size === 0) return false
      keys = next
      freshUntil = now() + maxAgeMs(response.headers.get('cache-control'))
      return true
    } catch {
      return false
    }
  }

  function refresh(): Promise<boolean> {
    if (inflight) return inflight
    lastAttempt = now()
    // Assigned before it is cleared: the clean-up runs in a later microtask, so a fetch that throws synchronously
    // can never leave a finished promise stuck in `inflight` (review of #359).
    const pending: Promise<boolean> = Promise.resolve()
      .then(load)
      .catch(() => false)
      .finally(() => {
        if (inflight === pending) inflight = null
      })
    inflight = pending
    return pending
  }

  return {
    async getKey(kid: string): Promise<SessionKeyLookup> {
      const fresh = now() < freshUntil
      const cached = keys.get(kid)
      if (fresh && cached) return { status: 'ok', key: cached }
      // Keys were fetched under a minute ago and this kid is not among them: it may have been published since
      // (a just-rotated key). Try again shortly — never "invalid", which would clear a valid cookie.
      if (fresh && !cached && now() - lastAttempt < 60_000) return { status: 'unavailable' }
      const refreshed = await refresh()
      const key = keys.get(kid)
      if (key) return { status: 'ok', key }
      if (refreshed) return { status: 'unknown' }
      // The refresh failed: never call an unseen key "unknown" (that would sign the person out); try again later.
      return { status: 'unavailable' }
    },
  }
}

/** One fetcher per server instance / edge isolate, so the keys are fetched about once per cache period. */
export const defaultSessionKeyFetcher: SessionKeyFetcher = createSessionKeyFetcher()

/**
 * The local Auth emulator mints unsigned (`alg: none`) session cookies. They are accepted only when the emulator
 * harness switch is on and the Auth emulator host is a loopback address (the same test as lib/owner/googleApis.ts);
 * a Netlify build never has either.
 */
export function sessionCookieAllowsUnsigned(
  // Literal reads, so a Next build inlines NEXT_PUBLIC_USE_EMULATORS into the edge middleware.
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_USE_EMULATORS: process.env.NEXT_PUBLIC_USE_EMULATORS,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  }
): boolean {
  if (env.NEXT_PUBLIC_USE_EMULATORS !== '1') return false
  return /^(127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test((env.FIREBASE_AUTH_EMULATOR_HOST || '').trim())
}

export function sessionProjectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
}

/** Verify with the app's project, the shared key cache and the emulator switch. */
export function verifyAppSessionCookie(raw: string | null | undefined, nowMs = Date.now()): Promise<SessionCookieCheck> {
  return verifyFirebaseSessionCookie(raw, {
    projectId: sessionProjectId(),
    keys: defaultSessionKeyFetcher,
    nowMs,
    allowUnsigned: sessionCookieAllowsUnsigned(),
  })
}

export type MfaPageGate =
  | { action: 'allow' }
  /** Send to the code screen; `clearSession` when the session cookie was present but refused or for someone else. */
  | { action: 'verify'; clearSession: boolean }
  /** The keys could not be fetched: answer 503 and let the browser try again. Never a sign-out. */
  | { action: 'retry' }

/**
 * The middleware's decision for /dashboard and /developer: both the MFA "ok" cookie and the session cookie must be
 * valid and name the same uid.
 */
export function mfaPageGateDecision(ok: { uid: string } | null, session: SessionCookieCheck): MfaPageGate {
  if (!ok) return { action: 'verify', clearSession: session.status !== 'missing' }
  if (session.status === 'unavailable') return { action: 'retry' }
  if (session.status === 'ok' && session.claims.uid === ok.uid) return { action: 'allow' }
  return { action: 'verify', clearSession: session.status !== 'missing' }
}

/**
 * The status route's plan once the MFA pass is confirmed for `uid` (the caller's verified ID token): keep a valid
 * session cookie for that uid with enough time left, otherwise mint a new one.
 */
export function sessionCookiePlan(
  uid: string,
  current: SessionCookieCheck,
  nowMs = Date.now()
): 'keep' | 'mint' {
  if (current.status === 'ok' && current.claims.uid === uid && current.claims.exp - nowMs > MFA_SESSION_REFRESH_BEFORE_MS) {
    return 'keep'
  }
  return 'mint'
}

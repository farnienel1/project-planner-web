import { adminGoogleAccessToken, GoogleAccessTokenError, serviceAccountProjectId } from '@/lib/owner/identityToolkitAdmin'
import { identityToolkitBase } from '@/lib/owner/googleApis'
import { MFA_SESSION_TTL_MS, sessionCookieAllowsUnsigned, sessionProjectId } from '@/lib/auth/mfa/mfaSessionCookie'

/**
 * Mints a Firebase session cookie from the caller's ID token (Node API routes only). The caller has already checked
 * the ID token and that the MFA "ok" cookie belongs to that same uid. Uses the existing
 * `FIREBASE_SERVICE_ACCOUNT_JSON` (no new key); against the local Auth emulator it uses the emulator's `owner` token.
 *
 * It mints for exactly the project the middleware checks (`sessionProjectId()`, i.e. NEXT_PUBLIC_FIREBASE_PROJECT_ID)
 * and uses the same emulator switch as the verifier (`sessionCookieAllowsUnsigned()`), so a cookie it mints is one the
 * middleware accepts. The status route still verifies every minted cookie before answering "verified".
 *
 * - `ok`: the cookie and how long it lives.
 * - `invalid`: Firebase refused the ID token (400 with an ID-token error): treat as not signed in.
 * - `unavailable`: no answer, Google 429 / 5xx: the caller answers 503 so the browser tries again.
 * - `setup`: the server is set up wrongly — no or unusable service account, its project differs from the app's,
 *   Google 401 / 403, or another 400. Retrying will not help; it is logged loudly and the person sees a distinct
 *   message. Never a sign-out either.
 *
 * Logs carry the HTTP status and Google's error code only — never the ID token, the access token or the cookie.
 */
export type SessionCookieMint =
  | { status: 'ok'; cookie: string; maxAgeMs: number }
  | { status: 'invalid' }
  | { status: 'unavailable' }
  | { status: 'setup'; reason: string }

/** Google's `error.message` for a refused ID token (its code only, e.g. "INVALID_ID_TOKEN : …" → INVALID_ID_TOKEN). */
const ID_TOKEN_ERRORS = new Set(['INVALID_ID_TOKEN', 'TOKEN_EXPIRED', 'USER_NOT_FOUND', 'USER_DISABLED', 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN', 'MISSING_ID_TOKEN'])

export function googleErrorCode(body: unknown): string {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message
  if (typeof message !== 'string') return ''
  const code = message.split(/[\s:]/)[0] || ''
  return /^[A-Z0-9_]{2,64}$/.test(code) ? code : ''
}

function logSetup(reason: string, details: Record<string, unknown> = {}) {
  console.error('[auth/mfa/session] SETUP ERROR: Firebase session cookies cannot be minted —', reason, details)
}

export async function mintFirebaseSessionCookie(
  idToken: string,
  options: {
    validDurationMs?: number
    fetchImpl?: typeof fetch
    accessToken?: () => Promise<{ token: string; projectId: string }>
    /** The project the middleware checks; defaults to `sessionProjectId()`. */
    projectId?: string
    /** The service account's own project_id; defaults to the configured account's. */
    serviceAccountProject?: string | null
    emulator?: boolean
    base?: string
  } = {}
): Promise<SessionCookieMint> {
  if (!idToken) return { status: 'invalid' }
  const validDurationMs = options.validDurationMs ?? MFA_SESSION_TTL_MS
  const emulator = options.emulator ?? sessionCookieAllowsUnsigned()
  const doFetch = options.fetchImpl || fetch
  const projectId = options.projectId ?? sessionProjectId()
  if (!projectId) {
    logSetup('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set')
    return { status: 'setup', reason: 'no-project' }
  }

  let bearer = 'owner'
  if (!emulator) {
    const saProject = options.serviceAccountProject !== undefined ? options.serviceAccountProject : serviceAccountProjectId()
    if (saProject && saProject !== projectId) {
      logSetup('the service account belongs to another project than NEXT_PUBLIC_FIREBASE_PROJECT_ID', {
        serviceAccountProject: saProject,
        appProject: projectId,
      })
      return { status: 'setup', reason: 'project-mismatch' }
    }
    try {
      const access = await (options.accessToken ||
        (() =>
          adminGoogleAccessToken([
            'https://www.googleapis.com/auth/identitytoolkit',
            'https://www.googleapis.com/auth/firebase',
          ])))()
      bearer = access.token
    } catch (error) {
      if (error instanceof GoogleAccessTokenError && error.kind === 'unavailable') {
        console.warn('[auth/mfa/session] service-account token unavailable', { httpStatus: error.httpStatus, googleError: error.googleError })
        return { status: 'unavailable' }
      }
      logSetup('the service account could not authenticate', {
        httpStatus: error instanceof GoogleAccessTokenError ? error.httpStatus : null,
        googleError: error instanceof GoogleAccessTokenError ? error.googleError : null,
        message: error instanceof Error ? error.message : String(error),
      })
      return { status: 'setup', reason: 'service-account' }
    }
  }

  const base = options.base || identityToolkitBase()
  let response: Response
  try {
    response = await doFetch(`${base}/projects/${encodeURIComponent(projectId)}:createSessionCookie`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, validDuration: String(Math.floor(validDurationMs / 1000)) }),
    })
  } catch {
    console.warn('[auth/mfa/session] createSessionCookie unreachable')
    return { status: 'unavailable' }
  }
  if (!response.ok) {
    const code = googleErrorCode(await response.json().catch(() => null))
    if (response.status === 429 || response.status >= 500) {
      console.warn('[auth/mfa/session] createSessionCookie unavailable', { httpStatus: response.status, googleError: code })
      return { status: 'unavailable' }
    }
    if (response.status === 400 && ID_TOKEN_ERRORS.has(code)) {
      console.warn('[auth/mfa/session] createSessionCookie refused the ID token', { httpStatus: 400, googleError: code })
      return { status: 'invalid' }
    }
    logSetup('createSessionCookie refused the request', { httpStatus: response.status, googleError: code })
    return { status: 'setup', reason: `http-${response.status}` }
  }
  let data: { sessionCookie?: string }
  try {
    data = (await response.json()) as typeof data
  } catch {
    return { status: 'unavailable' }
  }
  if (!data.sessionCookie) return { status: 'unavailable' }
  return { status: 'ok', cookie: data.sessionCookie, maxAgeMs: validDurationMs }
}

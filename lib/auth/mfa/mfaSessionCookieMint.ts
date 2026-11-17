import { adminGoogleAccessToken } from '@/lib/owner/identityToolkitAdmin'
import { emulatorHost, identityToolkitBase } from '@/lib/owner/googleApis'
import { MFA_SESSION_TTL_MS } from '@/lib/auth/mfa/mfaSessionCookie'

/**
 * Mints a Firebase session cookie from the caller's ID token (Node API routes only). The caller has already checked
 * the ID token and that the MFA "ok" cookie belongs to that same uid. Uses the existing
 * `FIREBASE_SERVICE_ACCOUNT_JSON` (no new key); against the local Auth emulator it uses the emulator's `owner` token.
 *
 * - `ok`: the cookie and how long it lives.
 * - `invalid`: Firebase refused the ID token (400): treat as not signed in.
 * - `unavailable`: no answer, Google 401/403/429/5xx, or the service account is missing / could not authenticate.
 *   The caller answers 503 so the browser tries again — never a sign-out.
 */
export type SessionCookieMint =
  | { status: 'ok'; cookie: string; maxAgeMs: number }
  | { status: 'invalid' }
  | { status: 'unavailable' }

export async function mintFirebaseSessionCookie(
  idToken: string,
  options: {
    validDurationMs?: number
    fetchImpl?: typeof fetch
    accessToken?: () => Promise<{ token: string; projectId: string }>
    projectId?: string
    emulator?: boolean
    base?: string
  } = {}
): Promise<SessionCookieMint> {
  if (!idToken) return { status: 'invalid' }
  const validDurationMs = options.validDurationMs ?? MFA_SESSION_TTL_MS
  const emulator = options.emulator ?? Boolean(emulatorHost('FIREBASE_AUTH_EMULATOR_HOST'))
  const doFetch = options.fetchImpl || fetch

  let bearer = 'owner'
  let projectId = options.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
  if (!emulator) {
    try {
      const access = await (options.accessToken ||
        (() =>
          adminGoogleAccessToken([
            'https://www.googleapis.com/auth/identitytoolkit',
            'https://www.googleapis.com/auth/firebase',
          ])))()
      bearer = access.token
      projectId = options.projectId || access.projectId || projectId
    } catch (error) {
      console.error('[auth/mfa/session] service account could not authenticate', error instanceof Error ? error.message : error)
      return { status: 'unavailable' }
    }
  }
  if (!projectId) return { status: 'unavailable' }

  const base = options.base || identityToolkitBase()
  let response: Response
  try {
    response = await doFetch(`${base}/projects/${encodeURIComponent(projectId)}:createSessionCookie`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, validDuration: String(Math.floor(validDurationMs / 1000)) }),
    })
  } catch {
    return { status: 'unavailable' }
  }
  if (response.status === 400) return { status: 'invalid' }
  if (!response.ok) return { status: 'unavailable' }
  let data: { sessionCookie?: string }
  try {
    data = (await response.json()) as typeof data
  } catch {
    return { status: 'unavailable' }
  }
  if (!data.sessionCookie) return { status: 'unavailable' }
  return { status: 'ok', cookie: data.sessionCookie, maxAgeMs: validDurationMs }
}

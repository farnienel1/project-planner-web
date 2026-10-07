/**
 * Server-side Identity Toolkit calls.
 *
 * The public Firebase web API key remains in the browser because Firestore and
 * Auth token refresh use the client SDK. Someone who copies that key can still
 * call identitytoolkit.googleapis.com directly. Referrer restrictions and
 * App Check are Google Cloud console settings; this repo cannot apply them
 * without that click, and Firestore rules are left unchanged.
 */

export type IdentityTokens = {
  ok: true
  localId: string
  email: string
  idToken: string
  refreshToken: string
}

export type IdentityFailure = { ok: false; code: string }

export type IdentityResult = IdentityTokens | IdentityFailure

type ErrorBody = { error?: { message?: string } }

function apiKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()
  if (!key) throw new Error('Firebase is not configured on the server.')
  return key
}

function failureCode(data: ErrorBody, status: number): string {
  const message = data.error?.message || ''
  const code = message.split(' ')[0] || ''
  return code || `HTTP_${status}`
}

async function postIdentity(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: ErrorBody & Record<string, unknown> }> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(apiKey())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as ErrorBody & Record<string, unknown>
  return { ok: response.ok, status: response.status, data }
}

function tokensFrom(data: Record<string, unknown>, fallbackEmail: string): IdentityResult {
  const localId = typeof data.localId === 'string' ? data.localId : ''
  const idToken = typeof data.idToken === 'string' ? data.idToken : ''
  const refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : ''
  const email = typeof data.email === 'string' ? data.email : fallbackEmail
  if (!localId || !idToken) return { ok: false, code: 'MISSING_TOKEN' }
  return { ok: true, localId, email, idToken, refreshToken }
}

export async function identitySignInWithPassword(email: string, password: string): Promise<IdentityResult> {
  const result = await postIdentity('accounts:signInWithPassword', { email, password, returnSecureToken: true })
  if (!result.ok) return { ok: false, code: failureCode(result.data, result.status) }
  return tokensFrom(result.data, email)
}

export async function identitySignUp(email: string, password: string): Promise<IdentityResult> {
  const result = await postIdentity('accounts:signUp', { email, password, returnSecureToken: true })
  if (!result.ok) return { ok: false, code: failureCode(result.data, result.status) }
  return tokensFrom(result.data, email)
}

export async function identitySendPasswordReset(email: string, continueUrl: string): Promise<{ ok: true } | IdentityFailure> {
  const send = (includeContinue: boolean) =>
    postIdentity(
      'accounts:sendOobCode',
      includeContinue
        ? { requestType: 'PASSWORD_RESET', email, continueUrl }
        : { requestType: 'PASSWORD_RESET', email }
    )
  let result = await send(Boolean(continueUrl))
  if (!result.ok && continueUrl && failureCode(result.data, result.status).includes('INVALID_CONTINUE_URI')) {
    result = await send(false)
  }
  if (!result.ok) return { ok: false, code: failureCode(result.data, result.status) }
  return { ok: true }
}

export async function identityConfirmPasswordReset(oobCode: string, newPassword: string): Promise<{ ok: true } | IdentityFailure> {
  const result = await postIdentity('accounts:resetPassword', { oobCode, newPassword })
  if (!result.ok) return { ok: false, code: failureCode(result.data, result.status) }
  return { ok: true }
}

export async function identityUpdatePassword(idToken: string, password: string): Promise<{ ok: true } | IdentityFailure> {
  const result = await postIdentity('accounts:update', { idToken, password, returnSecureToken: true })
  if (!result.ok) return { ok: false, code: failureCode(result.data, result.status) }
  return { ok: true }
}

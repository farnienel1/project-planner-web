import { createSign } from 'node:crypto'

type ServiceAccount = {
  client_email: string
  private_key: string
  project_id?: string
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ServiceAccount
    if (!parsed.client_email || !parsed.private_key) return null
    return parsed
  } catch {
    return null
  }
}

export function firebaseAdminConfigured(): boolean {
  return Boolean(readServiceAccount() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim())
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

/**
 * Why the service-account access token could not be had: `setup` (the account is missing or unusable, or Google
 * refused it — a deploy problem that retrying will not fix) or `unavailable` (no answer, 429 or 5xx — try again).
 * Callers that do not care read it as a plain Error with the same message as before.
 */
export class GoogleAccessTokenError extends Error {
  readonly kind: 'setup' | 'unavailable'
  readonly httpStatus: number | null
  readonly googleError: string | null
  constructor(message: string, kind: 'setup' | 'unavailable', httpStatus: number | null = null, googleError: string | null = null) {
    super(message)
    this.name = 'GoogleAccessTokenError'
    this.kind = kind
    this.httpStatus = httpStatus
    this.googleError = googleError
  }
}

/** The service account's own project id, or null when none is configured (never the key itself). */
export function serviceAccountProjectId(): string | null {
  return readServiceAccount()?.project_id || null
}

async function googleAccessToken(scopes: string[]): Promise<{ token: string; projectId: string }> {
  const sa = readServiceAccount()
  if (!sa) {
    throw new GoogleAccessTokenError('FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.', 'setup')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: scopes.join(' '),
    })
  )
  let assertion: string
  try {
    const signer = createSign('RSA-SHA256')
    signer.update(`${header}.${payload}`)
    assertion = `${header}.${payload}.${signer.sign(sa.private_key.replace(/\\n/g, '\n'), 'base64url')}`
  } catch {
    throw new GoogleAccessTokenError('The Firebase Admin service account private key could not be used.', 'setup')
  }
  let response: Response
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
  } catch {
    throw new GoogleAccessTokenError('Could not reach Google to authenticate the Firebase Admin service account.', 'unavailable')
  }
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string }
  if (!response.ok || !data.access_token) {
    const passing = response.status === 429 || response.status >= 500
    throw new GoogleAccessTokenError(
      data.error_description || 'Could not authenticate the Firebase Admin service account.',
      passing ? 'unavailable' : 'setup',
      response.status,
      typeof data.error === 'string' ? data.error : null
    )
  }
  return {
    token: data.access_token,
    projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  }
}

export async function adminGoogleAccessToken(scopes: string[]) {
  return googleAccessToken(scopes)
}

export async function adminLookupAuthEmail(uid: string): Promise<string | null> {
  const { token, projectId } = await googleAccessToken([
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: [uid] }),
    }
  )
  const data = (await response.json().catch(() => ({}))) as { users?: { email?: string }[]; error?: { message?: string } }
  if (!response.ok) return null
  const email = data.users?.[0]?.email
  return email ? email.trim().toLowerCase() : null
}

/**
 * The Firebase Auth creation time of one account, with the server key. `null` when there is no Auth account;
 * throws when the lookup itself fails (callers refuse rather than guess).
 */
export async function adminLookupAuthCreatedAtMs(uid: string): Promise<number | null> {
  const { token, projectId } = await googleAccessToken([
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: [uid] }),
    }
  )
  if (!response.ok) throw new Error('Could not look up the Auth account.')
  const data = (await response.json().catch(() => null)) as { users?: { localId?: string; createdAt?: string }[] } | null
  if (!data) throw new Error('Could not read the Auth account.')
  const user = data.users?.find((row) => row.localId === uid)
  if (!user) return null
  const createdAt = typeof user.createdAt === 'string' && /^\d+$/.test(user.createdAt) ? Number(user.createdAt) : NaN
  if (!Number.isFinite(createdAt) || createdAt <= 0) throw new Error('The Auth account has no creation time.')
  return createdAt
}

/** How many documents one collection holds, up to `limit`, read with the server key (rules do not apply). */
export async function adminCountCollection(collectionPath: string, limit = 1): Promise<number> {
  const { token, projectId } = await googleAccessToken(['https://www.googleapis.com/auth/datastore'])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collectionPath}`
  )
  url.searchParams.set('pageSize', String(Math.max(1, limit)))
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (response.status === 404) return 0
  if (!response.ok) throw new Error(`Could not list ${collectionPath}`)
  const body = (await response.json().catch(() => null)) as { documents?: unknown[] } | null
  if (!body) throw new Error(`Could not read ${collectionPath}`)
  return (body.documents || []).length
}

/** Document ids of one collection, read with the server key (rules do not apply). Throws when the list fails. */
export async function adminListDocumentIds(collectionPath: string, limit = 500): Promise<string[]> {
  const { token, projectId } = await googleAccessToken(['https://www.googleapis.com/auth/datastore'])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const ids: string[] = []
  let pageToken = ''
  while (ids.length < limit) {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collectionPath}`
    )
    url.searchParams.set('pageSize', String(Math.min(300, limit - ids.length)))
    url.searchParams.set('mask.fieldPaths', '__name__')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (response.status === 404) break
    if (!response.ok) throw new Error(`Could not list ${collectionPath}`)
    const body = (await response.json().catch(() => null)) as { documents?: { name?: string }[]; nextPageToken?: string } | null
    if (!body) throw new Error(`Could not read ${collectionPath}`)
    for (const row of body.documents || []) {
      const name = row.name || ''
      ids.push(name.slice(name.lastIndexOf('/') + 1))
    }
    if (!body.nextPageToken) break
    pageToken = body.nextPageToken
  }
  return ids
}

export async function adminLookupAuthUserByEmail(email: string): Promise<{ uid: string } | null> {
  const emailLower = email.trim().toLowerCase()
  if (!emailLower) return null
  const { token, projectId } = await googleAccessToken([
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: [emailLower] }),
    }
  )
  const data = (await response.json().catch(() => ({}))) as {
    users?: { localId?: string }[]
    error?: { message?: string }
  }
  if (!response.ok) return null
  const uid = data.users?.[0]?.localId
  return uid ? { uid } : null
}

export async function adminPasswordResetLink(email: string, continueUrl: string): Promise<string> {
  const { token, projectId } = await googleAccessToken([
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:sendOobCode`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email,
        returnOobLink: true,
        continueUrl,
      }),
    }
  )
  let data = (await response.json().catch(() => ({}))) as { oobLink?: string; error?: { message?: string } }
  if ((!response.ok || !data.oobLink) && continueUrl) {
    const retry = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:sendOobCode`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
          returnOobLink: true,
        }),
      }
    )
    data = (await retry.json().catch(() => ({}))) as { oobLink?: string; error?: { message?: string } }
    if (!retry.ok || !data.oobLink) {
      const message = data.error?.message || ''
      if (message.includes('EMAIL_NOT_FOUND')) throw new Error('No Firebase login exists for that email yet.')
      throw new Error(data.error?.message || 'Could not create a password reset link.')
    }
    return data.oobLink
  }
  if (!response.ok || !data.oobLink) {
    const message = data.error?.message || ''
    if (message.includes('EMAIL_NOT_FOUND')) throw new Error('No Firebase login exists for that email yet.')
    throw new Error(data.error?.message || 'Could not create a password reset link.')
  }
  return data.oobLink
}

export async function adminUpdateAuthEmail(uid: string, email: string): Promise<void> {
  const { token, projectId } = await googleAccessToken([
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, email, emailVerified: true }),
    }
  )
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok) {
    const message = data.error?.message || ''
    if (message.includes('EMAIL_EXISTS')) throw new Error('That email is already used by another login.')
    if (message.includes('USER_NOT_FOUND')) throw new Error('No Firebase login exists for that user id.')
    throw new Error(data.error?.message || 'Could not update the Firebase login email.')
  }
}

function identityError(data: { error?: { message?: string } }): string {
  return data.error?.message || ''
}

export async function verifyAuthPassword(email: string, password: string): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey || !email || !password) return false
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  if (!response.ok) return false
  const data = (await response.json().catch(() => ({}))) as { localId?: string }
  return Boolean(data.localId)
}

export async function adminRevokeRefreshTokens(uid: string): Promise<void> {
  const { token, projectId } = await googleAccessToken([
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/accounts:revokeRefreshTokens`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid }),
    }
  )
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  const message = identityError(data)
  if (!response.ok && !message.includes('USER_NOT_FOUND')) {
    throw new Error(data.error?.message || 'Could not revoke refresh tokens.')
  }
}

export async function adminDeleteAuthUser(uid: string): Promise<void> {
  const { token, projectId } = await googleAccessToken([
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/firebase',
  ])
  if (!projectId) throw new Error('Firebase project id is missing.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:delete`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid }),
    }
  )
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  const message = identityError(data)
  if (!response.ok && !message.includes('USER_NOT_FOUND')) {
    throw new Error(data.error?.message || 'Could not delete the Firebase login.')
  }
}

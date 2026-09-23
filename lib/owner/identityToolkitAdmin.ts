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

async function googleAccessToken(scopes: string[]): Promise<{ token: string; projectId: string }> {
  const sa = readServiceAccount()
  if (!sa) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.')
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
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const assertion = `${header}.${payload}.${signer.sign(sa.private_key.replace(/\\n/g, '\n'), 'base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string }
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'Could not authenticate the Firebase Admin service account.')
  }
  return {
    token: data.access_token,
    projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  }
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

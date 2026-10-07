import { createHmac, timingSafeEqual } from 'node:crypto'

import { adminGoogleAccessToken, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'

export const WEB_SESSION_COOKIE = 'pp_session'
export const WEB_SESSION_MAX_AGE_SEC = 5 * 24 * 60 * 60

export type WebSessionUser = {
  uid: string
  email: string | null
  emailVerified: boolean
}

type AppSession = {
  v: 1
  uid: string
  email: string | null
  emailVerified: boolean
  exp: number
}

export function webSessionCookieOptions(maxAgeSec: number, secure: boolean) {
  return {
    httpOnly: true as const,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.max(0, maxAgeSec),
  }
}

/**
 * A private server secret. The public Firebase web API key is not a secret:
 * it ships in the client bundle, so it must not sign a session cookie.
 */
export function privateSessionSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET?.trim() || process.env.MFA_SIGNING_SECRET?.trim() || ''
  if (!secret) return null
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()
  if (apiKey && secret === apiKey) return null
  return secret
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function encodeAppSession(value: AppSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function decodeAppSession(raw: string, secret: string): AppSession | null {
  const dot = raw.indexOf('.')
  if (dot <= 0) return null
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!payload || !sig || raw.slice(dot + 1).includes('.')) return null
  const expected = sign(payload, secret)
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AppSession
    if (parsed.v !== 1 || !parsed.uid || typeof parsed.exp !== 'number') return null
    if (parsed.exp * 1000 <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

type CertCache = { expiresAt: number; certs: Record<string, string> }
let certCache: CertCache | null = null

async function sessionCerts(): Promise<Record<string, string>> {
  const now = Date.now()
  if (certCache && certCache.expiresAt > now) return certCache.certs
  const response = await fetch('https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys')
  if (!response.ok) throw new Error('session certs unavailable')
  const certs = (await response.json()) as Record<string, string>
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 3600)
  certCache = { expiresAt: now + Math.max(60, maxAge) * 1000, certs }
  return certs
}

export async function verifyFirebaseSessionCookie(cookie: string, projectId: string): Promise<WebSessionUser | null> {
  const parts = cookie.split('.')
  if (parts.length !== 3 || !projectId) return null
  const [headerPart, payloadPart, signature] = parts
  let header: { alg?: string; kid?: string }
  let payload: { iss?: string; aud?: string; sub?: string; exp?: number; email?: string; email_verified?: boolean }
  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (header.alg !== 'RS256' || !header.kid || !payload.sub || !payload.exp) return null
  if (payload.exp * 1000 <= Date.now()) return null
  if (payload.aud !== projectId) return null
  if (payload.iss !== `https://session.firebase.google.com/${projectId}`) return null
  try {
    const { createVerify } = await import('node:crypto')
    const cert = (await sessionCerts())[header.kid]
    if (!cert) return null
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${headerPart}.${payloadPart}`)
    verifier.end()
    if (!verifier.verify(cert, signature, 'base64url')) return null
  } catch {
    return null
  }
  return {
    uid: payload.sub,
    email: payload.email ? payload.email.toLowerCase() : null,
    emailVerified: Boolean(payload.email_verified),
  }
}

async function createFirebaseSessionCookie(idToken: string): Promise<string | null> {
  if (!firebaseAdminConfigured() || !idToken) return null
  try {
    const { token, projectId } = await adminGoogleAccessToken([
      'https://www.googleapis.com/auth/identitytoolkit',
      'https://www.googleapis.com/auth/firebase',
    ])
    if (!projectId) return null
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}:createSessionCookie`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, validDuration: WEB_SESSION_MAX_AGE_SEC }),
      }
    )
    const data = (await response.json().catch(() => ({}))) as { sessionCookie?: string }
    return response.ok && data.sessionCookie ? data.sessionCookie : null
  } catch {
    return null
  }
}

export async function mintWebSession(input: {
  idToken: string
  uid: string
  email: string | null
  emailVerified: boolean
}): Promise<{ value: string; maxAgeSec: number } | null> {
  const firebaseCookie = await createFirebaseSessionCookie(input.idToken)
  if (firebaseCookie) return { value: firebaseCookie, maxAgeSec: WEB_SESSION_MAX_AGE_SEC }
  const secret = privateSessionSecret()
  if (!secret || !input.uid) return null
  const exp = Math.floor(Date.now() / 1000) + WEB_SESSION_MAX_AGE_SEC
  return {
    value: encodeAppSession(
      { v: 1, uid: input.uid, email: input.email, emailVerified: input.emailVerified, exp },
      secret
    ),
    maxAgeSec: WEB_SESSION_MAX_AGE_SEC,
  }
}

export async function readWebSessionCookie(raw: string | undefined | null): Promise<WebSessionUser | null> {
  if (!raw) return null
  if (raw.split('.').length === 3) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || ''
    return verifyFirebaseSessionCookie(raw, projectId)
  }
  const secret = privateSessionSecret()
  if (!secret) return null
  const session = decodeAppSession(raw, secret)
  if (!session) return null
  return { uid: session.uid, email: session.email, emailVerified: session.emailVerified }
}

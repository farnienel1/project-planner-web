import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/security/rateLimit'

export { clientSafeMessage } from '@/lib/security/sanitize'

export type FirebaseAuthUser = {
  uid: string
  email: string | null
  emailVerified: boolean
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

export function jsonError(message: string, status: number, retryAfterSec?: number) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (retryAfterSec) headers['Retry-After'] = String(retryAfterSec)
  return NextResponse.json(
    retryAfterSec ? { error: message, retryAfterSec } : { error: message },
    { status, headers }
  )
}

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const result = rateLimit(`${scope}:${clientIp(request)}`, limit, windowMs)
  if (result.ok) return null
  return jsonError('Too many requests. Please try again shortly.', 429, result.retryAfterSec)
}

export async function readJsonBody<T>(
  request: NextRequest,
  maxBytes = 32_768
): Promise<{ ok: true; value: T } | { ok: false; response: NextResponse }> {
  const lengthHeader = request.headers.get('content-length')
  const length = lengthHeader ? Number(lengthHeader) : 0
  if (Number.isFinite(length) && length > maxBytes) {
    return { ok: false, response: jsonError('Request too large', 413) }
  }

  try {
    const value = (await request.json()) as T
    return { ok: true, value }
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) }
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseAuthUser | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey || !idToken) return null

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!response.ok) return null

    const data = (await response.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>
    }
    const user = data.users?.[0]
    if (!user?.localId) return null

    return {
      uid: user.localId,
      email: user.email ? user.email.toLowerCase() : null,
      emailVerified: Boolean(user.emailVerified),
    }
  } catch {
    return null
  }
}

export async function requireFirebaseUser(
  request: NextRequest
): Promise<FirebaseAuthUser | NextResponse> {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return jsonError('Sign in required', 401)

  const user = await verifyFirebaseIdToken(token)
  if (!user) return jsonError('Sign in required', 401)
  return user
}

export function isFirebaseUser(
  value: FirebaseAuthUser | NextResponse
): value is FirebaseAuthUser {
  return !(value instanceof NextResponse)
}

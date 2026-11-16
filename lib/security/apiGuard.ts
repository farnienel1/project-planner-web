import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/security/rateLimit'
import { identityToolkitBase } from '@/lib/owner/googleApis'

export { clientSafeMessage } from '@/lib/security/sanitize'

export type FirebaseAuthUser = {
  uid: string
  email: string | null
  emailVerified: boolean
  /** Firebase Auth account creation time (ms) from `accounts:lookup`; null when missing or unreadable. */
  createdAtMs?: number | null
}

/** `accounts:lookup` returns `createdAt` as a string of epoch milliseconds. */
export function parseAuthCreatedAtMs(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
  return Number.isFinite(raw) && raw > 0 ? raw : null
}

/** True for a plain IPv4 or IPv6 address (no port, no brackets, no other text). */
export function looksLikeIpAddress(value: string): boolean {
  if (/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(value)) return true
  if (value.length > 45 || !value.includes(':') || !/^[0-9a-fA-F:.]+$/.test(value)) return false
  const doubleColons = value.split('::').length - 1
  if (doubleColons > 1) return false
  const groups = value.split(':')
  const last = groups[groups.length - 1]
  const tailIsV4 = last.includes('.')
  if (tailIsV4 && !looksLikeIpAddress(last)) return false
  const hexGroups = (tailIsV4 ? groups.slice(0, -1) : groups).filter((group) => group !== '')
  if (!hexGroups.every((group) => /^[0-9a-fA-F]{1,4}$/.test(group))) return false
  const width = hexGroups.length + (tailIsV4 ? 2 : 0)
  return doubleColons === 1 ? width < 8 : width === 8
}

/**
 * The caller's address for rate limits and audit rows. On Netlify `x-nf-client-connection-ip` is set by the edge from
 * the connection itself; its last comma-separated part is used, and only when it is an IPv4 or IPv6 address
 * (final check of #348). Otherwise `x-forwarded-for` and `x-real-ip` as before.
 */
export function clientIp(request: NextRequest): string {
  const edge = request.headers.get('x-nf-client-connection-ip')?.split(',').pop()?.trim() ?? ''
  return (
    (looksLikeIpAddress(edge) ? edge : '') ||
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

/** A rate limit on any key (for example a verified user id), not only the caller's address. */
export function enforceRateLimitKey(scope: string, key: string, limit: number, windowMs: number): NextResponse | null {
  const result = rateLimit(`${scope}:${key}`, limit, windowMs)
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
      `${identityToolkitBase()}/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!response.ok) return null

    const data = (await response.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean; createdAt?: string }>
    }
    const user = data.users?.[0]
    if (!user?.localId) return null

    return {
      uid: user.localId,
      email: user.email ? user.email.toLowerCase() : null,
      emailVerified: Boolean(user.emailVerified),
      createdAtMs: parseAuthCreatedAtMs(user.createdAt),
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

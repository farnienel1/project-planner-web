import { createPublicKey, verify, type JsonWebKey as CryptoJwk } from 'node:crypto'
import { jsonError } from '@/lib/security/apiGuard'
import type { NextRequest, NextResponse } from 'next/server'

const JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks'
const JWKS_TTL_MS = 60 * 60 * 1000

type Jwk = JsonWebKey & { kid?: string }

let cachedJwks: { keys: Jwk[]; fetchedAt: number } | null = null

export function appCheckTokenFromRequest(request: Request): string {
  return (request.headers.get('X-Firebase-AppCheck') || '').trim()
}

export function shouldRequireAppCheck(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === 'production'
}

export function appCheckProjectNumber(): string {
  return (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '').trim()
}

function decodeJwtPart(part: string): unknown {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

export function readAppCheckClaims(token: string): { header: { kid?: string; alg?: string }; payload: { iss?: string; aud?: unknown; exp?: number } } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = decodeJwtPart(parts[0]!) as { kid?: string; alg?: string }
    const payload = decodeJwtPart(parts[1]!) as { iss?: string; aud?: unknown; exp?: number }
    return { header, payload }
  } catch {
    return null
  }
}

function audienceMatches(aud: unknown, projectNumber: string): boolean {
  if (!projectNumber) return false
  if (typeof aud === 'string') return aud === projectNumber
  if (Array.isArray(aud)) return aud.some((item) => item === projectNumber)
  return false
}

async function loadJwks(): Promise<Jwk[]> {
  const now = Date.now()
  if (cachedJwks && now - cachedJwks.fetchedAt < JWKS_TTL_MS) return cachedJwks.keys
  const response = await fetch(JWKS_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error('App Check JWKS unavailable')
  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = Array.isArray(body.keys) ? body.keys : []
  cachedJwks = { keys, fetchedAt: now }
  return keys
}

export async function verifyAppCheckJwt(
  token: string,
  options?: { projectNumber?: string; nowMs?: number; keys?: Jwk[] }
): Promise<boolean> {
  const claims = readAppCheckClaims(token)
  if (!claims || claims.header.alg !== 'RS256') return false
  const projectNumber = (options?.projectNumber || appCheckProjectNumber()).trim()
  if (!projectNumber) return false
  const exp = Number(claims.payload.exp || 0)
  const nowSec = Math.floor((options?.nowMs || Date.now()) / 1000)
  if (!exp || exp <= nowSec) return false
  if (claims.payload.iss !== `https://firebaseappcheck.googleapis.com/${projectNumber}`) return false
  if (!audienceMatches(claims.payload.aud, projectNumber)) return false

  let keys: Jwk[]
  try {
    keys = options?.keys || (await loadJwks())
  } catch {
    return false
  }
  const jwk = keys.find((key) => key.kid && key.kid === claims.header.kid) || keys[0]
  if (!jwk) return false
  try {
    const key = createPublicKey({ key: jwk as unknown as CryptoJwk, format: 'jwk' })
    const [header, payload, signature] = token.split('.')
    return verify(
      'sha256',
      Buffer.from(`${header}.${payload}`),
      key,
      Buffer.from(signature!, 'base64url')
    )
  } catch {
    return false
  }
}

/** Production requires a valid App Check JWT. Local allows a missing token so localhost works before a debug token is registered. */
export async function enforceAppCheck(request: NextRequest, nodeEnv = process.env.NODE_ENV): Promise<NextResponse | null> {
  const token = appCheckTokenFromRequest(request)
  const required = shouldRequireAppCheck(nodeEnv)
  if (!token) return required ? jsonError('App Check is required.', 401) : null
  const valid = await verifyAppCheckJwt(token)
  if (valid) return null
  return required ? jsonError('App Check is required.', 401) : null
}

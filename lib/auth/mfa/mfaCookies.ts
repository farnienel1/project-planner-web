import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

import { resolveMfaSigningSecret, mfaSigningSecret } from '@/lib/auth/mfa/mfaSigningSecret'
import {
  clearMfaCookies,
  cookieOptions,
  expireMfaCookieOptions,
  MFA_CHALLENGE_COOKIE_HOST,
  MFA_CHALLENGE_COOKIE_LEGACY,
  MFA_OK_COOKIE_HOST,
  MFA_OK_COOKIE_LEGACY,
  readMfaCookie,
  writeMfaCookie,
} from '@/lib/auth/mfa/mfaCookiePolicy'

export { resolveMfaSigningSecret }
export {
  clearMfaCookies,
  cookieOptions,
  expireMfaCookieOptions,
  MFA_CHALLENGE_COOKIE_HOST,
  MFA_CHALLENGE_COOKIE_LEGACY,
  MFA_OK_COOKIE_HOST,
  MFA_OK_COOKIE_LEGACY,
  readMfaCookie,
  writeMfaCookie,
}

export const MFA_CODE_TTL_MS = 10 * 60 * 1000
export const MFA_RESEND_MS = 8 * 1000
export const MFA_MAX_ATTEMPTS = 5
export const MFA_OK_TTL_MS = 12 * 60 * 60 * 1000

export type MfaChallenge = {
  uid: string
  email: string
  codeHash: string
  exp: number
  attempts: number
  lastSentAt: number
  next?: string
}

export type MfaOk = {
  uid: string
  exp: number
}

function sign(payload: string): string {
  return createHmac('sha256', mfaSigningSecret()).update(payload).digest('base64url')
}

export function encodeSigned(value: object): string {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function decodeSigned<T>(raw?: string | null): T | null {
  if (!raw || !raw.includes('.')) return null
  const [payload, sig] = raw.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

export function hashMfaCode(code: string, uid: string): string {
  return createHmac('sha256', mfaSigningSecret()).update(`${uid}:${code}`).digest('hex')
}

export function generateMfaCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function codesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function readFirestoreBoolean(fields: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const field = fields?.[key] as { booleanValue?: boolean } | undefined
  if (!field || typeof field.booleanValue !== 'boolean') return undefined
  return field.booleanValue
}

export function readFirestoreString(fields: Record<string, unknown> | undefined, key: string): string | undefined {
  const field = fields?.[key] as { stringValue?: string } | undefined
  if (!field || typeof field.stringValue !== 'string') return undefined
  return field.stringValue
}

export async function readOwnUserFlags(idToken: string, uid: string): Promise<{ passwordSet: boolean; email?: string } | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId || !idToken) return null
  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    )
    if (response.status === 404) return { passwordSet: false }
    if (!response.ok) return null
    const data = (await response.json()) as { fields?: Record<string, unknown> }
    return {
      passwordSet: readFirestoreBoolean(data.fields, 'passwordSet') === true,
      email: readFirestoreString(data.fields, 'email'),
    }
  } catch {
    return null
  }
}

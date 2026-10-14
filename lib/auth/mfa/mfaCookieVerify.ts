import { mfaSigningSecret } from '@/lib/auth/mfa/mfaSigningSecret'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToUtf8(value: string): string | null {
  try {
    const pad = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = pad + '='.repeat((4 - (pad.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function signaturesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return bytesToBase64Url(new Uint8Array(signature))
}

export function mfaOkAllowsDashboard(value: { uid?: string; exp?: number } | null, nowMs = Date.now()): boolean {
  return Boolean(value?.uid && typeof value.exp === 'number' && value.exp > nowMs)
}

/** Edge-safe check: HMAC matches and exp is in the future. A non-empty cookie is not enough. */
export async function verifySignedMfaOk(raw: string | undefined | null, nowMs = Date.now()): Promise<{ uid: string; exp: number } | null> {
  if (!raw || !raw.includes('.')) return null
  const [payload, sig] = raw.split('.')
  if (!payload || !sig) return null
  try {
    const expected = await hmacSha256Base64Url(mfaSigningSecret(), payload)
    if (!signaturesMatch(sig, expected)) return null
    const parsed = JSON.parse(base64UrlToUtf8(payload) || '') as { uid?: string; exp?: number }
    if (!mfaOkAllowsDashboard(parsed, nowMs)) return null
    return { uid: parsed.uid as string, exp: parsed.exp as number }
  } catch {
    return null
  }
}

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const INTEREST_UNSUBSCRIBE_PURPOSE = 'interest' as const

export type InterestUnsubscribeClaims = {
  email: string
  purpose: typeof INTEREST_UNSUBSCRIBE_PURPOSE
  tokenId: string
}

export function normalizeInterestEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function resolveInterestUnsubscribeSecret(input: { secret?: string; nodeEnv?: string }): string {
  const secret = (input.secret || '').trim()
  if (secret) return secret
  if ((input.nodeEnv || '').trim() === 'production') {
    throw new Error('INTEREST_UNSUBSCRIBE_SECRET is not configured')
  }
  return 'project-planner-interest-unsub-dev'
}

function signingSecret(): string {
  return resolveInterestUnsubscribeSecret({
    secret: process.env.INTEREST_UNSUBSCRIBE_SECRET,
    nodeEnv: process.env.NODE_ENV,
  })
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url')
}

export function mintInterestUnsubscribeToken(email: string): InterestUnsubscribeClaims & { token: string } {
  const claims: InterestUnsubscribeClaims = {
    email: normalizeInterestEmail(email),
    purpose: INTEREST_UNSUBSCRIBE_PURPOSE,
    tokenId: randomBytes(16).toString('hex'),
  }
  if (!claims.email.includes('@')) {
    throw new Error('Cannot mint an unsubscribe token without an email.')
  }
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  return { ...claims, token: `${payload}.${sign(payload)}` }
}

export function verifyInterestUnsubscribeToken(raw?: string | null): InterestUnsubscribeClaims | null {
  if (!raw || !raw.includes('.')) return null
  const [payload, sig] = raw.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<InterestUnsubscribeClaims>
    if (claims.purpose !== INTEREST_UNSUBSCRIBE_PURPOSE) return null
    const email = typeof claims.email === 'string' ? normalizeInterestEmail(claims.email) : ''
    const tokenId = typeof claims.tokenId === 'string' ? claims.tokenId.trim() : ''
    if (!email.includes('@') || !tokenId) return null
    return { email, purpose: INTEREST_UNSUBSCRIBE_PURPOSE, tokenId }
  } catch {
    return null
  }
}

/** Token must come from the HMAC. A raw email in the body is not enough. */
export function resolveUnsubscribeToken(input: {
  queryToken?: string | null
  bodyToken?: string | null
  bodyEmail?: string | null
}): { ok: true; token: string } | { ok: false; reason: 'missing-token' | 'email-only' } {
  const token = (input.queryToken || input.bodyToken || '').trim()
  const email = (input.bodyEmail || '').trim()
  if (token) return { ok: true, token }
  if (email) return { ok: false, reason: 'email-only' }
  return { ok: false, reason: 'missing-token' }
}

export function interestUnsubscribePagePath(token: string): string {
  return `/interest/unsubscribe?token=${encodeURIComponent(token)}`
}

export function interestUnsubscribeApiPath(token: string): string {
  return `/api/interest/unsubscribe?token=${encodeURIComponent(token)}`
}

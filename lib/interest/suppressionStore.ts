import { restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { firestoreValue } from '@/lib/stripe/writeOrgBilling'
import { InterestAdminUnavailable, interestAdminDocuments } from '@/lib/interest/adminStore'
import { normalizeInterestEmail } from '@/lib/interest/unsubscribeToken'

export const EMAIL_SUPPRESSIONS = 'emailSuppressions'

export type SuppressionSource = 'interest' | 'manual'

export type EmailSuppression = {
  email: string
  source: SuppressionSource
  createdAt: Date
  tokenId: string
}

function suppressionSource(value: unknown): SuppressionSource {
  return value === 'manual' ? 'manual' : 'interest'
}

export function emailSuppressionCreateBody(
  input: { email: string; source: SuppressionSource; tokenId: string },
  createdAt = new Date()
): { fields: Record<string, unknown> } {
  const encoded = firestoreValue({
    email: normalizeInterestEmail(input.email),
    source: input.source,
    createdAt,
    tokenId: input.tokenId,
  }) as { mapValue?: { fields?: Record<string, unknown> } }
  return { fields: encoded.mapValue?.fields || {} }
}

function suppressionFromDocument(fields?: Record<string, unknown>): EmailSuppression | null {
  const plain = restFieldsToPlain(fields)
  const email = normalizeInterestEmail(typeof plain.email === 'string' ? plain.email : '')
  const tokenId = typeof plain.tokenId === 'string' ? plain.tokenId.trim() : ''
  if (!email.includes('@') || !tokenId) return null
  return {
    email,
    source: suppressionSource(plain.source),
    createdAt: plain.createdAt instanceof Date ? plain.createdAt : new Date(0),
    tokenId,
  }
}

export async function readEmailSuppression(email: string): Promise<EmailSuppression | null> {
  const { root, headers } = await interestAdminDocuments()
  const response = await fetch(
    `${root}/${EMAIL_SUPPRESSIONS}/${encodeURIComponent(normalizeInterestEmail(email))}`,
    { headers, cache: 'no-store' }
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Could not read email suppression (${response.status})`)
  const document = (await response.json()) as { fields?: Record<string, unknown> }
  return suppressionFromDocument(document.fields)
}

export async function writeEmailSuppression(input: {
  email: string
  source: SuppressionSource
  tokenId: string
  createdAt?: Date
}): Promise<'created' | 'exists'> {
  const email = normalizeInterestEmail(input.email)
  const { root, headers } = await interestAdminDocuments()
  const response = await fetch(`${root}/${EMAIL_SUPPRESSIONS}?documentId=${encodeURIComponent(email)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(emailSuppressionCreateBody(input, input.createdAt)),
  })
  if (response.status === 409) return 'exists'
  if (!response.ok) {
    const text = await response.text()
    if (text.includes('ALREADY_EXISTS')) return 'exists'
    throw new Error(text.slice(0, 500) || `Could not write email suppression (${response.status})`)
  }
  return 'created'
}

/** Missing Admin config: treat as not suppressed so local register-interest still acks. Unexpected read errors fail closed. */
export async function isInterestEmailSuppressed(email: string): Promise<boolean> {
  try {
    return (await readEmailSuppression(email)) !== null
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) return false
    console.error('[interest] suppression read failed', error)
    return true
  }
}

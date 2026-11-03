import { organizationLevelFor } from '@/lib/canonical'

/**
 * Run one Stripe webhook event exactly once.
 *
 * The event is claimed first (a named `stripeEvents/{eventId}` document) so a retry that arrives while
 * the first delivery is still running is dropped as a duplicate. If processing then fails, the claim is
 * released and the response is 500 so Stripe retries the event; only a fully processed event returns 200.
 * A failed release is logged and still returns 500 (Stripe's retry then reads as a duplicate, which is
 * the same outcome as before this change, never worse).
 */
export type StripeWebhookOutcome = {
  status: 200 | 500
  body: { received: true; duplicate?: true } | { received: false; error: 'processing_failed' }
}

export async function processStripeEventOnce(input: {
  claim: () => Promise<boolean>
  process: () => Promise<void>
  release: () => Promise<void>
  onError?: (error: unknown) => void
}): Promise<StripeWebhookOutcome> {
  let claimed = false
  try {
    claimed = await input.claim()
    if (!claimed) return { status: 200, body: { received: true, duplicate: true } }
    await input.process()
    return { status: 200, body: { received: true } }
  } catch (error) {
    input.onError?.(error)
    if (claimed) {
      await input.release().catch((releaseError) => input.onError?.(releaseError))
    }
    return { status: 500, body: { received: false, error: 'processing_failed' } }
  }
}

/**
 * Who gets an organisation's billing emails, in order: the super admin / creator (`creatorUserId`) first,
 * then every admin in the `members` map (roles read through the canonical `organizationLevelFor`). Ids are
 * de-duplicated without case. The caller sends to the first id that has an email address.
 */
export function billingEmailRecipientUids(input: {
  organizationId: string
  creatorUserId?: string | null
  members?: Record<string, unknown> | null
}): string[] {
  const out: string[] = []
  const add = (id: string) => {
    const trimmed = id.trim()
    if (trimmed && !out.some((row) => row.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed)
  }
  const creator = typeof input.creatorUserId === 'string' ? input.creatorUserId : ''
  add(creator)
  const members = input.members && typeof input.members === 'object' ? input.members : {}
  const levels = Object.entries(members).map(([userId, role]) => ({
    userId,
    level: organizationLevelFor({
      organizationId: input.organizationId,
      userId,
      membersRole: role,
      creatorUserId: creator || null,
    }),
  }))
  for (const row of levels) if (row.level.level === 'admin' && row.level.isSuperAdmin) add(row.userId)
  for (const row of levels) if (row.level.level === 'admin') add(row.userId)
  return out
}

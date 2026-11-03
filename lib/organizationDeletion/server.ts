/**
 * Server side of company deletion (rulebook 1.15.0 §20). Admin SDK access (service account REST), Stripe and the
 * deletion emails. The rules are the rulebook's (`lib/canonical/organizationDeletion.ts`); this file only performs
 * them.
 */
import { adminGoogleAccessToken } from '@/lib/owner/identityToolkitAdmin'
import { restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { firestoreValue } from '@/lib/stripe/writeOrgBilling'
import { getStripe } from '@/lib/stripe/stripe'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { buildOrganizationDeletionEmailHtml, organizationDeletionEmailSubject } from '@/lib/email/organizationDeletionEmail'
import {
  organizationDeletionState,
  organizationDeletionWriteFields,
  organizationEraseDateLabel,
  type OrganizationDeletionRestoreBy,
} from '@/lib/canonical/organizationDeletion'
import { organizationTimeZone } from '@/lib/canonical'
import { PLATFORM_OWNER_EMAIL } from '@/lib/canonical/passwordPolicy'

async function adminSession() {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  const project = projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
  if (!project) throw new Error('Firebase project id is missing.')
  return {
    root: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
}

export async function adminReadOrganization(organizationId: string): Promise<Record<string, unknown> | null> {
  const session = await adminSession()
  const response = await fetch(`${session.root}/organizations/${encodeURIComponent(organizationId)}`, {
    headers: session.headers,
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error((await response.text()).slice(0, 300) || 'Could not read the organisation.')
  const body = (await response.json()) as { fields?: Record<string, unknown> }
  return { id: organizationId, ...restFieldsToPlain(body.fields) }
}

async function adminPatchOrganization(organizationId: string, plain: Record<string, unknown>, fieldPaths: string[]) {
  const session = await adminSession()
  const encoded = firestoreValue(plain) as { mapValue?: { fields?: Record<string, unknown> } }
  const url = new URL(`${session.root}/organizations/${encodeURIComponent(organizationId)}`)
  for (const name of fieldPaths) url.searchParams.append('updateMask.fieldPaths', name)
  // The document must exist: never create an organisation by deleting it.
  url.searchParams.set('currentDocument.exists', 'true')
  const response = await fetch(url, { method: 'PATCH', headers: session.headers, body: JSON.stringify({ fields: encoded.mapValue?.fields || {} }) })
  if (!response.ok) throw new Error((await response.text()).slice(0, 300) || 'Could not update the organisation.')
}

function subscriptionIdOf(org: Record<string, unknown>): string {
  const billing = org.billing && typeof org.billing === 'object' ? (org.billing as Record<string, unknown>) : {}
  const id = billing.stripeSubscriptionId
  return typeof id === 'string' ? id.trim() : ''
}

export type StripeDeletionOutcome = 'cancel_at_period_end' | 'no_subscription' | 'already_ended' | 'failed'

/** Cancels the subscription at the end of the paid period. No refund (refunds are made by hand in Stripe). */
export async function cancelSubscriptionAtPeriodEnd(org: Record<string, unknown>): Promise<StripeDeletionOutcome> {
  const subscriptionId = subscriptionIdOf(org)
  if (!subscriptionId) return 'no_subscription'
  try {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (['canceled', 'incomplete_expired'].includes(subscription.status)) return 'already_ended'
    if (!subscription.cancel_at_period_end) {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        metadata: { ...(subscription.metadata || {}), organizationDeleted: 'true' },
      })
    }
    return 'cancel_at_period_end'
  } catch (error) {
    console.error('[organization/delete] stripe', error)
    return 'failed'
  }
}

export type StripeRestoreOutcome = 'resumed' | 'no_subscription' | 'ended' | 'failed'

/** Restore: keeps the subscription going when it is still in its period (`cancel_at_period_end` false). */
export async function resumeSubscription(org: Record<string, unknown>): Promise<StripeRestoreOutcome> {
  const subscriptionId = subscriptionIdOf(org)
  if (!subscriptionId) return 'no_subscription'
  try {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (['canceled', 'incomplete_expired'].includes(subscription.status)) return 'ended'
    if (subscription.cancel_at_period_end) {
      const metadata = { ...(subscription.metadata || {}) }
      metadata.organizationDeleted = ''
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false, metadata })
    }
    return 'resumed'
  } catch (error) {
    console.error('[organization/restore] stripe', error)
    return 'failed'
  }
}

const STRIPE_NOTES: Record<StripeDeletionOutcome, string> = {
  cancel_at_period_end: 'The subscription is cancelled at the end of the current billing period. Payments already made are not refunded.',
  no_subscription: 'There was no Stripe subscription to cancel.',
  already_ended: 'The subscription had already ended.',
  failed: 'The subscription could not be cancelled automatically. Support will cancel it in Stripe.',
}

/**
 * Schedules the organisation for erasure (`organizationDeletionWriteFields`), cancels Stripe at the period end and
 * emails the platform owner and the person who deleted it. Idempotent: an organisation already scheduled keeps its
 * dates.
 */
export async function scheduleOrganizationDeletion(input: {
  organizationId: string
  requestedBy: string
  requestedByEmail: string
  restoreBy: OrganizationDeletionRestoreBy
  nowMs?: number
}): Promise<{ eraseAfterMs: number | null; stripe: StripeDeletionOutcome; emailed: string[]; alreadyScheduled: boolean }> {
  const org = await adminReadOrganization(input.organizationId)
  if (!org) throw new Error('Organisation not found.')
  const current = organizationDeletionState(org)
  if (current.state === 'scheduled') {
    return { eraseAfterMs: current.eraseAfterMs, stripe: 'cancel_at_period_end', emailed: [], alreadyScheduled: true }
  }
  if (current.state === 'erased') throw new Error('This organisation has already been erased.')

  const fields = organizationDeletionWriteFields({
    requestedBy: input.requestedBy,
    requestedAtMs: input.nowMs ?? Date.now(),
    restoreBy: input.restoreBy,
  })
  await adminPatchOrganization(input.organizationId, fields, ['deletion'])
  const stripe = await cancelSubscriptionAtPeriodEnd(org)

  const eraseAfterMs = fields.deletion.eraseAfter.getTime()
  const name = typeof org.name === 'string' ? org.name : ''
  const html = buildOrganizationDeletionEmailHtml({
    organizationName: name,
    organizationId: input.organizationId,
    requestedByEmail: input.requestedByEmail,
    eraseOn: organizationEraseDateLabel(eraseAfterMs, organizationTimeZone(org.countryCode as string | undefined)),
    restorable: input.restoreBy === 'super_admin',
    stripeNote: STRIPE_NOTES[stripe],
  })
  const emailed: string[] = []
  const recipients = [...new Set([PLATFORM_OWNER_EMAIL, input.requestedByEmail.trim().toLowerCase()].filter(Boolean))]
  for (const to of recipients) {
    try {
      await sendProjectPlannerEmail({ to, subject: organizationDeletionEmailSubject(name), html })
      emailed.push(to)
    } catch (error) {
      console.error('[organization/delete] email', to, error)
    }
  }
  return { eraseAfterMs, stripe, emailed, alreadyScheduled: false }
}

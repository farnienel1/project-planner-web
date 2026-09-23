import type Stripe from 'stripe'
import { mrrPenceForInterval } from '@/lib/stripe/plans'
import type { OrgBilling, OrgBillingStatus } from '@/lib/stripe/billing'
import { adminGoogleAccessToken } from '@/lib/owner/identityToolkitAdmin'
import { firestorePatch } from '@/lib/owner/firestoreRest'

function secondsToDate(value?: number | null): Date | null {
  if (!value) return null
  return new Date(value * 1000)
}

function intervalFromSubscription(subscription: Stripe.Subscription): 'month' | 'year' | null {
  const interval = subscription.items.data[0]?.price?.recurring?.interval
  if (interval === 'year') return 'year'
  if (interval === 'month') return 'month'
  return null
}

function periodEndSeconds(subscription: Stripe.Subscription): number | null {
  const fromItem = subscription.items.data[0]?.current_period_end
  if (typeof fromItem === 'number') return fromItem
  const legacy = (subscription as { current_period_end?: number }).current_period_end
  return typeof legacy === 'number' ? legacy : null
}

export function billingFromSubscription(
  subscription: Stripe.Subscription,
  extras: {
    stripeCustomerId?: string
    lastStripeEventId?: string
    lastPaymentAt?: Date | null
    lastPaymentFailedAt?: Date | null
    trialUsed?: boolean
  } = {}
): OrgBilling {
  const interval = intervalFromSubscription(subscription)
  const priceId = subscription.items.data[0]?.price?.id || null
  const status = (subscription.status || 'none') as OrgBillingStatus
  return {
    stripeCustomerId:
      extras.stripeCustomerId ||
      (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    billingInterval: interval,
    status,
    trialStart: secondsToDate(subscription.trial_start),
    trialEnd: secondsToDate(subscription.trial_end),
    currentPeriodEnd: secondsToDate(periodEndSeconds(subscription)),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    canceledAt: secondsToDate(subscription.canceled_at),
    lastPaymentAt: extras.lastPaymentAt ?? null,
    lastPaymentFailedAt: extras.lastPaymentFailedAt ?? null,
    trialUsed: extras.trialUsed ?? Boolean(subscription.trial_start || subscription.trial_end),
    mrrPence: mrrPenceForInterval(interval),
    updatedAt: new Date(),
    lastStripeEventId: extras.lastStripeEventId,
  }
}

export function firestoreValue(value: unknown): Record<string, unknown> {
  if (value == null) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, inner]) => inner !== undefined)
            .map(([key, inner]) => [key, firestoreValue(inner)])
        ),
      },
    }
  }
  return { stringValue: String(value) }
}

async function patchOrganizationFields(
  token: string,
  projectId: string,
  organizationId: string,
  fields: Record<string, unknown>,
  fieldPaths: string[]
) {
  const path = `projects/${encodeURIComponent(projectId)}/databases/(default)/documents/organizations/${encodeURIComponent(organizationId)}`
  const url = `https://firestore.googleapis.com/v1/${path}?${fieldPaths
    .map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`)
    .join('&')}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Could not write organisation billing')
  }
}

export function subscriptionMirrorFromBilling(billing: OrgBilling) {
  return {
    status: billing.status,
    planKey: billing.billingInterval || 'month',
    stripeCustomerId: billing.stripeCustomerId || null,
    stripeSubscriptionId: billing.stripeSubscriptionId || null,
    stripePriceId: billing.stripePriceId || null,
    currentPeriodEnd: billing.currentPeriodEnd || null,
    activatedAt: billing.status === 'active' || billing.status === 'trialing' ? billing.updatedAt || new Date() : null,
  }
}

export async function writeOrgBillingWithServiceAccount(organizationId: string, billing: OrgBilling) {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  if (!projectId) throw new Error('Firebase project id is missing.')
  await patchOrganizationFields(
    token,
    projectId,
    organizationId,
    {
      billing: firestoreValue(billing),
      subscription: firestoreValue(subscriptionMirrorFromBilling(billing)),
      updatedAt: firestoreValue(new Date()),
    },
    ['billing', 'subscription', 'updatedAt']
  )
}

export async function writeOrgBillingWithUserToken(
  idToken: string,
  organizationId: string,
  billing: OrgBilling
) {
  await firestorePatch(
    idToken,
    `organizations/${organizationId}`,
    {
      billing: firestoreValue(billing),
      subscription: firestoreValue(subscriptionMirrorFromBilling(billing)),
      updatedAt: firestoreValue(new Date()),
    },
    ['billing', 'subscription', 'updatedAt']
  )
}

export async function writeOrgBilling(organizationId: string, billing: OrgBilling, idToken?: string) {
  try {
    await writeOrgBillingWithServiceAccount(organizationId, billing)
  } catch (error) {
    if (!idToken) throw error
    await writeOrgBillingWithUserToken(idToken, organizationId, billing)
  }
}

export async function adminFirestoreGet(path: string): Promise<{ fields?: Record<string, unknown> } | null> {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Could not read ${path}`)
  return (await response.json()) as { fields?: Record<string, unknown> }
}

export async function adminFirestoreCreateNamed(
  collectionPath: string,
  documentId: string,
  fields: Record<string, unknown>
): Promise<'created' | 'exists'> {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collectionPath}?documentId=${encodeURIComponent(documentId)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (response.status === 409) return 'exists'
  if (!response.ok) {
    const text = await response.text()
    if (text.includes('ALREADY_EXISTS')) return 'exists'
    throw new Error(text || `Could not create ${collectionPath}/${documentId}`)
  }
  return 'created'
}

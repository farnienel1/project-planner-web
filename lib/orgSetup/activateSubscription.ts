import { doc, updateDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'

export type OrganizationSubscription = {
  status: 'active' | 'pending' | 'canceled' | 'past_due'
  planKey?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  currentPeriodEnd?: Date
  activatedAt?: Date
}

export async function activateOrganizationSubscription(
  organizationId: string,
  subscription: OrganizationSubscription
): Promise<void> {
  const db = getFirebaseDb()
  await updateDoc(doc(db, 'organizations', organizationId), {
    subscription: {
      ...subscription,
      currentPeriodEnd: subscription.currentPeriodEnd ?? null,
      activatedAt: subscription.activatedAt ?? new Date(),
    },
    updatedAt: new Date(),
  })
}

import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

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
  await updateDoc(doc(db, 'organizations', organizationId), {
    subscription: {
      ...subscription,
      currentPeriodEnd: subscription.currentPeriodEnd ?? null,
      activatedAt: subscription.activatedAt ?? new Date(),
    },
    updatedAt: new Date(),
  })
}

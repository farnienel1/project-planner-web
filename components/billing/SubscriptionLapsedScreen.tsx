'use client'

import Link from 'next/link'
import { SUBSCRIPTION_LAPSED_ADMIN_NOTE, SUBSCRIPTION_LAPSED_MESSAGE } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'

/** The billing screen an admin of a lapsed organisation may still open (rulebook 1.13.0 §19). */
export const LAPSED_BILLING_PATH = '/dashboard/settings/billing'

/**
 * Rulebook 1.13.0 §19 (`subscriptionAccess`): the whole app while the organisation's subscription has lapsed. Nothing
 * is deleted; access returns once Stripe marks it paid. Admins get a link to Settings → Billing; everyone else only
 * the message and Sign out.
 */
export function SubscriptionLapsedScreen({ admin }: { admin: boolean }) {
  const { signOut } = useAuthStore()
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md text-center">
        <p className="text-lg font-semibold text-slate-900">Subscription lapsed</p>
        <p className="mt-2 text-sm text-slate-600">{SUBSCRIPTION_LAPSED_MESSAGE}</p>
        {admin ? <p className="mt-2 text-sm text-slate-600">{SUBSCRIPTION_LAPSED_ADMIN_NOTE}</p> : null}
        <div className="mt-6 flex flex-col items-center gap-3">
          {admin ? (
            <Link href={LAPSED_BILLING_PATH} className="btn primary">
              Open billing
            </Link>
          ) : null}
          <button type="button" className="btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

/** Billing alone for an admin of a lapsed organisation: no app shell, no other screen. */
export function LapsedBillingOnly({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuthStore()
  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{SUBSCRIPTION_LAPSED_MESSAGE}</p>
        <button type="button" className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
      {children}
    </div>
  )
}

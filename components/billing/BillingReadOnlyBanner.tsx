'use client'

import { hasAccess } from '@/lib/stripe/billing'
import { useAuthStore } from '@/lib/stores/authStore'
import Link from 'next/link'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'

export function BillingReadOnlyBanner() {
  const { organization, user } = useAuthStore()
  if (hasAccess(organization?.billing)) return null
  const admin = hasAdminAccess(user)
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      This organisation is read-only because the subscription is not active.{' '}
      {admin ? (
        <Link href="/dashboard/settings/billing" className="font-semibold underline">
          Update payment method
        </Link>
      ) : (
        'Ask an admin to update billing.'
      )}
    </div>
  )
}

'use client'

/**
 * Pay strip: whether the pay laid over the roster (`payProfilesStatusFor`) and the signed-in person's own pay
 * (`useOwnPayUser`) are final, as a hook, so a screen waits before it prices, signs, invoices, exports or builds a
 * report. Always ready while `privatePay` is off (the users documents hold the pay, as before).
 */
import { useSyncExternalStore } from 'react'
import { onPayProfilesStatusChange, payProfilesStatusFor, type PayProfilesStatus } from '@/lib/pay/payProfileOverlay'
import { retryOwnPayRead } from '@/lib/pay/useOwnPayUser'
import type { OwnPayStatus } from '@/lib/pay/ownPayRecord'

/** Shown where a report waits for pay that could not be read (refused, or offline with nothing read before). */
export const PAY_PROFILES_FAILED_MESSAGE = 'Could not load pay details, so this report cannot be built yet. Try again.'

/** `payProfilesStatusFor(organizationId)`, re-rendered when it changes. */
export function usePayProfilesStatus(organizationId: string | null | undefined): PayProfilesStatus {
  return useSyncExternalStore(
    onPayProfilesStatusChange,
    () => payProfilesStatusFor(organizationId),
    () => 'loading' as PayProfilesStatus
  )
}

/** Retry after a failed pay-profile read: the own read, and the roster (which reads the pay profiles again). */
export function retryPayProfiles(organizationId: string | null | undefined, own: OwnPayStatus): void {
  if (own === 'failed') retryOwnPayRead()
  if (!organizationId || payProfilesStatusFor(organizationId) !== 'failed') return
  void import('@/lib/stores/siteAuditStore')
    .then(({ useOrgUserStore }) => useOrgUserStore.getState().loadUsers(organizationId, { force: true }))
    .catch(() => undefined)
}

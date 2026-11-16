'use client'

/**
 * Pay strip: whether the pay laid over the roster (`payProfilesStatusFor`) and the signed-in person's own pay
 * (`useOwnPayUser`) are final, as a hook, so a screen waits before it prices, signs, invoices, exports or builds a
 * report. Always ready while `privatePay` is off (the users documents hold the pay, as before).
 */
import { useMemo, useSyncExternalStore } from 'react'
import {
  onPayProfilesStatusChange,
  payProfileFailedSubjectIds,
  payProfilesStatusFor,
  personPayStatus,
  type PayProfilesStatus,
} from '@/lib/pay/payProfileOverlay'
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

/** The people whose pay could not be read (lower-case ids), re-rendered when it changes. */
export function usePayProfileFailedIds(organizationId: string | null | undefined): ReadonlySet<string> {
  const joined = useSyncExternalStore(
    onPayProfilesStatusChange,
    () => payProfileFailedSubjectIds(organizationId).join('|'),
    () => ''
  )
  return useMemo(() => new Set(joined ? joined.split('|') : []), [joined])
}

/** One person's pay status (`personPayStatus`): the organisation's, then `failed` when their own read failed. */
export function usePersonPayStatus(
  organizationId: string | null | undefined,
  person: { id: string; formerUserIds?: ReadonlyArray<string> | null } | null | undefined
): PayProfilesStatus {
  const status = usePayProfilesStatus(organizationId)
  const failed = usePayProfileFailedIds(organizationId)
  return personPayStatus(status, failed, person)
}

/** Retry after a failed pay-profile read: the own read, and the roster (which reads the pay profiles again). */
export function retryPayProfiles(organizationId: string | null | undefined, own: OwnPayStatus): void {
  if (own === 'failed') retryOwnPayRead()
  if (!organizationId) return
  // Retry whenever anything failed: the whole organisation, the roster read, or one person's read.
  if (payProfilesStatusFor(organizationId) !== 'failed' && payProfileFailedSubjectIds(organizationId).length === 0) return
  void import('@/lib/stores/siteAuditStore')
    .then(({ useOrgUserStore }) => useOrgUserStore.getState().loadUsers(organizationId, { force: true }))
    .catch(() => undefined)
}

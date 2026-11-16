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
  payProfilesRetryNeeded,
  payProfileStateVersion,
  payProfilesStatusFor,
  payProfilesStatusForCatalogueOperative,
  payProfilesStatusForPerson,
  personPayStatus,
  type PayProfilesStatus,
} from '@/lib/pay/payProfileOverlay'
import { retryOwnPayRead } from '@/lib/pay/useOwnPayUser'
import { retrySecuritySwitches, securitySwitchesTimedOut } from '@/lib/access/securitySwitches'
import type { OwnPayStatus } from '@/lib/pay/ownPayRecord'

/** Shown where a report waits for pay that could not be read (refused, or offline with nothing read before). */
export { PAY_PROFILES_FAILED_MESSAGE } from '@/lib/pay/reportPayGate'

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

/**
 * Each person's pay status (`payProfilesStatusForPerson`: the organisation, their own read, and — re-review #342 item 2 —
 * `loading` for someone added to the roster after the last read), as a function re-rendered when anything changes.
 */
export function usePayStatusOf(
  organizationId: string | null | undefined
): (
  person: { id: string; formerUserIds?: ReadonlyArray<string> | null; catalogueOperative?: boolean } | null | undefined
) => PayProfilesStatus {
  const version = useSyncExternalStore(onPayProfilesStatusChange, payProfileStateVersion, () => 0)
  // 16 Nov scan: a catalogue operative (an `operatives` row with no account) waits for its row to be re-read with the
  // pay profiles (`payProfilesStatusForCatalogueOperative`).
  return useMemo(
    () => (person) =>
      person?.catalogueOperative
        ? payProfilesStatusForCatalogueOperative(organizationId, person.id)
        : payProfilesStatusForPerson(organizationId, person),
    // `version` re-creates the function whenever any pay status may have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, version]
  )
}

/** Retry after a failed pay-profile read: the own read, and the roster (which reads the pay profiles again). */
export function retryPayProfiles(organizationId: string | null | undefined, own: OwnPayStatus): void {
  if (own === 'failed') retryOwnPayRead()
  // Re-review #342 item 4: the settings did not load in time — read them again.
  if (securitySwitchesTimedOut()) retrySecuritySwitches()
  if (!organizationId) return
  void import('@/lib/stores/siteAuditStore')
    .then(({ useOrgUserStore }) => {
      // Retry whenever anything failed (the whole organisation, the roster read, one person's read) — or (final check
      // #342 item 2) someone on the roster is still waiting for a first pay read.
      const users = useOrgUserStore.getState().users
      if (!payProfilesRetryNeeded(organizationId, users)) return undefined
      return useOrgUserStore.getState().loadUsers(organizationId, { force: true })
    })
    .catch(() => undefined)
}

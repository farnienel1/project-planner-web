import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import {
  captureOrganizationContext,
  dueTimesheetSubmissionNotices,
  organizationContextStillCurrent,
  payProfileReadPlan,
  TIMESHEET_SUBMISSION_NOTICE_TYPE,
  timesheetParticipant,
  timesheetSubmissionNoticeDedupKey,
} from '@/lib/canonical'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import { organizationTimeZone } from '@/lib/canonical'
import { timesheetReminderAudience } from '@/lib/timesheets/timesheetReminderAudience'
import type { User } from '@/types'

const deliveredThisSession = new Set<string>()

/**
 * Pay strip: sends the due reminders for the people this viewer may judge (`timesheetReminderAudience`). `roster` is
 * the listed roster; while `privatePay` is off it is used as given (as before). While it is on, an admin waits for the
 * pay laid over the roster and uses the store's roster then; anyone else sends only their own, from their own pay.
 */
export async function deliverTimesheetRemindersForViewer(organizationId: string, roster: User[]): Promise<number> {
  const orgId = String(organizationId || '').trim()
  if (!orgId) return 0
  const [{ privatePayFor, whenSecuritySwitchesLoaded }, overlay, { resolveOwnPayUser }, { useAuthStore }, { useOrgUserStore }] =
    await Promise.all([
      import('@/lib/access/securitySwitches'),
      import('@/lib/pay/payProfileOverlay'),
      import('@/lib/pay/useOwnPayUser'),
      import('@/lib/stores/authStore'),
      import('@/lib/stores/siteAuditStore'),
    ])
  // Pay strip: until `platformConfig/app` has been read, `privatePay` is unknown — not off — so nothing is sent before
  // then (the stripped roster would read everyone as self-employed). Review #342 item 6: wait for the read rather than
  // giving up for the session, so a slow config read still sends what is due once it arrives (also with privatePay off).
  await whenSecuritySwitchesLoaded()
  // The company may have been switched while waiting: its own session run sends its reminders.
  const openOrganizationId = useAuthStore.getState().organization?.id
  if (openOrganizationId && openOrganizationId !== orgId) return 0
  const privatePay = privatePayFor(orgId)
  if (!privatePay) return deliverDueTimesheetSubmissionReminders(orgId, roster)
  const viewer = useAuthStore.getState().user
  const viewerReadsEveryPay = payProfileReadPlan(viewer as never, []).kind === 'all'
  const payProfiles = viewerReadsEveryPay ? await overlay.whenPayProfilesSettled(orgId) : 'loading'
  const own = await resolveOwnPayUser()
  const audience = timesheetReminderAudience({
    privatePay,
    viewerReadsEveryPay,
    payProfiles,
    roster: viewerReadsEveryPay ? useOrgUserStore.getState().users : roster,
    own,
  })
  return deliverDueTimesheetSubmissionReminders(orgId, audience)
}

/** Rulebook 1.10.0 (M12): `timesheetParticipant` — the same people as the Weekly Report feed. */
export function receivesTimesheetSubmissionReminder(user: User, now: Date, timeZone: string): boolean {
  return timesheetParticipant(
    { ...user, name: `${user.firstName ?? ''} ${user.surname ?? ''}`.trim(), operativeMode: user.permissions?.operativeMode === true },
    now,
    timeZone
  )
}

export async function deliverDueTimesheetSubmissionReminders(
  organizationId: string,
  users: User[],
  now: Date = new Date()
): Promise<number> {
  const orgId = String(organizationId || '').trim()
  if (!orgId || !db) return 0
  const captured = captureOrganizationContext()
  const details = await loadOrganizationDetails(orgId)
  if (!organizationContextStillCurrent(orgId, captured) || !details) return 0
  const timeZone = organizationTimeZone(details.countryCode)
  const notices = dueTimesheetSubmissionNotices({
    referenceIso: now.toISOString(),
    timeZone,
    paymentRunMode: details.invoicing.paymentRunMode,
    paymentDateMode: details.invoicing.paymentDateMode,
    paymentRunDateRanges: details.invoicing.paymentRunDateRanges,
    paymentDates: details.invoicing.paymentDates,
    recurringRunStartDay: details.invoicing.recurringRunStartDay,
    recurringRunEndDay: details.invoicing.recurringRunEndDay,
    recurringPaymentDay: details.invoicing.recurringPaymentDay,
    timesheetSubmission: details.invoicing.timesheetSubmission,
  })
  if (notices.length === 0) return 0
  const recipients = users.filter((user) => receivesTimesheetSubmissionReminder(user, now, timeZone))
  if (recipients.length === 0) return 0
  if (!organizationContextStillCurrent(orgId, captured)) return 0

  // One existence read per due notice and recipient, all in parallel (they used to run one by one).
  const pending: { key: string; id: string; notice: (typeof notices)[number]; user: User }[] = []
  for (const notice of notices) {
    for (const user of recipients) {
      const key = timesheetSubmissionNoticeDedupKey({
        organizationId: orgId,
        paymentDayKey: notice.paymentDayKey,
        runIndex: notice.runIndex,
        userId: user.id,
      })
      if (deliveredThisSession.has(key)) continue
      deliveredThisSession.add(key)
      pending.push({ key, id: '', notice, user })
    }
  }
  if (pending.length === 0) return 0
  const checked = await Promise.all(
    pending.map(async (entry) => {
      try {
        const id = await syntheticUuidFromKey(entry.key)
        const existing = await getDoc(doc(db, 'organizations', orgId, 'notifications', id))
        return { ...entry, id, exists: existing.exists() }
      } catch {
        // Not read: let a later session try again.
        deliveredThisSession.delete(entry.key)
        return { ...entry, exists: true }
      }
    })
  )
  if (!organizationContextStillCurrent(orgId, captured)) return 0

  let written = 0
  await Promise.all(
    checked
      .filter((entry) => !entry.exists && entry.id)
      .map(async ({ id, notice, user, key }) => {
        try {
          await saveInboxNotification({
            id,
            organizationId: orgId,
            type: TIMESHEET_SUBMISSION_NOTICE_TYPE,
            title: notice.title,
            message: notice.message,
            userId: user.id,
            relatedId: notice.paymentDayKey,
            deepLinkWeekStart: new Date(`${notice.paymentDayKey}T12:00:00Z`),
            // A scheduled notice nobody caused: no `actorUserId`, so the signed-in user's own reminder still pushes.
            actorUserId: null,
          })
          written += 1
        } catch {
          deliveredThisSession.delete(key)
        }
      })
  )
  return written
}

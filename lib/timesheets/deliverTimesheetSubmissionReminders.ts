import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import {
  captureOrganizationContext,
  dueTimesheetSubmissionNotices,
  organizationContextStillCurrent,
  TIMESHEET_SUBMISSION_NOTICE_TYPE,
  timesheetSubmissionNoticeDedupKey,
} from '@/lib/canonical'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'
import { participatesInTimesheets } from '@/lib/timesheets/timesheetPayrollPolicy'
import type { User } from '@/types'

const deliveredThisSession = new Set<string>()

export function receivesTimesheetSubmissionReminder(user: User, now: Date, timeZone: string): boolean {
  if (user.isActive === false) return false
  return participatesInTimesheets(user, now, timeZone)
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
  const timeZone = ianaTimeZoneForCountry(details.countryCode)
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
          })
          written += 1
        } catch {
          deliveredThisSession.delete(key)
        }
      })
  )
  return written
}

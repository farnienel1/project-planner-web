/**
 * iOS parity: NotificationService.notifyHolidayRequestSubmitted / notifyHolidayRequestSubmittedByUser
 *
 * One inbox row per approver (`leaveApproverIds`) when someone asks for leave. Same document as iOS:
 * type `holiday_request_submitted`, title "Annual Leave Request", message
 * "{name} requested annual leave {start} – {end}. Tap to review.", userId = approver,
 * relatedId = the holiday booking id, requiresPermission null, id =
 * syntheticNotificationId("holidaySubmitted|{bookingId}|{approverId}").
 * Device push is functions/inbox-push. Web does not send a browser/OS alert.
 */

import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import { HOLIDAY_REQUEST_SUBMITTED_TYPE, leaveApproverIds, type LeaveApproverMember, type LeaveRequester } from '@/lib/canonical'
import type { HolidayBooking } from '@/types'

function abbreviatedDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function holidayRequestSubmittedMessage(requesterName: string, booking: Pick<HolidayBooking, 'startDate' | 'endDate'>, timeZone: string): string {
  const name = requesterName.trim() || 'Someone'
  return `${name} requested annual leave ${abbreviatedDay(booking.startDate, timeZone)} – ${abbreviatedDay(booking.endDate, timeZone)}. Tap to review.`
}

export function holidaySubmittedDedupeKey(bookingId: string, approverId: string): string {
  return `holidaySubmitted|${bookingId.trim().toUpperCase()}|${approverId.trim()}`
}

export type HolidayRequestSubmittedWrite = {
  id: string
  organizationId: string
  type: typeof HOLIDAY_REQUEST_SUBMITTED_TYPE
  title: string
  message: string
  userId: string
  relatedId: string
  requiresPermission: null
}

export async function buildHolidayRequestSubmittedNotifications(input: {
  organizationId: string
  booking: Pick<HolidayBooking, 'id' | 'startDate' | 'endDate'>
  requester: LeaveRequester
  requesterName: string
  roster: ReadonlyArray<LeaveApproverMember>
  timeZone: string
}): Promise<HolidayRequestSubmittedWrite[]> {
  const organizationId = input.organizationId.trim()
  if (!organizationId || !input.booking.id) return []
  const approvers = leaveApproverIds(input.requester, input.roster)
  const message = holidayRequestSubmittedMessage(input.requesterName, input.booking, input.timeZone)
  const rows: HolidayRequestSubmittedWrite[] = []
  for (const approverId of approvers) {
    rows.push({
      id: await syntheticUuidFromKey(holidaySubmittedDedupeKey(input.booking.id, approverId)),
      organizationId,
      type: HOLIDAY_REQUEST_SUBMITTED_TYPE,
      title: 'Annual Leave Request',
      message,
      userId: approverId,
      relatedId: input.booking.id,
      requiresPermission: null,
    })
  }
  return rows
}

/** Best effort: the request is already saved, a missed inbox row must not undo it. */
export async function notifyHolidayRequestSubmitted(input: Parameters<typeof buildHolidayRequestSubmittedNotifications>[0]): Promise<void> {
  try {
    const rows = await buildHolidayRequestSubmittedNotifications(input)
    for (const row of rows) {
      try {
        await saveInboxNotification(row)
      } catch {
        // Keep notifying the other approvers.
      }
    }
  } catch {
    // ignore
  }
}

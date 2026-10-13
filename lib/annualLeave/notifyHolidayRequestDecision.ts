/**
 * iOS parity: NotificationService.notifyHolidayRequestDecisionToUser
 *
 * One inbox row for the operative. Not receivesJobNotification.
 * Device push is functions/inbox-push on create of
 * organizations/{orgId}/notifications/{id}. Web does not send a browser/OS alert.
 */

import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { notificationDestination } from '@/lib/canonical'
import type { HolidayBooking, Operative, User } from '@/types'

export const HOLIDAY_REQUEST_APPROVED = 'holiday_request_approved'
export const HOLIDAY_REQUEST_DECLINED = 'holiday_request_declined'

function trimmed(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

export function holidayDecisionActorName(user: Pick<User, 'firstName' | 'surname' | 'email'> | null | undefined): string {
  if (!user) return 'Manager'
  return `${user.firstName} ${user.surname}`.trim() || trimmed(user.email) || 'Manager'
}

/**
 * Holiday document userId first. operativeId is only the iOS fallback:
 * match an already-loaded operative, then an already-loaded operative-mode user
 * by email. Do not query the users collection.
 */
export function holidayDecisionRecipientUserId(
  booking: Pick<HolidayBooking, 'userId' | 'operativeId'>,
  users: ReadonlyArray<User> = [],
  operatives: ReadonlyArray<Operative> = []
): string | null {
  const fromBooking = trimmed(booking.userId)
  if (fromBooking) return fromBooking

  const operativeId = trimmed(booking.operativeId)
  if (!operativeId) return null
  const op = operatives.find((row) => row.id === operativeId)
  if (!op) return null
  const email = op.email.toLowerCase()
  const account = users.find(
    (row) =>
      (row.permissions.operativeMode || row.role === 'operative') &&
      row.email.toLowerCase() === email
  )
  return account?.id ? trimmed(account.id) || null : null
}

function abbreviatedLeaveDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** iOS `annualLeaveDateText(for:)` — abbreviated start/end plus timeSlot raw value. */
export function annualLeaveDecisionDateText(
  booking: Pick<HolidayBooking, 'startDate' | 'endDate' | 'timeSlot'>
): string {
  const start = abbreviatedLeaveDay(booking.startDate)
  const end = abbreviatedLeaveDay(booking.endDate)
  const slot = booking.timeSlot
  if (dayKey(booking.startDate) === dayKey(booking.endDate)) {
    return `${start} (${slot})`
  }
  return `${start} – ${end} (${slot})`
}

export function holidayRequestDecisionMessage(input: {
  approved: boolean
  decidedByName: string
  dateText: string
  reason?: string | null
}): string {
  const who = trimmed(input.decidedByName) || 'Manager'
  const when = input.dateText ? ` for ${input.dateText}` : ''
  if (input.approved) return `${who} approved your annual leave request${when}.`
  const note = trimmed(input.reason)
  if (!note) return `${who} declined your annual leave request${when}.`
  return `${who} declined your annual leave request${when}. ${note}`
}

export function holidayDecisionDedupeKey(bookingId: string, userId: string, approved: boolean): string {
  return `holidayDecision|${bookingId}|${userId}|${approved}`
}

export type HolidayRequestDecisionWrite = {
  organizationId: string
  type: typeof HOLIDAY_REQUEST_APPROVED | typeof HOLIDAY_REQUEST_DECLINED
  title: string
  message: string
  userId: string
  relatedId: string
  requiresPermission: null
  destination: ReturnType<typeof notificationDestination>
}

export function buildHolidayRequestDecisionNotification(input: {
  organizationId: string
  booking: HolidayBooking
  approved: boolean
  decidedByName: string
  reason?: string | null
  users?: ReadonlyArray<User>
  operatives?: ReadonlyArray<Operative>
}): HolidayRequestDecisionWrite | null {
  const organizationId = trimmed(input.organizationId)
  const userId = holidayDecisionRecipientUserId(input.booking, input.users, input.operatives)
  if (!organizationId || !userId) return null

  const approved = input.approved === true
  const type = approved ? HOLIDAY_REQUEST_APPROVED : HOLIDAY_REQUEST_DECLINED
  const note = trimmed(input.reason) || trimmed(input.booking.decisionNote)
  const dateText = annualLeaveDecisionDateText(input.booking)

  return {
    organizationId,
    type,
    title: approved ? 'Annual Leave Approved' : 'Annual Leave Declined',
    message: holidayRequestDecisionMessage({
      approved,
      decidedByName: input.decidedByName,
      dateText,
      reason: note,
    }),
    userId,
    relatedId: input.booking.id,
    requiresPermission: null,
    destination: notificationDestination({
      type,
      relatedId: input.booking.id,
      role: 'operative',
    }),
  }
}

export async function notifyHolidayRequestDecisionToUser(input: {
  organizationId: string
  booking: HolidayBooking
  approved: boolean
  decidedByName: string
  reason?: string | null
  users?: ReadonlyArray<User>
  operatives?: ReadonlyArray<Operative>
}): Promise<void> {
  const payload = buildHolidayRequestDecisionNotification(input)
  if (!payload) return
  try {
    const id = await syntheticUuidFromKey(
      holidayDecisionDedupeKey(payload.relatedId, payload.userId, input.approved === true)
    )
    await saveInboxNotification({
      id,
      organizationId: payload.organizationId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      userId: payload.userId,
      relatedId: payload.relatedId,
      requiresPermission: payload.requiresPermission,
    })
  } catch {
    // Booking status is already saved. A missed inbox row must not undo that.
  }
}

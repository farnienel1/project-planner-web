/**
 * Rulebook 1.72.0 §8 (owner decisions 23 Nov, A and B): the line manager's ⚙ and ✕ on a timesheet line under review
 * change the BOOKING, never only the timesheet.
 *
 * - ⚙ Edit hours writes the booking's times, slot, unpaid-break toggle and overtime rate as a partial update
 *   (`timesheetReviewBookingEditWrites`, on `bookingUpdateWriteFields` / `managerSiteBookingUpdateWriteFields`). No
 *   `payrollLineReviews` entry is written. The 1.47.0 rule (`signedTimesheetBookingChanges`) then reads the signed
 *   sheet as changed: it goes back to the person ("Your signed timesheet has changed", the 1.54.0 notice), they sign
 *   again and the line manager counter-signs again.
 * - ✕ deletes the booking with its tombstone in the same batch (`timesheetReviewBookingDelete`, on
 *   `bookingTombstoneWriteFields`, §2), after `timesheetReviewDeleteBookingWarning`. The sheet then reads the booking as
 *   removed (1.47.0) and goes back to the person the same way.
 * - ✓ stays what it was: the line is approved as it is (`payrollLineReviews[lineId] = { decision: 'approved' }`).
 *
 * Stored `payrollLineReviews` entries written before 1.72.0 (edited, declined) are read as before (guardrail 3): an old
 * sheet keeps its decisions, and a 1.46.0 edited review goes stale only when its booking changes.
 *
 * Only the fields the security rules let a person's line manager change are ever written (§16:
 * `workStartTime`, `workEndTime`, `timeSlot`, `isBreakRemoved` (1.72.0), `otMultiplierOverride`), plus the app's write
 * metadata. Online only (an approval, §2).
 */

import { bookingUpdateWriteFields, managerSiteBookingUpdateWriteFields } from './workDocumentReaders'
import { bookingTombstoneWriteFields, type BookingTombstoneWriteFields } from './bookingTombstones'
import {
  overtimeMultiplierValid,
  overtimeStrikeOutcome,
  OVERTIME_MULTIPLIER_MESSAGE,
  type OvertimeOrganization,
} from './payeOvertime'
import { bookingClock } from './bookings'
import { revisedPayrollLineTimesError } from './timesheetLineEdit'
import { timesheetLineReviewActionsAllowed } from './timesheetPeriod'

export type TimesheetReviewBookingCollection = 'bookings' | 'managerSiteBookings'

/** The booking fields a line manager's ⚙ may write (§16); nothing else is ever in the write. */
export const TIMESHEET_REVIEW_BOOKING_FIELDS = [
  'timeSlot',
  'workStartTime',
  'workEndTime',
  'isBreakRemoved',
  'otMultiplierOverride',
] as const

export const TIMESHEET_REVIEW_EDIT_BOOKING_NOTE =
  'Saving changes the booking itself, so scheduling, Daily Overview and the weekly report show the new hours. The timesheet then goes back to the person to review and sign again.'
export const TIMESHEET_REVIEW_DELETE_BOOKING_TITLE = 'Remove this booking?'
export const TIMESHEET_REVIEW_DELETE_BOOKING_CONFIRM_LABEL = 'Remove booking'
export const TIMESHEET_REVIEW_DELETE_BOOKING_CANCEL_LABEL = 'Go back'
export const TIMESHEET_REVIEW_DELETE_BOOKING_MESSAGE =
  'This deletes the booking from the schedule, not just from this timesheet. Scheduling, Daily Overview and the weekly report will no longer show it, and the timesheet goes back to the person to review and sign again.'
export const TIMESHEET_REVIEW_DELETE_OVERTIME_NOTE =
  'This booking is all overtime (it has no hours inside the working day), so removing the overtime removes the whole booking.'
export const TIMESHEET_REVIEW_REMOVE_OVERTIME_TITLE = 'Remove the overtime from this booking?'
export const TIMESHEET_REVIEW_REMOVE_OVERTIME_CONFIRM_LABEL = 'Remove overtime'
export const TIMESHEET_REVIEW_REMOVE_OVERTIME_MESSAGE =
  'This changes the booking itself, so scheduling, Daily Overview and the weekly report show the new hours. The standard hours stay; the timesheet then goes back to the person to review and sign again.'
export const TIMESHEET_REVIEW_DELETE_BOOKING_UNDO_NOTE = 'This cannot be undone. A manager can book it again.'
export const TIMESHEET_REVIEW_BOOKING_REFUSED_MESSAGE =
  "You can't change this booking from the timesheet. Ask an admin or the job's manager to change it in projects or small works."
export const TIMESHEET_REVIEW_BOOKING_MISSING_MESSAGE = 'This booking was deleted on another device.'
export const TIMESHEET_REVIEW_BOOKING_SENT_BACK_MESSAGE =
  'Booking updated. The timesheet has gone back to the person to review and sign again.'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** `HH:mm` from any stored clock shape the booking reader accepts ("7:30", "07:30:00", "7:30 AM", a Timestamp). */
function clock(value: unknown, timeZone?: string | null): string {
  return bookingClock(value, timeZone) ?? ''
}

function rateOf(value: unknown): number | null {
  const rate = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

/**
 * The overtime rate a reviewer's ⚙ writes. `typed` is the rate box on save, `opened` what the box showed when the editor
 * opened (the stored override, else the organisation's rate that day), `organizationMultiplier` the organisation's rate
 * that day, `stored` the booking's stored `otMultiplierOverride`. Unchanged (or blank) → undefined (leave the booking's
 * rate); set to the organisation's rate → null (remove the override) only when one is stored, else undefined; anything
 * else → the number. Never writes a rate nobody changed (review of #416).
 */
export function timesheetReviewOvertimeRate(input: {
  typed: unknown
  opened: unknown
  organizationMultiplier: unknown
  stored: unknown
}): number | null | undefined {
  const typed = rateOf(input.typed)
  if (typed == null) return undefined
  const opened = rateOf(input.opened)
  if (opened != null && Math.abs(typed - opened) < 1e-9) return undefined
  const organization = rateOf(input.organizationMultiplier)
  if (organization != null && Math.abs(typed - organization) < 1e-9) return rateOf(input.stored) != null ? null : undefined
  return typed
}

function slotKey(value: unknown): string {
  return text(value).toUpperCase().replace(/[_-]+/g, ' ')
}

function isCustomSlot(value: unknown): boolean {
  const slot = slotKey(value)
  return slot === 'CUSTOM HOURS' || slot === 'CUSTOM'
}

function documentId(value: unknown): string {
  const id = text(value)
  return id && !id.includes('/') ? id : ''
}

export function isTimesheetReviewBookingCollection(value: unknown): value is TimesheetReviewBookingCollection {
  return value === 'bookings' || value === 'managerSiteBookings'
}

/** The stored booking the line came from (the live document; only these fields are read). */
export type TimesheetReviewBookingInput = {
  id: string
  collection: TimesheetReviewBookingCollection | string
  timeSlot?: unknown
  workStartTime?: unknown
  workEndTime?: unknown
  isBreakRemoved?: unknown
  otMultiplierOverride?: unknown
}

export type TimesheetReviewBookingEdit =
  | {
      ok: true
      collection: TimesheetReviewBookingCollection
      bookingId: string
      /** Partial update (no write when both are empty). The app adds write metadata. */
      set: Record<string, unknown>
      remove: string[]
      changed: boolean
    }
  | { ok: false; error: string }

/**
 * ⚙ on a timesheet line under review → the booking's partial update. `startTime` / `endTime` are `HH:mm` (a finish
 * before the start is overnight; equal times are refused, `revisedPayrollLineTimesError`). `otMultiplierOverride`:
 * undefined leaves the booking's rate, null removes it (the organisation's rate), a number sets it (1–3 in 0.25
 * steps, `overtimeMultiplierValid`). `slotWindow` is the named slot's clock window that day when the stored booking has
 * no clock times (a Full day): unchanged times then keep the slot and write nothing. When the times change the slot
 * becomes `CUSTOM_HOURS` (as the overtime cog does). An unchanged `isBreakRemoved` that was never stored is not added.
 */
export function timesheetReviewBookingEditWrites(input: {
  booking: TimesheetReviewBookingInput | null | undefined
  startTime: unknown
  endTime: unknown
  isBreakRemoved: unknown
  otMultiplierOverride?: number | null
  /** Preferred over `otMultiplierOverride`: resolved with `timesheetReviewOvertimeRate` against the stored booking. */
  overtimeRate?: { typed: unknown; opened: unknown; organizationMultiplier: unknown } | null
  slotWindow?: { start: string; end: string } | null
  timeZone?: string | null
}): TimesheetReviewBookingEdit {
  const booking = input.booking
  const zone = input.timeZone ?? null
  const bookingId = documentId(booking?.id)
  const collection = booking?.collection
  if (!booking || !bookingId || !isTimesheetReviewBookingCollection(collection)) {
    return { ok: false, error: TIMESHEET_REVIEW_BOOKING_MISSING_MESSAGE }
  }
  const timesError = revisedPayrollLineTimesError(input.startTime, input.endTime)
  if (timesError) return { ok: false, error: timesError }
  const rate = input.overtimeRate
    ? timesheetReviewOvertimeRate({ ...input.overtimeRate, stored: booking.otMultiplierOverride })
    : input.otMultiplierOverride
  if (rate != null && !overtimeMultiplierValid(rate)) {
    return { ok: false, error: OVERTIME_MULTIPLIER_MESSAGE }
  }
  const start = clock(input.startTime)
  const end = clock(input.endTime)
  const storedStart = clock(booking.workStartTime, zone)
  const storedEnd = clock(booking.workEndTime, zone)
  const shownStart = storedStart || clock(input.slotWindow?.start)
  const shownEnd = storedEnd || clock(input.slotWindow?.end)
  const timesChanged = start !== shownStart || end !== shownEnd
  const storedBreak = booking.isBreakRemoved === true
  const nextBreak = input.isBreakRemoved === true
  const before: Record<string, unknown> = {}
  for (const key of TIMESHEET_REVIEW_BOOKING_FIELDS) {
    if (booking[key] !== undefined) before[key] = booking[key]
  }
  const next: Record<string, unknown> = {
    timeSlot: timesChanged && !isCustomSlot(booking.timeSlot) ? 'CUSTOM_HOURS' : undefined,
    workStartTime: timesChanged ? start : undefined,
    workEndTime: timesChanged ? end : undefined,
    isBreakRemoved: nextBreak === storedBreak && booking.isBreakRemoved === undefined ? undefined : nextBreak,
  }
  if (rate === null) {
    if (booking.otMultiplierOverride != null) next.otMultiplierOverride = null
  } else if (rate !== undefined) next.otMultiplierOverride = Number(rate)
  // Keep the slot group whole when it is written: unchanged group fields are the stored values.
  if (timesChanged || next.isBreakRemoved !== undefined) {
    if (next.timeSlot === undefined && booking.timeSlot !== undefined) next.timeSlot = booking.timeSlot
    if (next.workStartTime === undefined && storedStart) next.workStartTime = storedStart
    if (next.workEndTime === undefined && storedEnd) next.workEndTime = storedEnd
  }
  const write =
    collection === 'bookings' ? bookingUpdateWriteFields(before, next) : managerSiteBookingUpdateWriteFields(before, next)
  const set: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(write.set)) {
    if ((TIMESHEET_REVIEW_BOOKING_FIELDS as readonly string[]).includes(key)) set[key] = value
  }
  const remove = write.remove.filter((key) => (TIMESHEET_REVIEW_BOOKING_FIELDS as readonly string[]).includes(key))
  return { ok: true, collection, bookingId, set, remove, changed: Object.keys(set).length > 0 || remove.length > 0 }
}

export type TimesheetReviewBookingDelete = {
  collection: TimesheetReviewBookingCollection
  bookingId: string
  /** Written in the same batch as the delete; the app adds the server `deletedAt`. */
  tombstone: BookingTombstoneWriteFields
}

/** ✕ on a timesheet line under review → the booking delete and its tombstone (one batch). Null for unusable ids. */
export function timesheetReviewBookingDelete(input: {
  booking: { id: unknown; collection: unknown } | null | undefined
  deletedBy: unknown
  platform: unknown
}): TimesheetReviewBookingDelete | null {
  const collection = input.booking?.collection
  if (!isTimesheetReviewBookingCollection(collection)) return null
  const tombstone = bookingTombstoneWriteFields({
    bookingId: input.booking?.id,
    collection,
    deletedBy: input.deletedBy,
    deletedFrom: input.platform,
  })
  return tombstone ? { collection, bookingId: tombstone.bookingId, tombstone } : null
}

/** The confirm shown before ✕ deletes a booking: title, message, labels. */
export function timesheetReviewDeleteBookingWarning(input: {
  /** "Mon 23 Nov · J-1042 Station Road · 07:00–16:00" (the app builds it in the organisation zone). */
  summary?: string | null
  /** The line is the booking's overtime line: say the whole booking goes. */
  overtimeLine?: boolean | null
}): { title: string; summary: string; message: string; overtimeNote: string | null; undoNote: string; confirmLabel: string; cancelLabel: string } {
  return {
    title: TIMESHEET_REVIEW_DELETE_BOOKING_TITLE,
    summary: text(input.summary),
    message: TIMESHEET_REVIEW_DELETE_BOOKING_MESSAGE,
    overtimeNote: input.overtimeLine ? TIMESHEET_REVIEW_DELETE_OVERTIME_NOTE : null,
    undoNote: TIMESHEET_REVIEW_DELETE_BOOKING_UNDO_NOTE,
    confirmLabel: TIMESHEET_REVIEW_DELETE_BOOKING_CONFIRM_LABEL,
    cancelLabel: TIMESHEET_REVIEW_DELETE_BOOKING_CANCEL_LABEL,
  }
}

/**
 * Which line actions a reviewer gets on one labour line (✓ approve, ✕ remove the booking, ⚙ edit the booking). None on
 * an exported sheet (`timesheetLineReviewActionsAllowed`, 1.71.0) and none on a PAYE-day or leave line. ✕ and ⚙ need a
 * labour or manager site booking id on the line (a line that names no booking can only be approved). Whether the viewer
 * reviews this person, and the person's signature, stay the app's checks.
 */
export function timesheetLabourLineReviewActions(input: {
  sheet: Record<string, unknown> | null | undefined
  line: { bookingId?: string | null; bookingCollection?: string | null; isPayeDay?: boolean | null; isLeave?: boolean | null } | null | undefined
}): { approve: boolean; removeBooking: boolean; editBooking: boolean } {
  const none = { approve: false, removeBooking: false, editBooking: false }
  if (!input.line || !timesheetLineReviewActionsAllowed(input.sheet)) return none
  if (input.line.isPayeDay === true || input.line.isLeave === true) return none
  const collection = text(input.line.bookingCollection) || 'bookings'
  const hasBooking = Boolean(documentId(input.line.bookingId)) && isTimesheetReviewBookingCollection(collection)
  return { approve: true, removeBooking: hasBooking, editBooking: hasBooking }
}

export type TimesheetReviewOvertimeStrike =
  | {
      /** ✕ on the overtime line keeps the standard part: a partial update of the booking's times (rate untouched). */
      kind: 'trim'
      collection: TimesheetReviewBookingCollection
      bookingId: string
      start: string
      end: string
      set: Record<string, unknown>
      remove: string[]
      title: string
      summary: string
      message: string
      confirmLabel: string
      cancelLabel: string
    }
  | {
      /** The booking has no standard part (all overtime, or a weekend paid every hour at a multiplier): only a delete. */
      kind: 'delete'
    }
  | { kind: 'refused'; error: string }

/**
 * ✕ on a booking's OVERTIME line under review (owner answer 23 Nov, #416 Q3): remove the overtime only. The booking is
 * trimmed to its standard part with the §25 rule (`overtimeStrikeOutcome`): a weekday booking back inside the working
 * day, a set-window weekend booking to the window. The write is `workStartTime` / `workEndTime` / `timeSlot` only
 * (`otMultiplierOverride` and the break toggle stay as stored). A booking with no standard part — all overtime, a weekend
 * paid every hour at a multiplier, or no clock times — can only be removed entirely: `delete` (the app then shows
 * `timesheetReviewDeleteBookingWarning` with `overtimeLine: true` and deletes with its tombstone). ✕ on the standard line
 * is always the delete.
 */
export function timesheetReviewOvertimeStrike(input: {
  booking: (TimesheetReviewBookingInput & { dayKey: string; personId?: string | null }) | null | undefined
  organization: OvertimeOrganization
  timeZone?: string | null
  /** "Mon 23 Nov · J-1042 Station Road" (the app builds it in the organisation zone). */
  summary?: string | null
}): TimesheetReviewOvertimeStrike {
  const booking = input.booking
  const bookingId = documentId(booking?.id)
  const collection = booking?.collection
  if (!booking || !bookingId || !isTimesheetReviewBookingCollection(collection)) {
    return { kind: 'refused', error: TIMESHEET_REVIEW_BOOKING_MISSING_MESSAGE }
  }
  const zone = input.timeZone ?? null
  const outcome = overtimeStrikeOutcome({
    booking: {
      id: bookingId,
      collection,
      personId: text(booking.personId),
      dayKey: text(booking.dayKey),
      timeSlot: text(booking.timeSlot) || undefined,
      workStartTime: clock(booking.workStartTime, zone) || undefined,
      workEndTime: clock(booking.workEndTime, zone) || undefined,
      isBreakRemoved: booking.isBreakRemoved === true,
    },
    organization: input.organization,
    timeZone: zone,
  })
  if (outcome.kind !== 'trim') return { kind: 'delete' }
  const edit = timesheetReviewBookingEditWrites({
    booking,
    startTime: outcome.start,
    endTime: outcome.end,
    isBreakRemoved: booking.isBreakRemoved === true,
    timeZone: zone,
  })
  if (!edit.ok) return { kind: 'refused', error: edit.error }
  const keep = new Set(['timeSlot', 'workStartTime', 'workEndTime'])
  const set: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(edit.set)) if (keep.has(key)) set[key] = value
  const remove = edit.remove.filter((key) => keep.has(key))
  const range = `${outcome.start}–${outcome.end}`
  return {
    kind: 'trim',
    collection,
    bookingId,
    start: outcome.start,
    end: outcome.end,
    set,
    remove,
    title: TIMESHEET_REVIEW_REMOVE_OVERTIME_TITLE,
    summary: [text(input.summary), `New times ${range}`].filter(Boolean).join(' · '),
    message: TIMESHEET_REVIEW_REMOVE_OVERTIME_MESSAGE,
    confirmLabel: TIMESHEET_REVIEW_REMOVE_OVERTIME_CONFIRM_LABEL,
    cancelLabel: TIMESHEET_REVIEW_DELETE_BOOKING_CANCEL_LABEL,
  }
}

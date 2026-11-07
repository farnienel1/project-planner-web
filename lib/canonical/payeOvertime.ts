/**
 * PAYE overtime (rulebook §25, 1.29.0, owner decisions 4 Nov; spec "PAYE overtime, price work and expenses").
 *
 * The booking is the only source. A PAYE person's overtime is worked out from their bookings under the working hours
 * in effect on each day, with the pay rule timesheets already use (`payrollHoursResult`): weekday hours outside the
 * working day × the weekday multiplier; a weekend set window, the hours outside the window × that day's rate; a
 * weekend paid at a multiplier only, every hour × the rate; an unpaid break stays plain hours. Hours only — no money.
 * One line per booking with at least `OVERTIME_MIN_MINUTES` of overtime clock time; two jobs on one day are two lines.
 *
 * The booking's own overtime rate is the stored `otMultiplierOverride` (1–3 in 0.25 steps; missing = the
 * organisation's rate). It is the field the booking editors already wrote and `payrollHoursResult` already priced, so
 * the cog, Edit Booking's "Overtime rate" and older app builds read and write one field; a stored rate is never
 * clamped or re-priced on read.
 *
 * A line's state comes from the person's overtime request and review documents (1.33.0, owner decisions 6 Nov):
 *   - `needsReview` — never sent (or the person has no line manager and has not ticked it yet);
 *   - `waiting` — a pending request names the booking and the booking still matches its fingerprint;
 *   - `changedSinceRequest` — a pending request names it but the booking changed since, or a Return skipped it because
 *     it had changed (`staleBookingIds`): the person sends it again;
 *   - `confirmed` — the person (no line manager) ticked, crossed or changed it directly and it is unchanged since;
 *   - `returnedApproved` / `returnedChanged` / `returnedDeclined` — a Return decided it ("Approved", "Changed by {name}",
 *     "Declined") and the booking is unchanged since;
 *   - `reopened` — it was decided (or confirmed) but the booking changed afterwards: the cycle starts again for it;
 *   - `deleted` — the booking was removed by an approved red X (1.33.0), shown struck through at 0h;
 *   - `cancelled` — 1.29–1.32 data: the booking was cancelled by an approved strike (shown struck through).
 * The fingerprint (`overtimeBookingFingerprint`) is the day, slot, start, finish, overtime rate, break toggle and
 * status, so an old request can never overwrite a newer booking.
 */

import { formatClockMinutes, parseClockMinutes } from './engine'
import { normalizeBookingStatus, normalizeBookingTimeSlot } from './bookings'
import { isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import { hasActiveLineManager, isAdminOutsideOperativeMode, isSuperAdminAccount, lineManagerIds, type LeaveSelfBookUser } from './leaveRequests'
import { bookingIdsForAccount } from './bookingPerson'
import { bookingTombstoneWriteFields, type BookingTombstoneWriteFields } from './bookingTombstones'
import { payePayrunPeriod } from './payePayrun'
import { excludeActor, notificationRecipientAccountId, type NotificationPerson, type NotificationRosterMember } from './notificationRecipients'
import { formatPaymentRunDay } from './paymentRuns'
import { payrollDayWindows, payrollHoursResult, payrollMultipliedHours, payrollOutsideMultiplier } from './payrollHours'
import { effectivePayrollTimePolicy } from './payrollPolicySchedule'
import { idKey, idText, personIdSet, rosterMemberActive } from './personIds'
import { canWriteBooking, type BookingPermissionInput, type JobAccessViewer, type JobManagerFields, type JobManagerRosterRow } from './staffAccess'
import { employmentTypeOnDay, type EmploymentTypeUser } from './userProfile'
import { dateFromDayKeyInZone } from '../orgTime/zoneTime'
import { reportGeneratedText } from './reportHeader'
import { isGhostUser } from './userRosterSegment'

// MARK: - Constants and copy

export const OVERTIME_MIN_MINUTES = 15
export const OVERTIME_MULTIPLIER_MIN = 1
export const OVERTIME_MULTIPLIER_MAX = 3
export const OVERTIME_MULTIPLIER_STEP = 0.25
/** 1, 1.25, 1.5 … 3. */
export const OVERTIME_MULTIPLIER_STEPS: ReadonlyArray<number> = Array.from({ length: 9 }, (_, i) => 1 + i * 0.25)
export const OVERTIME_MULTIPLIER_MESSAGE = 'Choose an overtime rate from 1 to 3 in steps of 0.25.'
export const OVERTIME_TIMES_MESSAGE = 'Enter a start and finish time (e.g. 07:30).'
export const OVERTIME_HUB_LABEL = 'Overtime, Expenses & Price Work'
export const OVERTIME_MINE_LABEL = 'My Overtime, Expenses & Price Work'
export const OVERTIME_USERS_LABEL = "Users' Overtime, Expenses & Price Work"
export const OVERTIME_COMING_NEXT_MESSAGE = 'Expenses and price work are coming in the next update.'
/** The person's button (1.33.0 owner decision 6 Nov: the label stays "Send for approval"); green per `overtimeSubmitReady`. */
export const OVERTIME_SEND_FOR_APPROVAL_LABEL = 'Send for approval'
export const OVERTIME_GENERATE_REPORT_LABEL = 'Generate overtime report'
/** 1.33.0: the line manager's (or deciding admin's) one button; green per `overtimeReturnReady`. */
export const OVERTIME_RETURN_LABEL = 'Return overtime'
/** @deprecated 1.32.0: use `OVERTIME_RETURN_LABEL` (1.33.0); kept while iOS builds before the 1.32.0 hand-off read it. */
export const OVERTIME_APPROVE_REQUEST_LABEL = 'Approve Overtime Request'
/** @deprecated 1.32.0: a changed line now goes back on its own (`OVERTIME_CHANGED_SINCE_REQUEST_LINE_MESSAGE`). */
export const OVERTIME_REQUEST_STALE_MESSAGE =
  'A booking changed after this request was sent, so it cannot be approved. Ask for the request to be sent again.'
/** 1.33.0: Return needs every line decided (`overtimeReturnReady`). */
export const OVERTIME_REQUEST_UNDECIDED_MESSAGE = 'Tick, cross or change every line before returning the request.'
/** 1.33.0: Send for approval needs every line marked (`overtimeSubmitReady`). */
export const OVERTIME_SUBMIT_UNDECIDED_MESSAGE = 'Tick, cross or change every line before sending.'
/** 1.33.0: after a Return, Send for approval stays grey until a line is changed (✕→✓, ✓→✕ or ⚙). */
export const OVERTIME_SUBMIT_NOTHING_CHANGED_MESSAGE = 'Nothing to send — change a line first.'
export const OVERTIME_REQUEST_NOT_PENDING_MESSAGE = 'This request is no longer waiting for approval.'
export const OVERTIME_NO_LINES_MESSAGE = 'There is no overtime in this range.'
export const OVERTIME_CANCEL_NOT_ALLOWED_MESSAGE =
  'All of this booking is outside the working day. Change its hours with the cog, or ask a scheduler to remove it.'
export const OVERTIME_REPORT_TOTAL_LABEL = 'Total overtime'
/** 1.33.0: why Generate overtime report is grey (`overtimeGenerateReady`). */
export const OVERTIME_GENERATE_NOT_READY_MESSAGE = 'Every line must be returned by your line manager first.'
export const OVERTIME_GENERATE_NOT_MARKED_MESSAGE = 'Tick, cross or change every line first.'
export const OVERTIME_GENERATE_UNSENT_MESSAGE = 'Send your changes for approval first.'
export const OVERTIME_GENERATE_SAVED_MESSAGE = 'A report for this range is already saved. It is marked out of date if a line changes.'
/** 1.33.0: a saved report whose lines no longer match the bookings (`overtimeReportOutOfDate`). */
export const OVERTIME_REPORT_OUT_OF_DATE_LABEL = 'Out of date'
/** 1.32.0: the one review button under the lines (Price work / Expenses, §26). Overtime uses `OVERTIME_RETURN_LABEL` from 1.33.0. */
export const OVERTIME_APPROVE_LABEL = 'Approve'
export const OVERTIME_CHANGED_SINCE_REQUEST_LINE_MESSAGE = 'Changed since they sent it — it goes back to them to send again.'
export const OVERTIME_BOOKING_UNREADABLE_MESSAGE = "Can't read this booking — it is left out of this Return."
export const OVERTIME_NOT_THEIR_BOOKING_MESSAGE = 'This booking is not theirs — it is left out.'

/** The red X delete warning (1.33.0: the booking is deleted, not cancelled), the same on every platform. */
export const OVERTIME_DELETE_WARNING = {
  title: 'Remove this booking?',
  body: 'This will remove this booking entirely. Your organisation pays a set multiplier for this day. If you still worked this day, use the cog to set the hours you worked and agreed.',
  back: 'Go back',
  confirm: 'Remove booking',
  footnote: 'This cannot be undone. A manager can book it again.',
} as const
/** @deprecated 1.33.0: renamed `OVERTIME_DELETE_WARNING` (the booking is deleted). The same object. */
export const OVERTIME_CANCEL_WARNING = OVERTIME_DELETE_WARNING

export const OVERTIME_LINE_STATES = [
  'needsReview',
  'waiting',
  'changedSinceRequest',
  'confirmed',
  'returnedApproved',
  'returnedChanged',
  'returnedDeclined',
  'reopened',
  'deleted',
  'cancelled',
] as const
export type OvertimeLineState = (typeof OVERTIME_LINE_STATES)[number]
/** `returnedChanged` reads "Changed by {name}" on a line (`OvertimeLine.stateLabel` fills the name). */
export const OVERTIME_LINE_STATE_LABELS: Readonly<Record<OvertimeLineState, string>> = {
  needsReview: 'Needs review',
  waiting: 'Waiting for line manager',
  changedSinceRequest: 'Changed since you sent it',
  confirmed: 'Confirmed',
  returnedApproved: 'Approved',
  returnedChanged: 'Changed by {name}',
  returnedDeclined: 'Declined',
  reopened: 'Booking changed — check it again',
  deleted: 'Booking removed — not worked',
  cancelled: 'Booking cancelled',
}
/** 1.33.0: states in which a line is finished (nothing left for the person or the line manager to do). */
export const OVERTIME_DONE_LINE_STATES: ReadonlyArray<OvertimeLineState> = [
  'confirmed',
  'returnedApproved',
  'returnedChanged',
  'returnedDeclined',
  'deleted',
  'cancelled',
]
/** 1.33.0: states the line manager has returned (Generate needs every line in one of these when there is a line manager). */
export const OVERTIME_RETURNED_LINE_STATES: ReadonlyArray<OvertimeLineState> = ['returnedApproved', 'returnedChanged', 'returnedDeclined']

/** Notification types (§13). */
export const OVERTIME_REQUEST_SUBMITTED_TYPE = 'overtime_request_submitted'
export const OVERTIME_REQUEST_REVIEWED_TYPE = 'overtime_request_reviewed'
export const BOOKING_HOURS_CHANGED_BY_OWNER_TYPE = 'booking_hours_changed_by_owner'

/** Firestore collections (organisation scoped). */
export const OVERTIME_REQUESTS_COLLECTION = 'overtimeRequests'
export const OVERTIME_REVIEWS_COLLECTION = 'overtimeReviews'
export const OVERTIME_REPORTS_COLLECTION = 'overtimeReports'
export const OVERTIME_REQUEST_STATUSES = ['pending', 'approved', 'withdrawn'] as const
export type OvertimeRequestStatus = (typeof OVERTIME_REQUEST_STATUSES)[number]

// MARK: - Inputs

export type OvertimeBookingCollection = 'bookings' | 'managerSiteBookings'

/** A booking as the overtime rules read it (from `parseBookingDocument` / `parseManagerSiteBookingDocument`). */
export type OvertimeBookingInput = {
  id: string
  /** `bookings` (labour) or `managerSiteBookings`. */
  collection?: string | null
  /** `operativeId` of a labour booking, `userId` of a manager site booking. */
  personId: string
  /** Organisation-zone `YYYY-MM-DD`. */
  dayKey: string
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
  otMultiplierOverride?: number | null
  /** Missing reads Confirmed (manager site bookings carry none). */
  status?: string | null
  jobId?: string | null
  jobNumber?: string | null
  jobName?: string | null
}

/** An organisation document (or a `PayrollTimePolicyState`) — the working hours in effect on each day. */
export type OvertimeOrganization = unknown

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function hoursText(hours: number): string {
  return `${round2(hours)}h`
}

function clockOf(value: unknown): string {
  const minutes = parseClockMinutes(text(value))
  return minutes == null ? '' : formatClockMinutes(minutes)
}

function collectionOf(booking: Pick<OvertimeBookingInput, 'collection'>): OvertimeBookingCollection {
  return text(booking.collection) === 'managerSiteBookings' ? 'managerSiteBookings' : 'bookings'
}

function slotKey(raw: unknown): string {
  return text(raw).toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function isCustomSlot(raw: unknown): boolean {
  const slot = slotKey(raw)
  return slot === 'CUSTOM HOURS' || slot === 'CUSTOM'
}

function isCancelled(booking: Pick<OvertimeBookingInput, 'status'>): boolean {
  return normalizeBookingStatus(booking.status) === 'Cancelled'
}

function multiplierOf(value: unknown): number | null {
  const n = Number(value)
  return value != null && value !== '' && Number.isFinite(n) && n > 0 ? n : null
}

// MARK: - Overtime rate (the booking's `otMultiplierOverride`)

/** True for 1, 1.25 … 3. */
export function overtimeMultiplierValid(value: unknown): boolean {
  const n = Number(value)
  if (value == null || value === '' || !Number.isFinite(n)) return false
  if (n < OVERTIME_MULTIPLIER_MIN - 1e-9 || n > OVERTIME_MULTIPLIER_MAX + 1e-9) return false
  return Math.abs(n / OVERTIME_MULTIPLIER_STEP - Math.round(n / OVERTIME_MULTIPLIER_STEP)) < 1e-9
}

/** Null when `value` is null / undefined (the organisation rate) or a valid custom rate; else the message. */
export function overtimeMultiplierValidationError(value: unknown): string | null {
  if (value == null || value === '') return null
  return overtimeMultiplierValid(value) ? null : OVERTIME_MULTIPLIER_MESSAGE
}

/** The organisation's overtime rate for the booking's day (the booking's own rate ignored). */
export function organizationOvertimeMultiplier(organization: OvertimeOrganization, dayKey: string, timeZone?: string | null): number {
  const zone = zoneOrLondon(timeZone)
  const policy = effectivePayrollTimePolicy(organization, dayKey, zone)
  return payrollOutsideMultiplier({}, isoWeekdayOfDayKey(dayKey, zone), policy)
}

// MARK: - Fingerprint and figures

/**
 * The booking's fingerprint: `day|slot|start|finish|rate|break|status`, normalised so both apps build the same text
 * (slot upper case with spaces, clock `HH:mm`, the rate as a number or empty for the organisation's, `nb` when the
 * unpaid break is removed, the status lower case — Confirmed when missing).
 */
export function overtimeBookingFingerprint(booking: OvertimeBookingInput | null | undefined): string {
  if (!booking) return ''
  const rate = multiplierOf(booking.otMultiplierOverride)
  const status = (normalizeBookingStatus(booking.status) ?? (text(booking.status) || 'Confirmed')).toLowerCase()
  return [
    text(booking.dayKey),
    slotKey(booking.timeSlot),
    clockOf(booking.workStartTime),
    clockOf(booking.workEndTime),
    rate == null ? '' : String(rate),
    booking.isBreakRemoved === true ? 'nb' : '',
    status,
  ].join('|')
}

/** True when a stored fingerprint no longer matches the booking (or the booking is gone). */
export function overtimeLineIsStale(storedFingerprint: string | null | undefined, booking: OvertimeBookingInput | null | undefined): boolean {
  if (!booking) return true
  return text(storedFingerprint) !== overtimeBookingFingerprint(booking)
}

export type OvertimeFigures = {
  /** Clock hours at the multiplier (before any unpaid break). */
  clockHours: number
  multiplier: number
  /** Unpaid break taken off as plain hours. */
  breakHours: number
  /** clock × multiplier − break. */
  overtimeHours: number
  /** "1h × 1.5 = 1.5h". */
  text: string
  /** The working day (weekday) or set window (weekend) the overtime is outside of, "07:30–16:00"; null on an every-hour day. */
  dayWindow: string | null
  organizationMultiplier: number
  /** The booking's own rate, or null for the organisation's. */
  customMultiplier: number | null
}

/**
 * The overtime of one booking on its day under the working hours in effect then (`payrollHoursResult`), or null when
 * it has none (or less than `minMinutes`, default `OVERTIME_MIN_MINUTES`). A cancelled booking has none.
 */
export function overtimeForBooking(input: {
  booking: OvertimeBookingInput
  organization: OvertimeOrganization
  timeZone?: string | null
  minMinutes?: number | null
}): OvertimeFigures | null {
  const booking = input.booking
  if (!booking || !/^\d{4}-\d{2}-\d{2}$/.test(text(booking.dayKey)) || isCancelled(booking)) return null
  const zone = zoneOrLondon(input.timeZone)
  const policy = effectivePayrollTimePolicy(input.organization, booking.dayKey, zone)
  const result = payrollHoursResult({
    booking: {
      timeSlot: booking.timeSlot,
      workStartTime: booking.workStartTime,
      workEndTime: booking.workEndTime,
      isBreakRemoved: booking.isBreakRemoved,
      otMultiplierOverride: booking.otMultiplierOverride,
    },
    dayKey: booking.dayKey,
    policy,
    timeZone: zone,
  })
  const multiplied = payrollMultipliedHours(result)
  if (!multiplied) return null
  const min = input.minMinutes == null ? OVERTIME_MIN_MINUTES : Math.max(0, Number(input.minMinutes) || 0)
  if (multiplied.clockHours * 60 < min - 0.01 || !(multiplied.clockHours > 0)) return null
  const window = payrollDayWindows(policy, booking.dayKey, zone).paidWindow
  return {
    clockHours: round2(multiplied.clockHours),
    multiplier: multiplied.multiplier,
    breakHours: round2(multiplied.breakHours),
    overtimeHours: round2(multiplied.paidHours),
    text: multiplied.text,
    dayWindow: window ? `${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)}` : null,
    organizationMultiplier: payrollOutsideMultiplier({}, isoWeekdayOfDayKey(booking.dayKey, zone), policy),
    customMultiplier: multiplierOf(booking.otMultiplierOverride),
  }
}

// MARK: - Stored documents

export type OvertimeRequestLineAction = 'keep' | 'edit' | 'strike'

export type OvertimeRequestLine = {
  bookingId: string
  collection: OvertimeBookingCollection
  dayKey: string
  jobId: string | null
  fingerprint: string
  action: OvertimeRequestLineAction
  proposedStart: string | null
  proposedEnd: string | null
  /** The proposed rate; null = the organisation's. Only meaningful for `edit`. */
  proposedMultiplier: number | null
  /**
   * True when the proposal removes the booking (a strike of a booking with no hours inside the day). The stored name is
   * kept from 1.29.0; from 1.33.0 an approved line deletes the booking (with a tombstone) instead of cancelling it.
   */
  cancel: boolean
  overtimeHoursBefore: number
  overtimeHoursAfter: number
}

export type OvertimeDecision =
  | { action: 'approve' }
  | { action: 'strike' }
  | { action: 'edit'; start: string; end: string; multiplier: number | null }

export type OvertimeRequestRecord = {
  id: string
  userId: string
  rangeStart: string
  rangeEnd: string
  status: OvertimeRequestStatus
  lines: OvertimeRequestLine[]
  decisions: Record<string, OvertimeDecision>
  decidedBy: string | null
  createdAtMs: number | null
  decidedAtMs: number | null
  appliedBookingIds: string[]
  droppedBookingIds: string[]
  /** 1.33.0: lines a Return skipped because the booking changed since it was sent (they go back to the person). */
  staleBookingIds: string[]
  /** 1.33.0: bookings this Return deleted (an approved red X on an all-overtime day; the tombstone names the request). */
  deletedBookingIds: string[]
}

/**
 * `approved` / `edited` / `trimmed`: the line as the person asked (or, without a line manager, as they set it);
 * `cancelled`: a 1.29–1.32 strike that cancelled the booking. 1.33.0: `changed` (the decider's own cog values),
 * `declined` (the decider's ✕: the booking was left as it was) and `deleted` (an approved red X removed the booking).
 */
export type OvertimeReviewDecision = 'approved' | 'edited' | 'trimmed' | 'cancelled' | 'changed' | 'declined' | 'deleted'
export const OVERTIME_REVIEW_DECISIONS: ReadonlyArray<OvertimeReviewDecision> = [
  'approved',
  'edited',
  'trimmed',
  'cancelled',
  'changed',
  'declined',
  'deleted',
]

export type OvertimeReviewRecord = {
  id: string
  userId: string
  bookingId: string
  collection: OvertimeBookingCollection
  decision: OvertimeReviewDecision
  fingerprint: string
  reviewedBy: string | null
  reviewedAtMs: number | null
  requestId: string | null
}

function instantMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime()
  if (typeof raw === 'string') {
    const ms = Date.parse(raw)
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    if (typeof row.toMillis === 'function') {
      const ms = Number((row.toMillis as () => number)())
      return Number.isFinite(ms) ? ms : null
    }
    const seconds = Number(row.seconds ?? row._seconds)
    if (!Number.isFinite(seconds)) return null
    const nanos = Number(row.nanoseconds ?? row._nanoseconds ?? 0) || 0
    return seconds * 1000 + Math.floor(nanos / 1e6)
  }
  return null
}

function dayKeyOrEmpty(value: unknown): string {
  const key = text(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : ''
}

function parseRequestLine(raw: unknown): OvertimeRequestLine | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const bookingId = text(row.bookingId)
  if (!bookingId) return null
  const action = text(row.action)
  return {
    bookingId,
    collection: collectionOf({ collection: text(row.collection) }),
    dayKey: dayKeyOrEmpty(row.dayKey),
    jobId: text(row.jobId) || null,
    fingerprint: text(row.fingerprint),
    action: action === 'edit' || action === 'strike' ? action : 'keep',
    proposedStart: clockOf(row.proposedStart) || null,
    proposedEnd: clockOf(row.proposedEnd) || null,
    proposedMultiplier: multiplierOf(row.proposedMultiplier),
    cancel: row.cancel === true,
    overtimeHoursBefore: round2(Number(row.overtimeHoursBefore) || 0),
    overtimeHoursAfter: round2(Number(row.overtimeHoursAfter) || 0),
  }
}

function parseDecision(raw: unknown): OvertimeDecision | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const action = text(row.action)
  if (action === 'approve') return { action: 'approve' }
  if (action === 'strike') return { action: 'strike' }
  if (action === 'edit') {
    const start = clockOf(row.start)
    const end = clockOf(row.end)
    if (!start || !end) return null
    return { action: 'edit', start, end, multiplier: multiplierOf(row.multiplier) }
  }
  return null
}

/** Reads `organizations/{orgId}/overtimeRequests/{id}`. Never throws; the document id is the record id. */
export function parseOvertimeRequestDocument(docId: string, data: Record<string, unknown> | null | undefined): OvertimeRequestRecord {
  const row = data && typeof data === 'object' ? data : {}
  const status = text(row.status).toLowerCase()
  const decisions: Record<string, OvertimeDecision> = {}
  const rawDecisions = row.decisions && typeof row.decisions === 'object' ? (row.decisions as Record<string, unknown>) : {}
  for (const [bookingId, value] of Object.entries(rawDecisions)) {
    const decision = parseDecision(value)
    if (decision) decisions[bookingId] = decision
  }
  const ids = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean) : [])
  return {
    id: text(docId),
    userId: text(row.userId),
    rangeStart: dayKeyOrEmpty(row.rangeStart),
    rangeEnd: dayKeyOrEmpty(row.rangeEnd),
    status: (OVERTIME_REQUEST_STATUSES as readonly string[]).includes(status) ? (status as OvertimeRequestStatus) : 'pending',
    lines: (Array.isArray(row.lines) ? row.lines : []).map(parseRequestLine).filter((line): line is OvertimeRequestLine => line != null),
    decisions,
    decidedBy: text(row.decidedBy) || null,
    createdAtMs: instantMs(row.createdAt),
    decidedAtMs: instantMs(row.decidedAt),
    appliedBookingIds: ids(row.appliedBookingIds),
    droppedBookingIds: ids(row.droppedBookingIds),
    staleBookingIds: ids(row.staleBookingIds),
    deletedBookingIds: ids(row.deletedBookingIds),
  }
}

/** Reads `organizations/{orgId}/overtimeReviews/{userId}_{bookingId}`. Never throws. */
export function parseOvertimeReviewDocument(docId: string, data: Record<string, unknown> | null | undefined): OvertimeReviewRecord {
  const row = data && typeof data === 'object' ? data : {}
  const decision = text(row.decision)
  return {
    id: text(docId),
    userId: text(row.userId),
    bookingId: text(row.bookingId),
    collection: collectionOf({ collection: text(row.collection) }),
    decision: (OVERTIME_REVIEW_DECISIONS as readonly string[]).includes(decision) ? (decision as OvertimeReviewDecision) : 'approved',
    fingerprint: text(row.fingerprint),
    reviewedBy: text(row.reviewedBy) || null,
    reviewedAtMs: instantMs(row.reviewedAt),
    requestId: text(row.requestId) || null,
  }
}

/** The review document id: `{userId}_{bookingId}` as stored. */
export function overtimeReviewDocId(userId: string, bookingId: string): string {
  return `${text(userId)}_${text(bookingId)}`
}

// MARK: - Lines

export type OvertimeLine = {
  bookingId: string
  collection: OvertimeBookingCollection
  dayKey: string
  /** "Tue 4 Nov". */
  dayLabel: string
  jobId: string | null
  jobNumber: string
  jobName: string
  /** "J-1042 · Riverside Flats". */
  title: string
  start: string
  end: string
  timeSlot: string
  fingerprint: string
  state: OvertimeLineState
  /** `OVERTIME_LINE_STATE_LABELS[state]`, with the decider's name in "Changed by {name}". */
  stateLabel: string
  /** Null for a cancelled or deleted line. */
  figures: OvertimeFigures | null
  /** The pending request naming this booking, if any. */
  requestId: string | null
  requestLine: OvertimeRequestLine | null
  review: OvertimeReviewRecord | null
  /** 1.33.0: who returned the line (`review.reviewedBy`) and their name from `names`; null when not returned. */
  decidedBy: string | null
  deciderName: string | null
  /**
   * 1.33.0: the request line the person last sent for this booking (pending, or the request the Return decided);
   * the person's ✓ ✕ ⚙ start from it (`overtimeLineBaselineChoice`).
   */
  sentLine: OvertimeRequestLine | null
}

function newestPending(requests: ReadonlyArray<OvertimeRequestRecord>, bookingId: string): { request: OvertimeRequestRecord; line: OvertimeRequestLine } | null {
  let best: { request: OvertimeRequestRecord; line: OvertimeRequestLine } | null = null
  for (const request of requests) {
    if (request.status !== 'pending') continue
    // 1.32.0: a line already applied (or left out) by a partial approval no longer waits on this request.
    if ([...(request.appliedBookingIds || []), ...(request.droppedBookingIds || [])].some((id) => idKey(id) === idKey(bookingId))) continue
    const line = request.lines.find((row) => idKey(row.bookingId) === idKey(bookingId))
    if (!line) continue
    if (!best || (request.createdAtMs ?? 0) >= (best.request.createdAtMs ?? 0)) best = { request, line }
  }
  return best
}

/** 1.33.0: the newest returned (approved) request that names the booking. */
function newestReturned(requests: ReadonlyArray<OvertimeRequestRecord>, bookingId: string): { request: OvertimeRequestRecord; line: OvertimeRequestLine } | null {
  let best: { request: OvertimeRequestRecord; line: OvertimeRequestLine } | null = null
  for (const request of requests) {
    if (request.status !== 'approved') continue
    const line = request.lines.find((row) => idKey(row.bookingId) === idKey(bookingId))
    if (!line) continue
    const at = request.decidedAtMs ?? request.createdAtMs ?? 0
    if (!best || at >= (best.request.decidedAtMs ?? best.request.createdAtMs ?? 0)) best = { request, line }
  }
  return best
}

function hasId(list: ReadonlyArray<string> | null | undefined, id: string): boolean {
  return (list || []).some((row) => idKey(row) === idKey(id))
}

/** The parts of a fingerprint (`day|slot|start|finish|rate|break|status`) a deleted line is drawn from. */
function fingerprintParts(fingerprint: string): { dayKey: string; timeSlot: string; start: string; end: string } {
  const [day, slot, start, end] = text(fingerprint).split('|')
  return { dayKey: dayKeyOrEmpty(day), timeSlot: text(slot), start: clockOf(start), end: clockOf(end) }
}

function stateLabelFor(state: OvertimeLineState, deciderName: string | null): string {
  return OVERTIME_LINE_STATE_LABELS[state].replace('{name}', deciderName || 'your line manager')
}

/**
 * The overtime lines of one person in `range` (inclusive day keys): every booking on any of `personIds` (without case)
 * with overtime (`overtimeForBooking`), every booking cancelled by a 1.29–1.32 approved strike (state `cancelled`) and,
 * 1.33.0, every booking an approved red X deleted (state `deleted`, drawn from its review — the day, slot and times come
 * from the review's fingerprint and the job from the request line and `jobs`), each with its state (see the file
 * header). `names` maps a user id to the name shown in "Changed by {name}". Sorted by day, then start, then job number.
 */
export function payeOvertimeLines(input: {
  personIds: ReadonlyArray<string>
  bookings: ReadonlyArray<OvertimeBookingInput>
  organization: OvertimeOrganization
  timeZone?: string | null
  range: { start: string; end: string }
  reviews?: ReadonlyArray<OvertimeReviewRecord> | null
  requests?: ReadonlyArray<OvertimeRequestRecord> | null
  /** 1.33.0: user id → display name (the decider's name on returned lines). */
  names?: Record<string, string> | null
  /** 1.33.0: job id → number and name, for deleted lines (their booking is gone). */
  jobs?: ReadonlyArray<{ id: string; jobNumber?: string | null; jobName?: string | null }> | null
}): OvertimeLine[] {
  const ids = new Set((input.personIds || []).map(idKey).filter(Boolean))
  const start = text(input.range?.start)
  const end = text(input.range?.end)
  const reviews = input.reviews || []
  const requests = input.requests || []
  const names = new Map(Object.entries(input.names || {}).map(([id, name]) => [idKey(id), text(name)]))
  const nameOf = (id: string | null) => (id ? names.get(idKey(id)) || null : null)
  const out: OvertimeLine[] = []
  const seen = new Set<string>()
  const liveIds = new Set<string>()
  for (const booking of input.bookings || []) {
    if (!booking || !ids.has(idKey(booking.personId))) continue
    liveIds.add(idKey(booking.id))
    const day = text(booking.dayKey)
    if (!day || day < start || day > end) continue
    const bookingKey = `${collectionOf(booking)}/${idKey(booking.id)}`
    if (seen.has(bookingKey)) continue
    seen.add(bookingKey)
    const fingerprint = overtimeBookingFingerprint(booking)
    const review = reviews.find((row) => idKey(row.bookingId) === idKey(booking.id)) ?? null
    const pending = newestPending(requests, booking.id)
    const returned = newestReturned(requests, booking.id)
    let state: OvertimeLineState
    let figures: OvertimeFigures | null = null
    let decidedBy: string | null = null
    if (isCancelled(booking)) {
      if (!review || review.decision !== 'cancelled' || review.fingerprint !== fingerprint) continue
      state = 'cancelled'
    } else {
      figures = overtimeForBooking({ booking, organization: input.organization, timeZone: input.timeZone })
      if (!figures) continue
      const reviewMatches = Boolean(review && review.fingerprint === fingerprint && review.decision !== 'deleted')
      const reviewNewerThanReturn =
        review != null && returned != null && (review.reviewedAtMs ?? 0) > (returned.request.decidedAtMs ?? 0) && review.requestId !== returned.request.id
      if (pending) state = pending.line.fingerprint === fingerprint ? 'waiting' : 'changedSinceRequest'
      else if (reviewMatches && review) {
        if (!review.requestId) state = 'confirmed'
        else {
          state = review.decision === 'changed' ? 'returnedChanged' : review.decision === 'declined' ? 'returnedDeclined' : 'returnedApproved'
          decidedBy = review.reviewedBy
        }
      } else if (returned && hasId(returned.request.staleBookingIds, booking.id) && !reviewNewerThanReturn) state = 'changedSinceRequest'
      else if (review) state = 'reopened'
      else state = 'needsReview'
    }
    const jobNumber = text(booking.jobNumber)
    const jobName = text(booking.jobName)
    const deciderName = nameOf(decidedBy)
    out.push({
      bookingId: text(booking.id),
      collection: collectionOf(booking),
      dayKey: day,
      dayLabel: formatPaymentRunDay(day),
      jobId: text(booking.jobId) || null,
      jobNumber,
      jobName,
      title: [jobNumber, jobName].filter(Boolean).join(' · ') || 'Booking',
      start: clockOf(booking.workStartTime),
      end: clockOf(booking.workEndTime),
      timeSlot: text(booking.timeSlot),
      fingerprint,
      state,
      stateLabel: stateLabelFor(state, deciderName),
      figures,
      requestId: pending ? pending.request.id : null,
      requestLine: pending ? pending.line : null,
      review,
      decidedBy,
      deciderName,
      sentLine: pending ? pending.line : returned ? returned.line : null,
    })
  }
  // 1.33.0 (item f): a booking an approved red X deleted is still a line, struck through at 0h.
  const jobs = new Map((input.jobs || []).filter((row) => row && text(row.id)).map((row) => [idKey(row.id), row]))
  for (const review of reviews) {
    if (review.decision !== 'deleted' || liveIds.has(idKey(review.bookingId))) continue
    const key = `${review.collection}/${idKey(review.bookingId)}`
    if (seen.has(key)) continue
    const request = review.requestId ? requests.find((row) => idKey(row.id) === idKey(review.requestId)) ?? null : null
    const line = request ? request.lines.find((row) => idKey(row.bookingId) === idKey(review.bookingId)) ?? null : null
    const parts = fingerprintParts(review.fingerprint)
    const day = parts.dayKey || (line ? line.dayKey : '')
    if (!day || day < start || day > end) continue
    seen.add(key)
    const job = line?.jobId ? jobs.get(idKey(line.jobId)) : undefined
    const jobNumber = text(job?.jobNumber)
    const jobName = text(job?.jobName)
    const decidedBy = review.requestId ? review.reviewedBy : null
    const deciderName = nameOf(decidedBy)
    out.push({
      bookingId: review.bookingId,
      collection: review.collection,
      dayKey: day,
      dayLabel: formatPaymentRunDay(day),
      jobId: line?.jobId ?? null,
      jobNumber,
      jobName,
      title: [jobNumber, jobName].filter(Boolean).join(' · ') || 'Booking',
      start: parts.start,
      end: parts.end,
      timeSlot: parts.timeSlot,
      fingerprint: review.fingerprint,
      state: 'deleted',
      stateLabel: stateLabelFor('deleted', deciderName),
      figures: null,
      requestId: null,
      requestLine: null,
      review,
      decidedBy,
      deciderName,
      sentLine: line,
    })
  }
  return out.sort((a, b) =>
    a.dayKey !== b.dayKey ? (a.dayKey < b.dayKey ? -1 : 1) : a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.jobNumber.localeCompare(b.jobNumber)
  )
}

/** The overtime hours a line counts for: 0 when cancelled, deleted, or declined by the line manager (1.33.0). */
export function overtimeLineHours(line: Pick<OvertimeLine, 'figures' | 'state'>): number {
  if (line.state === 'cancelled' || line.state === 'deleted' || line.state === 'returnedDeclined') return 0
  return line.figures?.overtimeHours ?? 0
}

/** Total overtime hours of the lines (`overtimeLineHours`: cancelled, deleted and declined lines count 0). */
export function overtimeLinesTotal(lines: ReadonlyArray<Pick<OvertimeLine, 'figures' | 'state'>>): number {
  return round2(lines.reduce((sum, line) => sum + overtimeLineHours(line), 0))
}

// MARK: - The red X, the cog and the booking write

export type OvertimeStrikeOutcome =
  | { kind: 'none' }
  | { kind: 'trim'; start: string; end: string }
  | {
      kind: 'delete'
      warning: { title: string; summary: string; body: string; back: string; confirm: string; footnote: string }
    }
  | { kind: 'notAllowed'; message: string }

/**
 * What the red X ("I didn't work these overtime hours") does to a booking: a weekday booking partly outside the
 * working day is trimmed back inside it (06:30–14:00 on 07:30–16:00 → 07:30–14:00); a weekend set-window booking is
 * trimmed to the window; a booking with no hours inside the day (or window), or on a weekend paid at a multiplier
 * only, is **deleted** after `OVERTIME_DELETE_WARNING` (1.33.0 owner decision 4 Nov, item f; 1.29–1.32 cancelled it) —
 * with a line manager only when the Return approves it. A manager site booking is never deleted here (`notAllowed`).
 * `none` when there is nothing to trim.
 */
export function overtimeStrikeOutcome(input: {
  booking: OvertimeBookingInput
  organization: OvertimeOrganization
  timeZone?: string | null
}): OvertimeStrikeOutcome {
  const booking = input.booking
  const zone = zoneOrLondon(input.timeZone)
  const s = parseClockMinutes(clockOf(booking?.workStartTime))
  let e = parseClockMinutes(clockOf(booking?.workEndTime))
  if (!booking || s == null || e == null) return { kind: 'none' }
  if (e <= s) e += 24 * 60
  const policy = effectivePayrollTimePolicy(input.organization, booking.dayKey, zone)
  const window = payrollDayWindows(policy, booking.dayKey, zone).paidWindow
  const from = window ? Math.max(s, window.start) : 0
  const to = window ? Math.min(e, window.end) : 0
  if (!window || to <= from) {
    if (collectionOf(booking) === 'managerSiteBookings') return { kind: 'notAllowed', message: OVERTIME_CANCEL_NOT_ALLOWED_MESSAGE }
    const title = [text(booking.jobNumber), text(booking.jobName)].filter(Boolean).join(' ')
    const summary = [formatPaymentRunDay(booking.dayKey), title, `${formatClockMinutes(s)}–${formatClockMinutes(e % (24 * 60))}`]
      .filter(Boolean)
      .join(' · ')
    return { kind: 'delete', warning: { ...OVERTIME_DELETE_WARNING, summary } }
  }
  if (from === s && to === e) return { kind: 'none' }
  return { kind: 'trim', start: formatClockMinutes(from), end: formatClockMinutes(to) }
}

export type OvertimeBookingChange =
  | { kind: 'edit'; start: string; end: string; /** undefined: leave the rate; null: the organisation's. */ multiplier?: number | null }
  | { kind: 'trim'; start: string; end: string }

/** The booking as it will read after `change` (exactly `overtimeBookingWriteFields` applied). */
export function overtimeBookingAfter(booking: OvertimeBookingInput, change: OvertimeBookingChange): OvertimeBookingInput {
  const { set, remove } = overtimeBookingWriteFields(booking, change)
  const next: OvertimeBookingInput = { ...booking, ...(set as Partial<OvertimeBookingInput>) }
  for (const key of remove) delete (next as Record<string, unknown>)[key]
  return next
}

/**
 * The partial update of a booking for an overtime change → `{ set, remove }` (empty when nothing changes). Only
 * `workStartTime`, `workEndTime`, `timeSlot` (a Full day becomes `CUSTOM_HOURS` when its times change) and
 * `otMultiplierOverride` are ever written — fields the security rules let a line manager change (§16). 1.33.0: the red X
 * no longer writes `status` Cancelled; an all-overtime booking is deleted (`overtimeBookingDelete`). The app adds
 * write metadata.
 */
export function overtimeBookingWriteFields(booking: OvertimeBookingInput, change: OvertimeBookingChange): { set: Record<string, unknown>; remove: string[] } {
  const set: Record<string, unknown> = {}
  const remove: string[] = []
  const start = clockOf(change.start)
  const end = clockOf(change.end)
  if (start && start !== clockOf(booking.workStartTime)) set.workStartTime = start
  if (end && end !== clockOf(booking.workEndTime)) set.workEndTime = end
  if ((set.workStartTime || set.workEndTime || !clockOf(booking.workStartTime)) && !isCustomSlot(booking.timeSlot)) {
    set.timeSlot = 'CUSTOM_HOURS'
  }
  if (change.kind === 'edit' && change.multiplier !== undefined) {
    const stored = multiplierOf(booking.otMultiplierOverride)
    if (change.multiplier == null) {
      if (booking.otMultiplierOverride != null) remove.push('otMultiplierOverride')
    } else if (stored !== Number(change.multiplier)) {
      set.otMultiplierOverride = Number(change.multiplier)
    }
  }
  return { set, remove }
}

/** Null when a cog change is valid: start and finish on the clock, a valid rate (or null). */
export function overtimeEditValidationError(change: { start: unknown; end: unknown; multiplier?: unknown }): string | null {
  if (!clockOf(change.start) || !clockOf(change.end) || clockOf(change.start) === clockOf(change.end)) return OVERTIME_TIMES_MESSAGE
  return overtimeMultiplierValidationError(change.multiplier)
}

/**
 * The cog's live preview: the overtime before and after a change of start, finish and rate, and the struck-through
 * old figure beside the new one (`beforeText` / `afterText`, "2h × 1.5 = 3h" → "3h × 2 = 6h"; "No overtime" when none).
 */
export function overtimeCogPreview(input: {
  booking: OvertimeBookingInput
  organization: OvertimeOrganization
  timeZone?: string | null
  start: string
  end: string
  multiplier: number | null
}): { before: OvertimeFigures | null; after: OvertimeFigures | null; beforeText: string; afterText: string; changed: boolean; error: string | null } {
  const before = overtimeForBooking({ booking: input.booking, organization: input.organization, timeZone: input.timeZone, minMinutes: 0 })
  const error = overtimeEditValidationError(input)
  const nextBooking = error
    ? input.booking
    : overtimeBookingAfter(input.booking, { kind: 'edit', start: input.start, end: input.end, multiplier: input.multiplier })
  const after = overtimeForBooking({ booking: nextBooking, organization: input.organization, timeZone: input.timeZone, minMinutes: 0 })
  const beforeText = before ? before.text : 'No overtime'
  const afterText = after ? after.text : 'No overtime'
  return {
    before,
    after,
    beforeText,
    afterText,
    changed: !error && overtimeBookingFingerprint(nextBooking) !== overtimeBookingFingerprint(input.booking),
    error,
  }
}

/**
 * Edit Booking's "Overtime rate" control (§25): shown on a custom-hours booking that has overtime; "Organisation (×1.5)"
 * or "Custom ×__" (`OVERTIME_MULTIPLIER_STEPS`). Who may change it is `canWriteBooking`.
 */
export function overtimeRateControl(input: {
  booking: OvertimeBookingInput
  organization: OvertimeOrganization
  timeZone?: string | null
}): { show: boolean; organizationMultiplier: number; organizationLabel: string; customMultiplier: number | null; steps: number[] } {
  const zone = zoneOrLondon(input.timeZone)
  const day = text(input.booking?.dayKey)
  const organizationMultiplier = /^\d{4}-\d{2}-\d{2}$/.test(day) ? organizationOvertimeMultiplier(input.organization, day, zone) : 1.5
  const custom = isCustomSlot(input.booking?.timeSlot) && Boolean(clockOf(input.booking?.workStartTime)) && Boolean(clockOf(input.booking?.workEndTime))
  const figures = custom ? overtimeForBooking({ booking: input.booking, organization: input.organization, timeZone: zone, minMinutes: 0 }) : null
  return {
    show: Boolean(figures),
    organizationMultiplier,
    organizationLabel: `Organisation (×${organizationMultiplier})`,
    customMultiplier: multiplierOf(input.booking?.otMultiplierOverride),
    steps: [...OVERTIME_MULTIPLIER_STEPS],
  }
}

/** Edit Booking's write for the rate: `{ set: { otMultiplierOverride } }`, or `{ remove: ['otMultiplierOverride'] }` for the organisation rate. */
export function overtimeMultiplierWriteFields(stored: unknown, next: number | null): { set: Record<string, unknown>; remove: string[] } {
  if (next == null) return { set: {}, remove: stored != null ? ['otMultiplierOverride'] : [] }
  if (!overtimeMultiplierValid(next)) return { set: {}, remove: [] }
  return multiplierOf(stored) === Number(next) ? { set: {}, remove: [] } : { set: { otMultiplierOverride: Number(next) }, remove: [] }
}

// MARK: - Who

export type OvertimeEditMode = 'direct' | 'request' | 'none'

/**
 * How a PAYE person changes their own booking's overtime (cog, tick, X).
 *
 * 1.32.0 (owner decisions 4 Nov), when `person` is given: the Super Admin directly; anyone with an active line manager
 * (`hasActiveLineManager`) as a request to that line manager; anyone without one directly where the security rules let
 * them write the booking (an admin, or a manager `canWriteBooking` allows), otherwise as a request. Before 1.32.0 (no
 * `person`): a PAYE admin directly; a PAYE manager directly where `canWriteBooking` lets them edit the booking, else as a
 * request; a PAYE operative always as a request.
 *
 * `none` for a person who is not PAYE, no viewer, or a booking dated after `editableUntilKey` (1.32.0 option 2: the last
 * day of the current PAYE payrun, `overtimeEditableUntil`; before 1.32.0 `todayKey`). Future payruns stay locked.
 */
export function canEditOwnBookingOvertime(input: {
  viewer: JobAccessViewer | null | undefined
  isPaye: boolean
  booking: BookingPermissionInput & { dayKey?: string | null }
  job?: JobManagerFields | Record<string, unknown> | null
  managers?: ReadonlyArray<JobManagerRosterRow> | null
  todayKey?: string | null
  /** 1.32.0: the last day that may be changed (`overtimeEditableUntil`); wins over `todayKey`. */
  editableUntilKey?: string | null
  /** 1.32.0: the PAYE person themself (users document as the app holds it) and the roster, for the line-manager rule. */
  person?: (LeaveSelfBookUser & { id?: string | null }) | null
  roster?: ReadonlyArray<NotificationRosterMember> | null
}): OvertimeEditMode {
  const viewer = input.viewer
  if (!viewer || !input.isPaye) return 'none'
  const day = text(input.booking?.dayKey)
  const limit = text(input.editableUntilKey) || text(input.todayKey)
  if (limit && day && day > limit) return 'none'
  const role = viewer.role
  if (!role) return 'none'
  const rulesMayWrite =
    !role.isOperativeMode &&
    (role.isAdmin || role.isSuperAdmin || (role.isManager && canWriteBooking(viewer, input.booking, input.job ?? null, input.managers)))
  if (input.person !== undefined) {
    const person = input.person
    if (role.isSuperAdmin || isSuperAdminAccount(person)) return rulesMayWrite ? 'direct' : 'request'
    if (hasActiveLineManager(person as never, (input.roster || []) as never)) return 'request'
    return rulesMayWrite ? 'direct' : 'request'
  }
  if (!role.isOperativeMode && (role.isAdmin || role.isSuperAdmin)) return 'direct'
  if (role.isOperativeMode || !role.isManager) return 'request'
  return rulesMayWrite ? 'direct' : 'request'
}

/**
 * 1.32.0 (owner option 2): the last day a PAYE person may tick, cross or change: the last day of the PAYE payrun that
 * contains today (`payePayrunPeriod`), so future days of the current payrun are open and future payruns stay locked.
 * Today when no PAYE payday is set.
 */
export function overtimeEditableUntil(organization: OvertimeOrganization, todayKey: string): string {
  const today = text(todayKey)
  const current = payePayrunPeriod(organization, today)
  return current && current.end > today ? current.end : today
}

/**
 * 1.32.0, the one "all records for this person" rule (platform guardrail 1) for overtime loading, sending and approving
 * and for PAYE price work and expenses: every id the person goes by (`personIdSet` over the roster: own id, former
 * invite ids, same-email ids) plus every `operatives` row on their email (`bookingIdsForAccount`), never one row picked
 * by email. 1.33.0 (owner 6 Nov, superseding decision A): the person's line manager decides lines under every one of
 * these ids (`overtimeDeciderMayWriteBooking`); there is no "Needs an admin".
 */
export function overtimePersonIds(input: {
  person: { id?: string | null; email?: string | null } | null | undefined
  roster?: ReadonlyArray<NotificationRosterMember> | null
  operatives?: ReadonlyArray<{ id?: string | null; email?: string | null }> | null
}): string[] {
  const person = input.person
  if (!person || !idText(person.id)) return []
  const aliasIds = personIdSet(person as never, (input.roster || []) as never)
  const operatives = (input.operatives || [])
    .filter((row) => row && idText(row.id))
    .map((row) => ({ id: idText(row.id), email: typeof row.email === 'string' ? row.email : '' }))
  return bookingIdsForAccount({ id: idText(person.id), email: typeof person.email === 'string' ? person.email : null, aliasIds }, operatives as never)
}

type OvertimePerson = LeaveSelfBookUser & { id?: string | null; isActive?: boolean | null }

/**
 * Who may decide a person's overtime request: their active line managers and every active admin outside operative
 * mode — never the requester under any of their ids.
 */
export function canDecideOvertimeRequest(
  viewer: OvertimePerson | null | undefined,
  requester: OvertimePerson | null | undefined,
  roster?: ReadonlyArray<NotificationRosterMember> | null
): boolean {
  if (!viewer || !requester || !idText(viewer.id)) return false
  const members = (roster || []) as NotificationRosterMember[]
  const requesterIds = new Set(personIdSet(requester as never, members).map(idKey))
  const viewerIds = personIdSet(viewer as never, members).map(idKey)
  if (viewerIds.some((id) => requesterIds.has(id))) return false
  if (viewer.isActive === false) return false
  if (isAdminOutsideOperativeMode(viewer)) return true
  const managers = new Set(lineManagerIds(requester, members).map(idKey))
  return viewerIds.some((id) => managers.has(id))
}

/** The people whose overtime a viewer sees under Users': admins everyone active (not themself); a line manager their reports. */
export function overtimeUserSubjects(
  viewer: OvertimePerson | null | undefined,
  roster: ReadonlyArray<NotificationRosterMember & OvertimePerson> | null | undefined
): string[] {
  if (!viewer || !idText(viewer.id)) return []
  const members = (roster || []).filter((member) => member && idText(member.id))
  const self = new Set(personIdSet(viewer as never, members as never).map(idKey))
  const admin = isAdminOutsideOperativeMode(viewer)
  const out: string[] = []
  const seen = new Set<string>()
  for (const member of members) {
    const key = idKey(member.id)
    // 1.34.0: a ghost operative has no overtime, price work or expenses (no app login).
    if (self.has(key) || seen.has(key) || !rosterMemberActive(member) || isGhostUser(member)) continue
    const managed = lineManagerIds(member, members as never).some((id) => self.has(idKey(id)))
    if (!admin && !managed) continue
    seen.add(key)
    out.push(idText(member.id))
  }
  return out
}

/**
 * The Timesheets hub button "Overtime, Expenses & Price Work" (below My Timesheets, above User Timesheets): `mine` for a
 * PAYE person; `users` for an admin or anyone who line-manages at least one active person. Shown when either is true.
 */
export function overtimeHubAccess(input: {
  viewer: OvertimePerson | null | undefined
  roster?: ReadonlyArray<NotificationRosterMember & OvertimePerson> | null
}): { showButton: boolean; mine: boolean; users: boolean } {
  const viewer = input.viewer
  if (!viewer || viewer.isActive === false) return { showButton: false, mine: false, users: false }
  const mine = text(viewer.employmentType).toLowerCase() === 'paye'
  const users = isAdminOutsideOperativeMode(viewer) || overtimeUserSubjects(viewer, input.roster).length > 0
  return { showButton: mine || users, mine, users }
}

// MARK: - Requests

/** One request line for a booking and the person's proposal (keep, a cog edit, or the red X). */
export function overtimeRequestLineFields(input: {
  booking: OvertimeBookingInput
  organization: OvertimeOrganization
  timeZone?: string | null
  proposal: { action: 'keep' } | { action: 'strike' } | { action: 'edit'; start: string; end: string; multiplier: number | null }
  /** Every id the requester goes by; a booking on anyone else is never a line (null). */
  personIds?: ReadonlyArray<string> | null
}): OvertimeRequestLine | null {
  const booking = input.booking
  if (!booking || !text(booking.id)) return null
  if (input.personIds && !overtimeBookingIsTheirs(booking, input.personIds)) return null
  const before = overtimeForBooking({ booking, organization: input.organization, timeZone: input.timeZone, minMinutes: 0 })
  const base: OvertimeRequestLine = {
    bookingId: text(booking.id),
    collection: collectionOf(booking),
    dayKey: text(booking.dayKey),
    jobId: text(booking.jobId) || null,
    fingerprint: overtimeBookingFingerprint(booking),
    action: 'keep',
    proposedStart: null,
    proposedEnd: null,
    proposedMultiplier: null,
    cancel: false,
    overtimeHoursBefore: before?.overtimeHours ?? 0,
    overtimeHoursAfter: before?.overtimeHours ?? 0,
  }
  const proposal = input.proposal
  if (proposal.action === 'keep') return base
  let change: OvertimeBookingChange | null = null
  if (proposal.action === 'edit') {
    if (overtimeEditValidationError(proposal)) return null
    change = { kind: 'edit', start: proposal.start, end: proposal.end, multiplier: proposal.multiplier }
    base.action = 'edit'
    base.proposedStart = clockOf(proposal.start)
    base.proposedEnd = clockOf(proposal.end)
    base.proposedMultiplier = multiplierOf(proposal.multiplier)
  } else {
    const outcome = overtimeStrikeOutcome({ booking, organization: input.organization, timeZone: input.timeZone })
    if (outcome.kind === 'notAllowed' || outcome.kind === 'none') return outcome.kind === 'none' ? base : null
    base.action = 'strike'
    if (outcome.kind === 'delete') {
      // 1.33.0 (item f): asks for the booking to be deleted; nothing changes until the Return approves it.
      base.cancel = true
      base.overtimeHoursAfter = 0
      return base
    }
    base.proposedStart = outcome.start
    base.proposedEnd = outcome.end
    change = { kind: 'trim', start: outcome.start, end: outcome.end }
  }
  const after = overtimeForBooking({ booking: overtimeBookingAfter(booking, change), organization: input.organization, timeZone: input.timeZone, minMinutes: 0 })
  base.overtimeHoursAfter = after?.overtimeHours ?? 0
  return base
}

/**
 * A new `overtimeRequests/{id}` (the person, online only): `{ userId, rangeStart, rangeEnd, status: 'pending', lines }`;
 * the app adds `createdAt` (server time) and write metadata. Null with no lines or a bad range. Sending again replaces
 * the person's pending request for the same range: withdraw `overtimeRequestsToReplace` in the same batch.
 */
export function overtimeRequestWriteFields(input: {
  userId: string
  rangeStart: string
  rangeEnd: string
  lines: ReadonlyArray<OvertimeRequestLine>
  /**
   * The requester's ids and their bookings: when given, a line is kept only when its booking is one of `bookings` and
   * on one of `personIds` (a request can never name someone else's booking).
   */
  personIds?: ReadonlyArray<string> | null
  bookings?: ReadonlyArray<OvertimeBookingInput> | null
}): Record<string, unknown> | null {
  const userId = text(input.userId)
  const start = dayKeyOrEmpty(input.rangeStart)
  const end = dayKeyOrEmpty(input.rangeEnd)
  if (!userId || !start || !end || start > end || !input.lines) return null
  const ids = input.personIds ?? [userId]
  const byId = input.bookings ? new Map(input.bookings.map((row) => [`${collectionOf(row)}/${idKey(row.id)}`, row])) : null
  const lines = input.lines.filter((line) => {
    if (!byId) return true
    const booking = byId.get(`${line.collection}/${idKey(line.bookingId)}`)
    return Boolean(booking && overtimeBookingIsTheirs(booking, ids))
  })
  if (lines.length === 0) return null
  return {
    userId,
    rangeStart: start,
    rangeEnd: end,
    status: 'pending',
    lines: lines.map((line) => ({ ...line })),
  }
}

/** The booking is on one of the person's ids (without case). */
export function overtimeBookingIsTheirs(booking: Pick<OvertimeBookingInput, 'personId'> | null | undefined, personIds: ReadonlyArray<string>): boolean {
  if (!booking) return false
  const ids = new Set((personIds || []).map(idKey).filter(Boolean))
  return ids.has(idKey(booking.personId))
}

/**
 * Whether a decider (already allowed by `canDecideOvertimeRequest`) may apply a line to this booking. 1.33.0 (owner
 * 6 Nov, item b, superseding 4 Nov decision A "Needs an admin"): yes for every booking on any id the requester goes by
 * (`requesterIds` = `overtimePersonIds`: their users id, former and same-email ids, and `operatives` rows on their
 * email) — a line manager can always decide their report's lines; also an admin, or a `canWriteBooking` writer
 * (`writableBookingIds`). Without `requesterIds` only `requesterUserId` counts (the 1.32 behaviour).
 */
export function overtimeDeciderMayWriteBooking(input: {
  booking: Pick<OvertimeBookingInput, 'id' | 'personId'>
  requesterUserId: string
  requesterIds?: ReadonlyArray<string> | null
  deciderIsAdmin?: boolean | null
  writableBookingIds?: ReadonlyArray<string> | null
}): boolean {
  if (input.deciderIsAdmin === true) return true
  if ((input.writableBookingIds || []).some((id) => idKey(id) === idKey(input.booking.id))) return true
  if (text(input.booking.personId) === '') return false
  const ids = input.requesterIds && input.requesterIds.length > 0 ? input.requesterIds : [input.requesterUserId]
  return overtimeBookingIsTheirs(input.booking, ids)
}

/** The person's pending requests for exactly this range (withdrawn when they send again). */
export function overtimeRequestsToReplace(
  requests: ReadonlyArray<OvertimeRequestRecord>,
  userId: string,
  rangeStart: string,
  rangeEnd: string
): string[] {
  return requests
    .filter((row) => row.status === 'pending' && idKey(row.userId) === idKey(userId) && row.rangeStart === rangeStart && row.rangeEnd === rangeEnd)
    .map((row) => row.id)
}

/** The owner withdrawing their pending request: `{ status: 'withdrawn' }` (the app adds `withdrawnAt`). */
export function overtimeRequestWithdrawWriteFields(request: Pick<OvertimeRequestRecord, 'status'>): Record<string, unknown> | null {
  return request.status === 'pending' ? { status: 'withdrawn' } : null
}

function storedDecision(decision: OvertimeDecision): Record<string, unknown> {
  return decision.action === 'edit'
    ? { action: 'edit', start: clockOf(decision.start), end: clockOf(decision.end), multiplier: decision.multiplier ?? null }
    : { action: decision.action }
}

export type OvertimeBookingWrite = { collection: OvertimeBookingCollection; bookingId: string; set: Record<string, unknown>; remove: string[] }
export type OvertimeReviewWrite = { docId: string; fields: Record<string, unknown> }
/**
 * 1.33.0 (item f): a booking delete and its tombstone (`bookingTombstoneWriteFields`, with `overtimeRequestId` when a
 * Return deletes it), written in the same transaction. The app adds the tombstone's `deletedAt` (server time).
 */
export type OvertimeBookingDelete = {
  collection: 'bookings'
  bookingId: string
  tombstone: BookingTombstoneWriteFields
}

/** 1.33.0: the delete of an all-overtime booking an approved red X removes. Null for a manager site booking or bad ids. */
export function overtimeBookingDelete(input: {
  booking: Pick<OvertimeBookingInput, 'id' | 'collection'>
  deletedBy: string
  platform: string
  overtimeRequestId?: string | null
}): OvertimeBookingDelete | null {
  if (collectionOf(input.booking) !== 'bookings') return null
  const tombstone = bookingTombstoneWriteFields({
    bookingId: input.booking.id,
    collection: 'bookings',
    deletedBy: input.deletedBy,
    deletedFrom: input.platform,
    overtimeRequestId: input.overtimeRequestId ?? null,
  })
  return tombstone ? { collection: 'bookings', bookingId: tombstone.bookingId, tombstone } : null
}

/**
 * 1.33.0: a write-only booking field that `overtimeReturnWrites` sets on every booking change of a Return — the id of
 * the overtime request being returned. The security rules accept a line manager's overtime-field change of a booking
 * filed under one of the person's other ids (`formerUserIds` / `sameEmailUserIds` on the person's users document) only
 * when this field names a request they decided in the same transaction that lists the booking in `appliedBookingIds`
 * (rulebook §16, §25). No reader uses it; it is never removed.
 */
export const OVERTIME_RETURN_REQUEST_ID_FIELD = 'overtimeReturnRequestId'

/** 1.33.0: what happened to one line of a Return (`overtimeReturnWrites` → `lineOutcomes`). */
export type OvertimeLineOutcome =
  | 'applied'
  | 'declined'
  | 'removed'
  | 'alreadyApplied'
  | 'stale'
  | 'refused'
  | 'deleted'
  | 'unreadable'
  | 'foreign'

/** The per-line label of an outcome that leaves a line out of a Return or sends it back; null when it was returned. */
export function overtimeLineOutcomeLabel(outcome: OvertimeLineOutcome | string | null | undefined): string | null {
  switch (outcome) {
    case 'stale':
      return OVERTIME_CHANGED_SINCE_REQUEST_LINE_MESSAGE
    case 'refused':
      return OVERTIME_CANCEL_NOT_ALLOWED_MESSAGE
    case 'unreadable':
      return OVERTIME_BOOKING_UNREADABLE_MESSAGE
    case 'foreign':
      return OVERTIME_NOT_THEIR_BOOKING_MESSAGE
    case 'deleted':
      return 'This booking was deleted — it is left out.'
    default:
      return null
  }
}

/**
 * 1.33.0: the message after a Return: "Returned 5 lines." then why any line was left out or sent back — "2 changed
 * since they sent it — they need to send those again." No "need an admin" and no "not decided yet" (Return needs every
 * line decided and a line manager decides every line).
 */
export function overtimeReturnMessage(input: {
  returned: number
  counts?: Partial<Record<'stale' | 'refused' | 'deleted' | 'unreadable' | 'foreign', number>> | null
}): string {
  const counts = input.counts || {}
  const phrase = (n: number | undefined, one: string, many: string) => (n && n > 0 ? `${n} ${n === 1 ? one : many}` : '')
  const parts = [`Returned ${input.returned} ${input.returned === 1 ? 'line' : 'lines'}.`]
  if (counts.stale && counts.stale > 0) {
    parts.push(`${counts.stale} changed since they sent it — they need to send ${counts.stale === 1 ? 'it' : 'those'} again.`)
  }
  const left = [
    phrase(counts.refused, 'could not be removed', 'could not be removed'),
    phrase(counts.deleted, 'deleted booking left out', 'deleted bookings left out'),
    phrase(counts.unreadable, "booking you can't read left out", "bookings you can't read left out"),
    phrase(counts.foreign, 'booking not theirs left out', 'bookings not theirs left out'),
  ].filter(Boolean)
  if (left.length > 0) parts.push(`${left.join('; ')}.`)
  return parts.join(' ')
}

/**
 * 1.33.0: Return gating (owner 6 Nov): green only when every line of the request that is still waiting has a decision
 * (tick, cross, or cog + tick). Lines applied by a 1.32 partial approval are done; `skipBookingIds` (bookings the
 * decider cannot read, or no longer there) are left out and do not block. Replaces `overtimeRequestAnyDecided`.
 */
export function overtimeReturnReady(input: {
  request: Pick<OvertimeRequestRecord, 'lines' | 'status' | 'appliedBookingIds' | 'droppedBookingIds'>
  decisions: Record<string, OvertimeDecision | null | undefined>
  skipBookingIds?: ReadonlyArray<string> | null
}): { ready: boolean; undecidedCount: number; message: string | null } {
  const request = input.request
  if (request.status !== 'pending') return { ready: false, undecidedCount: 0, message: OVERTIME_REQUEST_NOT_PENDING_MESSAGE }
  const done = new Set([...(request.appliedBookingIds || []), ...(request.droppedBookingIds || []), ...(input.skipBookingIds || [])].map(idKey))
  const keyed = new Map(Object.entries(input.decisions || {}).map(([key, value]) => [idKey(key), value]))
  const open = request.lines.filter((line) => !done.has(idKey(line.bookingId)))
  const undecidedCount = open.filter((line) => !keyed.get(idKey(line.bookingId))).length
  const ready = undecidedCount === 0 && request.lines.length > 0
  return { ready, undecidedCount, message: ready ? null : OVERTIME_REQUEST_UNDECIDED_MESSAGE }
}

/**
 * Return overtime (line manager or admin, online, one transaction that re-reads the request and every booking).
 * 1.33.0 (owner decisions 6 Nov) — the only action that writes the bookings and the reviews; every waiting line must
 * be decided (`overtimeReturnReady`, else `ok: false`, `undecided`). Per line:
 *   - **✓** applies the person's line: keep (no booking write, review `approved`), their cog (review `edited`), their
 *     red X — a trim (review `trimmed`) or, on an all-overtime day, the booking **deleted** with a tombstone carrying
 *     `overtimeRequestId` (`bookingDeletes`, review `deleted`, the id in `deletedBookingIds`);
 *   - **✕** means "I don't agree with this line at all" (Q-A2): the booking is left as it was, review `declined`;
 *   - **⚙ + ✓** applies the decider's own start, finish and rate (review `changed`).
 * Skip-and-name (Q-A1): a line whose booking changed since it was sent is not applied and goes back to the person
 * (`staleBookingIds`, outcome `stale`); a booking deleted meanwhile, unreadable to the decider, or not the
 * requester's is left out and named (`droppedBookingIds`). A line applied by a 1.32 partial approval is skipped
 * (`alreadyApplied`). Every booking on any of `requesterIds` may be decided (`overtimeDeciderMayWriteBooking`, item b).
 * The request becomes `approved` with `decisions`, `decidedBy`, `appliedBookingIds`, `droppedBookingIds`,
 * `staleBookingIds` and `deletedBookingIds`. The app adds `decidedAt` / `reviewedAt` / the tombstone's `deletedAt`
 * (server time) and write metadata.
 */
export function overtimeReturnWrites(input: {
  request: OvertimeRequestRecord
  decisions: Record<string, OvertimeDecision>
  bookings: Record<string, OvertimeBookingInput | null | undefined>
  organization: OvertimeOrganization
  timeZone?: string | null
  deciderId: string
  /** Every id the requester goes by (`overtimePersonIds`); default `[request.userId]`. */
  requesterIds?: ReadonlyArray<string> | null
  /** Bookings the decider could not read: left out, nothing written for them. */
  unreadableBookingIds?: ReadonlyArray<string> | null
  /** `web` / `ios` / `android`, for the tombstone's `deletedFrom`. Default `web`. */
  platform?: string | null
}):
  | {
      ok: true
      bookingWrites: OvertimeBookingWrite[]
      bookingDeletes: OvertimeBookingDelete[]
      reviewWrites: OvertimeReviewWrite[]
      /** Lines returned by this Return (✓, ✕ and ⚙ alike). */
      appliedBookingIds: string[]
      declinedBookingIds: string[]
      staleBookingIds: string[]
      /** Bookings deleted by this Return (an approved red X on an all-overtime day). */
      deletedBookingIds: string[]
      /** Deleted meanwhile, unreadable, refused or not the requester's: left out (`droppedBookingIds`). */
      droppedBookingIds: string[]
      unreadableBookingIds: string[]
      foreignBookingIds: string[]
      lineOutcomes: Record<string, OvertimeLineOutcome>
      requestFields: Record<string, unknown>
      message: string
    }
  | { ok: false; reason: 'notPending' | 'undecided'; bookingIds: string[]; lineOutcomes: Record<string, OvertimeLineOutcome>; message: string } {
  const request = input.request
  if (request.status !== 'pending') {
    return { ok: false, reason: 'notPending', bookingIds: [], lineOutcomes: {}, message: OVERTIME_REQUEST_NOT_PENDING_MESSAGE }
  }
  const decisions = new Map(Object.entries(input.decisions || {}).map(([key, value]) => [idKey(key), value]))
  const live = new Map(Object.entries(input.bookings || {}).map(([key, value]) => [idKey(key), value]))
  const unreadable = new Set((input.unreadableBookingIds || []).map(idKey))
  const previouslyApplied = new Set((request.appliedBookingIds || []).map(idKey))
  const previouslyDropped = new Set((request.droppedBookingIds || []).map(idKey))
  const requesterIds = input.requesterIds && input.requesterIds.length > 0 ? input.requesterIds : [request.userId]
  const platform = text(input.platform) || 'web'
  const deciderId = text(input.deciderId)
  const outcomes: Record<string, OvertimeLineOutcome> = {}
  const bookingWrites: OvertimeBookingWrite[] = []
  const bookingDeletes: OvertimeBookingDelete[] = []
  const reviewWrites: OvertimeReviewWrite[] = []
  const applied: string[] = []
  const declined: string[] = []
  const stale: string[] = []
  const removed: string[] = []
  const deleted: string[] = []
  const unreadableIds: string[] = []
  const foreign: string[] = []
  const refused: string[] = []
  const undecided: string[] = []
  const storedDecisions: Record<string, Record<string, unknown>> = {}
  for (const [bookingId, decision] of Object.entries(request.decisions || {})) storedDecisions[bookingId] = storedDecision(decision)
  const review = (line: OvertimeRequestLine, decision: OvertimeReviewDecision, fingerprint: string): OvertimeReviewWrite => ({
    docId: overtimeReviewDocId(request.userId, line.bookingId),
    fields: {
      userId: request.userId,
      bookingId: line.bookingId,
      collection: line.collection,
      decision,
      fingerprint,
      reviewedBy: deciderId,
      requestId: request.id,
    },
  })
  for (const line of request.lines) {
    const key = idKey(line.bookingId)
    if (previouslyApplied.has(key) || previouslyDropped.has(key)) {
      outcomes[line.bookingId] = 'alreadyApplied'
      continue
    }
    if (unreadable.has(key)) {
      unreadableIds.push(line.bookingId)
      outcomes[line.bookingId] = 'unreadable'
      continue
    }
    const booking = live.get(key)
    if (!booking) {
      deleted.push(line.bookingId)
      outcomes[line.bookingId] = 'deleted'
      continue
    }
    // A request can only ever change the requester's own bookings (any id they go by — item b).
    if (
      !overtimeBookingIsTheirs(booking, requesterIds) ||
      !overtimeDeciderMayWriteBooking({ booking, requesterUserId: request.userId, requesterIds })
    ) {
      foreign.push(line.bookingId)
      outcomes[line.bookingId] = 'foreign'
      continue
    }
    const decision = decisions.get(key) as OvertimeDecision | undefined
    if (!decision) {
      undecided.push(line.bookingId)
      continue
    }
    if (overtimeBookingFingerprint(booking) !== line.fingerprint) {
      stale.push(line.bookingId)
      outcomes[line.bookingId] = 'stale'
      continue
    }
    if (decision.action === 'strike') {
      // ✕: the decider does not agree with the line — the booking stays as it was.
      reviewWrites.push(review(line, 'declined', overtimeBookingFingerprint(booking)))
      storedDecisions[line.bookingId] = storedDecision(decision)
      declined.push(line.bookingId)
      applied.push(line.bookingId)
      outcomes[line.bookingId] = 'declined'
      continue
    }
    let change: OvertimeBookingChange | null = null
    let reviewDecision: OvertimeReviewDecision = 'approved'
    if (decision.action === 'edit') {
      if (overtimeEditValidationError(decision)) {
        undecided.push(line.bookingId)
        continue
      }
      change = { kind: 'edit', start: decision.start, end: decision.end, multiplier: decision.multiplier }
      reviewDecision = 'changed'
    } else if (line.action === 'edit' && line.proposedStart && line.proposedEnd) {
      change = { kind: 'edit', start: line.proposedStart, end: line.proposedEnd, multiplier: line.proposedMultiplier }
      reviewDecision = 'edited'
    } else if (line.action === 'strike') {
      const outcome = overtimeStrikeOutcome({ booking, organization: input.organization, timeZone: input.timeZone })
      if (outcome.kind === 'delete') {
        const del = overtimeBookingDelete({ booking, deletedBy: deciderId, platform, overtimeRequestId: request.id })
        if (!del) {
          refused.push(line.bookingId)
          outcomes[line.bookingId] = 'refused'
          continue
        }
        bookingDeletes.push(del)
        reviewWrites.push(review(line, 'deleted', overtimeBookingFingerprint(booking)))
        storedDecisions[line.bookingId] = storedDecision(decision)
        removed.push(line.bookingId)
        applied.push(line.bookingId)
        outcomes[line.bookingId] = 'removed'
        continue
      }
      if (outcome.kind === 'notAllowed') {
        refused.push(line.bookingId)
        outcomes[line.bookingId] = 'refused'
        continue
      }
      if (outcome.kind === 'trim') {
        change = { kind: 'trim', start: outcome.start, end: outcome.end }
        reviewDecision = 'trimmed'
      }
    }
    let next = booking
    if (change) {
      const fields = overtimeBookingWriteFields(booking, change)
      if (Object.keys(fields.set).length > 0 || fields.remove.length > 0) {
        // The request id rides on the write (`OVERTIME_RETURN_REQUEST_ID_FIELD`) so the security rules can let the
        // requester's line manager change a booking filed under any id the person goes by (an old invite id, a
        // same-email account): they read the request after the transaction and check the booking is the person's.
        bookingWrites.push({
          collection: line.collection,
          bookingId: line.bookingId,
          set: { ...fields.set, [OVERTIME_RETURN_REQUEST_ID_FIELD]: request.id },
          remove: fields.remove,
        })
        next = overtimeBookingAfter(booking, change)
      }
    }
    reviewWrites.push(review(line, reviewDecision, overtimeBookingFingerprint(next)))
    storedDecisions[line.bookingId] = storedDecision(decision)
    applied.push(line.bookingId)
    outcomes[line.bookingId] = 'applied'
  }
  if (undecided.length > 0) {
    return { ok: false, reason: 'undecided', bookingIds: undecided, lineOutcomes: outcomes, message: OVERTIME_REQUEST_UNDECIDED_MESSAGE }
  }
  const newlyDropped = [...deleted, ...unreadableIds, ...foreign, ...refused]
  const message = overtimeReturnMessage({
    returned: applied.length,
    counts: { stale: stale.length, refused: refused.length, deleted: deleted.length, unreadable: unreadableIds.length, foreign: foreign.length },
  })
  return {
    ok: true,
    bookingWrites,
    bookingDeletes,
    reviewWrites,
    appliedBookingIds: applied,
    declinedBookingIds: declined,
    staleBookingIds: stale,
    deletedBookingIds: removed,
    droppedBookingIds: newlyDropped,
    unreadableBookingIds: unreadableIds,
    foreignBookingIds: foreign,
    lineOutcomes: outcomes,
    message,
    requestFields: {
      status: 'approved',
      decisions: storedDecisions,
      decidedBy: deciderId,
      appliedBookingIds: [...(request.appliedBookingIds || []), ...applied],
      droppedBookingIds: [...(request.droppedBookingIds || []), ...newlyDropped],
      staleBookingIds: stale,
      deletedBookingIds: removed,
    },
  }
}

/**
 * A direct change by a PAYE person with no line manager (or the Super Admin) who may write the booking
 * (`canEditOwnBookingOvertime` = direct): tick (as it is), X (strike) or cog (edit) → the booking write (null for a
 * tick), 1.33.0 the booking delete with its tombstone for an X on an all-overtime day (`bookingDelete`, review
 * `deleted`), and the review with the booking's new fingerprint; `hoursChanged` is true when the booking changes (then
 * `booking_hours_changed_by_owner` goes to `bookingHoursChangedRecipients`). Null when the X is not allowed (manager
 * site booking with nothing inside).
 */
export function overtimeDirectWrites(input: {
  booking: OvertimeBookingInput
  action: OvertimeDecision
  userId: string
  reviewerId: string
  organization: OvertimeOrganization
  timeZone?: string | null
  /** `web` / `ios` / `android`, for a delete's tombstone. Default `web`. */
  platform?: string | null
}): { bookingWrite: OvertimeBookingWrite | null; bookingDelete: OvertimeBookingDelete | null; reviewWrite: OvertimeReviewWrite; hoursChanged: boolean } | null {
  const booking = input.booking
  let change: OvertimeBookingChange | null = null
  let decision: OvertimeReviewDecision = 'approved'
  const reviewWrite = (reviewDecision: OvertimeReviewDecision, fingerprint: string): OvertimeReviewWrite => ({
    docId: overtimeReviewDocId(input.userId, booking.id),
    fields: {
      userId: text(input.userId),
      bookingId: text(booking.id),
      collection: collectionOf(booking),
      decision: reviewDecision,
      fingerprint,
      reviewedBy: text(input.reviewerId),
      requestId: null,
    },
  })
  if (input.action.action === 'edit') {
    if (overtimeEditValidationError(input.action)) return null
    change = { kind: 'edit', start: input.action.start, end: input.action.end, multiplier: input.action.multiplier }
    decision = 'edited'
  } else if (input.action.action === 'strike') {
    const outcome = overtimeStrikeOutcome({ booking, organization: input.organization, timeZone: input.timeZone })
    if (outcome.kind === 'notAllowed') return null
    if (outcome.kind === 'trim') {
      change = { kind: 'trim', start: outcome.start, end: outcome.end }
      decision = 'trimmed'
    }
    if (outcome.kind === 'delete') {
      const del = overtimeBookingDelete({ booking, deletedBy: input.reviewerId, platform: text(input.platform) || 'web' })
      if (!del) return null
      return { bookingWrite: null, bookingDelete: del, reviewWrite: reviewWrite('deleted', overtimeBookingFingerprint(booking)), hoursChanged: true }
    }
  }
  const fields = change ? overtimeBookingWriteFields(booking, change) : { set: {}, remove: [] as string[] }
  const changed = Object.keys(fields.set).length > 0 || fields.remove.length > 0
  const next = change && changed ? overtimeBookingAfter(booking, change) : booking
  return {
    bookingWrite: changed ? { collection: collectionOf(booking), bookingId: text(booking.id), ...fields } : null,
    bookingDelete: null,
    reviewWrite: reviewWrite(changed ? decision : 'approved', overtimeBookingFingerprint(next)),
    hoursChanged: changed,
  }
}

// MARK: - Notification recipients (§13)

/** `overtime_request_submitted`: the requester's active line managers and every active admin, never the requester. */
export function overtimeRequestRecipients(requester: NotificationPerson, roster: ReadonlyArray<NotificationRosterMember> | null | undefined): string[] {
  const members = (roster || []).filter((member) => member && idText(member.id))
  const person =
    typeof requester === 'string'
      ? members.find((member) => idKey(member.id) === idKey(requester)) ?? { id: requester }
      : requester
  if (!person || !idText((person as { id?: string }).id)) return []
  const managers = lineManagerIds(person as LeaveSelfBookUser, members)
  const admins = members
    .filter((member) => rosterMemberActive(member) && isAdminOutsideOperativeMode(member as LeaveSelfBookUser))
    .map((member) => idText(member.id))
  return excludeActor([...managers, ...admins], person, members)
}

/** `overtime_request_reviewed`: the requester, unless they decided. 1.33.0 name: `overtimeReturnedRecipients`. */
export function overtimeReviewedRecipients(
  requester: NotificationPerson,
  decider: NotificationPerson,
  roster: ReadonlyArray<NotificationRosterMember> | null | undefined
): string[] {
  const id = typeof requester === 'string' ? idText(requester) : idText(requester?.id)
  return id ? excludeActor([id], decider, roster) : []
}

/** 1.33.0: who hears that a request was returned (`overtime_request_reviewed`): the requester, unless they decided. */
export const overtimeReturnedRecipients = overtimeReviewedRecipients

/**
 * 1.33.0 (owner 6 Nov): the `overtime_request_reviewed` notice after a Return. The person's line manager: "Your line
 * manager {name} has returned your overtime request"; anyone else (an admin deciding): "{name} has returned your
 * overtime request". `deciderIsLineManager` comes from `lineManagerIds(requester, roster)`.
 */
export function overtimeReturnedMessage(input: { deciderName: string | null | undefined; deciderIsLineManager: boolean }): {
  title: string
  message: string
} {
  const name = text(input.deciderName) || (input.deciderIsLineManager ? 'Your line manager' : 'An admin')
  return {
    title: 'Overtime returned',
    message: input.deciderIsLineManager
      ? text(input.deciderName)
        ? `Your line manager ${name} has returned your overtime request`
        : 'Your line manager has returned your overtime request'
      : `${name} has returned your overtime request`,
  }
}

/** 1.33.0: whether `decider` is one of the requester's line managers (any id they go by). */
export function overtimeDeciderIsLineManager(
  decider: NotificationPerson,
  requester: (LeaveSelfBookUser & { id?: string | null }) | null | undefined,
  roster: ReadonlyArray<NotificationRosterMember> | null | undefined
): boolean {
  if (!requester) return false
  const members = (roster || []).filter((member) => member && idText(member.id))
  const deciderRow =
    typeof decider === 'string' ? members.find((member) => idKey(member.id) === idKey(decider)) ?? { id: decider } : decider
  if (!deciderRow || !idText((deciderRow as { id?: string }).id)) return false
  const deciderIds = new Set(personIdSet(deciderRow as never, members as never).map(idKey))
  return lineManagerIds(requester, members).some((id) => deciderIds.has(idKey(id)))
}

/** 1.33.0: the `overtime_request_submitted` notice to the line managers and admins (`overtimeRequestRecipients`). */
export function overtimeRequestSubmittedMessage(input: { requesterName: string | null | undefined; rangeStart: string; rangeEnd: string }): {
  title: string
  message: string
} {
  const name = text(input.requesterName) || 'Someone'
  return {
    title: `Overtime request from ${name}`,
    message: `${name} sent their overtime for ${formatPaymentRunDay(input.rangeStart)} – ${formatPaymentRunDay(input.rangeEnd)} for approval.`,
  }
}

/**
 * 1.33.0 (owner 6 Nov, reopen): whether a booking change (by a manager or an admin, in any editor) reopens an overtime
 * line — the booking's fingerprint changed (or it was deleted) and the line had been sent (a pending request names its
 * old fingerprint), confirmed or returned (a review with its old fingerprint). `returned` is true when a Return had
 * decided it (then the person's line manager is told too). When the editor cannot read the person's requests and
 * reviews (`reviews` / `requests` null), any change to a booking that had or now has overtime counts as reopened and
 * `returned` is false. The line then shows `reopened` / `changedSinceRequest` (`payeOvertimeLines`) and a saved report
 * of its range reads out of date (`overtimeReportOutOfDate`).
 */
export function overtimeLineReopened(input: {
  before: OvertimeBookingInput | null | undefined
  after: OvertimeBookingInput | null | undefined
  organization: OvertimeOrganization
  timeZone?: string | null
  reviews?: ReadonlyArray<OvertimeReviewRecord> | null
  requests?: ReadonlyArray<OvertimeRequestRecord> | null
}): { reopened: boolean; returned: boolean } {
  const before = input.before
  if (!before || !text(before.id)) return { reopened: false, returned: false }
  const oldPrint = overtimeBookingFingerprint(before)
  if (input.after && overtimeBookingFingerprint(input.after) === oldPrint) return { reopened: false, returned: false }
  if (input.reviews == null || input.requests == null) {
    const had =
      overtimeForBooking({ booking: before, organization: input.organization, timeZone: input.timeZone }) != null ||
      (input.after ? overtimeForBooking({ booking: input.after, organization: input.organization, timeZone: input.timeZone }) != null : false)
    return { reopened: had, returned: false }
  }
  const review = input.reviews.find((row) => idKey(row.bookingId) === idKey(before.id) && row.fingerprint === oldPrint) ?? null
  const pending = newestPending(input.requests, before.id)
  const sent = pending != null && pending.line.fingerprint === oldPrint
  const returned = Boolean(review && review.requestId && review.decision !== 'deleted')
  return { reopened: sent || Boolean(review), returned }
}

/**
 * 1.33.0: who hears that a line reopened: the booked person (any id they go by → their account, PAYE only), plus their
 * active line managers when the line had been returned — never the person who changed the booking.
 */
export function overtimeReopenedRecipients(input: {
  bookedId: string
  actor: NotificationPerson
  roster: ReadonlyArray<NotificationRosterMember> | null | undefined
  operatives?: ReadonlyArray<{ id?: string | null; email?: string | null }> | null
  returned: boolean
}): string[] {
  const members = (input.roster || []).filter((member) => member && idText(member.id))
  const catalogue = (input.operatives || []).filter((row) => row && idText(row.id)).map((row) => ({ id: idText(row.id), email: row.email ?? null }))
  const account = notificationRecipientAccountId(input.bookedId, members, catalogue as never)
  if (!account) return []
  const person = members.find((member) => idKey(member.id) === idKey(account))
  if (!person || text(person.employmentType).toLowerCase() !== 'paye') return []
  const managers = input.returned ? lineManagerIds(person as LeaveSelfBookUser, members) : []
  return excludeActor([account, ...managers], input.actor, members)
}

/** 1.33.0: the reopen notice (sent as `overtime_request_reviewed`, which opens the person's Overtime for that day). */
export function overtimeReopenedMessage(input: { dayKey: string; jobNumber?: string | null; forLineManager?: boolean; personName?: string | null }): {
  title: string
  message: string
} {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(text(input.dayKey)) ? formatPaymentRunDay(text(input.dayKey)) : 'a day'
  const job = text(input.jobNumber) ? ` (${text(input.jobNumber)})` : ''
  if (input.forLineManager) {
    const who = text(input.personName) || 'Someone'
    return { title: 'Overtime line reopened', message: `${who}'s booking on ${day}${job} changed after you returned their overtime. They need to check it and send it again.` }
  }
  return { title: 'Overtime line reopened', message: `Your booking on ${day}${job} changed. Check that overtime line and send it again.` }
}

/**
 * 1.33.0: where an overtime notice opens (both apps): the current PAYE payrun when the request's range (or the day)
 * is in it — `{ range: 'current' }` — else that past payrun (`{ range: 'past', start, end }`), else the request's own
 * range (`{ range: 'custom', start, end }`). Null when nothing usable is given.
 */
export function overtimeNotificationRange(input: {
  organization: OvertimeOrganization
  todayKey: string
  rangeStart?: string | null
  rangeEnd?: string | null
  dayKey?: string | null
}): { range: 'current' | 'past' | 'custom'; start: string; end: string } | null {
  const rangeStart = dayKeyOrEmpty(input.rangeStart)
  const rangeEnd = dayKeyOrEmpty(input.rangeEnd)
  const day = rangeStart || dayKeyOrEmpty(input.dayKey)
  if (!day) return null
  const current = payePayrunPeriod(input.organization, text(input.todayKey))
  const containing = payePayrunPeriod(input.organization, day)
  const fits = (period: { start: string; end: string } | null) =>
    Boolean(period && day >= period.start && day <= period.end && (!rangeEnd || rangeEnd <= period.end))
  if (current && fits(current)) return { range: 'current', start: current.start, end: current.end }
  if (containing && fits(containing)) return { range: 'past', start: containing.start, end: containing.end }
  if (rangeStart && rangeEnd && rangeStart <= rangeEnd) return { range: 'custom', start: rangeStart, end: rangeEnd }
  if (containing) return { range: 'past', start: containing.start, end: containing.end }
  return { range: 'custom', start: day, end: day }
}

/**
 * `booking_hours_changed_by_owner` (inbox only): when a PAYE manager or admin changes their own booking directly — the
 * job's managers and the person's line managers, never the person.
 */
export function bookingHoursChangedRecipients(
  owner: NotificationPerson,
  jobManagerIds: ReadonlyArray<string> | null | undefined,
  roster: ReadonlyArray<NotificationRosterMember> | null | undefined
): string[] {
  const members = (roster || []).filter((member) => member && idText(member.id))
  const person =
    typeof owner === 'string' ? members.find((member) => idKey(member.id) === idKey(owner)) ?? { id: owner } : owner
  if (!person || !idText((person as { id?: string }).id)) return []
  const managers = lineManagerIds(person as LeaveSelfBookUser, members)
  return excludeActor([...(jobManagerIds || []), ...managers], person, members)
}

// MARK: - Reports

export type OvertimeReportLine = {
  bookingId: string
  dayKey: string
  dayLabel: string
  jobNumber: string
  jobName: string
  start: string
  end: string
  clockHours: number
  multiplier: number
  breakHours: number
  overtimeHours: number
  text: string
  /** 1.33.0: the booking's fingerprint when the report was generated ('' on older reports) — `overtimeReportOutOfDate`. */
  fingerprint?: string
  /** 1.33.0: the line's state then (`returnedDeclined` / `deleted` lines are listed at 0h). */
  state?: string
  /** 1.33.0: "Declined by {name}" or "Booking removed — not worked" ('' otherwise). */
  note?: string
  /** 1.33.0: the line manager declined it (✕); listed at 0h. */
  declined?: boolean
  /** 1.33.0: who declined it ('' otherwise). */
  declinedByName?: string
}

export type OvertimeReportSnapshot = {
  userId: string
  userName: string
  companyName: string
  rangeStart: string
  rangeEnd: string
  kind: 'overtime'
  lines: OvertimeReportLine[]
  totals: { overtimeHours: number; clockHours: number; lineCount: number }
  generatedBy: string
}

/**
 * The saved copy of an overtime report (`overtimeReports/{id}`, created once by the person, never changed): who,
 * the range, one line per day and job with the final figures (hours only) and the totals. Cancelled (1.29–1.32) lines
 * are left out. 1.33.0 (owner 6 Nov): a line the line manager declined is listed at 0h, "Declined by {name}", and a
 * booking an approved red X deleted at 0h, "Booking removed — not worked"; each line keeps the booking's fingerprint
 * and state so a later change marks the report out of date (`overtimeReportOutOfDate`). The app adds `generatedAt`
 * (server time). The PDF is rebuilt from this copy (`overtimeReportRows`).
 */
export function overtimeReportSnapshot(input: {
  userId: string
  userName: string
  companyName?: string | null
  rangeStart: string
  rangeEnd: string
  lines: ReadonlyArray<OvertimeLine>
  generatedBy: string
}): OvertimeReportSnapshot {
  const lines: OvertimeReportLine[] = input.lines
    .filter((line) => line.state !== 'cancelled' && (line.figures || line.state === 'deleted'))
    .map((line) => {
      const zero = line.state === 'deleted' || line.state === 'returnedDeclined'
      const note =
        line.state === 'returnedDeclined'
          ? `Declined by ${line.deciderName || 'your line manager'}`
          : line.state === 'deleted'
            ? OVERTIME_LINE_STATE_LABELS.deleted
            : ''
      return {
        bookingId: line.bookingId,
        dayKey: line.dayKey,
        dayLabel: line.dayLabel,
        jobNumber: line.jobNumber,
        jobName: line.jobName,
        start: line.start,
        end: line.end,
        clockHours: zero ? 0 : line.figures!.clockHours,
        multiplier: line.figures?.multiplier ?? 1,
        breakHours: zero ? 0 : line.figures!.breakHours,
        overtimeHours: zero ? 0 : line.figures!.overtimeHours,
        text: zero ? `${note} · 0h` : line.figures!.text,
        fingerprint: line.fingerprint,
        state: line.state,
        note,
        declined: line.state === 'returnedDeclined',
        declinedByName: line.state === 'returnedDeclined' ? line.deciderName || '' : '',
      }
    })
  return {
    userId: text(input.userId),
    userName: text(input.userName),
    companyName: text(input.companyName),
    rangeStart: text(input.rangeStart),
    rangeEnd: text(input.rangeEnd),
    kind: 'overtime',
    lines,
    totals: {
      overtimeHours: round2(lines.reduce((sum, line) => sum + line.overtimeHours, 0)),
      clockHours: round2(lines.reduce((sum, line) => sum + line.clockHours, 0)),
      lineCount: lines.length,
    },
    generatedBy: text(input.generatedBy),
  }
}

/**
 * 1.33.0 (owner 6 Nov): a saved report is **out of date** when the lines of its range no longer match it — a line it
 * lists changed (its booking's fingerprint, or on reports before 1.33.0 its hours), a line was added or removed, or a
 * line is no longer finished (reopened, waiting, changed since sent). The report stays as a record, marked
 * `OVERTIME_REPORT_OUT_OF_DATE_LABEL`, and Generate turns green again for a replacement (`overtimeGenerateReady`).
 * `lines` are `payeOvertimeLines` for exactly the report's range.
 */
export function overtimeReportOutOfDate(input: {
  report: Pick<OvertimeReportSnapshot, 'lines'> & { outOfDate?: boolean | null; outOfDateAtMs?: number | null }
  lines: ReadonlyArray<OvertimeLine>
}): boolean {
  if (input.report.outOfDate === true || input.report.outOfDateAtMs != null) return true
  const live = input.lines.filter((line) => line.state !== 'cancelled')
  if (live.some((line) => !OVERTIME_DONE_LINE_STATES.includes(line.state))) return true
  const current = new Map(
    overtimeReportSnapshot({ userId: '', userName: '', rangeStart: '', rangeEnd: '', lines: live, generatedBy: '' }).lines.map((line) => [
      idKey(line.bookingId),
      line,
    ])
  )
  const saved = input.report.lines || []
  if (saved.length !== current.size) return true
  for (const line of saved) {
    const now = current.get(idKey(line.bookingId))
    if (!now) return true
    if (text(line.fingerprint) && text(line.fingerprint) !== text(now.fingerprint)) return true
    if (round2(line.overtimeHours) !== round2(now.overtimeHours)) return true
  }
  return false
}

/** Reads `overtimeReports/{id}` back into a snapshot (plus `id` and `generatedAtMs`). Never throws. */
export function parseOvertimeReportDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): OvertimeReportSnapshot & { id: string; generatedAtMs: number | null; outOfDate: boolean; outOfDateAtMs: number | null } {
  const row = data && typeof data === 'object' ? data : {}
  const lines = (Array.isArray(row.lines) ? row.lines : []).map((raw) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const dayKey = dayKeyOrEmpty(r.dayKey)
    return {
      bookingId: text(r.bookingId),
      dayKey,
      dayLabel: text(r.dayLabel) || (dayKey ? formatPaymentRunDay(dayKey) : ''),
      jobNumber: text(r.jobNumber),
      jobName: text(r.jobName),
      start: clockOf(r.start),
      end: clockOf(r.end),
      clockHours: round2(Number(r.clockHours) || 0),
      multiplier: Number(r.multiplier) > 0 ? Number(r.multiplier) : 1,
      breakHours: round2(Number(r.breakHours) || 0),
      overtimeHours: round2(Number(r.overtimeHours) || 0),
      text: text(r.text),
      fingerprint: text(r.fingerprint),
      state: text(r.state),
      note: text(r.note),
      declined: r.declined === true,
      declinedByName: text(r.declinedByName),
    }
  })
  const totals = (row.totals && typeof row.totals === 'object' ? row.totals : {}) as Record<string, unknown>
  return {
    id: text(docId),
    userId: text(row.userId),
    userName: text(row.userName),
    companyName: text(row.companyName),
    rangeStart: dayKeyOrEmpty(row.rangeStart),
    rangeEnd: dayKeyOrEmpty(row.rangeEnd),
    kind: 'overtime',
    lines,
    totals: {
      overtimeHours: round2(Number(totals.overtimeHours) || lines.reduce((sum, line) => sum + line.overtimeHours, 0)),
      clockHours: round2(Number(totals.clockHours) || lines.reduce((sum, line) => sum + line.clockHours, 0)),
      lineCount: Number(totals.lineCount) || lines.length,
    },
    generatedBy: text(row.generatedBy),
    generatedAtMs: instantMs(row.generatedAt),
    // 1.33.0: a stored out-of-date mark, if one is ever written (today the apps work it out: `overtimeReportOutOfDate`).
    outOfDate: row.outOfDate === true || instantMs(row.outOfDateAt ?? row.outOfDateAtMs) != null,
    outOfDateAtMs: instantMs(row.outOfDateAt ?? row.outOfDateAtMs),
  }
}

/**
 * The overtime report PDF's content, from the saved copy (1.33.0, owner 6 Nov: laid out like the invoice / timesheet
 * report). Kept for older readers: `title`, `subtitle`, `rows` (one text row per line, "Tue 4 Nov · J-1042 Riverside
 * Flats · 06:30–14:00 · 1h × 1.5 = 1.5h") and `total`. 1.33.0 adds the header (`documentTitle`, `companyName`,
 * `personName`, `period`, `generatedAt` / `generatedBy` / `generated` in the organisation zone, `reportGeneratedText`),
 * the table (`columns` and `table`: day, job, start–finish, overtime per line), `totalLabel` / `totalValue`,
 * `emptyMessage`, `footer` and the out-of-date mark. A line the line manager declined (1.33.0 Return, still ✕ at
 * Generate) is listed at 0h with "Declined by {name}". Field names match iOS `OvertimeReportPDFLayout`.
 */
export function overtimeReportRows(
  snapshot: Pick<OvertimeReportSnapshot, 'userName' | 'companyName' | 'rangeStart' | 'rangeEnd' | 'lines' | 'totals'> & OvertimeReportRowsExtras,
  options?: OvertimeReportRowsOptions | null
): OvertimeReportRowsResult {
  const table: OvertimeReportTableRow[] = snapshot.lines.map((raw) => {
    const line = raw as OvertimeReportLine & OvertimeReportLineExtras
    const declinedBy = overtimeReportLineDeclinedBy(line)
    const declined = declinedBy != null
    return {
      bookingId: text(line.bookingId),
      day: text(line.dayLabel) || (line.dayKey ? formatPaymentRunDay(line.dayKey) : ''),
      job: [text(line.jobNumber), text(line.jobName)].filter(Boolean).join(' '),
      time: line.start && line.end ? `${line.start}–${line.end}` : '',
      overtime: declined ? hoursText(0) : text(line.text),
      note: declined ? (declinedBy ? `${OVERTIME_REPORT_DECLINED_PREFIX} ${declinedBy}` : OVERTIME_REPORT_DECLINED_PREFIX.replace(/ by$/, '')) : '',
      declined,
    }
  })
  const rows = table.map((row) => [row.day, row.job, row.time, row.overtime, row.note].filter(Boolean).join(' · '))
  const totalValue = hoursText(snapshot.totals.overtimeHours)
  const period = `${formatPaymentRunDay(snapshot.rangeStart)} – ${formatPaymentRunDay(snapshot.rangeEnd)}`
  const generated = reportGeneratedText({
    generatedAtMs: snapshot.generatedAtMs,
    nowMs: options?.nowMs,
    timeZone: options?.timeZone,
    generatedBy: snapshot.generatedBy,
    userId: snapshot.userId,
    userName: snapshot.userName,
    generatedByName: options?.generatedByName,
  })
  const outOfDate = overtimeReportIsOutOfDate(snapshot)
  return {
    title: `${OVERTIME_REPORT_TITLE} · ${text(snapshot.userName)}`,
    subtitle: period,
    rows,
    total: `${OVERTIME_REPORT_TOTAL_LABEL}: ${totalValue}`,
    documentTitle: OVERTIME_REPORT_TITLE,
    companyName: text(snapshot.companyName),
    personName: text(snapshot.userName),
    period,
    ...generated,
    columns: [...OVERTIME_REPORT_COLUMNS],
    table,
    totalLabel: OVERTIME_REPORT_TOTAL_LABEL,
    totalValue,
    emptyMessage: OVERTIME_NO_LINES_MESSAGE,
    footer: [text(snapshot.companyName), OVERTIME_REPORT_TITLE, text(snapshot.userName)].filter(Boolean).join(' · '),
    outOfDate,
    outOfDateNote: outOfDate ? OVERTIME_REPORT_OUT_OF_DATE_NOTE : '',
  }
}

// 1.33.0 report helpers (kept beside `overtimeReportRows`).

export const OVERTIME_REPORT_TITLE = 'Overtime report'
export const OVERTIME_REPORT_COLUMNS: ReadonlyArray<string> = ['Day', 'Job', 'Start–Finish', 'Overtime']
export const OVERTIME_REPORT_DECLINED_PREFIX = 'Declined by'
export const OVERTIME_REPORT_OUT_OF_DATE_NOTE =
  'Out of date: a booking changed after this report was generated. Generate a replacement report.'

/** Optional saved-copy fields the 1.33.0 overtime flow adds (read when present; older copies have none). */
export type OvertimeReportRowsExtras = {
  userId?: string | null
  generatedBy?: string | null
  generatedAtMs?: number | null
  /** 1.33.0 (owner 6 Nov): the report was superseded because a line reopened after it was generated. */
  outOfDate?: boolean | null
  outOfDateAtMs?: number | null
}

/** Optional saved-line fields for a line still declined (red ✕) at Generate. */
export type OvertimeReportLineExtras = {
  declined?: boolean | null
  declinedByName?: string | null
}

export type OvertimeReportRowsOptions = {
  /** Organisation zone for the generated time. London when missing. */
  timeZone?: string | null
  /** The generator's name when the app can resolve `generatedBy` from the roster. */
  generatedByName?: string | null
  /** The time to show while the saved `generatedAt` is not back yet. */
  nowMs?: number | null
}

export type OvertimeReportTableRow = {
  bookingId: string
  /** "Wed 4 Nov". */
  day: string
  /** "J-1042 Riverside Flats". */
  job: string
  /** "06:30–14:00", or "" when the saved line has no times. */
  time: string
  /** "1h × 1.5 = 1.5h"; "0h" on a declined line. */
  overtime: string
  /** "Declined by Lee Manager" on a declined line, else "". */
  note: string
  declined: boolean
}

export type OvertimeReportRowsResult = {
  title: string
  subtitle: string
  rows: string[]
  total: string
  documentTitle: string
  companyName: string
  personName: string
  period: string
  generatedAt: string
  generatedBy: string
  generated: string
  columns: string[]
  table: OvertimeReportTableRow[]
  totalLabel: string
  totalValue: string
  emptyMessage: string
  footer: string
  outOfDate: boolean
  outOfDateNote: string
}

/** The decider's name when a saved line was declined ("" when declined without a stored name); null when not declined. */
export function overtimeReportLineDeclinedBy(line: OvertimeReportLineExtras | null | undefined): string | null {
  if (!line) return null
  const name = text(line.declinedByName)
  if (name) return name
  return line.declined === true ? '' : null
}

/** 1.33.0: whether a saved overtime report is marked out of date (`outOfDate` or `outOfDateAtMs` on the copy). */
export function overtimeReportIsOutOfDate(snapshot: OvertimeReportRowsExtras | null | undefined): boolean {
  if (!snapshot) return false
  if (snapshot.outOfDate === true) return true
  return snapshot.outOfDateAtMs != null && Number.isFinite(Number(snapshot.outOfDateAtMs)) && Number(snapshot.outOfDateAtMs) > 0
}

// MARK: - Weekly report

export type WeeklyReportPayePerson = EmploymentTypeUser & {
  id: string
  name: string
  /** Every id the person goes by (`personIdSet`); defaults to `[id]`. */
  ids?: ReadonlyArray<string> | null
}

/** True when the person is PAYE on `dayKey` (effective-dated `employmentTypeOnDay`): their day leaves the normal hours and pay rows. */
export function weeklyReportPayeDay(person: EmploymentTypeUser | null | undefined, dayKey: string, timeZone?: string | null): boolean {
  if (!person || !/^\d{4}-\d{2}-\d{2}$/.test(text(dayKey))) return false
  const zone = zoneOrLondon(timeZone)
  return employmentTypeOnDay(person, dateFromDayKeyInZone(dayKey, zone), zone) === 'paye'
}

/** 1.32.0: the weekly report's mark on a row whose multiplier was changed from the organisation rate. */
export const OVERTIME_RATE_CHANGED_MARK = 'changed from organisation rate'

/** 1.32.0: "2h at ×1.5 = 3h" (with an unpaid break: "2h at ×1.5 − 0.5h break = 2.5h"). */
export function overtimeMultiplierText(input: { clockHours: number; multiplier: number; breakHours?: number | null; overtimeHours: number }): string {
  const brk = round2(Number(input.breakHours) || 0)
  return `${hoursText(input.clockHours)} at ×${round2(input.multiplier)}${brk > 0 ? ` − ${hoursText(brk)} break` : ''} = ${hoursText(input.overtimeHours)}`
}

export type WeeklyReportPayeOvertimeRow = {
  personId: string
  name: string
  jobId: string | null
  jobNumber: string
  jobName: string
  /** Clock hours at the multiplier. */
  clockHours: number
  breakHours: number
  /** 1.32.0: the multiplier these lines were priced at. */
  multiplier: number
  /** The organisation's rate on those days. */
  organizationMultiplier: number
  /** 1.32.0: true when the bookings carry their own rate (`otMultiplierOverride`) different from the organisation's. */
  changedFromOrganization: boolean
  overtimeHours: number
  /** "2h at ×1.5 = 3h". */
  multiplierText: string
  /** "Sam · J-1042 · 2h at ×1.5 = 3h", plus " · changed from organisation rate (×1.5)" on an edited row. */
  label: string
}

/**
 * The weekly report's PAYE overtime section, always live from the bookings: the same lines as the Overtime screen,
 * whatever their review state, grouped per PAYE person, job and multiplier. 1.32.0 (owner decision 4 Nov): each row
 * shows its multiplier ("2h at ×1.5 = 3h") and a row whose bookings carry their own rate different from the
 * organisation's is marked (`changedFromOrganization`, `OVERTIME_RATE_CHANGED_MARK`) — under owner decision A only rows
 * someone changed store a rate. Sorted by name, job number, then multiplier.
 */
export function weeklyReportPayeOvertime(input: {
  people: ReadonlyArray<WeeklyReportPayePerson>
  bookings: ReadonlyArray<OvertimeBookingInput>
  organization: OvertimeOrganization
  timeZone?: string | null
  range: { start: string; end: string }
}): WeeklyReportPayeOvertimeRow[] {
  const zone = zoneOrLondon(input.timeZone)
  type Acc = Omit<WeeklyReportPayeOvertimeRow, 'multiplierText' | 'label'>
  const rows = new Map<string, Acc>()
  for (const person of input.people || []) {
    const ids = (person.ids && person.ids.length > 0 ? person.ids : [person.id]).map(String)
    const lines = payeOvertimeLines({ personIds: ids, bookings: input.bookings, organization: input.organization, timeZone: zone, range: input.range })
    for (const line of lines) {
      if (line.state === 'cancelled' || !line.figures || !weeklyReportPayeDay(person, line.dayKey, zone)) continue
      const figures = line.figures
      const changed = figures.customMultiplier != null && Math.abs(figures.customMultiplier - figures.organizationMultiplier) > 1e-9
      const key = `${idKey(person.id)}|${idKey(line.jobId ?? line.jobNumber)}|${figures.multiplier}|${changed ? 'c' : 'o'}|${figures.organizationMultiplier}`
      const row = rows.get(key) ?? {
        personId: idText(person.id),
        name: text(person.name),
        jobId: line.jobId,
        jobNumber: line.jobNumber,
        jobName: line.jobName,
        clockHours: 0,
        breakHours: 0,
        multiplier: figures.multiplier,
        organizationMultiplier: figures.organizationMultiplier,
        changedFromOrganization: changed,
        overtimeHours: 0,
      }
      row.clockHours = round2(row.clockHours + figures.clockHours)
      row.breakHours = round2(row.breakHours + figures.breakHours)
      row.overtimeHours = round2(row.overtimeHours + figures.overtimeHours)
      rows.set(key, row)
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.jobNumber.localeCompare(b.jobNumber) || a.multiplier - b.multiplier)
    .map((row) => {
      const multiplierText = overtimeMultiplierText(row)
      const mark = row.changedFromOrganization ? ` · ${OVERTIME_RATE_CHANGED_MARK} (×${row.organizationMultiplier})` : ''
      return { ...row, multiplierText, label: `${[row.name, row.jobNumber, multiplierText].filter(Boolean).join(' · ')}${mark}` }
    })
}

/**
 * 1.32.0 (owner decision A): the rate control on every custom-hours create screen, pre-filled with the organisation's
 * rate for that day (`organizationOvertimeMultiplier`). `options` are the 1–3 steps with the organisation's marked.
 */
export function overtimeRateCreateControl(input: { organization: OvertimeOrganization; dayKey: string; timeZone?: string | null }): {
  organizationMultiplier: number
  prefill: number
  options: Array<{ value: number; label: string; organization: boolean }>
} {
  const zone = zoneOrLondon(input.timeZone)
  const day = text(input.dayKey)
  const organizationMultiplier = /^\d{4}-\d{2}-\d{2}$/.test(day) ? organizationOvertimeMultiplier(input.organization, day, zone) : 1.5
  const steps = [...OVERTIME_MULTIPLIER_STEPS]
  if (!steps.some((step) => Math.abs(step - organizationMultiplier) < 1e-9)) steps.push(organizationMultiplier)
  steps.sort((a, b) => a - b)
  return {
    organizationMultiplier,
    prefill: organizationMultiplier,
    options: steps.map((value) => {
      const organization = Math.abs(value - organizationMultiplier) < 1e-9
      return { value, label: organization ? `×${value} (organisation rate)` : `×${value}`, organization }
    }),
  }
}

/**
 * 1.32.0 (review fix r274 S4): the booking's own rate when a booking is changed or **moved** (the Daily Overview booking
 * sheet: hours, another job, Office / WFH / Site survey — including a move to the other collection, which writes a new
 * document). `chosen` is the rate on screen (null = the organisation's; undefined = not shown, keep the stored rate).
 * A rate equal to the organisation's is never stored (decision A). `newDocument` true → `{ otMultiplierOverride }` only
 * when there is a rate to carry; false (an update of the same document) → only when it differs from the stored one,
 * `null` meaning remove it.
 */
export function overtimeMultiplierMoveFields(input: {
  stored: number | null | undefined
  chosen?: number | null
  organizationMultiplier: number
  newDocument: boolean
}): { otMultiplierOverride?: number | null } {
  const norm = (value: number | null | undefined): number | null => {
    if (value == null || !overtimeMultiplierValid(value)) return null
    return Math.abs(Number(value) - Number(input.organizationMultiplier)) < 1e-9 ? null : Number(value)
  }
  const stored = input.stored == null || !overtimeMultiplierValid(input.stored) ? null : Number(input.stored)
  const effective = input.chosen === undefined ? norm(stored) : norm(input.chosen)
  if (input.newDocument) return effective == null ? {} : { otMultiplierOverride: effective }
  return effective === stored ? {} : { otMultiplierOverride: effective }
}

/**
 * 1.32.0 (owner decision A): the multiplier field of a new booking. `otMultiplierOverride` is stored only when the
 * person changed the pre-filled organisation rate (`chosen` differs from `organizationMultiplier`); left at the
 * organisation's rate, nothing is stored, so the booking follows later rate changes, scheduled ones included. A chosen
 * value outside 1–3 in 0.25 steps stores nothing.
 */
export function overtimeMultiplierCreateFields(input: { chosen: number | null | undefined; organizationMultiplier: number }): { otMultiplierOverride?: number } {
  const chosen = input.chosen == null ? null : Number(input.chosen)
  if (chosen == null || !overtimeMultiplierValid(chosen)) return {}
  if (Math.abs(chosen - Number(input.organizationMultiplier)) < 1e-9) return {}
  return { otMultiplierOverride: chosen }
}

/** Normalised booking slot for overtime inputs (re-exported for callers mapping stored bookings). */
export function overtimeBookingSlot(raw: unknown): string {
  return normalizeBookingTimeSlot(raw) ?? text(raw)
}

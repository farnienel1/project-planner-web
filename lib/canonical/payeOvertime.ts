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
 * A line's state comes from the person's overtime request and review documents:
 *   - `waiting` — a pending request names the booking and the booking still matches its fingerprint;
 *   - `changedSinceRequest` — a pending request names it but the booking changed since (it cannot be approved);
 *   - `approved` — a review whose fingerprint is the booking's current fingerprint;
 *   - `cancelled` — the booking was cancelled by an approved strike (shown struck through);
 *   - `needsReview` — anything else (a booking changed after a decision goes back here).
 * The fingerprint (`overtimeBookingFingerprint`) is the day, slot, start, finish, overtime rate, break toggle and
 * status, so an old request can never overwrite a newer booking.
 */

import { formatClockMinutes, parseClockMinutes } from './engine'
import { normalizeBookingStatus, normalizeBookingTimeSlot } from './bookings'
import { isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import { isAdminOutsideOperativeMode, lineManagerIds, type LeaveSelfBookUser } from './leaveRequests'
import { excludeActor, type NotificationPerson, type NotificationRosterMember } from './notificationRecipients'
import { formatPaymentRunDay } from './paymentRuns'
import { payrollDayWindows, payrollHoursResult, payrollMultipliedHours, payrollOutsideMultiplier } from './payrollHours'
import { effectivePayrollTimePolicy } from './payrollPolicySchedule'
import { idKey, idText, personIdSet, rosterMemberActive } from './personIds'
import { canWriteBooking, type BookingPermissionInput, type JobAccessViewer, type JobManagerFields, type JobManagerRosterRow } from './staffAccess'
import { employmentTypeOnDay, type EmploymentTypeUser } from './userProfile'
import { dateFromDayKeyInZone } from '../orgTime/zoneTime'

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
export const OVERTIME_SEND_FOR_APPROVAL_LABEL = 'Send for approval'
export const OVERTIME_GENERATE_REPORT_LABEL = 'Generate overtime report'
export const OVERTIME_APPROVE_REQUEST_LABEL = 'Approve Overtime Request'
export const OVERTIME_REQUEST_STALE_MESSAGE =
  'A booking changed after this request was sent, so it cannot be approved. Ask for the request to be sent again.'
export const OVERTIME_REQUEST_UNDECIDED_MESSAGE = 'Tick, cross or change every line before approving the request.'
export const OVERTIME_REQUEST_NOT_PENDING_MESSAGE = 'This request is no longer waiting for approval.'
export const OVERTIME_NO_LINES_MESSAGE = 'There is no overtime in this range.'
export const OVERTIME_CANCEL_NOT_ALLOWED_MESSAGE =
  'All of this booking is outside the working day. Change its hours with the cog, or ask a scheduler to remove it.'
export const OVERTIME_REPORT_TOTAL_LABEL = 'Total overtime'

/** The red X cancel warning, the same on every platform. */
export const OVERTIME_CANCEL_WARNING = {
  title: 'Remove this booking?',
  body: 'This will remove this booking entirely. Your organisation pays a set multiplier for this day. If you still worked this day, use the cog to set the hours you worked and agreed.',
  back: 'Go back',
  confirm: 'Remove booking',
  footnote: 'A manager can restore it if this was a mistake.',
} as const

export const OVERTIME_LINE_STATES = ['needsReview', 'waiting', 'approved', 'changedSinceRequest', 'cancelled'] as const
export type OvertimeLineState = (typeof OVERTIME_LINE_STATES)[number]
export const OVERTIME_LINE_STATE_LABELS: Readonly<Record<OvertimeLineState, string>> = {
  needsReview: 'Needs review',
  waiting: 'Waiting for line manager',
  approved: 'Approved',
  changedSinceRequest: 'Booking changed since request',
  cancelled: 'Booking cancelled',
}

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
  /** True when the proposal cancels the booking (a strike of a booking with no hours inside the day). */
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
}

export type OvertimeReviewDecision = 'approved' | 'edited' | 'trimmed' | 'cancelled'

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
    decision: decision === 'edited' || decision === 'trimmed' || decision === 'cancelled' ? decision : 'approved',
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
  stateLabel: string
  /** Null for a cancelled line. */
  figures: OvertimeFigures | null
  /** The pending request naming this booking, if any. */
  requestId: string | null
  requestLine: OvertimeRequestLine | null
  review: OvertimeReviewRecord | null
}

function newestPending(requests: ReadonlyArray<OvertimeRequestRecord>, bookingId: string): { request: OvertimeRequestRecord; line: OvertimeRequestLine } | null {
  let best: { request: OvertimeRequestRecord; line: OvertimeRequestLine } | null = null
  for (const request of requests) {
    if (request.status !== 'pending') continue
    const line = request.lines.find((row) => idKey(row.bookingId) === idKey(bookingId))
    if (!line) continue
    if (!best || (request.createdAtMs ?? 0) >= (best.request.createdAtMs ?? 0)) best = { request, line }
  }
  return best
}

/**
 * The overtime lines of one person in `range` (inclusive day keys): every booking on any of `personIds` (without case)
 * with overtime (`overtimeForBooking`), and every booking cancelled by an approved strike (state `cancelled`), each
 * with its state. Sorted by day, then start, then job number.
 */
export function payeOvertimeLines(input: {
  personIds: ReadonlyArray<string>
  bookings: ReadonlyArray<OvertimeBookingInput>
  organization: OvertimeOrganization
  timeZone?: string | null
  range: { start: string; end: string }
  reviews?: ReadonlyArray<OvertimeReviewRecord> | null
  requests?: ReadonlyArray<OvertimeRequestRecord> | null
}): OvertimeLine[] {
  const ids = new Set((input.personIds || []).map(idKey).filter(Boolean))
  const start = text(input.range?.start)
  const end = text(input.range?.end)
  const reviews = input.reviews || []
  const requests = input.requests || []
  const out: OvertimeLine[] = []
  const seen = new Set<string>()
  for (const booking of input.bookings || []) {
    if (!booking || !ids.has(idKey(booking.personId))) continue
    const day = text(booking.dayKey)
    if (!day || day < start || day > end) continue
    const bookingKey = `${collectionOf(booking)}/${idKey(booking.id)}`
    if (seen.has(bookingKey)) continue
    seen.add(bookingKey)
    const fingerprint = overtimeBookingFingerprint(booking)
    const review = reviews.find((row) => idKey(row.bookingId) === idKey(booking.id)) ?? null
    const pending = newestPending(requests, booking.id)
    let state: OvertimeLineState
    let figures: OvertimeFigures | null = null
    if (isCancelled(booking)) {
      if (!review || review.decision !== 'cancelled' || review.fingerprint !== fingerprint) continue
      state = 'cancelled'
    } else {
      figures = overtimeForBooking({ booking, organization: input.organization, timeZone: input.timeZone })
      if (!figures) continue
      if (pending) state = pending.line.fingerprint === fingerprint ? 'waiting' : 'changedSinceRequest'
      else if (review && review.fingerprint === fingerprint) state = 'approved'
      else state = 'needsReview'
    }
    const jobNumber = text(booking.jobNumber)
    const jobName = text(booking.jobName)
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
      stateLabel: OVERTIME_LINE_STATE_LABELS[state],
      figures,
      requestId: pending ? pending.request.id : null,
      requestLine: pending ? pending.line : null,
      review,
    })
  }
  return out.sort((a, b) =>
    a.dayKey !== b.dayKey ? (a.dayKey < b.dayKey ? -1 : 1) : a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.jobNumber.localeCompare(b.jobNumber)
  )
}

/** Total overtime hours of the lines that are not cancelled. */
export function overtimeLinesTotal(lines: ReadonlyArray<Pick<OvertimeLine, 'figures' | 'state'>>): number {
  return round2(lines.reduce((sum, line) => sum + (line.state === 'cancelled' ? 0 : line.figures?.overtimeHours ?? 0), 0))
}

/** Generate overtime report is enabled when there is at least one line and every line is approved (or cancelled by an approval). */
export function canGenerateOvertimeReport(lines: ReadonlyArray<Pick<OvertimeLine, 'state'>>): boolean {
  return lines.length > 0 && lines.every((line) => line.state === 'approved' || line.state === 'cancelled')
}

// MARK: - The red X, the cog and the booking write

export type OvertimeStrikeOutcome =
  | { kind: 'none' }
  | { kind: 'trim'; start: string; end: string }
  | {
      kind: 'cancel'
      warning: { title: string; summary: string; body: string; back: string; confirm: string; footnote: string }
    }
  | { kind: 'notAllowed'; message: string }

/**
 * What the red X ("I didn't work these overtime hours") does to a booking: a weekday booking partly outside the
 * working day is trimmed back inside it (06:30–14:00 on 07:30–16:00 → 07:30–14:00); a weekend set-window booking is
 * trimmed to the window; a booking with no hours inside the day (or window), or on a weekend paid at a multiplier
 * only, is cancelled after `OVERTIME_CANCEL_WARNING` (status Cancelled, never deleted). A manager site booking is
 * never cancelled here (`notAllowed`). `none` when there is nothing to trim.
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
    return { kind: 'cancel', warning: { ...OVERTIME_CANCEL_WARNING, summary } }
  }
  if (from === s && to === e) return { kind: 'none' }
  return { kind: 'trim', start: formatClockMinutes(from), end: formatClockMinutes(to) }
}

export type OvertimeBookingChange =
  | { kind: 'edit'; start: string; end: string; /** undefined: leave the rate; null: the organisation's. */ multiplier?: number | null }
  | { kind: 'trim'; start: string; end: string }
  | { kind: 'cancel' }

/** The booking as it will read after `change` (exactly `overtimeBookingWriteFields` applied). */
export function overtimeBookingAfter(booking: OvertimeBookingInput, change: OvertimeBookingChange): OvertimeBookingInput {
  const { set, remove } = overtimeBookingWriteFields(booking, change)
  const next: OvertimeBookingInput = { ...booking, ...(set as Partial<OvertimeBookingInput>) }
  for (const key of remove) delete (next as Record<string, unknown>)[key]
  return next
}

/**
 * The partial update of a booking for an overtime change → `{ set, remove }` (empty when nothing changes). Only
 * `workStartTime`, `workEndTime`, `timeSlot` (a Full day becomes `CUSTOM_HOURS` when its times change),
 * `otMultiplierOverride` and `status` (→ `Cancelled`) are ever written — the fields the security rules let a line
 * manager change (§16). The app adds write metadata.
 */
export function overtimeBookingWriteFields(booking: OvertimeBookingInput, change: OvertimeBookingChange): { set: Record<string, unknown>; remove: string[] } {
  const set: Record<string, unknown> = {}
  const remove: string[] = []
  if (change.kind === 'cancel') {
    if (!isCancelled(booking)) set.status = 'Cancelled'
    return { set, remove }
  }
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
 * How a PAYE person changes their own booking's overtime (cog, tick, X): a PAYE admin directly; a PAYE manager directly
 * where `canWriteBooking` lets them edit the booking, else as a request; a PAYE operative always as a request. `none`
 * for a person who is not PAYE (no My Overtime), a booking dated after `todayKey`, or no viewer.
 */
export function canEditOwnBookingOvertime(input: {
  viewer: JobAccessViewer | null | undefined
  isPaye: boolean
  booking: BookingPermissionInput & { dayKey?: string | null }
  job?: JobManagerFields | Record<string, unknown> | null
  managers?: ReadonlyArray<JobManagerRosterRow> | null
  todayKey?: string | null
}): OvertimeEditMode {
  const viewer = input.viewer
  if (!viewer || !input.isPaye) return 'none'
  const day = text(input.booking?.dayKey)
  if (input.todayKey && day && day > text(input.todayKey)) return 'none'
  const role = viewer.role
  if (!role) return 'none'
  if (!role.isOperativeMode && (role.isAdmin || role.isSuperAdmin)) return 'direct'
  if (role.isOperativeMode || !role.isManager) return 'request'
  return canWriteBooking(viewer, input.booking, input.job ?? null, input.managers) ? 'direct' : 'request'
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
    if (self.has(key) || seen.has(key) || !rosterMemberActive(member)) continue
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
}): OvertimeRequestLine | null {
  const booking = input.booking
  if (!booking || !text(booking.id)) return null
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
    if (outcome.kind === 'cancel') {
      base.cancel = true
      change = { kind: 'cancel' }
    } else {
      base.proposedStart = outcome.start
      base.proposedEnd = outcome.end
      change = { kind: 'trim', start: outcome.start, end: outcome.end }
    }
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
}): Record<string, unknown> | null {
  const userId = text(input.userId)
  const start = dayKeyOrEmpty(input.rangeStart)
  const end = dayKeyOrEmpty(input.rangeEnd)
  if (!userId || !start || !end || start > end || !input.lines || input.lines.length === 0) return null
  return {
    userId,
    rangeStart: start,
    rangeEnd: end,
    status: 'pending',
    lines: input.lines.map((line) => ({ ...line })),
  }
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

/** Every line of the request has a decision. */
export function overtimeRequestFullyDecided(request: Pick<OvertimeRequestRecord, 'lines'>, decisions: Record<string, OvertimeDecision | null | undefined>): boolean {
  if (request.lines.length === 0) return false
  const keyed = new Map(Object.entries(decisions || {}).map(([key, value]) => [idKey(key), value]))
  return request.lines.every((line) => Boolean(keyed.get(idKey(line.bookingId))))
}

function decisionToChange(
  line: OvertimeRequestLine,
  decision: OvertimeDecision,
  live: OvertimeBookingInput,
  organization: OvertimeOrganization,
  timeZone?: string | null
): { change: OvertimeBookingChange | null; refused?: string } {
  if (decision.action === 'edit') return { change: { kind: 'edit', start: decision.start, end: decision.end, multiplier: decision.multiplier } }
  if (decision.action === 'approve') {
    if (line.action === 'keep') return { change: null }
    if (line.action === 'edit') {
      if (!line.proposedStart || !line.proposedEnd) return { change: null }
      return { change: { kind: 'edit', start: line.proposedStart, end: line.proposedEnd, multiplier: line.proposedMultiplier } }
    }
  }
  const outcome = overtimeStrikeOutcome({ booking: live, organization, timeZone })
  if (outcome.kind === 'trim') return { change: { kind: 'trim', start: outcome.start, end: outcome.end } }
  if (outcome.kind === 'cancel') return { change: { kind: 'cancel' } }
  if (outcome.kind === 'notAllowed') return { change: null, refused: outcome.message }
  return { change: null }
}

function reviewDecisionFor(change: OvertimeBookingChange | null): OvertimeReviewDecision {
  if (!change) return 'approved'
  if (change.kind === 'cancel') return 'cancelled'
  if (change.kind === 'trim') return 'trimmed'
  return 'edited'
}

export type OvertimeBookingWrite = { collection: OvertimeBookingCollection; bookingId: string; set: Record<string, unknown>; remove: string[] }
export type OvertimeReviewWrite = { docId: string; fields: Record<string, unknown> }

/**
 * Approve Overtime Request (line manager or admin, online, one transaction): re-reads every booking and refuses the
 * whole approval when any booking no longer matches its line's fingerprint (`stale`, nothing applied); a booking deleted
 * meanwhile is dropped and named. Every other line applies its decision — tick: the request's proposal; X: the strike
 * outcome; cog: the decider's times and rate — as booking writes, plus one review per line with the booking's new
 * fingerprint, and the request becomes approved. `bookings` maps booking id (any case) → the live booking; a missing
 * entry is a deleted booking. The app adds `decidedAt` / `reviewedAt` (server time) and write metadata.
 */
export function overtimeApprovalWrites(input: {
  request: OvertimeRequestRecord
  decisions: Record<string, OvertimeDecision>
  bookings: Record<string, OvertimeBookingInput | null | undefined>
  organization: OvertimeOrganization
  timeZone?: string | null
  deciderId: string
}):
  | {
      ok: true
      bookingWrites: OvertimeBookingWrite[]
      reviewWrites: OvertimeReviewWrite[]
      droppedBookingIds: string[]
      requestFields: Record<string, unknown>
    }
  | { ok: false; reason: 'notPending' | 'undecided' | 'stale' | 'refused'; bookingIds: string[]; message: string } {
  const request = input.request
  if (request.status !== 'pending') return { ok: false, reason: 'notPending', bookingIds: [], message: OVERTIME_REQUEST_NOT_PENDING_MESSAGE }
  if (!overtimeRequestFullyDecided(request, input.decisions)) {
    return { ok: false, reason: 'undecided', bookingIds: [], message: OVERTIME_REQUEST_UNDECIDED_MESSAGE }
  }
  const decisions = new Map(Object.entries(input.decisions).map(([key, value]) => [idKey(key), value]))
  const live = new Map(Object.entries(input.bookings || {}).map(([key, value]) => [idKey(key), value]))
  const stale: string[] = []
  const dropped: string[] = []
  const refused: string[] = []
  const bookingWrites: OvertimeBookingWrite[] = []
  const reviewWrites: OvertimeReviewWrite[] = []
  const applied: string[] = []
  const storedDecisions: Record<string, Record<string, unknown>> = {}
  for (const line of request.lines) {
    const booking = live.get(idKey(line.bookingId))
    if (!booking) {
      dropped.push(line.bookingId)
      continue
    }
    if (overtimeBookingFingerprint(booking) !== line.fingerprint) {
      stale.push(line.bookingId)
      continue
    }
    const decision = decisions.get(idKey(line.bookingId)) as OvertimeDecision
    const { change, refused: why } = decisionToChange(line, decision, booking, input.organization, input.timeZone)
    if (why) {
      refused.push(line.bookingId)
      continue
    }
    storedDecisions[line.bookingId] =
      decision.action === 'edit'
        ? { action: 'edit', start: clockOf(decision.start), end: clockOf(decision.end), multiplier: decision.multiplier ?? null }
        : { action: decision.action }
    const next = change ? overtimeBookingAfter(booking, change) : booking
    if (change) {
      const fields = overtimeBookingWriteFields(booking, change)
      if (Object.keys(fields.set).length > 0 || fields.remove.length > 0) {
        bookingWrites.push({ collection: line.collection, bookingId: line.bookingId, ...fields })
      }
    }
    reviewWrites.push({
      docId: overtimeReviewDocId(request.userId, line.bookingId),
      fields: {
        userId: request.userId,
        bookingId: line.bookingId,
        collection: line.collection,
        decision: reviewDecisionFor(change),
        fingerprint: overtimeBookingFingerprint(next),
        reviewedBy: text(input.deciderId),
        requestId: request.id,
      },
    })
    applied.push(line.bookingId)
  }
  if (stale.length > 0) return { ok: false, reason: 'stale', bookingIds: stale, message: OVERTIME_REQUEST_STALE_MESSAGE }
  if (refused.length > 0) return { ok: false, reason: 'refused', bookingIds: refused, message: OVERTIME_CANCEL_NOT_ALLOWED_MESSAGE }
  return {
    ok: true,
    bookingWrites,
    reviewWrites,
    droppedBookingIds: dropped,
    requestFields: {
      status: 'approved',
      decisions: storedDecisions,
      decidedBy: text(input.deciderId),
      appliedBookingIds: applied,
      droppedBookingIds: dropped,
    },
  }
}

/**
 * A direct change by a PAYE admin, or a PAYE manager who may edit the booking (`canEditOwnBookingOvertime` = direct):
 * tick (approve as it is), X (strike) or cog (edit). → the booking write (null for a tick) and the review with the
 * booking's new fingerprint; `hoursChanged` is true when the booking changes (then `booking_hours_changed_by_owner`
 * goes to `bookingHoursChangedRecipients`). Null when the X is not allowed (manager site booking with nothing inside).
 */
export function overtimeDirectWrites(input: {
  booking: OvertimeBookingInput
  action: OvertimeDecision
  userId: string
  reviewerId: string
  organization: OvertimeOrganization
  timeZone?: string | null
}): { bookingWrite: OvertimeBookingWrite | null; reviewWrite: OvertimeReviewWrite; hoursChanged: boolean } | null {
  const booking = input.booking
  let change: OvertimeBookingChange | null = null
  if (input.action.action === 'edit') {
    if (overtimeEditValidationError(input.action)) return null
    change = { kind: 'edit', start: input.action.start, end: input.action.end, multiplier: input.action.multiplier }
  } else if (input.action.action === 'strike') {
    const outcome = overtimeStrikeOutcome({ booking, organization: input.organization, timeZone: input.timeZone })
    if (outcome.kind === 'notAllowed') return null
    if (outcome.kind === 'trim') change = { kind: 'trim', start: outcome.start, end: outcome.end }
    if (outcome.kind === 'cancel') change = { kind: 'cancel' }
  }
  const fields = change ? overtimeBookingWriteFields(booking, change) : { set: {}, remove: [] as string[] }
  const changed = Object.keys(fields.set).length > 0 || fields.remove.length > 0
  const next = change && changed ? overtimeBookingAfter(booking, change) : booking
  return {
    bookingWrite: changed ? { collection: collectionOf(booking), bookingId: text(booking.id), ...fields } : null,
    reviewWrite: {
      docId: overtimeReviewDocId(input.userId, booking.id),
      fields: {
        userId: text(input.userId),
        bookingId: text(booking.id),
        collection: collectionOf(booking),
        decision: reviewDecisionFor(changed ? change : null),
        fingerprint: overtimeBookingFingerprint(next),
        reviewedBy: text(input.reviewerId),
        requestId: null,
      },
    },
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

/** `overtime_request_reviewed` ("Overtime update"): the requester, unless they decided. */
export function overtimeReviewedRecipients(
  requester: NotificationPerson,
  decider: NotificationPerson,
  roster: ReadonlyArray<NotificationRosterMember> | null | undefined
): string[] {
  const id = typeof requester === 'string' ? idText(requester) : idText(requester?.id)
  return id ? excludeActor([id], decider, roster) : []
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
 * the range, one line per day and job with the final figures (hours only) and the totals. Cancelled lines are left
 * out. The app adds `generatedAt` (server time). The PDF is rebuilt from this copy (`overtimeReportRows`).
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
    .filter((line) => line.state !== 'cancelled' && line.figures)
    .map((line) => ({
      bookingId: line.bookingId,
      dayKey: line.dayKey,
      dayLabel: line.dayLabel,
      jobNumber: line.jobNumber,
      jobName: line.jobName,
      start: line.start,
      end: line.end,
      clockHours: line.figures!.clockHours,
      multiplier: line.figures!.multiplier,
      breakHours: line.figures!.breakHours,
      overtimeHours: line.figures!.overtimeHours,
      text: line.figures!.text,
    }))
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

/** Reads `overtimeReports/{id}` back into a snapshot (plus `id` and `generatedAtMs`). Never throws. */
export function parseOvertimeReportDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): OvertimeReportSnapshot & { id: string; generatedAtMs: number | null } {
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
  }
}

/** The PDF's text rows: heading, one row per line ("Tue 4 Nov · J-1042 Riverside Flats · 06:30–14:00 · 1h × 1.5 = 1.5h") and the total. */
export function overtimeReportRows(snapshot: Pick<OvertimeReportSnapshot, 'userName' | 'companyName' | 'rangeStart' | 'rangeEnd' | 'lines' | 'totals'>): {
  title: string
  subtitle: string
  rows: string[]
  total: string
} {
  const rows = snapshot.lines.map((line) =>
    [line.dayLabel, [line.jobNumber, line.jobName].filter(Boolean).join(' '), line.start && line.end ? `${line.start}–${line.end}` : '', line.text]
      .filter(Boolean)
      .join(' · ')
  )
  return {
    title: `Overtime report · ${text(snapshot.userName)}`,
    subtitle: `${formatPaymentRunDay(snapshot.rangeStart)} – ${formatPaymentRunDay(snapshot.rangeEnd)}`,
    rows,
    total: `${OVERTIME_REPORT_TOTAL_LABEL}: ${hoursText(snapshot.totals.overtimeHours)}`,
  }
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

/**
 * The weekly report's PAYE overtime section, always live from the bookings: one row per PAYE person per job with their
 * overtime hours in the range (the same lines as the Overtime screen, whatever their review state) —
 * "Sam · J-1042 · 1.5h". Sorted by name, then job number.
 */
export function weeklyReportPayeOvertime(input: {
  people: ReadonlyArray<WeeklyReportPayePerson>
  bookings: ReadonlyArray<OvertimeBookingInput>
  organization: OvertimeOrganization
  timeZone?: string | null
  range: { start: string; end: string }
}): Array<{ personId: string; name: string; jobId: string | null; jobNumber: string; jobName: string; overtimeHours: number; label: string }> {
  const zone = zoneOrLondon(input.timeZone)
  const rows = new Map<string, { personId: string; name: string; jobId: string | null; jobNumber: string; jobName: string; overtimeHours: number }>()
  for (const person of input.people || []) {
    const ids = (person.ids && person.ids.length > 0 ? person.ids : [person.id]).map(String)
    const lines = payeOvertimeLines({ personIds: ids, bookings: input.bookings, organization: input.organization, timeZone: zone, range: input.range })
    for (const line of lines) {
      if (line.state === 'cancelled' || !line.figures || !weeklyReportPayeDay(person, line.dayKey, zone)) continue
      const key = `${idKey(person.id)}|${idKey(line.jobId ?? line.jobNumber)}`
      const row = rows.get(key) ?? { personId: idText(person.id), name: text(person.name), jobId: line.jobId, jobNumber: line.jobNumber, jobName: line.jobName, overtimeHours: 0 }
      row.overtimeHours = round2(row.overtimeHours + line.figures.overtimeHours)
      rows.set(key, row)
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.jobNumber.localeCompare(b.jobNumber))
    .map((row) => ({ ...row, label: [row.name, row.jobNumber, hoursText(row.overtimeHours)].filter(Boolean).join(' · ') }))
}

/** Normalised booking slot for overtime inputs (re-exported for callers mapping stored bookings). */
export function overtimeBookingSlot(raw: unknown): string {
  return normalizeBookingTimeSlot(raw) ?? text(raw)
}

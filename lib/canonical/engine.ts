/**
 * Canonical business rules shared by the web app and the iOS bundle.
 *
 * This module has no React, Firebase, or browser dependencies.
 * `scripts/build-canonical-bundle.mjs` compiles it to the JavaScript file
 * the iOS app evaluates. Do not add a second copy of these rules in a screen,
 * a store, or a Swift type.
 */

import {
  LONDON_TIME_ZONE,
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  dayOfMonthInZone,
  daysInZoneMonth,
  isoWeekdayInZone,
  midnightInZone,
  partsInZone,
} from '../orgTime/zoneTime'

export const CANONICAL_TIME_ZONE = LONDON_TIME_ZONE

export const CANONICAL_HALF_MONTH_RANGES: ReadonlyArray<{ startDay: number; endDay: number }> = [
  { startDay: 1, endDay: 15 },
  { startDay: 16, endDay: 31 },
]

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

export type ClashLookaheadMode = 'numberOfDays' | 'endOfInvoicingPeriod' | 'endOfWorkingWeek'
export type PaymentRunMode = 'date_ranges' | 'recurring_timeframe'

export type PaymentRunRange = {
  startDay: number
  endDay: number
}

/**
 * One payment-run row as stored or passed in.
 * Web writes `startDay`/`endDay`. iOS historically wrote `startDate`/`endDate`.
 * Dual-write keeps both pairs equal. A leftover web 1–16 must not override an
 * iOS-saved 1–15: when both pairs are valid and disagree, the iOS pair wins.
 */
export type PaymentRunRangeInput = {
  startDay?: number | string | null
  endDay?: number | string | null
  startDate?: number | string | null
  endDate?: number | string | null
}

export type InvoicingPeriodInput = {
  paymentRunMode?: PaymentRunMode | string | null
  ranges?: readonly PaymentRunRangeInput[] | null
  recurringRunStartDay?: string | null
  recurringRunEndDay?: string | null
}

export type CoverageWindowInput = InvoicingPeriodInput & {
  referenceIso: string
  timeZone?: string | null
  clashLookaheadMode?: ClashLookaheadMode | string | null
  clashLookaheadDays?: number | null
}

export type DayWindow = {
  startDayKey: string
  endDayKey: string
}

export type OrganizationContextSnapshot = {
  organizationId: string
  epoch: number
}

type OrganizationContextState = {
  organizationId: string
  epoch: number
  userId: string
}

const organizationContext: OrganizationContextState = {
  organizationId: '',
  epoch: 0,
  userId: '',
}

export function organizationIdsMatch(lhs?: string | null, rhs?: string | null): boolean {
  const left = String(lhs ?? '').trim().toLowerCase()
  const right = String(rhs ?? '').trim().toLowerCase()
  return left.length > 0 && left === right
}

/** Firestore may store an organisation id as a string or a path ending in the id. */
export function organizationIdFromValue(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/').filter(Boolean)
      return parts[parts.length - 1] || ''
    }
    return trimmed
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return organizationIdFromValue((value as { id?: unknown }).id)
  }
  return ''
}

export function bookingBelongsToOrganization(
  bookingOrganizationId: string | null | undefined,
  currentOrganizationId: string | null | undefined
): boolean {
  return organizationIdsMatch(bookingOrganizationId, currentOrganizationId)
}

/**
 * The company to open before membership reads finish.
 * Explicit switch, then the company this device remembers, then the user document.
 */
export function provisionalOrganizationId(input: {
  explicitOrganizationId?: string | null
  rememberedOrganizationId?: string | null
  documentOrganizationId?: string | null
}): string {
  for (const value of [input.explicitOrganizationId, input.rememberedOrganizationId, input.documentOrganizationId]) {
    const organizationId = String(value || '').trim()
    if (organizationId) return organizationId
  }
  return ''
}

export type OrgAccessProbe = 'allowed' | 'denied' | 'unknown'

/**
 * Explicit switch, then remembered company, then the user document.
 * Only a definite "not a member" skips a non-document company.
 * A slow or failed read stays on the company already chosen.
 */
export function chooseSessionOrganization(input: {
  explicitOrganizationId?: string | null
  rememberedOrganizationId?: string | null
  documentOrganizationId?: string | null
  probes: ReadonlyMap<string, OrgAccessProbe> | Readonly<Record<string, OrgAccessProbe>>
}): { organizationId: string; persistOrganizationId: string | null } {
  const documentOrganizationId = String(input.documentOrganizationId || '').trim()
  const candidates: string[] = []
  for (const value of [input.explicitOrganizationId, input.rememberedOrganizationId, documentOrganizationId]) {
    const id = String(value || '').trim()
    if (!id) continue
    if (candidates.some((existing) => organizationIdsMatch(existing, id))) continue
    candidates.push(id)
  }

  const probeFor = (organizationId: string): OrgAccessProbe => {
    if (input.probes instanceof Map) {
      for (const [key, probe] of input.probes) {
        if (organizationIdsMatch(key, organizationId)) return probe
      }
      return 'unknown'
    }
    for (const [key, probe] of Object.entries(input.probes)) {
      if (organizationIdsMatch(key, organizationId)) return probe
    }
    return 'unknown'
  }

  const rememberedOrganizationId = String(input.rememberedOrganizationId || '').trim()
  const persistFor = (organizationId: string): string | null => {
    if (
      rememberedOrganizationId &&
      organizationIdsMatch(organizationId, documentOrganizationId) &&
      !organizationIdsMatch(organizationId, rememberedOrganizationId)
    ) {
      return null
    }
    return organizationId || null
  }

  for (const organizationId of candidates) {
    const isDocument = organizationIdsMatch(organizationId, documentOrganizationId)
    if (!isDocument && probeFor(organizationId) === 'denied') continue
    return { organizationId, persistOrganizationId: persistFor(organizationId) }
  }

  return {
    organizationId: documentOrganizationId,
    persistOrganizationId: persistFor(documentOrganizationId),
  }
}

/**
 * One in-memory organisation for this process.
 * Switching company increments the epoch so an in-flight result from the previous company cannot commit.
 * Logout clears the user as well, so the next account cannot reuse the previous epoch.
 */
export function adoptCurrentOrganization(organizationId: string, userId = organizationContext.userId): OrganizationContextSnapshot {
  const nextOrganizationId = String(organizationId || '').trim()
  const nextUserId = String(userId || '').trim()
  const sameUser = nextUserId === organizationContext.userId
  const sameOrganization = organizationIdsMatch(organizationContext.organizationId, nextOrganizationId)
  if (!sameUser || !sameOrganization) {
    organizationContext.epoch += 1
    organizationContext.organizationId = nextOrganizationId
    organizationContext.userId = nextUserId
  }
  return captureOrganizationContext()
}

export function captureOrganizationContext(): OrganizationContextSnapshot {
  return {
    organizationId: organizationContext.organizationId,
    epoch: organizationContext.epoch,
  }
}

export function currentOrganizationId(): string {
  return organizationContext.organizationId
}

/**
 * True only when this result still belongs to the organisation that is open now.
 * Before the first adoptCurrentOrganization call, loads are not gated, so tests and
 * boot code that have not chosen a company yet keep their existing behaviour.
 */
export function organizationContextStillCurrent(
  requestOrganizationId: string,
  captured: OrganizationContextSnapshot
): boolean {
  if (!organizationContext.organizationId && organizationContext.epoch === 0) return true
  return (
    captured.epoch === organizationContext.epoch &&
    organizationIdsMatch(requestOrganizationId, organizationContext.organizationId) &&
    organizationIdsMatch(requestOrganizationId, captured.organizationId)
  )
}

export function resetOrganizationContextForTests(): void {
  organizationContext.organizationId = ''
  organizationContext.epoch = 0
  organizationContext.userId = ''
}

export type MinuteInterval = { start: number; end: number }

/** Half-open minute intervals. Touching endpoints are not a clash. */
export function intervalsOverlap(a: MinuteInterval, b: MinuteInterval): boolean {
  return a.start < b.end && b.start < a.end
}

// ─── Standard day, AM and PM ─────────────────────────────────────────────────
//
// One definition of the working day and of its two halves, used by booking
// clashes, annual-leave checks, half-day pay, and every screen that draws AM/PM.
//
// Rule
//   1. The standard day is [standardDayStart, standardDayEnd) from organisation
//      settings. An unparsable or inverted pair falls back to 07:30–16:00.
//      A break field the organisation has not set falls back to 12:00–12:30.
//   2. The break window splits the day when it is usable: valid, strictly inside
//      the day, and leaving at least MIN_HALF_DAY_MINUTES on each side.
//      AM = [dayStart, breakStart). PM = [breakEnd, dayEnd). The break belongs to
//      neither half, so an AM booking and a PM booking never touch.
//   3. Otherwise the day is split at its wall-clock midpoint (floored to the
//      minute). AM = [dayStart, mid). PM = [mid, dayEnd). A company on
//      13:00–19:00 with the default 12:00–12:30 break gets AM 13:00–16:00 and
//      PM 16:00–19:00.
//   4. FULL DAY is the whole standard day.
//   5. Pay for a named slot stays `paidHoursForNamedSlot`: FULL DAY is the
//      standard paid hours, AM and PM are each half. The clock windows above are
//      for clashes and cover; they do not change what a half day pays.

export const CANONICAL_STANDARD_DAY: Readonly<MinuteInterval> = { start: 7 * 60 + 30, end: 16 * 60 }
export const CANONICAL_STANDARD_BREAK: Readonly<MinuteInterval> = { start: 12 * 60, end: 12 * 60 + 30 }
export const MIN_HALF_DAY_MINUTES = 60

export type StandardDayInput = {
  standardDayStart?: string | null
  standardDayEnd?: string | null
  breakWindowStart?: string | null
  breakWindowEnd?: string | null
}

export type HalfDayWindows = {
  day: MinuteInterval
  am: MinuteInterval
  pm: MinuteInterval
  /** Which rule produced the split. */
  pivot: 'break' | 'midpoint'
  /** The break that separates AM from PM, when `pivot` is `break`. */
  breakWindow: MinuteInterval | null
}

/** "HH:mm" or "H:mm" to minutes since midnight. Anything else is null. */
export function parseClockMinutes(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && value <= 24 * 60 ? Math.round(value) : null
  }
  const text = String(value ?? '').trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 24 || minutes > 59) return null
  const total = hours * 60 + minutes
  return total <= 24 * 60 ? total : null
}

export function formatClockMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(Math.round(minutes), 24 * 60))
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/** The organisation's standard day. Invalid settings fall back to 07:30–16:00. */
export function standardDayWindow(input?: StandardDayInput | null): MinuteInterval {
  const start = parseClockMinutes(input?.standardDayStart)
  const end = parseClockMinutes(input?.standardDayEnd)
  if (start == null || end == null || end <= start) return { ...CANONICAL_STANDARD_DAY }
  return { start, end }
}

/**
 * The organisation's unpaid break as set, with the 12:00–12:30 default for a
 * field that was never set. Null when the pair does not form a window. This is
 * the break pay subtracts; whether it also splits AM from PM is `halfDayWindows`.
 */
export function standardBreakWindow(input?: StandardDayInput | null): MinuteInterval | null {
  const start = input?.breakWindowStart == null ? CANONICAL_STANDARD_BREAK.start : parseClockMinutes(input.breakWindowStart)
  const end = input?.breakWindowEnd == null ? CANONICAL_STANDARD_BREAK.end : parseClockMinutes(input.breakWindowEnd)
  if (start == null || end == null || end <= start) return null
  return { start, end }
}

/** AM and PM for the organisation. See the rule above. */
export function halfDayWindows(input?: StandardDayInput | null): HalfDayWindows {
  const day = standardDayWindow(input)
  const breakWindow = standardBreakWindow(input)
  const breakStart = breakWindow?.start ?? null
  const breakEnd = breakWindow?.end ?? null
  const breakUsable =
    breakStart != null &&
    breakEnd != null &&
    breakStart - day.start >= MIN_HALF_DAY_MINUTES &&
    day.end - breakEnd >= MIN_HALF_DAY_MINUTES
  if (breakUsable) {
    return {
      day,
      am: { start: day.start, end: breakStart },
      pm: { start: breakEnd, end: day.end },
      pivot: 'break',
      breakWindow: { start: breakStart, end: breakEnd },
    }
  }
  const mid = day.start + Math.floor((day.end - day.start) / 2)
  return {
    day,
    am: { start: day.start, end: mid },
    pm: { start: mid, end: day.end },
    pivot: 'midpoint',
    breakWindow: null,
  }
}

export type NamedSlotKind = 'FULL_DAY' | 'AM' | 'PM' | 'CUSTOM' | 'EVENING' | 'OVERTIME' | 'UNKNOWN'

/** Normalises every spelling both apps have stored: FULL DAY, FULL_DAY, Morning, Afternoon, CUSTOM_HOURS. */
export function namedSlotKind(timeSlot: string | null | undefined): NamedSlotKind {
  const normalized = String(timeSlot || '').trim().toUpperCase().replace(/_/g, ' ')
  if (!normalized) return 'UNKNOWN'
  if (normalized.includes('FULL')) return 'FULL_DAY'
  if (normalized === 'AM' || normalized.includes('MORNING')) return 'AM'
  if (normalized === 'PM' || normalized.includes('AFTERNOON')) return 'PM'
  if (normalized.includes('CUSTOM')) return 'CUSTOM'
  if (normalized.includes('EVENING')) return 'EVENING'
  if (normalized.includes('OVERTIME')) return 'OVERTIME'
  return 'UNKNOWN'
}

export type SlotIntervalInput = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
}

/**
 * The clock interval a booking occupies.
 * Explicit work times win. Named slots use the organisation's day and halves.
 * A custom slot without times, and an unknown slot, occupy the whole day.
 * Evening is the four hours after the day; overtime is the two hours after that.
 */
export function slotInterval(booking: SlotIntervalInput, dayInput?: StandardDayInput | null): MinuteInterval | null {
  const start = parseClockMinutes(booking.workStartTime)
  const end = parseClockMinutes(booking.workEndTime)
  if (start != null && end != null && end > start) return { start, end }
  const windows = halfDayWindows(dayInput)
  switch (namedSlotKind(booking.timeSlot)) {
    case 'AM':
      return { ...windows.am }
    case 'PM':
      return { ...windows.pm }
    case 'EVENING': {
      const eveningEnd = Math.min(windows.day.end + 240, 24 * 60)
      return eveningEnd > windows.day.end ? { start: windows.day.end, end: eveningEnd } : null
    }
    case 'OVERTIME': {
      const overtimeStart = Math.min(windows.day.end + 240, 24 * 60)
      const overtimeEnd = Math.min(windows.day.end + 360, 24 * 60)
      return overtimeEnd > overtimeStart ? { start: overtimeStart, end: overtimeEnd } : null
    }
    default:
      return { ...windows.day }
  }
}

/** Sorted, merged copy of the intervals. Touching intervals join. */
export function mergeMinuteIntervals(intervals: readonly MinuteInterval[]): MinuteInterval[] {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .map((interval) => ({ ...interval }))
    .sort((a, b) => a.start - b.start)
  const merged: MinuteInterval[] = []
  for (const interval of sorted) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
    else merged.push(interval)
  }
  return merged
}

/** The parts of `window` that none of `covered` reaches. */
export function subtractMinuteIntervals(window: MinuteInterval, covered: readonly MinuteInterval[]): MinuteInterval[] {
  const gaps: MinuteInterval[] = []
  let cursor = window.start
  for (const interval of mergeMinuteIntervals(covered)) {
    if (interval.end <= cursor) continue
    if (interval.start >= window.end) break
    if (interval.start > cursor) gaps.push({ start: cursor, end: Math.min(interval.start, window.end) })
    cursor = Math.max(cursor, interval.end)
    if (cursor >= window.end) break
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end })
  return gaps
}

/**
 * Named booking slots. FULL DAY and FULL_DAY are the same business day.
 * AM and PM are each half of the organisation's standard paid day.
 * Custom clock times and overtime stay in the payroll engines; they must call this for named slots.
 */
export function paidHoursForNamedSlot(timeSlot: string | null | undefined, standardPaidHours = 8): number | null {
  const normalized = String(timeSlot || '').trim().toUpperCase().replace(/_/g, ' ')
  const standard = Number.isFinite(standardPaidHours) && standardPaidHours > 0 ? standardPaidHours : 8
  if (normalized.includes('FULL')) return standard
  if (normalized === 'AM' || normalized === 'PM') return standard / 2
  return null
}

function zoneOf(timeZone?: string | null): string {
  const value = String(timeZone || '').trim()
  return value || CANONICAL_TIME_ZONE
}

function isoWeekdayIndex(day: string | null | undefined): number {
  const index = WEEKDAYS.indexOf(String(day || '').trim().toLowerCase() as (typeof WEEKDAYS)[number])
  return index >= 0 ? index + 1 : 5
}

function weekdayOnOrBefore(reference: Date, isoWeekday: number, timeZone: string): Date {
  const current = isoWeekdayInZone(reference, timeZone)
  const delta = current >= isoWeekday ? current - isoWeekday : current + 7 - isoWeekday
  return addDaysInZone(midnightInZone(reference, timeZone), -delta, timeZone)
}

function weekdayOnOrAfter(reference: Date, isoWeekday: number, timeZone: string): Date {
  const current = isoWeekdayInZone(reference, timeZone)
  const delta = current <= isoWeekday ? isoWeekday - current : 7 - current + isoWeekday
  return addDaysInZone(midnightInZone(reference, timeZone), delta, timeZone)
}

function dayInMonth(monthAnchor: Date, day: number, timeZone: string): Date {
  const { y, m } = partsInZone(monthAnchor, timeZone)
  const dim = daysInZoneMonth(monthAnchor, timeZone)
  const clamped = Math.min(Math.max(day, 1), dim)
  return dateFromDayKeyInZone(
    `${y}-${String(m).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`,
    timeZone
  )
}

function shiftMonth(reference: Date, offset: number, timeZone: string): Date {
  const { y, m } = partsInZone(reference, timeZone)
  return midnightInZone(new Date(Date.UTC(y, m - 1 + offset, 1, 12, 0, 0)), timeZone)
}

/** Day-of-month 1–31. 0, blank, and anything else are missing. */
export function paymentRunMonthDay(value: unknown): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 0
}

/**
 * Resolve one payment-run row to `startDay`/`endDay`.
 * Prefer `startDate`/`endDate` when they are valid so a leftover web 1–16
 * cannot override an iOS-saved 1–15. Fall back to `startDay`/`endDay` when
 * the iOS pair is missing. A web-only 1–16 save is kept.
 */
export function normalizePaymentRunRange(
  row: PaymentRunRangeInput | null | undefined
): PaymentRunRange | null {
  if (!row) return null
  const startDay = paymentRunMonthDay(row.startDate) || paymentRunMonthDay(row.startDay)
  const endDay = paymentRunMonthDay(row.endDate) || paymentRunMonthDay(row.endDay)
  if (startDay <= 0 || endDay <= 0) return null
  return { startDay, endDay }
}

function usableRanges(ranges: readonly PaymentRunRangeInput[] | null | undefined): PaymentRunRange[] {
  return (ranges ?? [])
    .map((range) => normalizePaymentRunRange(range))
    .filter((range): range is PaymentRunRange => range != null)
    .slice(0, 2)
}

function rangeContainsDay(range: PaymentRunRange, dayOfMonth: number): boolean {
  if (range.startDay <= range.endDay) {
    return dayOfMonth >= range.startDay && dayOfMonth <= range.endDay
  }
  return dayOfMonth >= range.startDay || dayOfMonth <= range.endDay
}

function boundsForRange(range: PaymentRunRange, reference: Date, timeZone: string): DayWindow {
  const dayOfMonth = dayOfMonthInZone(reference, timeZone)
  const monthAnchor = shiftMonth(reference, 0, timeZone)
  if (range.startDay <= range.endDay) {
    return {
      startDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.startDay, timeZone), timeZone),
      endDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.endDay, timeZone), timeZone),
    }
  }
  if (dayOfMonth >= range.startDay) {
    const nextMonth = shiftMonth(reference, 1, timeZone)
    return {
      startDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.startDay, timeZone), timeZone),
      endDayKey: dayKeyInZone(dayInMonth(nextMonth, range.endDay, timeZone), timeZone),
    }
  }
  const previousMonth = shiftMonth(reference, -1, timeZone)
  return {
    startDayKey: dayKeyInZone(dayInMonth(previousMonth, range.startDay, timeZone), timeZone),
    endDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.endDay, timeZone), timeZone),
  }
}

/** Payment-run segment that contains the reference instant, in the organisation time zone. */
export function invoicingPeriod(input: CoverageWindowInput): DayWindow {
  const timeZone = zoneOf(input.timeZone)
  const reference = midnightInZone(new Date(input.referenceIso), timeZone)
  if (String(input.paymentRunMode || 'date_ranges') === 'recurring_timeframe') {
    return recurringPeriod(reference, input, timeZone)
  }
  return dateRangePeriod(reference, input.ranges, timeZone)
}

function dateRangePeriod(
  reference: Date,
  ranges: readonly PaymentRunRangeInput[] | null | undefined,
  timeZone: string
): DayWindow {
  const parsed = usableRanges(ranges)
  const effective = parsed.length > 0 ? parsed : CANONICAL_HALF_MONTH_RANGES
  const dayOfMonth = dayOfMonthInZone(reference, timeZone)
  const match = effective.find((range) => rangeContainsDay(range, dayOfMonth))
  if (match) return boundsForRange(match, reference, timeZone)
  const fallback = effective.reduce((latest, range) => (range.endDay > latest.endDay ? range : latest))
  return boundsForRange(fallback, reference, timeZone)
}

function recurringPeriod(reference: Date, input: InvoicingPeriodInput, timeZone: string): DayWindow {
  const startWd = isoWeekdayIndex(input.recurringRunStartDay || 'monday')
  const endWd = isoWeekdayIndex(input.recurringRunEndDay || 'sunday')
  let periodStart = weekdayOnOrBefore(reference, startWd, timeZone)
  let periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone)
  if (dayKeyInZone(periodEnd, timeZone) < dayKeyInZone(periodStart, timeZone)) {
    periodEnd = addDaysInZone(periodEnd, 7, timeZone)
  }
  if (dayKeyInZone(reference, timeZone) > dayKeyInZone(periodEnd, timeZone)) {
    periodStart = addDaysInZone(periodStart, 7, timeZone)
    periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone)
    if (dayKeyInZone(periodEnd, timeZone) < dayKeyInZone(periodStart, timeZone)) {
      periodEnd = addDaysInZone(periodEnd, 7, timeZone)
    }
  }
  return {
    startDayKey: dayKeyInZone(periodStart, timeZone),
    endDayKey: dayKeyInZone(periodEnd, timeZone),
  }
}

/** Same shape as `StandardDayInput`; kept as the name `standardDayCoverage` callers use. */
export type StandardDayPolicy = StandardDayInput

export type StandardDayBooking = {
  timeSlot?: string | null
  workStart?: string | null
  workEnd?: string | null
  /** iOS / Firestore booking clock fields. Same meaning as `workStart` / `workEnd`. */
  workStartTime?: string | null
  workEndTime?: string | null
}

export type StandardDayCoverage = {
  requiredHours: number
  coveredHours: number
  missingHours: number
}

function intervalMinutes(intervals: readonly MinuteInterval[]): number {
  return intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0)
}

function roundCoverageHours(hours: number): number {
  return Math.round(hours * 100) / 100
}

/** `intervals` with `cut` removed from each. */
function withoutInterval(intervals: readonly MinuteInterval[], cut: MinuteInterval | null): MinuteInterval[] {
  if (!cut) return intervals.map((interval) => ({ ...interval }))
  return intervals.flatMap((interval) => subtractMinuteIntervals(interval, [cut]))
}

/**
 * The part of the standard day a booking covers.
 * A full-day slot, or no slot at all, is the whole day. AM and PM are the
 * organisation's halves from `halfDayWindows`. Any other slot uses its clock
 * times when they form a window, otherwise the whole day.
 */
function bookingCoverInterval(booking: StandardDayBooking, windows: HalfDayWindows): MinuteInterval | null {
  switch (namedSlotKind(booking.timeSlot)) {
    case 'UNKNOWN':
    case 'FULL_DAY':
      return { ...windows.day }
    case 'AM':
      return windows.am.end > windows.am.start ? { ...windows.am } : null
    case 'PM':
      return windows.pm.end > windows.pm.start ? { ...windows.pm } : null
    default: {
      const start = parseClockMinutes(booking.workStart ?? booking.workStartTime)
      const end = parseClockMinutes(booking.workEnd ?? booking.workEndTime)
      if (start != null && end != null && end > start) return { start, end }
      return { ...windows.day }
    }
  }
}

/**
 * Hours of the organisation standard day a person's bookings cover.
 * The required window is the standard day minus the unpaid break
 * (07:30–16:00 with a 12:00–12:30 break is 8 hours). A full-day slot covers that
 * window. AM covers the morning half and PM the afternoon half (`halfDayWindows`).
 * Custom clock times count only where they overlap the required window.
 * Hours outside the standard day do not cover it. Overlapping bookings merge.
 * A booking with no slot is a full day, so older callers stay compatible.
 */
export function standardDayCoverage(
  policy: StandardDayPolicy,
  bookings: readonly StandardDayBooking[]
): StandardDayCoverage {
  const windows = halfDayWindows(policy)
  const unpaidBreak = standardBreakWindow(policy)
  const required = withoutInterval([windows.day], unpaidBreak)
  const requiredHours = roundCoverageHours(intervalMinutes(required) / 60)
  const covered: MinuteInterval[] = []
  for (const booking of bookings) {
    const interval = bookingCoverInterval(booking, windows)
    if (!interval) continue
    const start = Math.max(interval.start, windows.day.start)
    const end = Math.min(interval.end, windows.day.end)
    if (end > start) covered.push({ start, end })
  }
  const inside = withoutInterval(mergeMinuteIntervals(covered), unpaidBreak)
  const coveredHours = roundCoverageHours(Math.min(requiredHours, intervalMinutes(inside) / 60))
  return {
    requiredHours,
    coveredHours,
    missingHours: roundCoverageHours(Math.max(0, requiredHours - coveredHours)),
  }
}

/**
 * Inclusive warning scan window.
 * numberOfDays: today through today+(N-1).
 * endOfWorkingWeek: Monday through Friday of the organisation week.
 * Weekend days are not part of this window. The include-weekends toggle adds them
 * only for unbooked labour.
 * endOfInvoicingPeriod: the payment-run segment that contains today.
 * Missing ranges use the half-month default, not the device calendar and not a 1–2 placeholder.
 */
export function coverageWindow(input: CoverageWindowInput): DayWindow {
  const timeZone = zoneOf(input.timeZone)
  const today = midnightInZone(new Date(input.referenceIso), timeZone)
  const todayKey = dayKeyInZone(today, timeZone)
  const mode = String(input.clashLookaheadMode || 'endOfWorkingWeek')
  if (mode === 'numberOfDays') {
    const days = Math.max(1, Math.min(Number(input.clashLookaheadDays) || 1, 366))
    return {
      startDayKey: todayKey,
      endDayKey: dayKeyInZone(addDaysInZone(today, days - 1, timeZone), timeZone),
    }
  }
  if (mode === 'endOfInvoicingPeriod') {
    return invoicingPeriod({ ...input, referenceIso: today.toISOString(), timeZone })
  }
  const iso = isoWeekdayInZone(today, timeZone)
  return {
    startDayKey: dayKeyInZone(addDaysInZone(today, -(iso - 1), timeZone), timeZone),
    endDayKey: dayKeyInZone(addDaysInZone(today, 5 - iso, timeZone), timeZone),
  }
}

export function dayKeyInOrganizationZone(referenceIso: string, timeZone?: string | null): string {
  return dayKeyInZone(new Date(referenceIso), zoneOf(timeZone))
}

/** Cache and persistence keys for organisation-scoped data. */
export function organizationScopedKey(kind: string, organizationId: string, userId = ''): string {
  const org = String(organizationId || '').trim().toLowerCase()
  const user = String(userId || '').trim()
  return user ? `${kind}:${user}:${org}` : `${kind}:${org}`
}

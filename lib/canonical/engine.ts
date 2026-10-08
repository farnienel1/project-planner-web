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

export type InvoicingPeriodInput = {
  paymentRunMode?: PaymentRunMode | string | null
  ranges?: readonly PaymentRunRange[] | null
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

function usableRanges(ranges: readonly PaymentRunRange[] | null | undefined): PaymentRunRange[] {
  return (ranges ?? []).filter((range) => range.startDay > 0 && range.endDay > 0).slice(0, 2)
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

function dateRangePeriod(reference: Date, ranges: readonly PaymentRunRange[] | null | undefined, timeZone: string): DayWindow {
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

export type StandardDayPolicy = {
  standardDayStart?: string | null
  standardDayEnd?: string | null
  breakWindowStart?: string | null
  breakWindowEnd?: string | null
}

export type StandardDayBooking = {
  timeSlot?: string | null
  workStart?: string | null
  workEnd?: string | null
}

export type StandardDayCoverage = {
  requiredHours: number
  coveredHours: number
  missingHours: number
}

type MinuteSpan = { start: number; end: number }

function parseClockMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function mergeSpans(spans: readonly MinuteSpan[]): MinuteSpan[] {
  const sorted = spans.filter((span) => span.end > span.start).sort((a, b) => a.start - b.start)
  const merged: MinuteSpan[] = []
  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (!last || span.start > last.end) merged.push({ ...span })
    else last.end = Math.max(last.end, span.end)
  }
  return merged
}

function subtractSpan(base: readonly MinuteSpan[], cut: MinuteSpan | null): MinuteSpan[] {
  if (!cut || cut.end <= cut.start) return [...base]
  const out: MinuteSpan[] = []
  for (const span of base) {
    if (cut.end <= span.start || cut.start >= span.end) {
      out.push(span)
      continue
    }
    if (cut.start > span.start) out.push({ start: span.start, end: cut.start })
    if (cut.end < span.end) out.push({ start: cut.end, end: span.end })
  }
  return out
}

function spanMinutes(spans: readonly MinuteSpan[]): number {
  return spans.reduce((sum, span) => sum + (span.end - span.start), 0)
}

function roundCoverageHours(hours: number): number {
  return Math.round(hours * 100) / 100
}

function bookingCoverSpan(
  booking: StandardDayBooking,
  dayStart: number,
  dayEnd: number,
  breakStart: number,
  breakEnd: number
): MinuteSpan | null {
  const slot = String(booking.timeSlot || '')
    .trim()
    .toUpperCase()
    .replace(/_/g, ' ')
  const clockStart = parseClockMinutes(booking.workStart)
  const clockEnd = parseClockMinutes(booking.workEnd)
  const hasClock = clockStart != null && clockEnd != null && clockEnd > clockStart
  if (!slot || slot.includes('FULL')) return { start: dayStart, end: dayEnd }
  if (slot === 'AM' || slot.includes('MORNING')) {
    const end = breakStart > dayStart && breakStart < dayEnd ? breakStart : dayStart + Math.floor((dayEnd - dayStart) / 2)
    return end > dayStart ? { start: dayStart, end } : null
  }
  if (slot === 'PM' || slot.includes('AFTERNOON')) {
    const start = breakEnd > dayStart && breakEnd < dayEnd ? breakEnd : dayStart + Math.floor((dayEnd - dayStart) / 2)
    return dayEnd > start ? { start, end: dayEnd } : null
  }
  if (hasClock) return { start: clockStart, end: clockEnd }
  return { start: dayStart, end: dayEnd }
}

/**
 * Hours of the organisation standard day a person's bookings cover.
 * The required window is standardDayStart–standardDayEnd minus the unpaid break
 * (07:30–16:00 with a 12:00–12:30 break is 8 hours). A full-day slot covers that
 * window. Morning covers up to the break. Afternoon covers from the end of the
 * break. Custom clock times count only where they overlap the required window.
 * Hours outside the standard day do not cover it. Overlapping bookings merge.
 * A booking with no slot is a full day, so older callers stay compatible.
 */
export function standardDayCoverage(
  policy: StandardDayPolicy,
  bookings: readonly StandardDayBooking[]
): StandardDayCoverage {
  const dayStart = parseClockMinutes(policy.standardDayStart) ?? 7 * 60 + 30
  const dayEnd = parseClockMinutes(policy.standardDayEnd) ?? 16 * 60
  const breakStart = parseClockMinutes(policy.breakWindowStart) ?? 12 * 60
  const breakEnd = parseClockMinutes(policy.breakWindowEnd) ?? 12 * 60 + 30
  const required =
    dayEnd > dayStart
      ? subtractSpan([{ start: dayStart, end: dayEnd }], breakEnd > breakStart ? { start: breakStart, end: breakEnd } : null)
      : []
  const requiredHours = roundCoverageHours(spanMinutes(required) / 60)
  const covered: MinuteSpan[] = []
  for (const booking of bookings) {
    const span = bookingCoverSpan(booking, dayStart, dayEnd, breakStart, breakEnd)
    if (!span) continue
    const start = Math.max(span.start, dayStart)
    const end = Math.min(span.end, dayEnd)
    if (end > start) covered.push({ start, end })
  }
  const inside = subtractSpan(mergeSpans(covered), breakEnd > breakStart ? { start: breakStart, end: breakEnd } : null)
  const coveredHours = roundCoverageHours(Math.min(requiredHours, spanMinutes(inside) / 60))
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

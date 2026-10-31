/**
 * Working hours over time: the policy in effect on a day, "apply from today" and
 * "schedule from a date" writes, the one set of limits, and the fixed working week.
 *
 * Fields on `organizations/{orgId}` (unchanged names, iOS-decodable):
 * - `payrollTimePolicy` — the current policy.
 * - `payrollTimePolicyPrior` — the policy for days before `payrollTimePolicyEffectiveFrom`.
 * - `payrollTimePolicyEffectiveFrom` — `YYYY-MM-DD` day key in the organisation zone.
 * - `payrollTimePolicyScheduled` — `{ policy, effectiveFrom: 'YYYY-MM-DD' }`, a queued future change.
 *
 * A scheduled change counts from its `effectiveFrom` day on, whether or not any app has promoted
 * it into `payrollTimePolicy` yet, so neither app needs an in-memory promotion. Writes promote a
 * due scheduled change before changing anything, and never cancel a future one silently.
 * Day keys use `organizationTimeZone(countryCode)`.
 */
import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { parseClockMinutes } from './engine'
import {
  parsePayrollPolicy,
  payrollPolicyToFirestore,
  type OrgPayrollTimePolicy,
  type WeekendPayrollSettings,
} from './organizationSettings'

const DEFAULT_ZONE = 'Europe/London'
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export type PayrollTimePolicyScheduledChange = {
  policy: OrgPayrollTimePolicy
  /** Organisation-zone day key the policy becomes live. */
  effectiveFrom: string
}

export type PayrollTimePolicyState = {
  current: OrgPayrollTimePolicy
  prior: OrgPayrollTimePolicy | null
  effectiveFrom: string | null
  scheduled: PayrollTimePolicyScheduledChange | null
}

function zone(timeZone?: string | null): string {
  return String(timeZone || '').trim() || DEFAULT_ZONE
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

/** `YYYY-MM-DD`, a Date, or a Firestore Timestamp (any SDK shape) → organisation-zone day key. */
export function payrollDayKeyFromValue(value: unknown, timeZone?: string | null): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim().slice(0, 10)
    return DAY_KEY_RE.test(trimmed) ? trimmed : null
  }
  let date: Date | null = null
  if (value instanceof Date) date = value
  else if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (typeof v.toDate === 'function') date = (v.toDate as () => Date)()
    else if (typeof v.seconds === 'number') date = new Date(v.seconds * 1000)
    else if (typeof v._seconds === 'number') date = new Date(v._seconds * 1000)
  }
  if (!date || Number.isNaN(date.getTime())) return null
  return dayKeyInZone(date, zone(timeZone))
}

function shiftDayKey(dayKey: string, days: number, timeZone: string): string {
  return dayKeyInZone(addDaysInZone(dateFromDayKeyInZone(dayKey, timeZone), days, timeZone), timeZone)
}

export function parsePayrollTimePolicyScheduled(
  value: unknown,
  timeZone?: string | null
): PayrollTimePolicyScheduledChange | null {
  const raw = record(value)
  const policy = record(raw?.policy)
  if (!raw || !policy) return null
  const effectiveFrom = payrollDayKeyFromValue(raw.effectiveFrom, timeZone)
  if (!effectiveFrom) return null
  return { policy: parsePayrollPolicy(policy), effectiveFrom }
}

/** The four stored payroll fields of an organisation document, parsed. */
export function parsePayrollTimePolicyState(orgDoc: unknown, timeZone?: string | null): PayrollTimePolicyState {
  const data = record(orgDoc) ?? {}
  const priorRaw = record(data.payrollTimePolicyPrior)
  return {
    current: parsePayrollPolicy(record(data.payrollTimePolicy)),
    prior: priorRaw ? parsePayrollPolicy(priorRaw) : null,
    effectiveFrom: payrollDayKeyFromValue(data.payrollTimePolicyEffectiveFrom, timeZone),
    scheduled: parsePayrollTimePolicyScheduled(data.payrollTimePolicyScheduled, timeZone),
  }
}

function isState(value: unknown): value is PayrollTimePolicyState {
  const v = record(value)
  return Boolean(v && 'current' in v && 'scheduled' in v && record(v.current))
}

/** Policy in effect on `dayKey` from an already-parsed state. */
export function payrollTimePolicyForDayFromState(state: PayrollTimePolicyState, dayKey: string): OrgPayrollTimePolicy {
  if (state.scheduled && dayKey >= state.scheduled.effectiveFrom) return state.scheduled.policy
  if (state.prior && state.effectiveFrom && dayKey < state.effectiveFrom) return state.prior
  return state.current
}

/**
 * The working-hours policy in effect on `dayKey` (organisation-zone `YYYY-MM-DD`):
 * the scheduled policy once its `effectiveFrom` has arrived; the prior policy before
 * `payrollTimePolicyEffectiveFrom`; otherwise the current policy.
 * Accepts the raw organisation document or a `PayrollTimePolicyState`.
 */
export function effectivePayrollTimePolicy(
  orgDoc: unknown,
  dayKey: string,
  timeZone?: string | null
): OrgPayrollTimePolicy {
  const state = isState(orgDoc) ? orgDoc : parsePayrollTimePolicyState(orgDoc, timeZone)
  return payrollTimePolicyForDayFromState(state, dayKey)
}

/**
 * The stored state as it stands on `todayKey`: a due scheduled change is promoted
 * (current = scheduled policy, prior = the policy of the day before it, effectiveFrom = its day).
 * A future scheduled change stays pending. Screens that show "today's" rules read `current`.
 */
export function payrollTimePolicyTimeline(
  orgDoc: unknown,
  todayKey: string,
  timeZone?: string | null
): PayrollTimePolicyState {
  const tz = zone(timeZone)
  const state = isState(orgDoc) ? orgDoc : parsePayrollTimePolicyState(orgDoc, tz)
  const scheduled = state.scheduled
  if (!scheduled || scheduled.effectiveFrom > todayKey) return state
  const dayBefore = shiftDayKey(scheduled.effectiveFrom, -1, tz)
  return {
    current: scheduled.policy,
    prior: payrollTimePolicyForDayFromState({ ...state, scheduled: null }, dayBefore),
    effectiveFrom: scheduled.effectiveFrom,
    scheduled: null,
  }
}

function promotedFields(state: PayrollTimePolicyState, todayKey: string, tz: string): Record<string, unknown> {
  const promoted = payrollTimePolicyTimeline(state, todayKey, tz)
  if (promoted === state) return {}
  return {
    payrollTimePolicy: payrollPolicyToFirestore(promoted.current),
    payrollTimePolicyPrior: promoted.prior ? payrollPolicyToFirestore(promoted.prior) : null,
    payrollTimePolicyEffectiveFrom: promoted.effectiveFrom,
    payrollTimePolicyScheduled: null,
  }
}

/**
 * "Apply from today". `prior` is the policy that was in effect yesterday, so a second save on the
 * same day keeps the real earlier rules. A due scheduled change is consumed; a future one is kept.
 */
export function payrollTimePolicyApplyNowWriteFields(input: {
  orgDoc: unknown
  policy: OrgPayrollTimePolicy
  todayKey: string
  timeZone?: string | null
}): Record<string, unknown> {
  const tz = zone(input.timeZone)
  const state = parsePayrollTimePolicyState(input.orgDoc, tz)
  const yesterday = shiftDayKey(input.todayKey, -1, tz)
  const prior = payrollTimePolicyForDayFromState(state, yesterday)
  const fields: Record<string, unknown> = {
    payrollTimePolicy: payrollPolicyToFirestore(input.policy),
    payrollTimePolicyPrior: payrollPolicyToFirestore(prior),
    payrollTimePolicyEffectiveFrom: input.todayKey,
  }
  if (state.scheduled && state.scheduled.effectiveFrom <= input.todayKey) {
    fields.payrollTimePolicyScheduled = null
  }
  return fields
}

/** A scheduled change must start after today; today uses "Apply from today". */
export function payrollTimePolicyScheduleDateError(effectiveFrom: string, todayKey: string): string | null {
  if (!DAY_KEY_RE.test(String(effectiveFrom || ''))) return 'Choose the date the new working hours start.'
  if (effectiveFrom <= todayKey) return 'Choose a date after today, or apply the change from today.'
  return null
}

/**
 * "Schedule from a date". Replaces any pending future change. A change that is already due is
 * first promoted into the current policy so it is not lost. Returns null when the date is invalid.
 */
export function payrollTimePolicyScheduleWriteFields(input: {
  orgDoc: unknown
  policy: OrgPayrollTimePolicy
  effectiveFrom: string
  todayKey: string
  timeZone?: string | null
}): Record<string, unknown> | null {
  if (payrollTimePolicyScheduleDateError(input.effectiveFrom, input.todayKey)) return null
  const tz = zone(input.timeZone)
  const state = parsePayrollTimePolicyState(input.orgDoc, tz)
  return {
    ...promotedFields(state, input.todayKey, tz),
    payrollTimePolicyScheduled: {
      policy: payrollPolicyToFirestore(input.policy),
      effectiveFrom: input.effectiveFrom,
    },
  }
}

/** Cancel a pending future change. Promotes a due one first so it is not lost. */
export function payrollTimePolicyCancelScheduleWriteFields(input: {
  orgDoc: unknown
  todayKey: string
  timeZone?: string | null
}): Record<string, unknown> {
  const tz = zone(input.timeZone)
  const state = parsePayrollTimePolicyState(input.orgDoc, tz)
  const promoted = promotedFields(state, input.todayKey, tz)
  return Object.keys(promoted).length > 0 ? promoted : { payrollTimePolicyScheduled: null }
}

/** One set of limits both apps enforce on save. */
export const PAYROLL_POLICY_LIMITS = {
  paidHours: { min: 1, max: 12 },
  breakMinutes: { min: 0, max: 120 },
  multiplier: { min: 1, max: 3 },
} as const

function inRange(value: unknown, limits: { min: number; max: number }): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= limits.min && value <= limits.max
}

function validClock(value: unknown): number | null {
  const raw = String(value ?? '').trim()
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return null
  return parseClockMinutes(raw)
}

/** Save check for a working-hours policy. Null when it is valid. */
export function validatePayrollTimePolicy(policy: OrgPayrollTimePolicy): string | null {
  const { paidHours, breakMinutes, multiplier } = PAYROLL_POLICY_LIMITS
  const clocks = [
    ['standardDayStart', 'Standard day start'],
    ['standardDayEnd', 'Standard day end'],
    ['breakWindowStart', 'Break window start'],
    ['breakWindowEnd', 'Break window end'],
  ] as const
  for (const [field, label] of clocks) {
    if (validClock(policy[field]) == null) return `${label} must be a valid 24h time (e.g. 07:30).`
  }
  const dayStart = validClock(policy.standardDayStart) as number
  const dayEnd = validClock(policy.standardDayEnd) as number
  const breakStart = validClock(policy.breakWindowStart) as number
  const breakEnd = validClock(policy.breakWindowEnd) as number
  if (dayEnd <= dayStart) return 'Standard day end must be after the start time.'
  if (breakEnd <= breakStart) return 'Break window end must be after the break start.'
  if (breakStart < dayStart || breakEnd > dayEnd) return 'Break window must fall within the working day.'
  if (!inRange(policy.standardPaidHours, paidHours)) {
    return `Standard paid hours must be between ${paidHours.min} and ${paidHours.max}.`
  }
  if (!inRange(policy.unpaidBreakMinutes, breakMinutes)) {
    return `Break length must be between ${breakMinutes.min} and ${breakMinutes.max} minutes.`
  }
  if (!inRange(policy.weekdayOutsideStandardMultiplier, multiplier)) {
    return `Weekday overtime rate must be between ×${multiplier.min} and ×${multiplier.max}.`
  }
  const weekend: Array<[string, WeekendPayrollSettings]> = [['Saturday', policy.saturday]]
  if (!policy.sunday.sameAsSaturday) weekend.push(['Sunday', policy.sunday])
  for (const [name, settings] of weekend) {
    if (settings.allHoursAtMultiplierMode) {
      if (!inRange(settings.allHoursMultiplier, multiplier)) {
        return `${name} rate must be between ×${multiplier.min} and ×${multiplier.max}.`
      }
      continue
    }
    const start = validClock(settings.definedWindowStart)
    const end = validClock(settings.definedWindowEnd)
    if (start == null || end == null) return `${name} window must use valid 24h times.`
    if (end <= start) return `${name} window end must be after the start.`
    if (settings.countsAsStandardHours != null && !inRange(settings.countsAsStandardHours, paidHours)) {
      return `${name} counts-as hours must be between ${paidHours.min} and ${paidHours.max}.`
    }
    if (!inRange(settings.outsideWindowMultiplier, multiplier)) {
      return `${name} rate outside the window must be between ×${multiplier.min} and ×${multiplier.max}.`
    }
  }
  return null
}

/**
 * The working week is fixed: Monday to Sunday, with Monday–Friday the working days.
 * Saturday and Sunday count only where a setting says so (Include weekends toggles,
 * weekend pay rules). There is no organisation setting for this.
 */
export const WORKING_WEEK = {
  firstDay: 'monday',
  lastDay: 'sunday',
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
} as const

/** ISO weekday 1 (Monday) … 7 (Sunday). True for Monday–Friday. */
export function isStandardWorkingWeekday(isoWeekday: number): boolean {
  return Number.isInteger(isoWeekday) && isoWeekday >= 1 && isoWeekday <= 5
}

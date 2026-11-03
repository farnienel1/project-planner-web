/**
 * Working hours over time: the policy in effect on a day, "apply from today" and
 * "schedule from a date" writes, the one set of limits, and the fixed working week.
 *
 * Fields on `organizations/{orgId}` (unchanged names, iOS-decodable; 1.19.0 adds the last two):
 * - `payrollTimePolicy` — the current policy.
 * - `payrollTimePolicyPrior` — the policy for days before `payrollTimePolicyEffectiveFrom`.
 * - `payrollTimePolicyEffectiveFrom` — `YYYY-MM-DD` day key in the organisation zone.
 * - `payrollTimePolicyScheduled` — `{ policy, effectiveFrom: 'YYYY-MM-DD' }`, a queued future change.
 * - `payrollTimePolicyHistory` — append-only `{ effectiveFrom: 'YYYY-MM-DD', policy }[]`: the rules from each day on.
 *   Never rewritten or trimmed (one entry is about 1 KB, so the 1 MiB document limit is several hundred changes away;
 *   no cap is applied).
 * - `payrollTimePolicyRevision` — a counter every working-hours write bumps; saves run in a transaction and are
 *   refused when it moved (`payrollTimePolicySaveConflict`).
 *
 * A scheduled change counts from its `effectiveFrom` day on, whether or not any app has promoted
 * it into `payrollTimePolicy` yet, so neither app needs an in-memory promotion. Writes promote a
 * due scheduled change before changing anything, and never cancel a future one silently.
 * Day keys use `organizationTimeZone(countryCode)`.
 */
import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { formatClockMinutes, parseClockMinutes, type StandardDayInput } from './engine'
import { weekendFullDayWindow, weekendRuleForIsoWeekday } from './payrollHours'
import {
  PAYROLL_POLICY_LIMITS,
  derivedWeekdayPaidHours,
  parsePayrollPolicy,
  payrollPolicyToFirestore,
  weekendBreakFor,
  withDerivedWeekdayPaidHours,
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

/** Rulebook 1.19.0: one entry of `payrollTimePolicyHistory` — the working hours in effect from `effectiveFrom` on. */
export type PayrollTimePolicyHistoryEntry = {
  /** Organisation-zone `YYYY-MM-DD`. `PAYROLL_POLICY_HISTORY_START` for the rules that applied before any recorded change. */
  effectiveFrom: string
  policy: OrgPayrollTimePolicy
}

export type PayrollTimePolicyState = {
  current: OrgPayrollTimePolicy
  prior: OrgPayrollTimePolicy | null
  effectiveFrom: string | null
  scheduled: PayrollTimePolicyScheduledChange | null
  /**
   * Rulebook 1.19.0: `payrollTimePolicyHistory` as stored (parsed, in date order; entries on the same day keep their
   * stored order and the later one wins). Missing or `[]` for a company with no history yet.
   */
  history?: PayrollTimePolicyHistoryEntry[]
  /** Rulebook 1.19.0: `payrollTimePolicyRevision` (0 when missing). */
  revision?: number
}

/** The `effectiveFrom` of the history entry for the rules in effect before any recorded change. */
export const PAYROLL_POLICY_HISTORY_START = '1970-01-01'

/** Refusal when another admin (or device) changed the working hours after this screen loaded them. */
export const PAYROLL_POLICY_STALE_SAVE_MESSAGE =
  'Someone else changed the working hours while you were editing. Your change was not saved — check the latest working hours and try again.'

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

/**
 * Rulebook 1.19.0: `payrollTimePolicyHistory` read into entries in date order. An entry without a valid day or policy
 * map is skipped; entries on the same day keep their stored order (the later one is the one in effect).
 */
export function parsePayrollTimePolicyHistory(value: unknown, timeZone?: string | null): PayrollTimePolicyHistoryEntry[] {
  if (!Array.isArray(value)) return []
  const entries: Array<PayrollTimePolicyHistoryEntry & { index: number }> = []
  value.forEach((raw, index) => {
    const row = record(raw)
    const policy = record(row?.policy)
    const effectiveFrom = row ? payrollDayKeyFromValue(row.effectiveFrom, timeZone) : null
    if (!policy || !effectiveFrom) return
    entries.push({ effectiveFrom, policy: parsePayrollPolicy(policy), index })
  })
  entries.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : a.index - b.index))
  return entries.map(({ effectiveFrom, policy }) => ({ effectiveFrom, policy }))
}

function parseRevision(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** The stored payroll fields of an organisation document, parsed (1.19.0: with history and revision). */
export function parsePayrollTimePolicyState(orgDoc: unknown, timeZone?: string | null): PayrollTimePolicyState {
  const data = record(orgDoc) ?? {}
  const priorRaw = record(data.payrollTimePolicyPrior)
  return {
    current: parsePayrollPolicy(record(data.payrollTimePolicy)),
    prior: priorRaw ? parsePayrollPolicy(priorRaw) : null,
    effectiveFrom: payrollDayKeyFromValue(data.payrollTimePolicyEffectiveFrom, timeZone),
    scheduled: parsePayrollTimePolicyScheduled(data.payrollTimePolicyScheduled, timeZone),
    history: parsePayrollTimePolicyHistory(data.payrollTimePolicyHistory, timeZone),
    revision: parseRevision(data.payrollTimePolicyRevision),
  }
}

function isState(value: unknown): value is PayrollTimePolicyState {
  const v = record(value)
  return Boolean(v && 'current' in v && 'scheduled' in v && record(v.current))
}

/** Whether `value` is the whole working-hours state (`PayrollTimePolicyState`) rather than one policy. */
export function isPayrollTimePolicyState(value: unknown): value is PayrollTimePolicyState {
  return isState(value)
}

/** ISO weekday (1 Monday … 7 Sunday) of a `YYYY-MM-DD` key — plain calendar arithmetic, zone independent. */
function isoWeekdayOfKey(dayKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim())
  if (!match) return null
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()
  return day === 0 ? 7 : day
}

function isWholePolicy(value: unknown): value is OrgPayrollTimePolicy {
  const v = record(value)
  return Boolean(v && record(v.saturday) && record(v.sunday))
}

/**
 * Rulebook 1.23.1 §4.3, §5: the day a booking's named slot (Full day, AM, PM) is measured against on `dayKey`, for
 * clash, overlap and leave checks. The working hours in effect that day (`standardDayOn`); on a Saturday or Sunday
 * that day's own Full day window (`weekendFullDayWindow`: the set window, or the standard day when the day pays
 * every hour at the multiplier) and its own lunch break (`weekendBreakFor`), never the Monday–Friday day. A bare
 * standard-day input (no weekend rules) is used as given. Pay never reads this: it prices weekends with
 * `payrollHoursResult`.
 */
export function bookingStandardDayOn(
  day: StandardDayInput | OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined
): StandardDayInput | null {
  const resolved = standardDayOn<StandardDayInput>(day, dayKey)
  if (!resolved || !isWholePolicy(resolved) || typeof dayKey !== 'string') return resolved
  const iso = isoWeekdayOfKey(dayKey)
  const weekend = iso === 6 || iso === 7 ? weekendRuleForIsoWeekday(iso, resolved) : null
  if (!weekend) return resolved
  const window = weekendFullDayWindow(resolved, weekend)
  if (!window) return resolved
  const ownBreak = weekendBreakFor(resolved, weekend)
  return {
    standardDayStart: formatClockMinutes(window.start),
    standardDayEnd: formatClockMinutes(window.end),
    breakWindowStart: ownBreak.start,
    breakWindowEnd: ownBreak.end,
  }
}

/**
 * Rulebook 1.23.0 §4.3: the standard day (or whole policy) in effect on `dayKey` for a scan that takes either one
 * policy or the whole state. A state is read per day (`payrollTimePolicyForDayFromState`); a single policy or
 * standard-day input is returned as given (callers and tests that pass one policy keep it for every day); null and
 * undefined stay null.
 */
export function standardDayOn<T>(day: T | PayrollTimePolicyState | null | undefined, dayKey: string | null | undefined): T | OrgPayrollTimePolicy | null {
  if (day == null) return null
  if (isState(day)) {
    const key = typeof dayKey === 'string' && DAY_KEY_RE.test(dayKey.trim()) ? dayKey.trim() : null
    return key ? payrollTimePolicyForDayFromState(day, key) : day.current
  }
  return day as T
}

/**
 * Rulebook 1.19.0: every change of working hours as a list of `{ effectiveFrom, policy }` in date order, the pending
 * scheduled change left out. History first: the stored entries before `payrollTimePolicyEffectiveFrom`, then the
 * current policy from that day (so a save by an older app build, which writes only the four flat fields, still counts
 * from its day). A company with no history reads its prior / current fields as before 1.19.0:
 * `[{ PAYROLL_POLICY_HISTORY_START, prior }, { effectiveFrom, current }]`, or just the current policy.
 * Days before the first entry use the first entry.
 */
export function payrollTimePolicyHistoryEntries(state: PayrollTimePolicyState): PayrollTimePolicyHistoryEntry[] {
  const history = state.history ?? []
  const effectiveFrom = state.effectiveFrom
  const entries = effectiveFrom ? history.filter((entry) => entry.effectiveFrom < effectiveFrom) : history.slice()
  if (entries.length === 0 && state.prior && effectiveFrom) {
    entries.push({ effectiveFrom: PAYROLL_POLICY_HISTORY_START, policy: state.prior })
  }
  if (effectiveFrom) entries.push({ effectiveFrom, policy: state.current })
  else if (entries.length === 0) entries.push({ effectiveFrom: PAYROLL_POLICY_HISTORY_START, policy: state.current })
  return entries
}

/** Policy in effect on `dayKey` from an already-parsed state. */
export function payrollTimePolicyForDayFromState(state: PayrollTimePolicyState, dayKey: string): OrgPayrollTimePolicy {
  if (state.scheduled && dayKey >= state.scheduled.effectiveFrom) return state.scheduled.policy
  const entries = payrollTimePolicyHistoryEntries(state)
  let chosen = entries[0]?.policy ?? state.current
  for (const entry of entries) {
    if (entry.effectiveFrom <= dayKey) chosen = entry.policy
    else break
  }
  return chosen
}

/**
 * The working-hours policy in effect on `dayKey` (organisation-zone `YYYY-MM-DD`): the scheduled policy once its
 * `effectiveFrom` has arrived; otherwise the latest `payrollTimePolicyHistory` entry on or before the day (1.19.0);
 * for a company with no history, the prior policy before `payrollTimePolicyEffectiveFrom` and the current policy after.
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
 * The stored state as it stands on `todayKey`: a due scheduled change is promoted (current = scheduled policy,
 * prior = the policy of the day before it, effectiveFrom = its day, and — 1.19.0 — the history carries every earlier
 * change plus the promoted one). A future scheduled change stays pending. Screens that show "today's" rules read
 * `current`; screens that price other days pass the whole state on.
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
  const settled = { ...state, scheduled: null }
  return {
    current: scheduled.policy,
    prior: payrollTimePolicyForDayFromState(settled, dayBefore),
    effectiveFrom: scheduled.effectiveFrom,
    scheduled: null,
    history: [...payrollTimePolicyHistoryEntries(settled), { effectiveFrom: scheduled.effectiveFrom, policy: scheduled.policy }],
    revision: state.revision ?? 0,
  }
}

function samePolicy(a: OrgPayrollTimePolicy, b: OrgPayrollTimePolicy): boolean {
  return JSON.stringify(payrollPolicyToFirestore(a)) === JSON.stringify(payrollPolicyToFirestore(b))
}

/**
 * The stored history to write, append-only: the stored entries as they are, never rewritten or removed. A company
 * with no history is seeded from its prior / current fields (the first write after 1.19.0, no data lost). When an
 * older app build changed the flat fields after the last entry, the current policy is appended from its day. Then a
 * due scheduled change, then `next` (when given).
 */
function historyToWrite(
  state: PayrollTimePolicyState,
  todayKey: string,
  next: PayrollTimePolicyHistoryEntry | null
): PayrollTimePolicyHistoryEntry[] {
  const stored = state.history ?? []
  const entries: PayrollTimePolicyHistoryEntry[] =
    stored.length === 0 ? payrollTimePolicyHistoryEntries({ ...state, scheduled: null }) : stored.slice()
  if (stored.length > 0 && state.effectiveFrom) {
    const last = stored[stored.length - 1]
    if (last.effectiveFrom < state.effectiveFrom || (last.effectiveFrom === state.effectiveFrom && !samePolicy(last.policy, state.current))) {
      entries.push({ effectiveFrom: state.effectiveFrom, policy: state.current })
    }
  }
  if (state.scheduled && state.scheduled.effectiveFrom <= todayKey) {
    entries.push({ effectiveFrom: state.scheduled.effectiveFrom, policy: state.scheduled.policy })
  }
  if (next) entries.push(next)
  return entries
}

function historyToFirestore(entries: PayrollTimePolicyHistoryEntry[]): Array<Record<string, unknown>> {
  return entries.map((entry) => ({ effectiveFrom: entry.effectiveFrom, policy: payrollPolicyToFirestore(entry.policy) }))
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

function revisionField(state: PayrollTimePolicyState): Record<string, unknown> {
  return { payrollTimePolicyRevision: (state.revision ?? 0) + 1 }
}

/**
 * "Apply from today". `prior` is the policy that was in effect yesterday, so a second save on the same day keeps the
 * real earlier rules. A due scheduled change is consumed; a future one is kept. 1.19.0: appends today's entry to
 * `payrollTimePolicyHistory` (seeding it first when missing) and bumps `payrollTimePolicyRevision`.
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
  // 1.20.0 §4.3: the saved policy derives its weekday paid day (`paidHoursDerived`); the prior and history stay as stored.
  const policy = withDerivedWeekdayPaidHours(input.policy)
  const fields: Record<string, unknown> = {
    payrollTimePolicy: payrollPolicyToFirestore(policy),
    payrollTimePolicyPrior: payrollPolicyToFirestore(prior),
    payrollTimePolicyEffectiveFrom: input.todayKey,
    payrollTimePolicyHistory: historyToFirestore(
      historyToWrite(state, input.todayKey, { effectiveFrom: input.todayKey, policy })
    ),
    ...revisionField(state),
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
 * "Schedule from a date". Replaces any pending future change (the one pending change is not history). A change that
 * is already due is first promoted into the current policy and the history so it is not lost. Returns null when the
 * date is invalid. 1.19.0: seeds the history when missing and bumps the revision.
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
      // 1.20.0 §4.3: the scheduled policy derives its weekday paid day (`paidHoursDerived`).
      policy: payrollPolicyToFirestore(withDerivedWeekdayPaidHours(input.policy)),
      effectiveFrom: input.effectiveFrom,
    },
    payrollTimePolicyHistory: historyToFirestore(historyToWrite(state, input.todayKey, null)),
    ...revisionField(state),
  }
}

/**
 * Cancel a pending future change. Promotes a due one first so it is not lost. Never removes a history entry (1.19.0);
 * seeds the history when missing and bumps the revision.
 */
export function payrollTimePolicyCancelScheduleWriteFields(input: {
  orgDoc: unknown
  todayKey: string
  timeZone?: string | null
}): Record<string, unknown> {
  const tz = zone(input.timeZone)
  const state = parsePayrollTimePolicyState(input.orgDoc, tz)
  const promoted = promotedFields(state, input.todayKey, tz)
  return {
    ...(Object.keys(promoted).length > 0 ? promoted : { payrollTimePolicyScheduled: null }),
    payrollTimePolicyHistory: historyToFirestore(historyToWrite(state, input.todayKey, null)),
    ...revisionField(state),
  }
}

/**
 * Rulebook 1.19.0: the two-admin guard. `baseOrgDoc` is the organisation document the screen showed when the admin
 * started editing (or pressed Cancel on the pending change); `liveOrgDoc` is the document read inside the save's
 * transaction. When the working hours changed in between — a different `payrollTimePolicyRevision`, or different
 * stored rules (an older build that does not bump the revision) — the save is refused with
 * `PAYROLL_POLICY_STALE_SAVE_MESSAGE`, so one admin cannot silently replace or cancel another's change. Null when it
 * is safe to write.
 */
export function payrollTimePolicySaveConflict(
  baseOrgDoc: unknown,
  liveOrgDoc: unknown,
  timeZone?: string | null
): string | null {
  const tz = zone(timeZone)
  const fingerprint = (doc: unknown): string => {
    const state = parsePayrollTimePolicyState(doc, tz)
    return JSON.stringify({
      revision: state.revision ?? 0,
      current: payrollPolicyToFirestore(state.current),
      prior: state.prior ? payrollPolicyToFirestore(state.prior) : null,
      effectiveFrom: state.effectiveFrom,
      scheduled: state.scheduled
        ? { effectiveFrom: state.scheduled.effectiveFrom, policy: payrollPolicyToFirestore(state.scheduled.policy) }
        : null,
      history: (state.history ?? []).length,
    })
  }
  return fingerprint(baseOrgDoc) === fingerprint(liveOrgDoc) ? null : PAYROLL_POLICY_STALE_SAVE_MESSAGE
}

/** One set of limits both apps enforce on save. */
// The one set of limits lives beside the policy reader, which clamps to them on read (1.12.0).
export { PAYROLL_POLICY_LIMITS }

function inRange(value: unknown, limits: { min: number; max: number }): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= limits.min && value <= limits.max
}

function validClock(value: unknown): number | null {
  const raw = String(value ?? '').trim()
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return null
  return parseClockMinutes(raw)
}

/**
 * Rulebook 1.20.2 / 1.20.3 §4.3 (owner decisions, 3 Nov): the working day's clock times — weekday start and finish,
 * each weekend day's set-window start and finish — are on a 30-minute step (:00 or :30). Lunch break times have their
 * own 15-minute step (`PAYROLL_BREAK_TIME_STEP_MINUTES`). Booking custom times keep their own 15-minute step.
 */
export const PAYROLL_POLICY_TIME_STEP_MINUTES = 30
export const PAYROLL_POLICY_TIME_STEP_MESSAGE = 'Working hours use 30-minute steps (e.g. 07:30).'

/**
 * Rulebook 1.20.3 §4.3 (owner decision, final): lunch break start and end (weekday `breakWindowStart` /
 * `breakWindowEnd` and each weekend day's own) and the break LENGTH (`unpaidBreakMinutes`, weekend `breakMinutes`:
 * 0, 15, 30 … 120) are on a 15-minute step — e.g. 10:00–10:45, 45 min.
 */
export const PAYROLL_BREAK_TIME_STEP_MINUTES = 15
export const PAYROLL_BREAK_TIME_STEP_MESSAGE = 'Lunch break times and length use 15-minute steps (e.g. 10:45).'

/** Whether a working-day clock time (start / finish, weekend window) is on the 30-minute step. */
export function payrollPolicyTimeOnStep(value: string | null | undefined): boolean {
  const minutes = validClock(value)
  return minutes != null && minutes % PAYROLL_POLICY_TIME_STEP_MINUTES === 0
}

/** 1.20.3: whether a lunch break clock time (start / end) is on the 15-minute step. */
export function payrollBreakTimeOnStep(value: string | null | undefined): boolean {
  const minutes = validClock(value)
  return minutes != null && minutes % PAYROLL_BREAK_TIME_STEP_MINUTES === 0
}

/** 1.20.3: whether a lunch break length in minutes is on the 15-minute step (0, 15, 30 …). */
export function payrollBreakMinutesOnStep(value: number | null | undefined): boolean {
  const n = Number(value)
  return value != null && Number.isFinite(n) && n % PAYROLL_BREAK_TIME_STEP_MINUTES === 0
}

type PolicyStepValue = { key: string; kind: 'day' | 'breakTime' | 'breakLength'; value: string | number | null | undefined }

/** Every stepped working-hours value the policy uses, with a stable key (weekend rows only when that day uses them). */
function payrollPolicyStepValues(policy: OrgPayrollTimePolicy): PolicyStepValue[] {
  const values: PolicyStepValue[] = [
    { key: 'standardDayStart', kind: 'day', value: policy.standardDayStart },
    { key: 'standardDayEnd', kind: 'day', value: policy.standardDayEnd },
    { key: 'breakWindowStart', kind: 'breakTime', value: policy.breakWindowStart },
    { key: 'breakWindowEnd', kind: 'breakTime', value: policy.breakWindowEnd },
    { key: 'unpaidBreakMinutes', kind: 'breakLength', value: policy.unpaidBreakMinutes },
  ]
  const days: Array<['saturday' | 'sunday', WeekendPayrollSettings | undefined]> = [['saturday', policy.saturday]]
  if (!policy.sunday?.sameAsSaturday) days.push(['sunday', policy.sunday])
  for (const [day, settings] of days) {
    if (!settings) continue
    if (!settings.allHoursAtMultiplierMode) {
      values.push({ key: `${day}.definedWindowStart`, kind: 'day', value: settings.definedWindowStart })
      values.push({ key: `${day}.definedWindowEnd`, kind: 'day', value: settings.definedWindowEnd })
    }
    if (settings.breakWindowStart != null) values.push({ key: `${day}.breakWindowStart`, kind: 'breakTime', value: settings.breakWindowStart })
    if (settings.breakWindowEnd != null) values.push({ key: `${day}.breakWindowEnd`, kind: 'breakTime', value: settings.breakWindowEnd })
    if (settings.breakMinutes != null) values.push({ key: `${day}.breakMinutes`, kind: 'breakLength', value: settings.breakMinutes })
  }
  return values
}

function stepValueOnStep(entry: PolicyStepValue): boolean {
  if (entry.kind === 'breakLength') return payrollBreakMinutesOnStep(entry.value as number)
  const value = entry.value as string
  return entry.kind === 'day' ? payrollPolicyTimeOnStep(value) : payrollBreakTimeOnStep(value)
}

function sameStepValue(entry: PolicyStepValue, stored: PolicyStepValue['value']): boolean {
  if (stored == null) return false
  if (entry.kind === 'breakLength') return Number(stored) === Number(entry.value)
  return validClock(stored) === validClock(entry.value)
}

/**
 * 1.20.2 / 1.20.3: the step checks. A stored value that is not on its step (saved before the step applied) is shown as
 * stored and only checked once it is edited: pass the saved policy as `previous` and an unchanged value passes.
 * Working-day times are checked first (30 minutes), then lunch break times and length (15 minutes).
 */
function payrollPolicyTimeStepError(policy: OrgPayrollTimePolicy, previous?: OrgPayrollTimePolicy | null): string | null {
  const before = new Map((previous ? payrollPolicyStepValues(previous) : []).map((entry) => [entry.key, entry.value]))
  const offStep = payrollPolicyStepValues(policy).filter((entry) => {
    if (entry.value == null || String(entry.value).trim() === '') return false
    if (stepValueOnStep(entry)) return false
    return !sameStepValue(entry, before.get(entry.key))
  })
  if (offStep.some((entry) => entry.kind === 'day')) return PAYROLL_POLICY_TIME_STEP_MESSAGE
  if (offStep.length > 0) return PAYROLL_BREAK_TIME_STEP_MESSAGE
  return null
}

/**
 * Save check for a working-hours policy. Null when it is valid. `previous` (1.20.2) is the saved policy, so a value
 * stored off its step (30-minute day times; 1.20.3: 15-minute break times and length) is only refused once it is changed.
 */
export function validatePayrollTimePolicy(policy: OrgPayrollTimePolicy, previous?: OrgPayrollTimePolicy | null): string | null {
  const error = validatePayrollTimePolicyFields(policy)
  return error ?? payrollPolicyTimeStepError(policy, previous)
}

function validatePayrollTimePolicyFields(policy: OrgPayrollTimePolicy): string | null {
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
  if (policy.paidHoursDerived === true) {
    // 1.20.0 §4.3: the weekday paid day is finish − start − the unpaid break; it must still be 1–12 hours.
    const derived = derivedWeekdayPaidHours(policy)
    if (!(derived >= paidHours.min - 1e-9 && derived <= paidHours.max + 1e-9)) {
      return `The working day must give between ${paidHours.min} and ${paidHours.max} paid hours (finish − start − unpaid break).`
    }
  } else if (!inRange(policy.standardPaidHours, paidHours)) {
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
    // 1.19.0: a weekend day's own lunch break has the weekday limits (0–120 minutes; the window forms an interval).
    if (settings.breakMinutes != null && !inRange(settings.breakMinutes, breakMinutes)) {
      return `${name} break length must be between ${breakMinutes.min} and ${breakMinutes.max} minutes.`
    }
    if (settings.breakWindowStart != null || settings.breakWindowEnd != null) {
      const bs = validClock(settings.breakWindowStart ?? policy.breakWindowStart)
      const be = validClock(settings.breakWindowEnd ?? policy.breakWindowEnd)
      if (bs == null || be == null) return `${name} break window must use valid 24h times.`
      if (be <= bs) return `${name} break window end must be after the break start.`
    }
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

/**
 * Rulebook 1.51.0 §4.3 (owner decision 15 Nov): Settings → Working hours "Working hours history" — a read-only list,
 * admins only, the same rows on web and iOS. One row per start date, newest first: the stored history and prior /
 * current rules (`payrollTimePolicyHistoryEntries`, the same entries `effectivePayrollTimePolicy` prices each day
 * with) and a pending scheduled change. Each row: the weekday day (start–finish, break, paid day), the weekday
 * overtime rate, Saturday's rule and Sunday's rule (or "same as Saturday"); the row in effect today is marked
 * (`payrollTimePolicyForDayFromState`). Display only: nothing here is written or changes how a day is priced.
 */

import { weekendBreakFor, weekendCountsAsHours, weekdayPaidHours, type OrgPayrollTimePolicy, type WeekendPayrollSettings } from './organizationSettings'
import { PAYROLL_POLICY_HISTORY_START, payrollTimePolicyHistoryEntries, type PayrollTimePolicyState } from './payrollPolicySchedule'

export type PayrollPolicyHistoryRow = {
  /** The first day the rules apply (`YYYY-MM-DD`); `PAYROLL_POLICY_HISTORY_START` for rules from before records. */
  effectiveFrom: string
  /** "From 3 Nov 2026", "Before 3 Nov 2026" (rules from before records), "Scheduled from 1 Dec 2026". */
  dates: string
  /** "07:00–16:00 · 30 min unpaid break 12:00–12:30 · 8.5h paid day". */
  weekday: string
  /** "Overtime ×1.5". */
  overtime: string
  /** "07:30–14:00 counts as 8h, outside ×1.5 · break 12:00–12:30 paid" or "Every hour ×2 · …". */
  saturday: string
  /** As Saturday, or "Same as Saturday". */
  sunday: string
  /** The row whose rules apply today. */
  inEffectToday: boolean
  /** A pending change (its day has not come yet). */
  scheduled: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayText(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return `${d} ${MONTHS[m - 1] ?? ''} ${y}`
}

function hours(value: number): string {
  return `${Math.round(Number(value) * 100) / 100}h`
}

function times(n: number): string {
  return `×${Math.round(Number(n) * 100) / 100}`
}

function breakText(paid: boolean, minutes: number, start: string, end: string): string {
  if (!(minutes > 0)) return 'no break'
  return `${minutes} min ${paid ? 'paid' : 'unpaid'} break ${start}–${end}`
}

function weekdayText(policy: OrgPayrollTimePolicy): string {
  const minutes = Number(policy.unpaidBreakMinutes) || 0
  const brk = breakText(policy.breakPaid === true, minutes, policy.breakWindowStart, policy.breakWindowEnd)
  return `${policy.standardDayStart}–${policy.standardDayEnd} · ${brk} · ${hours(weekdayPaidHours(policy))} paid day`
}

function weekendText(policy: OrgPayrollTimePolicy, weekend: WeekendPayrollSettings): string {
  const own = weekendBreakFor(policy, weekend)
  // A weekend break with `breakPaid` missing is paid (1.19.0).
  const brk = breakText(weekend.breakPaid !== false, own.minutes, own.start, own.end)
  if (weekend.allHoursAtMultiplierMode) return `Every hour ${times(weekend.allHoursMultiplier ?? 2)} · ${brk}`
  const outside = weekend.outsideWindowMultiplier ?? 1.5
  return `${weekend.definedWindowStart ?? '—'}–${weekend.definedWindowEnd ?? '—'} counts as ${hours(weekendCountsAsHours(weekend, policy))}, outside ${times(outside)} · ${brk}`
}

function rowFor(policy: OrgPayrollTimePolicy, effectiveFrom: string, dates: string, flags: { inEffectToday: boolean; scheduled: boolean }): PayrollPolicyHistoryRow {
  return {
    effectiveFrom,
    dates,
    weekday: weekdayText(policy),
    overtime: `Overtime ${times(policy.weekdayOutsideStandardMultiplier ?? 1.5)}`,
    saturday: weekendText(policy, policy.saturday),
    sunday: policy.sunday?.sameAsSaturday ? 'Same as Saturday' : weekendText(policy, policy.sunday),
    ...flags,
  }
}

/**
 * The Working hours history rows for an organisation's working-hours state (`parsePayrollTimePolicyState` or
 * `payrollTimePolicyTimeline`) on `todayKey` (the organisation-zone day key of today), newest first. See the file header.
 */
export function payrollPolicyHistoryRows(input: { state: PayrollTimePolicyState; todayKey: string }): PayrollPolicyHistoryRow[] {
  const state = input.state
  const today = String(input.todayKey || '')
  const entries = payrollTimePolicyHistoryEntries(state)
  const scheduled = state.scheduled ?? null
  const scheduledInEffect = Boolean(scheduled && scheduled.effectiveFrom <= today)
  // The entry in effect today: the latest on or before today; a day before the first entry uses the first.
  let todayIndex = 0
  entries.forEach((entry, index) => {
    if (entry.effectiveFrom <= today) todayIndex = index
  })
  const rows: PayrollPolicyHistoryRow[] = entries.map((entry, index) => {
    const next = entries[index + 1]?.effectiveFrom ?? scheduled?.effectiveFrom ?? null
    const seed = entry.effectiveFrom === PAYROLL_POLICY_HISTORY_START
    const dates = seed ? (next ? `Before ${dayText(next)}` : 'Since records began') : `From ${dayText(entry.effectiveFrom)}`
    return rowFor(entry.policy, entry.effectiveFrom, dates, { inEffectToday: !scheduledInEffect && index === todayIndex, scheduled: false })
  })
  if (scheduled) {
    rows.push(
      rowFor(scheduled.policy, scheduled.effectiveFrom, `${scheduledInEffect ? 'From' : 'Scheduled from'} ${dayText(scheduled.effectiveFrom)}`, {
        inEffectToday: scheduledInEffect,
        scheduled: !scheduledInEffect,
      })
    )
  }
  return rows.reverse()
}

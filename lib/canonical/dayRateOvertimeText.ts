/**
 * Rulebook 1.61.0 §8 (owner decision 17 Nov): how a day-rate person's overtime line reads on a timesheet and its
 * invoice. Wording only — the amount is always the exact pay as priced (`payForHours`, rounded once to pennies) and is
 * never changed to make the sum match.
 *
 * Before 1.61.0 the line read "0.71 days × £337.50/day = £238.24" (a multiplied day rate). It now reads the sum in
 * hours, with the hourly rate worked out from the day rate and that part's day-rate divisor (`payrollDayRateHours`:
 * the weekday paid day for every overtime part):
 *   "6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)"
 * The hourly rate shown is rounded to pennies, so hours × the shown rate can differ from the amount by a few pence;
 * it is then marked "(rounded)" (owner confirmed 17 Nov).
 *
 * Owner 17 Nov: the text only shows the calculation that is actually used. So this function does no arithmetic of its
 * own (a test walks its syntax tree): the hours come from `multipliedHoursParts` / `payrollMultipliedHours`, the hourly
 * rate from `dayRateHourlyEquivalent`, and the amount is the line's own amount, already priced by `payForHours` before
 * this is called. A caller that cannot build the text (null, or an error) keeps its older wording; the amount never
 * depends on the text.
 */

import { formatMoney } from './money'
import { dayRateHourlyEquivalent, payForHours, roundPennies } from './payRate'
import { multipliedHoursParts, parseMultipliedHoursText, plainHoursText } from './payrollHours'

/** The figures behind the hours part (`payrollMultipliedHours` / `multipliedHoursParts`). */
export type DayRateOvertimeMultipliedHours = {
  clockHours: number
  multiplier: number
  breakHours: number
  paidHours: number
  text: string
}

export type DayRateOvertimeCalcInput = {
  /** Clock hours at the multiplier (`payrollMultipliedHours.clockHours`). Ignored when `multiplied` is given. */
  clockHours: number
  multiplier: number
  /** Unpaid break taken off the multiplied hours as plain hours (1.20.3); 0 or missing for none. */
  breakHours?: number | null
  /** The booking's own `payrollMultipliedHours(result)`, when the caller has it (its figures are shown as given). */
  multiplied?: DayRateOvertimeMultipliedHours | null
  /** The person's day rate (never the multiplied rate). */
  dayRate: number
  /** The day-rate divisor of this part (`payrollDayRateHours`); at least 1 hour. */
  dayRateHours: number
  /** The line's amount as already priced (`payForHours`); shown rounded to pennies, never re-worked out. */
  pay: number
  currency?: string | null
}

export type DayRateOvertimeCalcText = {
  /** "6h × 1.5 = 9h" or "6.5h × 2 − 0.5h break = 12.5h" (`multipliedHoursText`). */
  hoursText: string
  /** "9h × £26.47/h (rounded) = £238.24". */
  payText: string
  /** "£225.00/day ÷ 8.5h = £26.47/h (rounded)" ("(rounded)" only when rounding changed the rate). */
  rateText: string
  /** The hours the line pays, as shown (`multipliedHoursParts.paidHours`). */
  paidHours: number
  /** The amount shown: the line's amount in pennies (`roundPennies(pay)`). */
  pay: number
  /** The amount as shown in the text (`formatMoney`), for a caller's own check. */
  payShown: string
  /** The hourly rate shown, rounded to pennies (`dayRateHourlyEquivalent`). */
  hourlyRate: number
  /** True when the shown hourly rate is rounded (the exact rate has more than two decimals). */
  hourlyRateRounded: boolean
  /** Two lines for a two-line layout: [hours and pay, how the hourly rate is worked out]. */
  lines: [string, string]
  /** One line: "6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)". */
  text: string
}

/** The note a screen may show once instead of marking each rate (mirrors `WEEKLY_REPORT_DAYS_ROUNDED_NOTE`). */
export const DAY_RATE_OVERTIME_ROUNDED_NOTE = 'Hourly rate is rounded; amounts use the exact rate.'

/**
 * Rulebook 1.61.0 §8: the wording of a day-rate overtime line. Null when it cannot be shown in hours (no positive
 * paid hours or day rate, or a divisor below 1 hour) — the caller then keeps its older wording. Formatting only: every
 * figure comes from a rulebook function or the caller (see the file comment).
 */
export function dayRateOvertimeCalcText(input: DayRateOvertimeCalcInput): DayRateOvertimeCalcText | null {
  const multiplied = input.multiplied ?? multipliedHoursParts(input)
  const rate = dayRateHourlyEquivalent(input.dayRate, input.dayRateHours)
  if (!input.multiplied && !(Number(input.multiplier) > 0)) return null
  if (!rate || !(multiplied.clockHours > 0) || !(multiplied.paidHours > 0) || !Number.isFinite(Number(input.pay))) return null
  const currency = input.currency ?? null
  const pay = roundPennies(Number(input.pay))
  const payShown = formatMoney(pay, currency)
  // Owner confirmed 17 Nov: the shown hourly rate is marked "(rounded)" when rounding changed it.
  const hourlyText = `${formatMoney(rate.hourlyRate, currency)}/h${rate.rounded ? ' (rounded)' : ''}`
  const payText = `${plainHoursText(multiplied.paidHours)} × ${hourlyText} = ${payShown}`
  const derivation = `${formatMoney(input.dayRate, currency)}/day ÷ ${plainHoursText(input.dayRateHours)}`
  const rateText = `${derivation} = ${hourlyText}`
  const first = `${multiplied.text} · ${payText}`
  return {
    hoursText: multiplied.text,
    payText,
    rateText,
    paidHours: multiplied.paidHours,
    pay,
    payShown,
    hourlyRate: rate.hourlyRate,
    hourlyRateRounded: rate.rounded,
    lines: [first, rateText],
    text: `${first} (${derivation})`,
  }
}

/** A signed timesheet snapshot line (`weeklyReportOverride.lines[]`) as both apps store it, for the 1.61.0 wording. */
export type SignedDayRateOvertimeLine = {
  isOvertime?: boolean | null
  /** Missing on older snapshots means day rate. */
  payBasis?: string | null
  /** `approved`, `edited`, `declined`, …; an edited or declined line keeps the older wording. */
  decision?: string | null
  /** The hours priced at the multiplier (the collector's `outsideHours`). */
  paidHours: number
  amount: number
  otMultiplier?: number | null
  /** 1.61.0: the person's own day rate at signing (never multiplied, never worked out from the amount). */
  otBaseDayRate?: number | null
  /** 1.61.0: the line's day-rate divisor at signing (`payrollDayRateHours`), never stored days. */
  otDayRateHours?: number | null
  /** The stored details text; a multiplied text ("6.5h × 2 − 0.5h break = 12.5h") gives the clock hours and break. */
  details?: string | null
}

/**
 * Rulebook 1.61.0 §8 (review of #378, S1): the hours wording of a SIGNED day-rate overtime line, or null for the older
 * "days × day rate" wording. Never works a rate out backwards from the signed amount: it needs the day rate and divisor
 * stored on the line at signing (`otBaseDayRate`, `otDayRateHours`), a line that was not edited or declined, and the
 * stored amount to be exactly what the rulebook pays for the stored hours at that rate (`payForHours`) — so an
 * amount-only revision, a line signed before 1.61.0 or any line whose figures do not agree keeps the older wording.
 */
export function signedDayRateOvertimeText(
  line: SignedDayRateOvertimeLine,
  options: { currency?: string | null } = {}
): DayRateOvertimeCalcText | null {
  if (line.isOvertime !== true || line.payBasis === 'hourly') return null
  if (line.decision === 'edited' || line.decision === 'declined') return null
  const multiplier = Number(line.otMultiplier)
  const dayRate = Number(line.otBaseDayRate)
  const divisor = Number(line.otDayRateHours)
  const paidHours = Number(line.paidHours)
  if (!(multiplier > 0) || !(dayRate > 0) || !(divisor >= 1) || !(paidHours > 0) || !Number.isFinite(Number(line.amount))) return null
  const priced = payForHours({ payBasis: 'day', dayRate, paidHours, standardDayHours: divisor, otMultiplier: multiplier })
  if (priced !== roundPennies(Number(line.amount))) return null
  const parsed = parseMultipliedHoursText(line.details)
  if (parsed && parsed.multiplier !== multiplier) return null
  // Second review of #378: both apps' collectors write the multiplied text into an overtime line's details whenever an
  // unpaid break came off the multiplied hours, so details without it mean no break, and the stored paid hours are the
  // clock hours (not back-calculated). Details that mention a break but cannot be read would show back-calculated
  // base hours: the older wording instead.
  if (!parsed && /break/i.test(String(line.details ?? ''))) return null
  const calc = dayRateOvertimeCalcText({
    clockHours: parsed ? parsed.clockHours : paidHours,
    multiplier,
    breakHours: parsed ? parsed.breakHours : 0,
    dayRate,
    dayRateHours: divisor,
    pay: priced,
    currency: options.currency ?? null,
  })
  if (!calc || Math.abs(calc.paidHours - paidHours * multiplier) > 0.005) return null
  return calc
}

/**
 * Rulebook 1.61.0 §8 (owner 17 Nov): the hours wording of a day-rate overtime line must never show a calculation other
 * than the one that pays. These tests prove, over many generated bookings, that every figure in the text comes from
 * the same rulebook outputs as the line's amount (`payrollHoursResult`, `payrollDayRateHours`, `payForHours`), that the
 * text function does no arithmetic of its own, and that the shown hourly rate is the day rate ÷ the divisor in pennies.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import * as R from './index'
import { plainHoursText } from './payrollHours'

type Policy = Parameters<typeof R.payrollHoursResult>[0]['policy']

/** Seeded generator (mulberry32), so a failure is reproducible from its case number. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const MULTIPLIERS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3] as const
const DAY_RATES = [100, 150, 180, 200, 225, 237.5, 240, 250, 275.55, 300, 333.33, 350, 412.17] as const
const PAID_DAYS = [7, 7.5, 8, 8.5, 9, 9.5, 10] as const
const ZONE = 'Europe/London'
const WEEKDAY = '2026-11-10'
const SATURDAY = '2026-11-14'
const SUNDAY = '2026-11-15'

type Case = { policy: Policy; dayKey: string; start: string; end: string; isBreakRemoved: boolean; override: number | null; dayRate: number }

/** One generated booking: a weekday (paid day 7–10h, paid or unpaid break), a set-window Saturday or an every-hour Sunday. */
function generate(seed: number): Case {
  const r = rng(seed)
  const paidDay = pick(r, PAID_DAYS)
  const breakMinutes = pick(r, [0, 30, 60] as const)
  const breakPaid = r() < 0.25
  const startMin = 7 * 60
  const endMin = startMin + paidDay * 60 + (breakPaid ? 0 : breakMinutes)
  const multiplier = pick(r, MULTIPLIERS)
  const weekendBreakUnpaid = r() < 0.5
  const saturday = {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: multiplier,
    definedWindowStart: '07:30',
    definedWindowEnd: '14:00',
    countsAsStandardHours: pick(r, [6, 7, 8] as const),
    outsideWindowMultiplier: multiplier,
    breakPaid: !weekendBreakUnpaid,
    breakMinutes: 30,
    // An unpaid break in the outside hours: taken off the multiplied hours as plain hours (1.20.3).
    breakWindowStart: '15:00',
    breakWindowEnd: '15:30',
  }
  const sunday = { ...saturday, allHoursAtMultiplierMode: true, breakWindowStart: '12:00', breakWindowEnd: '12:30', sameAsSaturday: false }
  const policy = {
    ...R.DEFAULT_PAYROLL_POLICY,
    standardDayStart: clock(startMin),
    standardDayEnd: clock(endMin),
    unpaidBreakMinutes: breakMinutes,
    breakPaid,
    breakWindowStart: '12:00',
    breakWindowEnd: clock(12 * 60 + breakMinutes),
    standardPaidHours: paidDay,
    paidHoursDerived: true,
    weekdayOutsideStandardMultiplier: pick(r, MULTIPLIERS),
    saturday,
    sunday,
  } as unknown as Policy
  const kind = pick(r, ['weekday', 'weekday', 'weekday', 'saturday', 'sunday'] as const)
  const quarter = (from: number, to: number) => from + 15 * Math.floor(r() * ((to - from) / 15 + 1))
  if (kind === 'weekday') {
    const early = r() < 0.3
    const start = early ? quarter(4 * 60, startMin - 15) : startMin
    const end = quarter(endMin + 15, 23 * 60)
    return { policy, dayKey: WEEKDAY, start: clock(start), end: clock(end), isBreakRemoved: r() < 0.2, override: r() < 0.6 ? multiplier : null, dayRate: pick(r, DAY_RATES) }
  }
  if (kind === 'saturday') {
    return { policy, dayKey: SATURDAY, start: '07:30', end: clock(quarter(14 * 60 + 15, 20 * 60)), isBreakRemoved: r() < 0.2, override: r() < 0.5 ? multiplier : null, dayRate: pick(r, DAY_RATES) }
  }
  const start = quarter(6 * 60, 10 * 60)
  return { policy, dayKey: SUNDAY, start: clock(start), end: clock(quarter(start + 60, 18 * 60)), isBreakRemoved: r() < 0.2, override: null, dayRate: pick(r, DAY_RATES) }
}

/** The overtime line exactly as the timesheet collector prices it, and the text built from the same outputs. */
function priced(c: Case) {
  const result = R.payrollHoursResult({
    booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: c.start, workEndTime: c.end, isBreakRemoved: c.isBreakRemoved, ...(c.override != null ? { otMultiplierOverride: c.override } : {}) },
    dayKey: c.dayKey,
    policy: c.policy,
    timeZone: ZONE,
  })
  const divisor = R.payrollDayRateHours({ policy: c.policy, dayKey: c.dayKey, timeZone: ZONE }).overtimeDayHours
  const pay = R.payForHours({ payBasis: 'day', dayRate: c.dayRate, paidHours: result.outsideHours, standardDayHours: divisor, otMultiplier: result.outsideMultiplier })
  const multiplied = R.payrollMultipliedHours(result)
  const calc = multiplied
    ? R.dayRateOvertimeCalcText({ ...multiplied, multiplied, dayRate: c.dayRate, dayRateHours: divisor, pay, currency: 'GBP' })
    : null
  return { result, divisor, pay, multiplied, calc }
}

/** The numbers printed in a text ("£1,234.50" → 1234.5). */
const numbersIn = (text: string) => (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, '')))
const hundredths = (n: number) => Math.round(n * 100) / 100

const CASES = 4000

test('1.61.0 property: the overtime text shows the calculation that pays, over many bookings', () => {
  let shown = 0
  const multipliersSeen = new Set<number>()
  const daysSeen = new Set<string>()
  for (let seed = 1; seed <= CASES; seed += 1) {
    const c = generate(seed)
    const { result, divisor, pay, multiplied, calc } = priced(c)
    const where = `case ${seed}: ${c.dayKey} ${c.start}–${c.end} ×${result.outsideMultiplier} £${c.dayRate}/day`
    if (!(result.outsideHours > 0)) {
      assert.equal(multiplied, null, where)
      continue
    }
    assert.ok(multiplied, where)
    assert.ok(calc, `${where}: a positive overtime part always has a text`)
    shown += 1
    multipliersSeen.add(result.outsideMultiplier)
    daysSeen.add(c.dayKey)
    // The divisor is the one pay used (`payrollHoursResult.overtimePartDayHours`, `payrollDayRateHours`).
    assert.equal(divisor, result.overtimePartDayHours, where)
    // The £ at the end is the line amount exactly.
    assert.equal(calc.pay, pay, where)
    assert.equal(calc.payShown, R.formatMoney(pay, 'GBP'), where)
    assert.ok(calc.text.includes(`= ${R.formatMoney(pay, 'GBP')} (`), `${where}: ${calc.text}`)
    // The hours sum shown is the overtime paid hours: the hours pay priced × the multiplier (= clock × N − break).
    assert.ok(Math.abs(calc.paidHours - result.outsideHours * result.outsideMultiplier) < 1e-9, `${where}: ${calc.paidHours}`)
    assert.ok(calc.text.startsWith(`${multiplied.text} · ${plainHoursText(calc.paidHours)} × `), `${where}: ${calc.text}`)
    assert.ok(multiplied.text.endsWith(`= ${plainHoursText(calc.paidHours)}`), `${where}: ${multiplied.text}`)
    // The rounded hourly rate is the day rate ÷ the divisor in pennies.
    assert.equal(calc.hourlyRate, R.roundPennies(c.dayRate / divisor), where)
    // Every number printed is one of the rulebook outputs (or the day rate it was priced with).
    const allowed = new Set(
      [multiplied.clockHours, multiplied.multiplier, multiplied.breakHours, multiplied.paidHours, calc.hourlyRate, pay, c.dayRate, divisor].map(hundredths)
    )
    for (const n of numbersIn(calc.text)) assert.ok(allowed.has(hundredths(n)), `${where}: ${n} in "${calc.text}" is not a rulebook output`)
    // Pay is never priced from the rounded rate: the amount equals payForHours on the exact hours.
    assert.equal(pay, R.roundPennies(c.dayRate * (result.outsideHours / divisor) * result.outsideMultiplier), where)
  }
  assert.ok(shown > CASES / 2, `most generated bookings have overtime (${shown})`)
  assert.equal(multipliersSeen.size, MULTIPLIERS.length, 'every multiplier 1–3 in 0.25 steps was exercised')
  assert.deepEqual([...daysSeen].sort(), [WEEKDAY, SATURDAY, SUNDAY].sort(), 'weekday, set-window Saturday and every-hour Sunday')
})

test('1.61.0 property: the rounded hourly rate is always dayRate ÷ divisor in pennies', () => {
  const r = rng(61)
  for (let i = 0; i < 20000; i += 1) {
    const dayRate = Math.round(r() * 100000) / 100 + 0.01
    const divisor = 1 + Math.round(r() * 44) / 4
    const eq = R.dayRateHourlyEquivalent(dayRate, divisor)
    assert.ok(eq)
    assert.equal(eq.hourlyRate, R.roundPennies(dayRate / divisor), `${dayRate} ÷ ${divisor}`)
    assert.equal(eq.rounded, Math.abs(dayRate / divisor - R.roundPennies(dayRate / divisor)) > 1e-9)
    const calc = R.dayRateOvertimeCalcText({ clockHours: 2, multiplier: 1.5, dayRate, dayRateHours: divisor, pay: 1, currency: 'GBP' })
    assert.equal(calc?.hourlyRate, eq.hourlyRate)
  }
  // Exactly half a penny (225 ÷ 8 = 28.125) rounds up, as roundPennies does.
  assert.equal(R.dayRateHourlyEquivalent(225, 8)?.hourlyRate, 28.13)
  assert.equal(R.dayRateHourlyEquivalent(0, 8), null)
  assert.equal(R.dayRateHourlyEquivalent(225, 0.5), null)
  assert.equal(R.dayRateHourlyEquivalent(225, Number.POSITIVE_INFINITY), null)
})

// MARK: - No arithmetic in the text function

/** Calls the text function may make: rulebook figures and formatting only. */
const ALLOWED_CALLS = new Set(['multipliedHoursParts', 'dayRateHourlyEquivalent', 'roundPennies', 'formatMoney', 'plainHoursText', 'Number', 'Number.isFinite'])
const ARITHMETIC = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
])

/** Every arithmetic expression or non-allowed call in the body of `name` in `source`. */
function arithmeticIn(source: string, name: string): string[] {
  const file = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true)
  let fn: ts.FunctionDeclaration | undefined
  file.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) fn = node
  })
  assert.ok(fn?.body, `${name} found`)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && ARITHMETIC.has(node.operatorToken.kind)) found.push(node.getText())
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && node.operator !== ts.SyntaxKind.ExclamationToken)
      found.push(node.getText())
    if (ts.isCallExpression(node) && !ALLOWED_CALLS.has(node.expression.getText())) found.push(node.getText())
    if (ts.isIdentifier(node) && node.text === 'Math') found.push(node.getText())
    ts.forEachChild(node, visit)
  }
  visit(fn.body)
  return found
}

test('1.61.0: the overtime text function does no arithmetic of its own (formatting only)', () => {
  const source = readFileSync(new URL('./dayRateOvertimeText.ts', import.meta.url), 'utf8')
  assert.deepEqual(arithmeticIn(source, 'dayRateOvertimeCalcText'), [])
  // The check itself works: it catches a sum, a division, a negation and a Math call.
  const broken = source.replace(
    'const pay = roundPennies(Number(input.pay))',
    'const pay = Math.round(Number(input.pay) * 100) / 100 - -0 + rate.exactRate'
  )
  assert.notEqual(broken, source)
  const caught = arithmeticIn(broken, 'dayRateOvertimeCalcText')
  assert.ok(caught.some((t) => t.includes('*')), caught.join(' | '))
  assert.ok(caught.some((t) => t.startsWith('Math.round')), caught.join(' | '))
  assert.ok(caught.includes('-0'), caught.join(' | '))
})

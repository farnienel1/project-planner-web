/**
 * Rulebook 1.67.0 §8 (owner 17 Nov): the amount of a day-rate overtime line is priced first (`payForHours`) and the
 * hours wording only shows it. A text that cannot be built, throws, or would not show the line's own hours and amount
 * never blocks or changes the amount: the line falls back to the older wording.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { dayRateOvertimeTextOrNull, money, payForHours, payLineDisplay, roundPennies } from './payBasis.ts'

const OLD_WORDING = /days? × £/

function line(over: Partial<Parameters<typeof payLineDisplay>[0]> = {}) {
  // Owner example: £225/day, 8.5h paid day, 6h at ×1.5 → £238.24, priced before any text is built.
  const pay = payForHours({ payBasis: 'day', dayRate: 225, paidHours: 6, standardDayHours: 8.5, otMultiplier: 1.5 })
  return { pay, display: payLineDisplay({ payBasis: 'day', paidHours: 6, standardDayHours: 8.5, rate: 337.5, pay, isOvertime: true, otMultiplier: 1.5, currencyCode: 'GBP', baseRate: 225, ...over }) }
}

test('1.67.0: a day-rate overtime line shows the hours wording built from its own amount', () => {
  const { pay, display } = line()
  assert.equal(pay, 238.24)
  assert.equal(display.equation, '6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)')
  assert.equal(display.pay, pay)
})

test('1.67.0: the amount is the same whether the text is built or falls back', () => {
  const { pay, display } = line()
  // Divisor below 1 hour: no text (the rulebook refuses), older wording, same amount.
  const noDivisor = payLineDisplay({ payBasis: 'day', paidHours: 6, standardDayHours: 0, rate: 337.5, pay, isOvertime: true, otMultiplier: 1.5, currencyCode: 'GBP' })
  assert.match(noDivisor.equation, OLD_WORDING)
  assert.equal(noDivisor.pay, display.pay)
  // The text function throws (a clock-hours value that cannot be read): the older wording, the amount unchanged.
  const throwing = { valueOf() { throw new Error('boom') } } as unknown as number
  const thrown = line({ clockHours: throwing })
  assert.match(thrown.display.equation, OLD_WORDING)
  assert.equal(thrown.display.pay, thrown.pay)
  assert.ok(thrown.display.equation.endsWith(`= ${money(thrown.pay, 'GBP')}`))
})

test('1.67.0: a text whose hours or amount would not match the line is never shown', () => {
  // Clock hours that disagree with the hours pay priced (9h ≠ 6h × 1.5 would be 13.5h): older wording.
  const wrongHours = line({ clockHours: 9, breakHours: 0 })
  assert.match(wrongHours.display.equation, OLD_WORDING)
  assert.equal(wrongHours.display.pay, wrongHours.pay)
  // Not a finite amount: no text.
  assert.equal(dayRateOvertimeTextOrNull({ paidHours: 6, multiplier: 1.5, dayRate: 225, standard: 8.5, pay: Number.NaN }), null)
  // A good line passes the same check.
  const good = dayRateOvertimeTextOrNull({ paidHours: 6, multiplier: 1.5, dayRate: 225, standard: 8.5, pay: 238.24, currencyCode: 'GBP' })
  assert.equal(good?.pay, 238.24)
  assert.equal(good?.paidHours, 9)
})

test('1.67.0: the shown hourly rate is the person’s day rate ÷ divisor, even when rate ÷ N is not exact', () => {
  // 237.33 × 1.25 ÷ 1.25 need not give back 237.33 exactly in binary; the collector passes the person's own rate.
  const dayRate = 237.33
  const multiplier = 1.25
  const pay = payForHours({ payBasis: 'day', dayRate, paidHours: 3, standardDayHours: 8, otMultiplier: multiplier })
  const display = payLineDisplay({ payBasis: 'day', paidHours: 3, standardDayHours: 8, rate: dayRate * multiplier, pay, isOvertime: true, otMultiplier: multiplier, currencyCode: 'GBP', baseRate: dayRate })
  assert.ok(display.equation.includes(`× ${money(roundPennies(dayRate / 8), 'GBP')}/h`), display.equation)
  assert.ok(display.equation.endsWith(`(${money(dayRate, 'GBP')}/day ÷ 8h)`), display.equation)
  assert.equal(display.pay, pay)
})

test('1.67.0 review (SF1): a live line whose decided amount differs from what its hours pay keeps the older wording', () => {
  // Edit hours revised the line to £300 while the hours shown stay 6h × 1.5 at £225/day ÷ 8.5h (which pays £238.24).
  const revised = line({ pay: 300 })
  assert.match(revised.display.equation, OLD_WORDING)
  assert.equal(revised.display.pay, 300)
  assert.ok(revised.display.equation.endsWith(`= ${money(300, 'GBP')}`))
  // A penny off is refused as well: the shown sum must price to the amount exactly.
  assert.equal(dayRateOvertimeTextOrNull({ paidHours: 6, multiplier: 1.5, dayRate: 225, standard: 8.5, pay: 238.25, currencyCode: 'GBP' }), null)
  assert.equal(dayRateOvertimeTextOrNull({ paidHours: 6, multiplier: 1.5, dayRate: 225, standard: 8.5, pay: 238.24, currencyCode: 'GBP' })?.pay, 238.24)
})

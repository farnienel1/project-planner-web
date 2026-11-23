/**
 * Rulebook 1.69.0 §4.3 (owner request 17 Nov): `bookingHoursBreakdownRows` / `bookingHoursBreakdownDays` — the simple
 * hours breakdown on every booking screen, web and iOS. Wording only: every figure must be the pay rule's
 * (`payrollHoursResult`) and Normal + Overtime must equal Total, which is the Save button's figure (`saveHoursLabel`).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingHoursBreakdownDays, bookingHoursBreakdownRows, type BookingHoursBreakdownBooking } from './bookingHoursBreakdown'
import { payrollHoursResult } from './payrollHours'
import { saveHoursLabel } from './bookingHoursText'
import type { OrgPayrollTimePolicy } from './organizationSettings'

const ZONE = 'Europe/London'
const TUE = '2026-11-17'
const WED = '2026-11-18'
const SAT = '2026-11-21'
const SUN = '2026-11-22'

/** The reference organisation: 07:00–16:00, 30 min unpaid break, overtime ×1.5; Saturday every hour ×1.5, Sunday ×2 with an unpaid break. */
const org = {
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  breakWindowStart: '11:30',
  breakWindowEnd: '12:00',
  weekdayOutsideStandardMultiplier: 1.5,
  saturday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 1.5, definedWindowStart: '07:30', definedWindowEnd: '14:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2, sameAsSaturday: false },
  sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false, breakPaid: false },
} as unknown as OrgPayrollTimePolicy

/** A set-window Saturday: 07:30–14:00 counts as 8h, outside ×2, its own unpaid break 12:00–12:30. */
const windowOrg = {
  ...(org as object),
  saturday: { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '14:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2, breakPaid: false, breakWindowStart: '12:00', breakWindowEnd: '12:30', breakMinutes: 30 },
} as unknown as OrgPayrollTimePolicy

function rows(policy: OrgPayrollTimePolicy, day: string, booking: BookingHoursBreakdownBooking) {
  const out = bookingHoursBreakdownRows(policy, day, booking, ZONE)
  assert.ok(out)
  // Normal + Overtime = Total = the pay rule's total = the Save button, for every variant.
  const paid = payrollHoursResult({ booking: { timeSlot: 'CUSTOM_HOURS', ...booking }, dayKey: day, policy, timeZone: ZONE })
  assert.equal(out.totalPaidHours, Math.round(paid.totalPaidHours * 100) / 100)
  assert.equal(Math.round((out.normalPaidHours + out.overtimePaidHours) * 100) / 100, out.totalPaidHours)
  const shown = out.rows.filter((row) => row.kind !== 'total').reduce((sum, row) => sum + row.hours, 0)
  assert.equal(Math.round(shown * 100) / 100, out.totalPaidHours)
  assert.equal(out.rows[out.rows.length - 1].value, `${out.totalPaidHours}h`)
  assert.equal(saveHoursLabel(out.totalPaidHours), `Save · ${out.totalPaidHours} hours`)
  return out
}

const view = (out: ReturnType<typeof rows>) => out.rows.map((row) => [row.label, ...row.details, row.value])

test('1.69.0 reference: weekday with overtime', () => {
  const out = rows(org, TUE, { workStartTime: '06:00', workEndTime: '17:30' })
  assert.equal(out.summary, '06:00–17:30 · 12.25 paid hours')
  assert.equal(out.headerDetail, 'Tuesday, full day')
  assert.deepEqual(view(out), [
    ['Normal hours', '07:00–16:00, less 30 min break', '8.5h'],
    ['Overtime', '06:00–07:00 and 16:00–17:30', '2.5h at ×1.5', '3.75h'],
    ['Total paid hours', '12.25h'],
  ])
  assert.equal(out.rows[1].accessibilityLabel, 'Overtime, 06:00 to 07:00 and 16:00 to 17:30, 2.5 hours at 1.5 times, 3.75 hours')
})

test('1.69.0 reference: no overtime hides the Overtime row', () => {
  const out = rows(org, TUE, { workStartTime: '07:00', workEndTime: '16:00' })
  assert.equal(out.summary, '07:00–16:00 · 8.5 paid hours')
  assert.deepEqual(view(out), [['Normal hours', '07:00–16:00, less 30 min break', '8.5h'], ['Total paid hours', '8.5h']])
})

test('1.69.0 reference: break turned off drops "less 30 min break"', () => {
  const out = rows(org, TUE, { workStartTime: '06:00', workEndTime: '17:30', isBreakRemoved: true })
  assert.deepEqual(view(out), [
    ['Normal hours', '07:00–16:00', '9h'],
    ['Overtime', '06:00–07:00 and 16:00–17:30', '2.5h at ×1.5', '3.75h'],
    ['Total paid hours', '12.75h'],
  ])
})

test('1.69.0 reference: Saturday paid every hour at a multiplier hides the Normal row', () => {
  const out = rows(org, SAT, { workStartTime: '08:00', workEndTime: '13:00' })
  assert.equal(out.headerDetail, 'Saturday, every hour is overtime')
  assert.deepEqual(view(out), [['Overtime', '08:00–13:00', '5h at ×1.5', '7.5h'], ['Total paid hours', '7.5h']])
})

test("1.69.0 reference: the booking's own ×2 rate", () => {
  const out = rows(org, TUE, { workStartTime: '06:00', workEndTime: '17:30', otMultiplierOverride: 2 })
  assert.deepEqual(view(out), [
    ['Normal hours', '07:00–16:00, less 30 min break', '8.5h'],
    ['Overtime', '06:00–07:00 and 16:00–17:30', '2.5h at ×2', '5h'],
    ['Total paid hours', '13.5h'],
  ])
})

test('1.69.0: a set-window Saturday — full window, part of it, and hours outside it (1.49.0)', () => {
  const full = rows(windowOrg, SAT, { workStartTime: '07:30', workEndTime: '14:00' })
  assert.equal(full.headerDetail, 'Saturday, full day 07:30–14:00 counts as 8h')
  assert.deepEqual(view(full), [['Normal hours', '07:30–14:00, counts as a full day, unpaid break allowed for', '8h'], ['Total paid hours', '8h']])
  const part = rows(windowOrg, SAT, { workStartTime: '07:30', workEndTime: '11:00' })
  assert.deepEqual(view(part), [
    ['Normal hours', '07:30–11:00, part of the 07:30–14:00 window, pro rata (unpaid break not counted)', '4.67h'],
    ['Total paid hours', '4.67h'],
  ])
  const outside = rows(windowOrg, SAT, { workStartTime: '07:30', workEndTime: '16:00' })
  assert.deepEqual(view(outside), [
    ['Normal hours', '07:30–14:00, counts as a full day, unpaid break allowed for', '8h'],
    ['Overtime', '14:00–16:00', '2h at ×2', '4h'],
    ['Total paid hours', '12h'],
  ])
})

test('1.69.0: a Sunday every hour at ×2 with an unpaid break in the multiplied hours', () => {
  const out = rows(org, SUN, { workStartTime: '07:30', workEndTime: '14:00' })
  assert.equal(out.headerDetail, 'Sunday, every hour is overtime')
  assert.deepEqual(view(out), [['Overtime', '07:30–14:00', '6.5h at ×2 − 0.5h break', '12.5h'], ['Total paid hours', '12.5h']])
})

test('1.69.0: a stored AM and a full day read by their slot', () => {
  const am = bookingHoursBreakdownRows(org, TUE, { timeSlot: 'AM' }, ZONE)
  assert.ok(am)
  assert.equal(am.headerDetail, 'Tuesday, half day (AM)')
  assert.equal(am.summary, 'AM · 4.25 paid hours')
  assert.deepEqual(view(am as never), [['Normal hours', '07:00–11:30', '4.25h'], ['Total paid hours', '4.25h']])
  const full = bookingHoursBreakdownRows(org, TUE, { timeSlot: 'FULL DAY' }, ZONE)
  assert.ok(full)
  assert.equal(full.summary, 'Full day · 8.5 paid hours')
})

test('1.69.0: an overnight booking is overtime past midnight at its start day rules', () => {
  const out = rows(org, TUE, { workStartTime: '22:00', workEndTime: '06:00' })
  assert.deepEqual(view(out), [['Overtime', '22:00–06:00', '8h at ×1.5', '12h'], ['Total paid hours', '12h']])
})

test('1.69.0: a booking inside the unpaid break says why it pays 0', () => {
  const out = rows(org, TUE, { workStartTime: '11:30', workEndTime: '12:00' })
  assert.deepEqual(view(out), [['Normal hours', '11:30–12:00, inside the unpaid break', '0h'], ['Total paid hours', '0h']])
})

test('1.69.0: several days share a group when they read the same; invalid input is null', () => {
  const same = bookingHoursBreakdownDays(org, [WED, TUE, TUE], { workStartTime: '06:00', workEndTime: '17:30' }, ZONE)
  assert.ok(same)
  assert.equal(same.groups.length, 1)
  assert.equal(same.groups[0].headerDetail, 'Tuesday/Wednesday, full day')
  assert.deepEqual(same.groups[0].dayKeys, [TUE, WED])
  assert.equal(same.summary, '06:00–17:30 · 12.25 paid hours')
  const mixed = bookingHoursBreakdownDays(org, [SAT, SUN], { workStartTime: '08:00', workEndTime: '13:00' }, ZONE)
  assert.ok(mixed)
  assert.equal(mixed.groups.length, 2)
  assert.equal(mixed.summary, '08:00–13:00 · paid hours vary by day')
  assert.equal(bookingHoursBreakdownRows(org, TUE, { workStartTime: '08:00', workEndTime: '08:00' }, ZONE), null)
  assert.equal(bookingHoursBreakdownRows(null, TUE, { workStartTime: '08:00', workEndTime: '09:00' }, ZONE), null)
  assert.equal(bookingHoursBreakdownDays(org, [], { workStartTime: '08:00', workEndTime: '09:00' }, ZONE), null)
})

test('1.69.0: the breakdown never changes the booking it reads (UI only)', () => {
  const booking = { workStartTime: '06:00', workEndTime: '17:30', isBreakRemoved: false, otMultiplierOverride: 2 }
  const before = JSON.stringify(booking)
  bookingHoursBreakdownRows(org, TUE, booking, ZONE)
  bookingHoursBreakdownDays(org, [TUE], booking, ZONE)
  assert.equal(JSON.stringify(booking), before)
})

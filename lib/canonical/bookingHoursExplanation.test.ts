/**
 * Rulebook 1.39.0 §4.3 (owner request 11 Nov): `bookingHoursExplanation` and `bookingShortfall` — the words under every
 * booking picker's hours. Wording only: the figures must equal the pay rule's (`payrollHoursResult`) and the existing
 * `weekendBookingBreakdown` rows.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingHoursExplanation, bookingShortfall } from './bookingHoursExplanation'
import { weekendBookingBreakdown } from './bookingSlots'
import { payrollHoursResult } from './payrollHours'
import type { OrgPayrollTimePolicy } from './organizationSettings'

const ZONE = 'Europe/London'
const SAT = '2026-11-14'
const SUN = '2026-11-15'
const MON = '2026-11-16'

/** The owner's organisation (TestFlight build 2, rules 1.37.0): Saturday and Sunday 07:30–14:00 counts as 8h, outside at 2×. */
const owner = {
  standardDayStart: '07:30',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  standardPaidHours: 8,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  weekdayOutsideStandardMultiplier: 1.5,
  saturday: {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: '07:30',
    definedWindowEnd: '14:00',
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 2,
    sameAsSaturday: false,
  },
  sunday: {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: '07:30',
    definedWindowEnd: '14:00',
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 2,
    sameAsSaturday: true,
  },
} as unknown as OrgPayrollTimePolicy

const sundayEveryHour = {
  ...owner,
  sunday: { ...(owner as any).sunday, sameAsSaturday: false, allHoursAtMultiplierMode: true, breakPaid: false },
} as unknown as OrgPayrollTimePolicy

function explain(policy: OrgPayrollTimePolicy, day: string, start: string, end: string, isBreakRemoved = false) {
  const row = bookingHoursExplanation(policy, day, { workStartTime: start, workEndTime: end, isBreakRemoved }, ZONE)
  assert.ok(row)
  return row
}

test('1.39.0 owner example: Saturday 07:30–10:30 on a 07:30–14:00 window counting 8h explains 3.69h', () => {
  const row = explain(owner, SAT, '07:30', '10:30')
  assert.equal(row.rule, 'Saturday full day: 07:30–14:00 counts as 8h, hours outside it at 2×, paid break 12:00–12:30 (30 min)')
  assert.deepEqual(row.steps, ['Booked 07:30–10:30 = 3h of the 6.5h window → 8h × 3 ÷ 6.5 = 3.69h'])
  assert.equal(row.totalPaidHours, 3.69)
  assert.equal(row.fullDayHours, 8)
})

test('1.39.0 owner example: Saturday 07:30–16:00 = full day + outside hours × 2 = 12h', () => {
  const row = explain(owner, SAT, '07:30', '16:00')
  assert.deepEqual(row.steps, ['07:30–14:00 = 8h (full day, 30 min paid break)', '+ 14:00–16:00 = 2h × 2 = 4h', '→ 12h'])
  assert.equal(row.summary, '07:30–16:00 = 8h (full day, 30 min paid break) + 2h × 2 = 4h → 12h')
  assert.equal(row.totalPaidHours, 12)
  // Sunday "same as Saturday" (the owner's Schedule booking screenshot) reads the same.
  assert.deepEqual(explain(owner, SUN, '07:30', '16:00').steps, row.steps)
})

test('1.39.0: a multiplier-only day says so; an unpaid break is its own deduction', () => {
  const short = explain(sundayEveryHour, SUN, '07:30', '10:30')
  assert.equal(short.kind, 'weekendAllHours')
  assert.equal(short.rule, 'Sunday every hour at 2×, unpaid break 12:00–12:30 (30 min)')
  assert.deepEqual(short.steps, ['07:30–10:30 = 3h × 2 = 6h'])
  assert.equal(short.fullDayHours, null)
  assert.deepEqual(explain(sundayEveryHour, SUN, '07:30', '14:00').steps, ['07:30–14:00 = 6.5h × 2 = 13h', '− 0.5h unpaid break', '→ 12.5h'])
  assert.deepEqual(explain(sundayEveryHour, SUN, '07:30', '14:00', true).steps, ['07:30–14:00 = 6.5h × 2 = 13h'])
})

test('1.39.0: an unpaid Saturday break inside the window comes off the credited hours', () => {
  const unpaid = { ...owner, saturday: { ...(owner as any).saturday, breakPaid: false } } as unknown as OrgPayrollTimePolicy
  assert.deepEqual(explain(unpaid, SAT, '07:30', '14:00').steps, ['07:30–14:00 = 7.5h (full day 8h, less 30 min unpaid break)'])
  assert.deepEqual(explain(unpaid, SAT, '07:30', '13:00').steps, [
    'Booked 07:30–13:00 = 5.5h of the 6.5h window → 8h × 5.5 ÷ 6.5 = 6.77h, less 30 min unpaid break = 6.27h',
  ])
})

test('1.39.0: weekdays get the same kind of line — working day, unpaid break, overtime at the multiplier', () => {
  const full = explain(owner, MON, '07:30', '16:00')
  assert.equal(full.rule, 'Monday full day: 07:30–16:00 − 30 min unpaid break (12:00–12:30) = 8h, hours outside it at 1.5×')
  assert.deepEqual(full.steps, ['07:30–16:00 = 8h (day, less 30 min unpaid break)'])
  assert.deepEqual(explain(owner, MON, '06:30', '18:00').steps, [
    '06:30–07:30 = 1h × 1.5 = 1.5h',
    '+ 07:30–16:00 = 8h (day, less 30 min unpaid break)',
    '+ 16:00–18:00 = 2h × 1.5 = 3h',
    '→ 12.5h',
  ])
  assert.deepEqual(explain(owner, MON, '09:00', '12:00').steps, ['09:00–12:00 = 3h (day)'])
  // Owner example (11 Nov): working day 07:00–16:00, 30 min unpaid break, booked 07:00–22:00.
  const early = { ...owner, standardDayStart: '07:00', breakWindowStart: '11:30', breakWindowEnd: '12:00' } as unknown as OrgPayrollTimePolicy
  assert.equal(explain(early, MON, '07:00', '22:00').summary, '07:00–22:00 = 8.5h (day, less 30 min unpaid break) + 6h × 1.5 = 9h → 17.5h')
  // A paid break the booking covers is named, not deducted; "No unpaid break" on the booking is named too.
  const paid = { ...owner, breakPaid: true } as unknown as OrgPayrollTimePolicy
  assert.deepEqual(explain(paid, MON, '07:30', '16:00').steps, ['07:30–16:00 = 8.5h (day, 30 min paid break)'])
  assert.deepEqual(explain(owner, MON, '07:30', '16:00', true).steps, ['07:30–16:00 = 8.5h (day, no unpaid break on this booking)'])
  assert.deepEqual(explain(owner, MON, '12:00', '12:30').steps, ['12:00–12:30 is inside the unpaid break = 0h'])
})

test('1.39.0: the explanation never changes a figure — totals equal payrollHoursResult and the breakdown rows', () => {
  for (const policy of [owner, sundayEveryHour]) {
    for (const day of [SAT, SUN, MON]) {
      for (const [start, end] of [
        ['07:30', '10:30'],
        ['07:30', '14:00'],
        ['07:30', '16:00'],
        ['06:00', '18:30'],
        ['11:45', '12:15'],
        ['22:00', '06:00'],
      ]) {
        for (const isBreakRemoved of [false, true]) {
          const paid = payrollHoursResult({
            booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: start, workEndTime: end, isBreakRemoved },
            dayKey: day,
            policy,
            timeZone: ZONE,
          })
          const row = explain(policy, day, start, end, isBreakRemoved)
          assert.equal(row.totalPaidHours, Math.round(paid.totalPaidHours * 100) / 100, `${day} ${start}–${end}`)
          const [breakdown] = weekendBookingBreakdown(policy, [day], start, end, isBreakRemoved, ZONE)
          assert.equal(breakdown.paidHoursEquivalent, row.totalPaidHours)
          assert.deepEqual(breakdown.explanation, { rule: row.rule, steps: row.steps })
          if (row.steps.length > 1) assert.equal(row.steps[row.steps.length - 1], `→ ${row.totalPaidHours}h`)
        }
      }
    }
  }
})

test('1.39.0 bookingShortfall names what it compares against; none on an every-hour day', () => {
  assert.deepEqual(bookingShortfall(owner, SAT, 3.69, ZONE), {
    label: 'Short of a full Saturday (8h)',
    fullDayHours: 8,
    missingHours: 4.31,
    value: '4.31h',
  })
  assert.equal(bookingShortfall(owner, MON, 4, ZONE)?.label, 'Short of a full Monday (8h)')
  assert.equal(bookingShortfall(owner, SAT, 8, ZONE), null)
  assert.equal(bookingShortfall(owner, SAT, 12, ZONE), null)
  assert.equal(bookingShortfall(sundayEveryHour, SUN, 6, ZONE), null)
  assert.equal(bookingHoursExplanation(owner, 'not-a-day', { workStartTime: '07:30', workEndTime: '10:30' }, ZONE), null)
  assert.equal(bookingHoursExplanation(owner, SAT, { workStartTime: '07:30', workEndTime: '07:30' }, ZONE), null)
})

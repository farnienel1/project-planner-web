/**
 * Rulebook 1.39.0 (owner answers 11 Nov): booking hours wording (`bookingHoursText.ts`) and the My Schedule clash
 * marker (`myScheduleClash.ts`). Wording only for the texts — the figures are the pay rule's.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bookedWithOvertimeText,
  bookingBreakText,
  bookingHoursCountText,
  bookingHoursTiles,
  onSiteHoursText,
  overtimeIncludedText,
  overtimeTotalText,
  saveHoursLabel,
} from './bookingHoursText'
import {
  MY_SCHEDULE_CLASH_APPROVED_MESSAGE,
  MY_SCHEDULE_CLASH_ASK_MANAGER,
  myScheduleClashMarkers,
} from './myScheduleClash'
import { payrollHoursResult } from './payrollHours'
import type { OrgPayrollTimePolicy } from './organizationSettings'

const ZONE = 'Europe/London'
const MON = '2026-11-16'
const SAT = '2026-11-14'

const policy = {
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  standardPaidHours: 8.5,
  breakWindowStart: '11:30',
  breakWindowEnd: '12:00',
  weekdayOutsideStandardMultiplier: 1.5,
  saturday: {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: '07:30',
    definedWindowEnd: '14:00',
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 2,
    sameAsSaturday: false,
    breakPaid: false,
    breakMinutes: 45,
    breakWindowStart: '12:00',
    breakWindowEnd: '12:45',
  },
  sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false },
} as unknown as OrgPayrollTimePolicy

test('1.39.0 labels: OT tile, booked line, "incl." line, hours not "paid", Save button', () => {
  assert.equal(overtimeTotalText({ clockHours: 12, multiplier: 1.5 }), '12h OT × 1.5 = 18h')
  assert.equal(overtimeTotalText({ clockHours: 6.5, multiplier: 2, breakHours: 0.5 }), '6.5h OT × 2 − 0.5h break = 12.5h')
  assert.equal(overtimeTotalText({ clockHours: 0, multiplier: 1.5 }), '')
  assert.equal(bookedWithOvertimeText({ bookedHours: 60.5, clockHours: 12, multiplier: 1.5 }), '60.5h booked (incl. 12h OT × 1.5)')
  assert.equal(bookedWithOvertimeText({ bookedHours: 40, clockHours: 0, multiplier: 1.5 }), '40h booked')
  assert.equal(bookedWithOvertimeText({ bookedHours: 30, clockHours: 4, multiplier: null }), '30h booked (incl. 4h OT)')
  assert.equal(overtimeIncludedText({ clockHours: 6, multiplier: 1.5 }), 'incl. 6h OT × 1.5 = 9h')
  assert.equal(overtimeIncludedText({ clockHours: 0, multiplier: 1.5 }), '')
  assert.equal(bookingHoursCountText(17.5), '17.5 hours')
  assert.equal(bookingHoursCountText(1), '1 hour')
  assert.equal(onSiteHoursText({ hours: 17.5, onSiteHours: 15 }), '17.5 hours · 15h on site')
  assert.equal(saveHoursLabel(17.5), 'Save · 17.5 hours')
})

test('1.39.0 break text follows the working hours in effect that day (weekday, weekend own break, paid)', () => {
  assert.deepEqual(bookingBreakText(policy, MON, ZONE), {
    minutes: 30,
    window: '11:30–12:00',
    paid: false,
    label: '30 min unpaid break 11:30–12:00',
    deducted: '30 mins deducted 11:30–12:00',
  })
  assert.equal(bookingBreakText(policy, SAT, ZONE)?.label, '45 min unpaid break 12:00–12:45')
  const paid = { ...policy, breakPaid: true } as unknown as OrgPayrollTimePolicy
  assert.equal(bookingBreakText(paid, MON, ZONE)?.label, '30 min paid break 11:30–12:00 (not deducted)')
  assert.equal(bookingBreakText(paid, MON, ZONE)?.deducted, '30 min paid break 11:30–12:00 (not deducted)')
  assert.equal(bookingBreakText({ ...policy, unpaidBreakMinutes: 0 } as unknown as OrgPayrollTimePolicy, MON, ZONE), null)
})

test('1.39.0 Edit booking tiles (option A): standard with the break on it, OT; none for a paid break or No unpaid break', () => {
  const booking = { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '22:00' }
  assert.deepEqual(
    bookingHoursTiles(policy, MON, booking, ZONE).map((t) => `${t.value} ${t.label}`),
    ['9 Standard (−0.5 break)', '6 OT']
  )
  const paid = { ...policy, breakPaid: true } as unknown as OrgPayrollTimePolicy
  assert.deepEqual(bookingHoursTiles(paid, MON, booking, ZONE).map((t) => `${t.value} ${t.label}`), ['9 Standard', '6 OT'])
  assert.deepEqual(
    bookingHoursTiles(policy, MON, { ...booking, isBreakRemoved: true }, ZONE).map((t) => `${t.value} ${t.label}`),
    ['9 Standard', '6 OT']
  )
  // Figures equal the pay rule's.
  const result = payrollHoursResult({ booking, dayKey: MON, policy, timeZone: ZONE })
  const tiles = bookingHoursTiles(policy, MON, booking, ZONE)
  assert.equal(tiles[0].paidHours + tiles[1].paidHours, Math.round(result.totalPaidHours * 100) / 100)
})

const people = {
  accounts: [{ id: 'op-1', email: 'op@example.com' }, { id: 'mgr-1', email: 'mgr@example.com' }],
  operatives: [],
}

test('1.39.0 My Schedule clash marker: red while not approved, grey when approved, third booking re-opens', () => {
  const a = { id: 'A', operativeId: 'op-1', dayKey: MON, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '12:00', placeLabel: 'J-1 Kitchen', projectId: 'J1' }
  const b = { id: 'B', operativeId: 'OP-1', dayKey: MON, timeSlot: 'CUSTOM_HOURS', workStartTime: '11:00', workEndTime: '15:00', placeLabel: 'J-2 Roof', projectId: 'J2' }
  const c = { id: 'C', operativeId: 'op-1', dayKey: MON, timeSlot: 'CUSTOM_HOURS', workStartTime: '14:00', workEndTime: '16:00', placeLabel: 'J-3', projectId: 'J3' }
  const base = { people, managerIds: ['mgr-1'], day: policy }

  // Operative: no Open Warnings, asked to speak to their manager.
  const red = myScheduleClashMarkers({ ...base, operativeBookings: [a, b], decisions: { approvedKeys: [], acceptedClashes: [] }, canOpenWarnings: false })
  assert.deepEqual(red.map((m) => [m.bookingId, m.state, m.otherBookingIds]), [['A', 'clash', ['B']], ['B', 'clash', ['A']]])
  assert.equal(red[0].message, `This booking overlaps Mon 16 Nov · J-2 Roof · 11:00–15:00. ${MY_SCHEDULE_CLASH_ASK_MANAGER}`)
  assert.equal(red[0].actionLabel, null)

  // Approvals not loaded: never "approved".
  const unknown = myScheduleClashMarkers({ ...base, operativeBookings: [a, b], decisions: null })
  assert.ok(unknown.every((m) => m.state === 'clash'))

  // Approved pair (key in another letter case) → grey.
  const accepted = { approvedKeys: [], acceptedClashes: [{ bookingAId: 'a', bookingBId: 'b' }] }
  const grey = myScheduleClashMarkers({ ...base, operativeBookings: [a, b], decisions: accepted })
  assert.ok(grey.every((m) => m.state === 'approved' && m.message === MY_SCHEDULE_CLASH_APPROVED_MESSAGE && m.actionLabel === null))

  // A third overlapping booking re-opens it.
  const reopened = myScheduleClashMarkers({ ...base, operativeBookings: [a, b, c], decisions: accepted })
  assert.ok(reopened.every((m) => m.state === 'clash'))

  // No overlap, no marker; touching times do not clash.
  const touch = { ...b, workStartTime: '12:00' }
  assert.deepEqual(myScheduleClashMarkers({ ...base, operativeBookings: [a, touch], decisions: accepted }), [])
})

test('1.39.0 My Schedule clash marker: a manager in scope gets Open Warnings (manager clash rules)', () => {
  const m1 = { id: 'M1', userId: 'mgr-1', dayKey: MON, timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '12:00', placeLabel: 'Office' }
  const m2 = { id: 'M2', userId: 'mgr-1', dayKey: MON, timeSlot: 'CUSTOM_HOURS', workStartTime: '10:00', workEndTime: '13:00', placeLabel: 'Site survey' }
  const markers = myScheduleClashMarkers({
    people,
    managerIds: ['mgr-1'],
    day: policy,
    managerBookings: [m1, m2],
    decisions: { approvedKeys: [], acceptedClashes: [] },
    canOpenWarnings: true,
    scope: { kind: 'jobs', jobIds: [], personIds: ['mgr-1'], personEmails: ['mgr@example.com'], unbookedLabour: true },
    viewerIds: ['mgr-1'],
    viewerEmail: 'mgr@example.com',
  })
  assert.deepEqual(markers.map((m) => [m.bookingId, m.state, m.actionLabel]), [['M1', 'clash', 'Open Warnings'], ['M2', 'clash', 'Open Warnings']])
  assert.equal(markers[0].message, 'This booking overlaps Mon 16 Nov · Site survey · 10:00–13:00.')
  // Approved through its manager resolution key → grey.
  const approved = myScheduleClashMarkers({
    people,
    managerIds: ['mgr-1'],
    day: policy,
    managerBookings: [m1, m2],
    decisions: { approvedKeys: [`mgr-clash-mgr-1-${MON}-0`], acceptedClashes: [] },
    canOpenWarnings: true,
  })
  assert.ok(approved.every((m) => m.state === 'approved'))
})

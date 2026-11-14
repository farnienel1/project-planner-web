import { test } from 'node:test'
import assert from 'node:assert/strict'
import { otherCurrenciesNote, signedTimesheetValue, userIdFromTimesheetDoc } from './signedTimesheetValue.ts'

test('reads the Firebase uid from the timesheet document id when userId is missing', () => {
  assert.equal(
    userIdFromTimesheetDoc('timesheet_abcUID123_1710000000', {}),
    'abcUID123'
  )
  assert.equal(
    userIdFromTimesheetDoc('timesheet_abcUID123_2026-09-01', { userId: ' stored-id ' }),
    'stored-id'
  )
  assert.equal(userIdFromTimesheetDoc('jobTypes', {}), '')
})

test('1.46.0: a signed sheet is valued from its signed snapshot by timesheetTotals (labour included)', () => {
  const sheet = {
    weeklyReportOverride: {
      lines: [
        { id: 'op-b1-normal', amount: 250, decision: 'agreed', isOvertime: false },
        { id: 'op-b1-ot', amount: 176.47, decision: 'agreed', isOvertime: true },
        { id: 'op-b2-normal', amount: 250, decision: 'declined', isOvertime: false },
      ],
      priceWork: [],
      expenses: [{ id: 'e1', amount: 25, decision: 'agreed', date: '2026-09-14' }],
    },
  }
  // Hours from the signed lines: 8.5 at the day rate + 3h at ×2 = 14.5 (declined line left out).
  const value = signedTimesheetValue({
    weeklyReportOverride: {
      ...sheet.weeklyReportOverride,
      lines: sheet.weeklyReportOverride.lines.map((line, index) => ({ ...line, paidHours: index === 1 ? 3 : 8.5, ...(index === 1 ? { otMultiplier: 2 } : {}) })),
    },
  })
  assert.deepEqual(value, { pence: 45147, hours: 14.5, labourCounted: true })
})

test('1.46.0: with no snapshot only the extras count, and the screen is told labour was not counted', () => {
  const sheet = { expenseEntries: [{ id: 'e1', title: 'Fuel', amount: 12.5 }] }
  assert.deepEqual(signedTimesheetValue(sheet), { pence: 1250, hours: 0, labourCounted: false })
})

test('1.46.0: money in other currencies is listed, never added to the £ figure', () => {
  assert.equal(otherCurrenciesNote([]), '')
  assert.match(otherCurrenciesNote([{ currency: 'EUR', pence: 12345, sheetCount: 2 }]), /123\.45.*2 sheets/)
})

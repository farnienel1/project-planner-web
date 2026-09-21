import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyTimesheetDraft } from './timesheetDraft.ts'
import { managerAdjustmentRows, showsTimesheetAdjustment } from './timesheetAdjustments.ts'

test('showsTimesheetAdjustment only after sign-off or live review', () => {
  assert.equal(
    showsTimesheetAdjustment({
      original: 40,
      effective: 0,
      decision: 'declined',
      managerHasSigned: false,
    }),
    false
  )
  assert.equal(
    showsTimesheetAdjustment({
      original: 40,
      effective: 0,
      decision: 'declined',
      managerHasSigned: true,
    }),
    true
  )
  assert.equal(
    showsTimesheetAdjustment({
      original: 200,
      effective: 150,
      decision: 'edited',
      managerHasSigned: false,
      applyLiveReview: true,
    }),
    true
  )
})

test('managerAdjustmentRows lists declined and edited extras and days', () => {
  const rows = managerAdjustmentRows({
    ...emptyTimesheetDraft(),
    expenseEntries: [
      {
        id: 'e1',
        title: 'Parking',
        details: '',
        jobNumber: 'J-1',
        date: new Date('2026-09-21T08:00:00Z'),
        amount: 12,
        managerDecision: 'declined',
      },
    ],
    priceWorkEntries: [
      {
        id: 'p1',
        title: 'Extra first fix',
        details: '',
        jobNumber: 'J-1',
        agreedManagerName: 'Pat',
        startDate: new Date('2026-09-21T08:00:00Z'),
        amount: 80,
        managerDecision: 'edited',
        managerRevisedAmount: 60,
      },
    ],
    payrollLineReviews: {
      'op-b1-normal': { decision: 'edited', revisedAmount: 150 },
    },
  })
  assert.equal(rows.length, 3)
  assert.equal(rows[0]?.title, 'Expense: Parking')
  assert.equal(rows[1]?.detail, '£80.00 → £60.00')
  assert.match(rows[2]?.title || '', /Day adjusted/)
})

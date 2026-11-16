import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyTimesheetDraft } from './timesheetDraft.ts'
import { draftEntryFingerprints, draftReviewEntries, extrasPendingReview, managerAdjustmentRows, showsTimesheetAdjustment } from './timesheetAdjustments.ts'
import { timesheetLateExtraFingerprintKey } from '../canonical/timesheetLateExtras.ts'

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

test('payroll line reviews are found without case, as on the invoice (payrollLineReview)', async () => {
  const { effectivePayrollAmount, isPayrollLineRemoved, draftTimesheetTotals } = await import('./timesheetAdjustments.ts')
  const line = { id: 'booking-abc-line', amount: 200, isOvertimeLine: false } as never
  const edited = {
    ...emptyTimesheetDraft(),
    payrollLineReviews: { 'BOOKING-ABC-LINE': { decision: 'edited' as const, revisedAmount: 150 } },
  }
  assert.equal(effectivePayrollAmount(line, edited, true), 150)
  assert.equal(draftTimesheetTotals({ lines: [line], draft: { ...edited, managerSignedAt: new Date('2026-11-01T12:00:00Z') }, decided: true }).labour, 150)
  assert.equal(draftTimesheetTotals({ lines: [line], draft: edited, decided: true, reviewing: true }).labour, 150)
  assert.equal(draftTimesheetTotals({ lines: [line], draft: edited, decided: false }).labour, 200)
  const declined = {
    ...emptyTimesheetDraft(),
    payrollLineReviews: { 'BOOKING-ABC-LINE': { decision: 'declined' as const, revisedAmount: null } },
  }
  assert.equal(isPayrollLineRemoved(line, declined, true), true)
  assert.equal(effectivePayrollAmount(line, declined, true), 0)
})

test('1.54.0 third review of #337 (1): an ignored late extra is never decided, never waits, and keeps its own fingerprint key', () => {
  const day = new Date('2026-11-12T10:00:00Z')
  const signed = { id: 'E1', title: 'Hotel', details: '', jobNumber: 'J', date: day, amount: 1000, reviewFingerprint: 'signed-fp', managerDecision: 'declined' as const }
  const late = { kind: 'expense' as const, id: 'e1', title: 'Taxi', details: '', jobNumber: 'J', date: day, amount: 40, reviewFingerprint: 'late-fp', managerDecision: 'pending' as const, lateState: 'ignored' as const, lateReason: 'id-taken' as const }
  const draft = { ...emptyTimesheetDraft(), expenseEntries: [signed], lateExtras: [late] }
  assert.deepEqual(draftReviewEntries(draft).map((entry) => entry.id), ['E1'])
  assert.equal(extrasPendingReview({ ...draft, expenseEntries: [] }), false)
  const map = draftEntryFingerprints(draft)
  assert.equal(map.e1, 'signed-fp')
  assert.equal(map[timesheetLateExtraFingerprintKey('e1')], 'late-fp')
})

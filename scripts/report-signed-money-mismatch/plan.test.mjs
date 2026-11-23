import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import { signedMoneyMismatchCounts } from './plan.mjs'

const rulebook = loadRulebook()
const at = (iso) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })

function sheet(id, { expenseRow = 40, review = null, exported = false, managerSigned = true } = {}) {
  return {
    id,
    data: {
      userId: 'u1',
      operativeSignedAt: at('2026-11-14T10:00:00Z'),
      operativeSignedByName: 'Jo',
      ...(managerSigned ? { managerSignedAt: at('2026-11-14T11:00:00Z'), managerSignedByName: 'LM' } : {}),
      expenseEntries: [{ id: 'ex1', title: 'Parking', amount: 40, jobNumber: 'J1', date: '2026-11-10' }],
      ...(review ? { extraEntryReviews: { ex1: review } } : {}),
      weeklyReportOverride: { lines: [], priceWork: [], expenses: [{ id: 'ex1', title: 'Parking', amount: expenseRow, decision: 'approved' }] },
      ...(exported ? { exportedAt: at('2026-11-15T09:00:00Z') } : {}),
    },
  }
}

test('report-signed-money-mismatch: counts only signed, unexported sheets whose signed money rows differ', () => {
  const declined = { decision: 'declined', reviewedAmount: 40, reviewedByUserId: 'lm', reviewedAtMs: 1 }
  const counts = signedMoneyMismatchCounts(rulebook, {
    sheets: [
      sheet('timesheet_u1_1'), // in step
      sheet('timesheet_u1_2', { review: declined }), // decided 0, signed 40 → mismatch
      sheet('timesheet_u1_3', { review: declined, expenseRow: 0 }), // in step
      sheet('timesheet_u1_4', { review: declined, exported: true }), // exported: never
      sheet('timesheet_u1_5', { review: declined, managerSigned: false }), // not counter-signed
      { id: 'jobTypes', data: {} },
    ],
  })
  assert.deepEqual(counts, { sheetsChecked: 5, counterSignedNotExported: 3, mismatched: 1, mismatchedIds: ['timesheet_u1_2'] })
})

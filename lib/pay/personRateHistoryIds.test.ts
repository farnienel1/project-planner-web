import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personRateHistoryIds } from './personRateHistoryIds.ts'
import { mergedDayRateEntries, emptyDayRateHistory, payHistoryBatchRows } from '../timesheets/dayRateHistoryStorage.ts'

const operatives = [
  { id: 'OP-ADA-1', email: 'ada@x.com' },
  { id: 'op-ada-2', email: 'ADA@x.com' },
  { id: 'op-bob', email: 'bob@x.com' },
  { id: 'op-blank', email: '' },
]

test('1.36.0 FU-5: personRateHistoryIds lists every operatives row on the email and every users id', () => {
  const ids = personRateHistoryIds(
    { id: 'u-ada', email: 'ada@x.com', formerUserIds: ['INVITE-1'] },
    operatives,
    { roster: [{ id: 'u-ada-2', email: 'Ada@X.com' }] }
  )
  assert.deepEqual(ids.userIds, ['u-ada', 'INVITE-1', 'u-ada-2'])
  assert.deepEqual(ids.operativeIds, ['OP-ADA-1', 'op-ada-2'])
})

test('1.36.0 FU-5: a person with no email (ghost) never picks up rows with an empty email', () => {
  const ids = personRateHistoryIds({ id: 'op-ghost', email: '' }, [...operatives, { id: 'op-ghost', email: '' }])
  assert.deepEqual(ids.userIds, ['op-ghost'])
  assert.deepEqual(ids.operativeIds, ['op-ghost'])
})

function row(id: string, over: Record<string, unknown>) {
  return { id, dayRate: 150, effectiveAt: new Date('2026-01-01T00:00:00Z'), createdAt: new Date('2026-01-01T00:00:00Z'), ...over }
}

test('1.36.0 FU-5: mergedDayRateEntries matches ids without case and under every operatives row', () => {
  const history = {
    ...emptyDayRateHistory(),
    byUserId: { 'U-ADA': [row('h1', { userId: 'U-ADA' })] },
    byOperativeId: { 'op-ada-2': [row('h2', { userId: '', operativeId: 'op-ada-2' })] },
  }
  const ids = personRateHistoryIds({ id: 'u-ada', email: 'ada@x.com' }, operatives)
  assert.deepEqual(
    mergedDayRateEntries(history, ids.userIds, ids.operativeIds).map((entry) => entry.id).sort(),
    ['h1', 'h2']
  )
})

test('1.36.0 FU-5: a pay change for a person whose history is under another row writes no duplicate seed row', () => {
  const history = {
    ...emptyDayRateHistory(),
    byOperativeId: { 'op-ada-2': [row('h2', { userId: '', operativeId: 'op-ada-2' })] },
  }
  const ids = personRateHistoryIds({ id: 'u-ada', email: 'ada@x.com' }, operatives)
  const base = {
    history,
    userId: 'u-ada',
    operativeId: 'OP-ADA-1',
    previous: { rate: 150, payBasis: 'day' as const },
    next: { rate: 180, payBasis: 'day' as const },
    effectiveAt: new Date('2026-11-09T00:00:00Z'),
    seedEffective: new Date('2025-01-01T00:00:00Z'),
    timeZone: 'Europe/London',
  }
  // Before 1.36.0 only the one linked row was read, so the history looked empty and a seed row was written too.
  assert.equal(payHistoryBatchRows(base).length, 2)
  assert.equal(payHistoryBatchRows({ ...base, historyUserIds: ids.userIds, historyOperativeIds: ids.operativeIds }).length, 1)
})

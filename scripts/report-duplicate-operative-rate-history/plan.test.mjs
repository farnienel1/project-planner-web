import assert from 'node:assert/strict'
import test from 'node:test'
import { duplicateRateHistoryFindings, instantMs } from './plan.mjs'

const users = [
  { id: 'u-ada', email: 'Ada@x.com', firstName: 'Ada', surname: 'Lovelace' },
  { id: 'u-bob', email: 'bob@x.com', firstName: 'Bob' },
]

test('1.36.0: a newer history row on a non-linked duplicate row is reported with the rate before and after', () => {
  const operatives = [
    { id: 'op1', email: 'ada@x.com', linkedUserId: 'U-ADA' },
    { id: 'op2', email: 'ADA@x.com ' },
  ]
  const history = [
    { userId: 'u-ada', operativeId: 'op1', dayRate: 200, payBasis: 'day', effectiveAt: new Date('2025-06-01T00:00:00Z') },
    { userId: '', operativeId: 'op2', dayRate: 260, payBasis: 'day', effectiveAt: { seconds: Date.parse('2026-01-01T00:00:00Z') / 1000 } },
  ]
  const [finding, ...rest] = duplicateRateHistoryFindings({ users, operatives, history })
  assert.equal(rest.length, 0)
  assert.equal(finding.email, 'ada@x.com')
  assert.equal(finding.reason, 'newer history on a non-linked row')
  assert.deepEqual(finding.linkedOperativeIds, ['op1'])
  assert.deepEqual(finding.newerOnOperativeIds, ['op2'])
  assert.equal(finding.before.rate, 200)
  assert.equal(finding.after.rate, 260)
  assert.equal(finding.name, 'Ada Lovelace')
})

test('1.36.0: older history on the duplicate, one row only, or no account is not reported', () => {
  const operatives = [{ id: 'op1', email: 'ada@x.com', linkedUserId: 'u-ada' }, { id: 'op2', email: 'ada@x.com' }]
  const older = [
    { userId: 'u-ada', operativeId: 'op1', dayRate: 200, effectiveAt: '2026-02-01' },
    { userId: '', operativeId: 'op2', dayRate: 260, effectiveAt: '2026-01-01' },
  ]
  assert.deepEqual(duplicateRateHistoryFindings({ users, operatives, history: older }), [])
  assert.deepEqual(duplicateRateHistoryFindings({ users, operatives: [operatives[0]], history: older }), [])
  assert.deepEqual(duplicateRateHistoryFindings({ users: [], operatives, history: older }), [])
  // A duplicate row's history filed under the users id was already read before 1.36.0.
  const underUser = [older[0], { userId: 'u-ada', operativeId: 'op2', dayRate: 300, effectiveAt: '2026-05-01' }]
  assert.deepEqual(duplicateRateHistoryFindings({ users, operatives, history: underUser }), [])
})

test('1.36.0: with no linked row, two rows with history are listed for the owner to check', () => {
  const operatives = [{ id: 'op3', email: 'bob@x.com' }, { id: 'op4', email: 'bob@x.com' }]
  const history = [
    { userId: '', operativeId: 'op3', dayRate: 150, effectiveAt: '2026-01-01' },
    { userId: '', operativeId: 'op4', dayRate: 170, effectiveAt: '2026-03-01' },
  ]
  const [finding] = duplicateRateHistoryFindings({ users, operatives, history })
  assert.equal(finding.reason, 'no linked row')
  assert.equal(finding.after.rate, 170)
})

test('instantMs reads every stored instant shape', () => {
  assert.equal(instantMs({ toMillis: () => 5 }), 5)
  assert.equal(instantMs({ seconds: 1, nanoseconds: 2_000_000 }), 1002)
  assert.equal(instantMs('nope'), null)
  assert.equal(instantMs(null), null)
})

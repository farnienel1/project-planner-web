import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overlayRosterPay, setPayProfilesForTests } from './payProfileOverlay.ts'

test('1.26.0 overlayRosterPay: pay profile first (own id, else a former invite id), users document second, other org untouched', () => {
  setPayProfilesForTests('org-a', [
    { subjectId: 'u1', fields: { dayRate: 220, payBasis: 'day' } },
    { subjectId: 'PLACEHOLDER-1', fields: { hourlyRate: 30, payBasis: 'hourly' } },
  ])
  assert.deepEqual(overlayRosterPay('org-a', 'u1', { firstName: 'A', dayRate: 200 }), { firstName: 'A', dayRate: 220, payBasis: 'day' })
  // After the strip the users document has no pay: the profile supplies it.
  assert.deepEqual(overlayRosterPay('org-a', 'u2', { formerUserIds: ['PLACEHOLDER-1'] }), {
    formerUserIds: ['PLACEHOLDER-1'],
    hourlyRate: 30,
    payBasis: 'hourly',
  })
  assert.deepEqual(overlayRosterPay('org-a', 'u3', { dayRate: 150 }), { dayRate: 150 })
  assert.deepEqual(overlayRosterPay('org-b', 'u1', { dayRate: 200 }), { dayRate: 200 })
})

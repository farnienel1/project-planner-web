import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overlayRosterPay, refreshPayProfiles, setPayProfilesForTests } from './payProfileOverlay.ts'
import { setSecuritySwitchConfigForTests } from '../access/securitySwitches.ts'

test('1.26.0 overlayRosterPay: privatePay off — a stale pay profile is ignored and nothing is read', async () => {
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-other'] })
  setPayProfilesForTests('org-a', [{ subjectId: 'u1', fields: { dayRate: 150, employmentType: 'paye' } }])
  const stored = { firstName: 'A', dayRate: 200, employmentType: 'self_employed' }
  assert.deepEqual(overlayRosterPay('org-a', 'u1', stored), stored)
  // The refresh skips the read and clears the cache (true: the roster must be read again without it).
  assert.equal(await refreshPayProfiles('org-a', { id: 'adm', adminAccess: true }, []), true)
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-a'] })
  assert.deepEqual(overlayRosterPay('org-a', 'u1', stored), stored)
})

test('1.26.0 overlayRosterPay: pay profile first (own id, else a former invite id), users document second, other org untouched', () => {
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-a'] })
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

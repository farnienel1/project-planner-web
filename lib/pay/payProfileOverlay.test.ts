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

test('1.26.0 people profile: privatePay off — a stale pay profile is ignored for the summary and the edit form starting values', async () => {
  const { personPayRecord, readsPersonPayProfile } = await import('./payProfileOverlay.ts')
  const { parseOrgUser } = await import('../firebase/parseUser.ts')
  const usersDoc = {
    organizationId: 'org-a',
    firstName: 'A',
    surname: 'B',
    email: 'a@example.com',
    payBasis: 'day',
    dayRate: 200,
    employmentType: 'self_employed',
  }
  const stale = { subjectId: 'u1', fields: { payBasis: 'day', dayRate: 150, employmentType: 'paye' } }

  // Off (on for another organisation only): no profile read, and the profile is never laid over.
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-other'] })
  assert.equal(readsPersonPayProfile('org-a'), false)
  const summary = personPayRecord('org-a', usersDoc, stale)
  assert.deepEqual(summary, usersDoc)
  // The edit form starts from the users document (`getUser` → `parseOrgUser`); it matches what the summary shows.
  const editor = parseOrgUser('u1', usersDoc)
  const shown = parseOrgUser('u1', summary)
  assert.equal(editor?.dayRate, 200)
  assert.equal(editor?.employmentType, 'self_employed')
  assert.equal(shown?.dayRate, editor?.dayRate)
  assert.equal(shown?.employmentType, editor?.employmentType)
  assert.equal(shown?.payBasis, editor?.payBasis)

  // On for this organisation: the profile is read and wins.
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-a'] })
  assert.equal(readsPersonPayProfile('org-a'), true)
  assert.deepEqual(personPayRecord('org-a', usersDoc, stale), { ...usersDoc, dayRate: 150, employmentType: 'paye' })
  assert.deepEqual(personPayRecord('org-a', usersDoc, null), usersDoc)
  assert.equal(readsPersonPayProfile(''), false)
  setSecuritySwitchConfigForTests(null)
})

test('1.26.1 payEditorRecord: privatePay off — no pay-profile read and the stored document unchanged (Edit User, operative form, save baseline)', async () => {
  const { payEditorRecord } = await import('./payProfileOverlay.ts')
  const { parseOrgUser } = await import('../firebase/parseUser.ts')
  const stored = { organizationId: 'org-a', firstName: 'A', surname: 'B', email: 'a@example.com', payBasis: 'day', dayRate: 120 }
  let reads = 0
  const load = async () => {
    reads += 1
    return { subjectId: 'u1', fields: { dayRate: 150 } }
  }
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-other'] })
  const record = await payEditorRecord('org-a', 'u1', stored, load)
  assert.equal(record, stored)
  assert.equal(reads, 0)
  // The editor's original rate (EditUserProfile `originalDayRate`) is the users document's, as before 1.26.1.
  assert.equal(parseOrgUser('u1', record)?.dayRate, 120)
  setSecuritySwitchConfigForTests(null)
})

test('1.26.1 payEditorRecord: privatePay on — the editor starts from the same pay the people profile shows (own id, else a former invite id)', async () => {
  const { payEditorRecord, personPayRecord } = await import('./payProfileOverlay.ts')
  const { parseOrgUser } = await import('../firebase/parseUser.ts')
  const stored = {
    organizationId: 'org-a',
    firstName: 'A',
    surname: 'B',
    email: 'a@example.com',
    payBasis: 'day',
    dayRate: 120,
    employmentType: 'self_employed',
    formerUserIds: ['PLACEHOLDER-1'],
  }
  const profiles: Record<string, { subjectId: string; fields: Record<string, unknown> }> = {
    u1: { subjectId: 'u1', fields: { payBasis: 'day', dayRate: 150 } },
    'PLACEHOLDER-1': { subjectId: 'PLACEHOLDER-1', fields: { payBasis: 'hourly', hourlyRate: 30 } },
  }
  const asked: string[] = []
  const load = async (_org: string, id: string) => {
    asked.push(id)
    return profiles[id] ?? null
  }
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-a'] })
  const record = await payEditorRecord('org-a', 'u1', stored, load)
  assert.deepEqual(asked, ['u1'])
  assert.deepEqual(record, { ...stored, dayRate: 150 })
  // Display and editor agree.
  assert.deepEqual(personPayRecord('org-a', stored, profiles.u1), record)
  const editor = parseOrgUser('u1', record)
  assert.equal(editor?.dayRate, 150)
  assert.equal(editor?.payBasis, 'day')

  // No profile of its own: the former invite id's.
  asked.length = 0
  const invited = await payEditorRecord('org-a', 'u2', stored, load)
  assert.deepEqual(asked, ['u2', 'PLACEHOLDER-1'])
  assert.equal(invited.hourlyRate, 30)
  assert.equal(invited.payBasis, 'hourly')

  // A refused read (the rules) keeps the stored document.
  const refused = await payEditorRecord('org-a', 'u1', stored, async () => {
    throw new Error('permission-denied')
  })
  assert.equal(refused, stored)
  setSecuritySwitchConfigForTests(null)
})

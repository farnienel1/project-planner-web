/**
 * Pay strip, review #342: store-level tests of the pay-profile overlay (`refreshPayProfiles` with a stand-in reader),
 * the roster-failure state, the wait for a signed-in person, and when the security switches count as read.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  notePayRosterLoadFailed,
  notePayRosterOverlaid,
  payProfileCacheVersion,
  payProfileFailedSubjectIds,
  payProfilesStatusFor,
  payProfilesStatusForPerson,
  personPayStatus,
  refreshPayProfiles,
  resetPayProfilesForTests,
  type PayProfileReader,
} from './payProfileOverlay.ts'
import { rerunWhenViewerArrives, resetViewerWaitsForTests } from './rosterViewerWait.ts'
import {
  platformConfigSnapshotIsKnown,
  securitySwitchesLoaded,
  setSecuritySwitchConfigForTests,
  setSecuritySwitchesUnreadForTests,
  whenSecuritySwitchesLoaded,
} from '../access/securitySwitches.ts'
import { payProfileReadPlan } from '../canonical/index.ts'

const ORG = 'org-store'

const lineManager = { id: 'lm', email: 'lm@firm.test', role: 'manager', manager: true, isActive: true, passwordSet: true }
const reportA = { id: 'a', email: 'a@firm.test', role: 'operative', operativeMode: true, isActive: true, passwordSet: true, assignedManagerUserIds: ['lm'] }
const reportB = { id: 'b', email: 'b@firm.test', role: 'operative', operativeMode: true, isActive: true, passwordSet: true, assignedManagerUserIds: ['lm'] }
const roster = [lineManager, reportA, reportB]
const admin = { id: 'adm', email: 'adm@firm.test', role: 'admin', adminAccess: true, isActive: true, passwordSet: true }

const refused = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })
const offline = () => Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' })

function reader(options: { refuse?: string[]; offline?: string[]; collection?: 'refuse' | 'offline' | 'ok' }): PayProfileReader {
  return {
    readCollection: async () => {
      if (options.collection === 'refuse') throw refused()
      if (options.collection === 'offline') throw offline()
      return [{ id: 'a', data: { employmentType: 'paye' } }]
    },
    readDocument: async (_org, id) => {
      if (options.refuse?.includes(id)) throw refused()
      if (options.offline?.includes(id)) throw offline()
      return { id, data: { employmentType: id === 'b' ? 'paye' : 'self_employed', dayRate: 200 } }
    },
  }
}

function on(): void {
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: [ORG] })
}

test('review #342 item 1: one refused read fails only that person — never the viewer, never the organisation', async () => {
  resetPayProfilesForTests()
  on()
  const plan = payProfileReadPlan(lineManager as never, roster as never, roster as never)
  assert.equal(plan.kind, 'documents')
  assert.deepEqual([...(plan as { ids: string[] }).ids].sort(), ['a', 'b', 'lm'])

  await refreshPayProfiles(ORG, lineManager as never, roster as never, reader({ refuse: ['b'] }))
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  // The organisation is settled: the viewer can sign their own sheet and review A.
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  assert.equal(payProfilesStatusForPerson(ORG, lineManager), 'ready')
  assert.equal(payProfilesStatusForPerson(ORG, reportA), 'ready')
  // Only B (refused) fails: their sheet, row and Export are blocked.
  assert.deepEqual(payProfileFailedSubjectIds(ORG), ['b'])
  assert.equal(payProfilesStatusForPerson(ORG, reportB), 'failed')
  // Matched without case, and through a former id.
  assert.equal(personPayStatus('ready', new Set(['b']), { id: 'B' }), 'failed')
  assert.equal(personPayStatus('ready', new Set(['b']), { id: 'new-b', formerUserIds: ['b'] }), 'failed')

  // Retry: B's read answers → B is ready again.
  await refreshPayProfiles(ORG, lineManager as never, roster as never, reader({}))
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.deepEqual(payProfileFailedSubjectIds(ORG), [])
  assert.equal(payProfilesStatusForPerson(ORG, reportB), 'ready')

  // Offline after an answer keeps it (no failure); a refusal afterwards fails B again.
  await refreshPayProfiles(ORG, lineManager as never, roster as never, reader({ offline: ['b'] }))
  assert.equal(payProfilesStatusForPerson(ORG, reportB), 'ready')
  await refreshPayProfiles(ORG, lineManager as never, roster as never, reader({ refuse: ['b'] }))
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusForPerson(ORG, reportB), 'failed')
  assert.equal(payProfilesStatusForPerson(ORG, reportA), 'ready')
  setSecuritySwitchConfigForTests(null)
})

test('review #342 item 1: a person never read before and not reached (offline) is failed, not ready', async () => {
  resetPayProfilesForTests()
  on()
  await refreshPayProfiles(ORG, lineManager as never, roster as never, reader({ offline: ['a'] }))
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  assert.equal(payProfilesStatusForPerson(ORG, reportA), 'failed')
  assert.equal(payProfilesStatusForPerson(ORG, lineManager), 'ready')
  setSecuritySwitchConfigForTests(null)
})

test("review #342 item 1: an admin's whole-collection read refused fails the organisation (nobody's pay is known)", async () => {
  resetPayProfilesForTests()
  on()
  await refreshPayProfiles(ORG, admin as never, [...roster, admin] as never, reader({ collection: 'refuse' }))
  assert.equal(payProfilesStatusFor(ORG), 'failed')
  await refreshPayProfiles(ORG, admin as never, [...roster, admin] as never, reader({ collection: 'ok' }))
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  setSecuritySwitchConfigForTests(null)
})

test('review #342 item 4: no signed-in person yet — nothing is read and the gate stays loading', async () => {
  resetPayProfilesForTests()
  on()
  let reads = 0
  const counting: PayProfileReader = {
    readCollection: async () => {
      reads += 1
      return []
    },
    readDocument: async () => {
      reads += 1
      return null
    },
  }
  assert.equal(await refreshPayProfiles(ORG, null, roster as never, counting), false)
  assert.equal(reads, 0)
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  setSecuritySwitchConfigForTests(null)
})

test('review #342 item 4: a roster that could not be read is failed (Retry), until it is laid over', () => {
  resetPayProfilesForTests()
  on()
  notePayRosterLoadFailed(ORG)
  assert.equal(payProfilesStatusFor(ORG), 'failed')
  // privatePay off: the roster read does not decide pay — nothing waits.
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-other'] })
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  on()
  assert.equal(payProfilesStatusFor(ORG), 'failed')
  notePayRosterOverlaid(ORG, payProfileCacheVersion())
  // No longer failed (the overlay still waits for a pay-profile read before it is ready).
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  setSecuritySwitchConfigForTests(null)
})

test('review #342 item 4: the roster is read again once the signed-in person arrives (once per organisation)', () => {
  resetViewerWaitsForTests()
  let user: unknown = null
  const listeners = new Set<(state: { user: unknown }) => void>()
  const store = {
    getState: () => ({ user }),
    subscribe: (listener: (state: { user: unknown }) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  let reloads = 0
  const input = { organizationId: ORG, authStore: store, stillListed: () => true, reload: () => (reloads += 1) }
  rerunWhenViewerArrives(input)
  rerunWhenViewerArrives(input)
  assert.equal(listeners.size, 1)
  for (const listener of [...listeners]) listener({ user: null })
  assert.equal(reloads, 0)
  user = { id: 'lm' }
  for (const listener of [...listeners]) listener({ user })
  assert.equal(reloads, 1)
  assert.equal(listeners.size, 0)
  // Already signed in: nothing to wait for.
  rerunWhenViewerArrives(input)
  assert.equal(listeners.size, 0)
})

test('review #342 item 2: a cached "missing" config is unknown; a server answer or a cached document is known', async () => {
  assert.equal(platformConfigSnapshotIsKnown({ exists: false, fromCache: true }), false)
  assert.equal(platformConfigSnapshotIsKnown({ exists: true, fromCache: true }), true)
  assert.equal(platformConfigSnapshotIsKnown({ exists: false, fromCache: false }), true)
  assert.equal(platformConfigSnapshotIsKnown({ exists: true, fromCache: false }), true)
  setSecuritySwitchesUnreadForTests()
  assert.equal(securitySwitchesLoaded(), false)
  assert.equal(payProfilesStatusFor(ORG), 'loading')
  let resolved = false
  const waiting = whenSecuritySwitchesLoaded().then(() => (resolved = true))
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(resolved, false)
  // Item 6: once the config is read and says off, nothing waits.
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['org-other'] })
  await waiting
  assert.equal(resolved, true)
  assert.equal(payProfilesStatusFor(ORG), 'ready')
  setSecuritySwitchConfigForTests(null)
})

/**
 * `w-timesheet-lookups` (guardrails 1 and 3): a person's timesheets under every id they go by, and people with no
 * level flag on the admin's Exported / User Timesheets lists. Real old document shapes: a sheet under a former invite
 * id, a sheet under a second users document on the same email, a sheet stored without `userId`, an id in another
 * letter case. Each test also checks that nothing the old one-id read showed disappears.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import {
  newestFirstOwnIdLast,
  personTimesheetDocs,
  timesheetLookupPlan,
  timesheetDocsForPerson,
  timesheetDocumentOwnerId,
  type SettingsDocument,
} from './personTimesheetDocs.ts'
import { timesheetMemberIds } from './timesheetQueue.ts'
import { exportedTimesheetSubjectIds, userTimesheetSubjectIds } from '../permissions.ts'
import { exportedSheetOwnerResolver, isUnresolvedTimesheetPerson, timesheetLookupPrivatePay } from './timesheetStorage.ts'
import { setSecuritySwitchConfigForTests, setSecuritySwitchesUnreadForTests } from '../access/securitySwitches.ts'
import { exportedTimesheetRosterGroups } from './timesheetWeekUtils.ts'

const sheet = (userId: string | undefined, weekStartKey: string): Record<string, unknown> => ({
  ...(userId === undefined ? {} : { userId }),
  weekStartKey,
  weekStart: new Date(`${weekStartKey}T00:00:00Z`),
})

function user(partial: Partial<User> & { id: string }): User {
  return {
    email: '',
    firstName: 'F',
    surname: 'S',
    organizationId: 'org',
    role: 'operative',
    passwordSet: true,
    policyAccepted: true,
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    permissions: { operativeMode: true },
    ...partial,
  } as unknown as User
}

// Farnie: current users id u1, former invite id INVITE-1 (upper case, as iOS writes), a second users document u1b on
// the same email.
const farnie = user({ id: 'u1', email: 'farnie@x.com', formerUserIds: ['INVITE-1'] })
const farnieCopy = user({ id: 'u1b', email: 'Farnie@x.com', formerUserIds: [] })
const other = user({ id: 'u2', email: 'bo@x.com', formerUserIds: [] })
const roster = [farnie, farnieCopy, other]

const docs: SettingsDocument[] = [
  { id: 'timesheet_u1_1761955200', data: sheet('u1', '2026-11-01') },
  { id: 'timesheet_INVITE-1_1759276800', data: sheet('INVITE-1', '2026-10-01') }, // former invite id
  { id: 'timesheet_u1b_1760486400', data: sheet('u1b', '2026-10-15') }, // same-email second account
  { id: 'timesheet_invite-1_1756684800', data: sheet(undefined, '2026-09-01') }, // no userId, id names the former id
  { id: 'timesheet_u1_1754006400', data: sheet(undefined, '2026-08-01') }, // no userId, id names the own id
  { id: 'timesheet_u2_1761955200', data: sheet('u2', '2026-11-01') }, // someone else's
  { id: 'timesheet_u1_1751328000', data: sheet('u2', '2026-07-01') }, // id names Farnie, stored userId says u2
  { id: 'variations_J1', data: { userId: 'u1' } }, // not a timesheet
]

test('timesheetMemberIds: own id first, then former and same-email ids (personIdSet)', () => {
  const ids = timesheetMemberIds(farnie, roster)
  assert.equal(ids[0], 'u1')
  assert.ok(ids.some((id) => id.toLowerCase() === 'invite-1'))
  assert.ok(ids.includes('u1b'))
  assert.ok(!ids.includes('u2'))
})

test("timesheetDocsForPerson keeps every sheet of the person and nobody else's", () => {
  const ids = timesheetMemberIds(farnie, roster)
  const kept = timesheetDocsForPerson(ids, docs).map((entry) => entry.id).sort()
  assert.deepEqual(kept, [
    'timesheet_INVITE-1_1759276800',
    'timesheet_invite-1_1756684800',
    'timesheet_u1_1754006400',
    'timesheet_u1_1761955200',
    'timesheet_u1b_1760486400',
  ])
  // Before: only `userId == 'u1'`. Everything that read showed is still there.
  const before = docs.filter((entry) => entry.data.userId === 'u1' && entry.id.startsWith('timesheet_')).map((e) => e.id)
  for (const id of before) assert.ok(kept.includes(id), `${id} dropped`)
  // A stored userId always wins over the id the document id names.
  assert.equal(timesheetDocumentOwnerId(docs[6]), 'u2')
})

test('personTimesheetDocs: a refused alias query never costs the own sheets', async () => {
  const ids = timesheetMemberIds(farnie, roster)
  const asked: string[][] = []
  const warnings: string[] = []
  const found = await personTimesheetDocs(ids, {
    byUserIds: async (chunk) => {
      asked.push(chunk)
      if (!chunk.includes('u1')) throw Object.assign(new Error('refused'), { code: 'permission-denied' })
      return docs.filter((entry) => chunk.includes(String(entry.data.userId)))
    },
    byDocumentPrefix: async (id) => {
      if (id !== 'u1') throw Object.assign(new Error('refused'), { code: 'permission-denied' })
      return docs.filter((entry) => entry.id.startsWith(`timesheet_${id}_`))
    },
    warn: (message) => warnings.push(message),
  })
  // The own id is asked on its own (`userId ==`, the query the rules allow everyone for themselves).
  assert.deepEqual(asked[0], ['u1'])
  assert.deepEqual(found.map((entry) => entry.id).sort(), ['timesheet_u1_1754006400', 'timesheet_u1_1761955200'])
  assert.ok(warnings.length > 0)
})

/**
 * Review of #386 (S1): Firestore matches ids exactly as stored, so these mocks do too — `userId ==` / `in` and the
 * document-id prefix are case-sensitive.
 */
function caseSensitiveQueries(source: SettingsDocument[]) {
  return {
    byUserIds: async (chunk: string[]) => source.filter((entry) => chunk.includes(String(entry.data.userId ?? ''))),
    byDocumentPrefix: async (id: string) => source.filter((entry) => entry.id.startsWith(`timesheet_${id}_`)),
  }
}

test('personTimesheetDocs: a viewer allowed every query gets every sheet filed under an id as stored, once', async () => {
  const ids = timesheetMemberIds(farnie, roster)
  const found = (await personTimesheetDocs(ids, caseSensitiveQueries(docs))).map((entry) => entry.id).sort()
  assert.deepEqual(found, [
    'timesheet_INVITE-1_1759276800', // userId == the former invite id
    'timesheet_u1_1754006400', // no userId, the own id's document-id prefix
    'timesheet_u1_1761955200', // userId == own id
    'timesheet_u1b_1760486400', // same-email second account
  ].sort())
  // The old one-id read (`userId == 'u1'`) lost nothing.
  const before = docs.filter((entry) => entry.id.startsWith('timesheet_') && entry.data.userId === ids[0])
  for (const entry of before) assert.ok(found.includes(entry.id), `${entry.id} dropped`)
  // Known limit (S1): a sheet stored without userId under the former id in ANOTHER letter case
  // (`timesheet_invite-1_…`) is not found by these case-sensitive queries.
  assert.ok(!found.includes('timesheet_invite-1_1756684800'))
})

test('personTimesheetDocs: no document-id query when the viewer may not run it (an operative)', async () => {
  const ids = timesheetMemberIds(farnie, roster)
  const queries = caseSensitiveQueries(docs)
  const found = (await personTimesheetDocs(ids, { ...queries, byDocumentPrefix: null })).map((entry) => entry.id)
  assert.ok(!found.includes('timesheet_u1_1754006400'), 'the no-userId sheet needs the prefix query')
  assert.ok(found.includes('timesheet_u1_1761955200'))
})

test('personTimesheetDocs: alias ids are asked in chunks of 10', async () => {
  const many = ['own', ...Array.from({ length: 23 }, (_, index) => `alias${index}`)]
  const sizes: number[] = []
  await personTimesheetDocs(many, {
    byUserIds: async (chunk) => {
      sizes.push(chunk.length)
      return []
    },
    byDocumentPrefix: async () => [],
  })
  assert.deepEqual(sizes.sort((a, b) => a - b), [1, 3, 10, 10])
})

test('personTimesheetDocs: a failure that is not a refusal drops only that alias chunk (as iOS)', async () => {
  const many = ['own', ...Array.from({ length: 12 }, (_, index) => `alias${index}`)]
  const docs = many.map((id) => ({ id: `timesheet_${id}_1761955200`, data: { userId: id } }))
  const warnings: string[] = []
  const asked: string[][] = []
  const found = await personTimesheetDocs(many, {
    byUserIds: async (chunk) => {
      asked.push(chunk)
      if (chunk.includes('alias0')) throw Object.assign(new Error('offline'), { code: 'unavailable' })
      return docs.filter((entry) => chunk.includes(String(entry.data.userId)))
    },
    byDocumentPrefix: null,
    warn: (message) => warnings.push(message),
  })
  // The failing chunk (alias0–alias9) is dropped and not retried id by id; the own sheet and alias10–11 stay.
  assert.deepEqual(found.map((entry) => entry.data.userId).sort(), ['alias10', 'alias11', 'own'])
  assert.equal(asked.filter((chunk) => chunk.length === 1 && chunk[0].startsWith('alias')).length, 0)
  assert.ok(warnings.includes('alias userId query failed'))
})

test('timesheetLookupPlan: only the queries the viewer may run (operatives own id; privatePay on, admins only)', () => {
  const ids = ['U1', 'INVITE-1', 'U1B']
  const admin = { viewerIsOperative: false, viewerIsAdmin: true }
  const manager = { viewerIsOperative: false, viewerIsAdmin: false }
  const operative = { viewerIsOperative: true, viewerIsAdmin: false }
  // privatePay off: admins and managers ask every id and the document-id prefix; an operative their own id only.
  assert.deepEqual(timesheetLookupPlan({ ids, ...admin, privatePay: false }), { ids, includeDocumentPrefix: true })
  assert.deepEqual(timesheetLookupPlan({ ids, ...manager, privatePay: false }), { ids, includeDocumentPrefix: true })
  assert.deepEqual(timesheetLookupPlan({ ids, ...operative, privatePay: false }), { ids: ['U1'], includeDocumentPrefix: false })
  // privatePay on (production): only admins keep the extra lookups; a manager or line manager asks the current id.
  assert.deepEqual(timesheetLookupPlan({ ids, ...admin, privatePay: true }), { ids, includeDocumentPrefix: true })
  assert.deepEqual(timesheetLookupPlan({ ids, ...manager, privatePay: true }), { ids: ['U1'], includeDocumentPrefix: false })
  assert.deepEqual(timesheetLookupPlan({ ids, ...operative, privatePay: true }), { ids: ['U1'], includeDocumentPrefix: false })
})

test('newestFirstOwnIdLast: newest pay run first; within a pay run the own-id sheet comes last and wins', () => {
  const run = (key: string) => new Date(`${key}T00:00:00Z`)
  const rows = [
    { userId: 'u1', weekStart: run('2026-10-01'), key: 'own-oct' },
    { userId: 'INVITE-1', weekStart: run('2026-11-01'), key: 'alias-nov' },
    { userId: 'u1', weekStart: run('2026-11-01'), key: 'own-nov' },
    { userId: 'INVITE-1', weekStart: run('2026-09-01'), key: 'alias-sep' },
  ]
  const ordered = newestFirstOwnIdLast(rows, 'U1')
  assert.deepEqual(
    ordered.map((row) => row.key),
    ['alias-nov', 'own-nov', 'own-oct', 'alias-sep']
  )
  const byRun = new Map<number, string>()
  for (const row of ordered) byRun.set(row.weekStart.getTime(), row.key)
  assert.equal(byRun.get(run('2026-11-01').getTime()), 'own-nov')
  assert.equal(byRun.get(run('2026-09-01').getTime()), 'alias-sep')
})

test('people with no level flag are on an admin\'s User Timesheets and Exported lists (rulebook §11, 1.23.1)', () => {
  const admin = user({ id: 'adm', email: 'adm@x.com', role: 'admin', permissions: { adminAccess: true } as never, adminAccess: true } as never)
  const op = user({ id: 'op', email: 'op@x.com' })
  const flagless = user({ id: 'legacy', email: 'legacy@x.com', role: undefined as never, permissions: {} as never })
  const members = [admin, op, flagless]
  const exported = exportedTimesheetSubjectIds(admin, members)
  const subjects = userTimesheetSubjectIds(admin, members)
  assert.ok(exported.includes('legacy'))
  assert.ok(subjects.includes('legacy'))
  // Nothing previously listed drops out.
  assert.ok(exported.includes('op') && exported.includes('adm'))
  assert.ok(subjects.includes('op'))
})

/**
 * Owner data, Raccord MEP (17 Nov read-only report): 9 exported sheets — 4 by Test Admin, 4 under a stored id nobody in
 * the roster goes by (a deleted person, "QAlPe29v…"), 1 by Farnie Nel — and two users documents "Test Manager" on one
 * email (1 and 3 sheets). Shapes only; no real ids.
 */
test('Raccord-shaped data: an admin sees the deleted person\'s sheets as Unknown person; the two Test Manager records are one person', () => {
  const admin = user({ id: 'admin1', email: 'admin@raccord.test', firstName: 'Test', surname: 'Admin', role: 'admin', isSuperAdmin: true, permissions: { adminAccess: true } as never } as never)
  const farnieNel = user({ id: 'farnie1', email: 'farnie.nel@raccord.test', firstName: 'Farnie', surname: 'Nel' })
  const tmA = user({ id: 'TM-A', email: 'farnie@raccordmep.test', firstName: 'Test', surname: 'Manager', role: 'manager', permissions: { manager: true } as never })
  const tmB = user({ id: 'tm-b', email: 'Farnie@RaccordMEP.test', firstName: 'Test', surname: 'Manager', role: 'manager', permissions: { manager: true } as never, passwordSet: false })
  const roster = [admin, farnieNel, tmA, tmB]
  const deletedId = 'QAlPe29vAbCdEfGhIjKlMnOpQr12'
  const sheets: Array<{ id: string; userId?: string }> = [
    ...[1, 2, 3, 4].map((n) => ({ id: `timesheet_admin1_${n}`, userId: 'admin1' })),
    ...[1, 2, 3, 4].map((n) => ({ id: `timesheet_${deletedId}_${n}`, userId: deletedId })),
    { id: 'timesheet_farnie1_1', userId: 'farnie1' },
    { id: 'timesheet_TM-A_1', userId: 'TM-A' },
    ...[1, 2, 3].map((n) => ({ id: `timesheet_tm-b_${n}` })), // stored without userId (older build)
  ]
  const listed = exportedTimesheetRosterGroups(admin, roster).flat()
  // Both Test Manager records and Farnie are on the admin's Exported people list; so is the admin (own, read-only).
  for (const id of ['admin1', 'farnie1', 'TM-A', 'tm-b']) assert.ok(listed.some((member) => member.id === id), id)

  const owner = exportedSheetOwnerResolver({ users: listed, roster, includeUnresolved: true, organizationId: 'org' })
  const byOwner = new Map<string, number>()
  for (const sheet of sheets) {
    const person = owner(sheet.userId ?? sheet.id.split('_')[1])
    assert.ok(person, `${sheet.id} dropped`)
    byOwner.set(`${person!.firstName} ${person!.surname}|${person!.id}`, (byOwner.get(`${person!.firstName} ${person!.surname}|${person!.id}`) ?? 0) + 1)
  }
  assert.equal(byOwner.get('Test Admin|admin1'), 4)
  assert.equal(byOwner.get('Farnie Nel|farnie1'), 1)
  // One person, listed under the signed-up record, with all 4 sheets.
  assert.equal(byOwner.get('Test Manager|TM-A'), 4)
  assert.ok(![...byOwner.keys()].some((key) => key.endsWith('|tm-b')))
  // The deleted person: one stand-in, all 4 sheets, "Unknown person · QALPE29V", nothing to open.
  const unknown = owner(deletedId)!
  assert.equal(`${unknown.firstName} ${unknown.surname}`, 'Unknown person · QALPE29V')
  assert.equal(byOwner.get(`Unknown person · QALPE29V|${deletedId}`), 4)
  assert.ok(isUnresolvedTimesheetPerson(unknown))
  assert.equal(owner(deletedId), unknown, 'one stand-in per stored id')

  // Not an admin (or the roster still loading): no Unknown person rows, never a wrong person.
  const noUnknown = exportedSheetOwnerResolver({ users: listed, roster, includeUnresolved: false, organizationId: 'org' })
  assert.equal(noUnknown(deletedId), null)
  assert.equal(noUnknown('admin1')?.id, 'admin1')
})

test('timesheetLookupPrivatePay: on until platformConfig/app is read; then the organisation\'s own switch', () => {
  setSecuritySwitchesUnreadForTests()
  assert.equal(timesheetLookupPrivatePay('ORG1'), true, 'not read yet: no query the rules might refuse')
  setSecuritySwitchConfigForTests({ privatePay: false })
  assert.equal(timesheetLookupPrivatePay('ORG1'), false, 'read and off: the list widens')
  setSecuritySwitchConfigForTests({ privatePayOrganizationIds: ['ORG1'] })
  assert.equal(timesheetLookupPrivatePay('ORG1'), true)
  assert.equal(timesheetLookupPrivatePay('ORG2'), false)
  setSecuritySwitchConfigForTests(null)
})

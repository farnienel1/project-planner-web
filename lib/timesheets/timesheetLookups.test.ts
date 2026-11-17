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
  ownIdRowsLast,
  personTimesheetDocs,
  timesheetDocsForPerson,
  timesheetDocumentOwnerId,
  type SettingsDocument,
} from './personTimesheetDocs.ts'
import { timesheetMemberIds } from './timesheetQueue.ts'
import { exportedTimesheetSubjectIds, userTimesheetSubjectIds } from '../permissions.ts'

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

test('personTimesheetDocs: a viewer allowed every query gets every sheet once', async () => {
  const ids = timesheetMemberIds(farnie, roster)
  const found = await personTimesheetDocs(ids, {
    byUserIds: async (chunk) => {
      const keys = chunk.map((id) => id.toLowerCase())
      return docs.filter((entry) => keys.includes(String(entry.data.userId ?? '').toLowerCase()))
    },
    byDocumentPrefix: async (id) =>
      docs.filter((entry) => entry.id.toLowerCase().startsWith(`timesheet_${id.toLowerCase()}_`)),
  })
  assert.equal(found.length, 5)
  assert.equal(new Set(found.map((entry) => entry.id)).size, 5)
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

test('ownIdRowsLast: the sheet filed under the own id wins its pay run', () => {
  const rows = [
    { userId: 'u1', key: 'own' },
    { userId: 'INVITE-1', key: 'alias' },
  ]
  const ordered = ownIdRowsLast(rows, 'U1')
  assert.equal(ordered[ordered.length - 1].key, 'own')
  const byRun = new Map<string, string>()
  for (const row of ordered) byRun.set('run', row.key)
  assert.equal(byRun.get('run'), 'own')
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

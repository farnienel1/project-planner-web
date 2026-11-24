/** Owner console PR 5: the pure parts of the person page and person actions. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  OWNER_NAME_MAX,
  ownerNameChangePlan,
  ownerNameFields,
  ownerNamePartError,
  ownerReasonError,
  rosterRowsForEmails,
  rosterRowsForPerson,
  nameChangeRefusal,
  renameableUserDocs,
} from './personActions.ts'
import { restCommitBody } from './firestoreRest.ts'
import {
  findDirectoryPerson,
  ownerPersonAudit,
  ownerPersonDocument,
  ownerPersonIds,
  ownerPersonOrganisations,
} from './person360.ts'
import { adminAuthRecordFromLookup } from './identityToolkitAdmin.ts'
import { buildOwnerConsoleSeed, SEED_NOW_MS } from '../../scripts/owner-console-seed/seedData.mjs'
import { ownerOrgRows, ownerPeopleRows, selectOwnerPeople, type OwnerPersonRow } from './directory.ts'
import { commandCentreHeadline } from './commandCentre.ts'
import { CONSOLE_PERIODS, resolveConsolePeriod } from '../analytics/consolePeriod.ts'

test('reason: 3–500 characters, trimmed', () => {
  assert.ok(ownerReasonError(''))
  assert.ok(ownerReasonError('  ab '))
  assert.equal(ownerReasonError('Ticket 42'), null)
  assert.ok(ownerReasonError('x'.repeat(501)))
})

test('name parts: required, at most OWNER_NAME_MAX, no control characters', () => {
  assert.ok(ownerNamePartError('first name', ' '))
  assert.equal(ownerNamePartError('first name', 'Sam'), null)
  assert.ok(ownerNamePartError('surname', 'x'.repeat(OWNER_NAME_MAX + 1)))
  assert.ok(ownerNamePartError('surname', 'Lee\u0007'))
})

test('name fields: the five fields both apps write (identityFields)', () => {
  assert.deepEqual(ownerNameFields(' Sam ', ' Lee '), { firstName: 'Sam', surname: 'Lee', lastName: 'Lee', name: 'Sam Lee', displayName: 'Sam Lee' })
})

test('change name: only the name fields of documents whose name differs are written (partial update)', () => {
  const plan = ownerNameChangePlan({
    firstName: 'Samuel',
    surname: 'Lee',
    userDocs: [
      { id: 'u1', data: { firstName: 'Sam', surname: 'Lee', lastName: 'Lee', name: 'Sam Lee', displayName: 'Sam Lee', email: 'sam@x.co', dayRate: 200, organizationId: 'org-a' } },
      { id: 'u2', data: { firstName: 'Samuel', surname: 'Lee', lastName: 'Lee', name: 'Samuel Lee', displayName: 'Samuel Lee', organizationId: 'org-b' } },
    ],
    rosterRows: [{ id: 'op1', organizationId: 'org-a', collection: 'operatives', data: { firstName: 'Sam', lastName: 'Lee', name: 'Sam Lee', email: 'SAM@x.co', dayRate: 200 } }],
  })
  assert.equal(plan.unchanged, false)
  assert.deepEqual(plan.users, [{ id: 'u1', organizationId: 'org-a' }])
  assert.deepEqual(plan.rows, [{ organizationId: 'org-a', collection: 'operatives', id: 'op1' }])
  const userWrite = plan.writes.find((write) => write.path === 'users/u1')
  assert.ok(userWrite)
  // Every key written is a name field: never pay, email or organisation.
  for (const key of Object.keys(userWrite.set)) assert.ok(['firstName', 'surname', 'lastName', 'name', 'displayName'].includes(key), key)
  assert.equal(userWrite.set.firstName, 'Samuel')
  const rowWrite = plan.writes.find((write) => write.path === 'organizations/org-a/operatives/op1')
  assert.ok(rowWrite)
  assert.equal(rowWrite.set.name, 'Samuel Lee')
  assert.equal('dayRate' in rowWrite.set, false)
})

test('change name: the same name everywhere writes nothing', () => {
  const plan = ownerNameChangePlan({
    firstName: 'Sam',
    surname: 'Lee',
    userDocs: [{ id: 'u1', data: { firstName: 'Sam', surname: 'Lee', lastName: 'Lee', name: 'Sam Lee', displayName: 'Sam Lee' } }],
    rosterRows: [],
  })
  assert.equal(plan.unchanged, true)
  assert.equal(plan.writes.length, 0)
})

test('roster rows on the person’s emails, without case', () => {
  const rows = [
    { id: 'a', data: { email: ' Sam@X.co ' } },
    { id: 'b', data: { email: 'other@x.co' } },
    { id: 'c', data: {} },
  ]
  assert.deepEqual(rosterRowsForEmails(rows, ['sam@x.co']).map((row) => row.id), ['a'])
  assert.deepEqual(rosterRowsForEmails(rows, []), [])
})

test('commit body: update mask, never a re-create, write metadata and server time', () => {
  const body = restCommitBody(
    'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents',
    [{ path: 'users/u1', set: { firstName: 'Sam' }, remove: ['displayName'] }],
    'owner-uid'
  )
  const write = body.writes[0]
  assert.equal(write.update.name, 'projects/demo/databases/(default)/documents/users/u1')
  assert.deepEqual(write.currentDocument, { exists: true })
  assert.deepEqual(write.updateMask.fieldPaths.sort(), ['displayName', 'firstName', 'updatedBy', 'updatedFrom'])
  assert.deepEqual(write.update.fields.updatedBy, { stringValue: 'owner-uid' })
  assert.deepEqual(write.update.fields.updatedFrom, { stringValue: 'web' })
  assert.deepEqual(write.updateTransforms, [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }])
  assert.equal('displayName' in write.update.fields, false)
})

const seed = buildOwnerConsoleSeed()
const orgRows = ownerOrgRows(seed.orgs, SEED_NOW_MS)
const peopleRows = ownerPeopleRows(seed.users, orgRows, seed.orgs)

test('PR 5 / #433 S2: People ?seen= and ?joined= totals equal the Overview tiles for every period', () => {
  const now = new Date(SEED_NOW_MS)
  for (const period of CONSOLE_PERIODS.map((item) => item.id)) {
    const range = resolveConsolePeriod(period, now)
    for (const includeTestData of [false, true]) {
      const headline = commandCentreHeadline({ orgRows, peopleRows, range, includeTestData, nowMs: SEED_NOW_MS })
      assert.equal(selectOwnerPeople(peopleRows, { includeTestData, seenIn: range }).total, headline.activePeople.value, `seen ${period}`)
      assert.equal(selectOwnerPeople(peopleRows, { includeTestData, joinedIn: range }).total, headline.newPeople.value, `joined ${period}`)
    }
  }
})

test('person page: found under any of their users document ids, without case', () => {
  const row: OwnerPersonRow = {
    id: 'kept',
    userIds: ['kept', 'Placeholder-ID'],
    name: 'Sam',
    emailMasked: 's***@x.co',
    role: 'Operative',
    segment: 'active',
    organizationIds: [],
    organizationNames: [],
    lastSeenAtMs: null,
    createdAtMs: null,
    ghost: false,
    isTest: false,
  }
  assert.equal(findDirectoryPerson([row], 'placeholder-id')?.id, 'kept')
  assert.equal(findDirectoryPerson([row], 'nobody'), null)
})

test('person page document: email masked, no pay, tax or tokens; token count only', () => {
  const doc = ownerPersonDocument({
    id: 'u1',
    data: { email: 'sam@example.com', dayRate: 250, hourlyRate: 30, utrNumber: '123', pushTokens: ['a', 'b', 'a'], firstName: 'Sam', surname: 'Lee', passwordSet: true, isActive: true },
  })
  const json = JSON.stringify(doc)
  assert.equal(json.includes('sam@example.com'), false)
  assert.equal(json.includes('250'), false)
  assert.equal(json.includes('"a"'), false)
  assert.equal(doc.pushTokenCount, 2)
  assert.equal(doc.segment, 'active')
  assert.equal(doc.lastSeenFrom, null)
})

test('person page: level per organisation from the rulebook (creator, members map, users document)', () => {
  const userDocs = [{ id: 'u1', data: { organizationId: 'org-home', role: 'operative', operativeMode: true } }]
  const ids = ownerPersonIds({ id: 'u1', userIds: ['u1'] } as OwnerPersonRow, userDocs)
  const orgs = ownerPersonOrganisations({
    organizationIds: ['org-home', 'org-other', 'org-made'],
    userDocs,
    personIds: ids,
    orgRows: [],
    orgDocs: [
      { id: 'org-home', data: {} },
      { id: 'org-other', data: { members: { U1: 'manager' } } },
      { id: 'org-made', data: { creatorUserId: 'u1' } },
    ],
    memberships: new Map(),
  })
  assert.deepEqual(
    orgs.map((org) => [org.id, org.level, org.isSuperAdmin, org.name]),
    [
      ['org-home', 'operative', false, 'Unknown organisation'],
      ['org-other', 'manager', false, 'Unknown organisation'],
      ['org-made', 'admin', true, 'Unknown organisation'],
    ]
  )
})

test('person audit: only this person, one row per request (latest step), newest first, reveals listed', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 20, h)).toISOString()
  const rows = ownerPersonAudit(
    [
      { id: '1', data: { requestId: 'r1', action: 'ownerChangeUserName', phase: 'requested', at: at(1), targetUserId: 'U1', reason: 'typo' } },
      { id: '2', data: { requestId: 'r1', action: 'ownerChangeUserName', phase: 'completed', at: at(2), targetUserId: 'u1' } },
      { id: '3', data: { requestId: 'r2', action: 'ownerRevealEmail', phase: 'completed', at: at(3), targetUserId: 'u1' } },
      { id: '4', data: { requestId: 'r3', action: 'ownerRevokeSessions', phase: 'completed', at: at(4), targetUserId: 'someone-else' } },
    ],
    ['u1']
  )
  assert.deepEqual(rows.map((row) => [row.action, row.phase, row.reason]), [
    ['ownerRevealEmail', 'completed', ''],
    ['ownerChangeUserName', 'completed', 'typo'],
  ])
  assert.equal(rows[1].label, 'Changed a name')
})

test('Auth record: provider ids only, times read, validSince in seconds', () => {
  const record = adminAuthRecordFromLookup({
    localId: 'u1',
    email: 'Sam@X.co',
    emailVerified: true,
    disabled: false,
    createdAt: '1000',
    lastLoginAt: '2000',
    lastRefreshAt: '2026-11-20T10:00:00.000Z',
    validSince: '3',
    passwordHash: 'secret',
    providerUserInfo: [{ providerId: 'password', rawId: 'x' }],
  })
  assert.ok(record)
  assert.equal(record.email, 'sam@x.co')
  assert.equal(record.validSinceMs, 3000)
  assert.equal(record.lastRefreshAtMs, Date.parse('2026-11-20T10:00:00.000Z'))
  assert.deepEqual(record.providers, ['password'])
  assert.equal(JSON.stringify(record).includes('secret'), false)
})

test('review of #434: a rename is refused when any users document is an anonymised deleted profile', () => {
  assert.equal(nameChangeRefusal([{ id: 'u1', data: { email: 'sam@x.co', firstName: 'Sam' } }]), null)
  assert.ok(nameChangeRefusal([{ id: 'u1', data: { email: 'sam@x.co', firstName: 'Sam' } }, { id: 'u2', data: { email: '', firstName: 'Deleted', surname: 'user' } }]))
})

test('review of #434: only documents on the person’s email, or with no email, are renamed', () => {
  const docs = [
    { id: 'kept', data: { email: 'Sam@X.co' } },
    { id: 'placeholder', data: {} },
    { id: 'moved-on', data: { email: 'someone.else@x.co' } },
  ]
  assert.deepEqual(renameableUserDocs(docs, ['sam@x.co']).map((doc) => doc.id), ['kept', 'placeholder'])
})

test('review of #434: a row with no email is the person’s when its id is one of theirs (a converted ghost)', () => {
  const rows = [
    { id: 'GHOST-1', data: { firstName: 'Gus' } },
    { id: 'other', data: {} },
    { id: 'emailed', data: { email: 'x@y.co' } },
  ]
  assert.deepEqual(rosterRowsForPerson(rows, ['sam@x.co'], ['ghost-1', 'emailed']).map((row) => row.id), ['GHOST-1'])
})

test('review of #434: the commit uses each document’s read updateTime as its precondition', () => {
  const plan = ownerNameChangePlan({
    firstName: 'New',
    surname: 'Name',
    userDocs: [{ id: 'u1', updateTime: '2026-11-23T10:00:00.000001Z', data: { firstName: 'Old', surname: 'Name' } }],
    rosterRows: [],
  })
  const body = restCommitBody('https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents', plan.writes, 'owner-uid')
  assert.deepEqual(body.writes[0].currentDocument, { updateTime: '2026-11-23T10:00:00.000001Z' })
})

test('1.81.0 change name in one organisation only: its memberNames entry and its rows, never a users document', () => {
  const plan = ownerNameChangePlan({
    firstName: 'Farns',
    surname: 'Nel',
    userDocs: [{ id: 'u1', data: { firstName: 'Farnie', surname: 'Nel', organizationId: 'A' } }],
    rosterRows: [
      { id: 'r1', organizationId: 'B', collection: 'operatives', data: { firstName: 'Farnie', lastName: 'Nel', name: 'Farnie Nel' } },
      { id: 'r2', organizationId: 'A', collection: 'operatives', data: { firstName: 'Farnie', lastName: 'Nel', name: 'Farnie Nel' } },
    ],
    scope: 'organization',
    organizationId: 'B',
    keptUserId: 'u1',
  })
  assert.deepEqual(plan.users, [])
  assert.deepEqual(plan.memberNames, [{ organizationId: 'B', action: 'set' }])
  assert.deepEqual(plan.writes.map((write) => [write.path, write.kind ?? 'update']), [
    ['organizations/B/memberNames/u1', 'upsert'],
    ['organizations/B/operatives/r1', 'update'],
  ])
})

test('1.81.0 change name everywhere removes the organisation names that exist', () => {
  const plan = ownerNameChangePlan({
    firstName: 'Farns',
    surname: 'Nel',
    userDocs: [{ id: 'u1', data: { firstName: 'Farnie', surname: 'Nel', organizationId: 'A' } }],
    rosterRows: [],
    organizationIds: ['A', 'B'],
    existingMemberNames: new Set(['b/u1']),
  })
  assert.deepEqual(plan.memberNames, [{ organizationId: 'B', action: 'removed' }])
  assert.deepEqual(plan.writes.map((write) => [write.path, write.kind ?? 'update']), [
    ['organizations/B/memberNames/u1', 'delete'],
    ['users/u1', 'update'],
  ])
})

test('review of #439: "this organisation only" on the home organisation writes its users document and removes its entry', () => {
  const plan = ownerNameChangePlan({
    firstName: 'Farns',
    surname: 'Nel',
    userDocs: [{ id: 'u1', data: { firstName: 'Farnie', surname: 'Nel', organizationId: 'organizations/A' } }],
    rosterRows: [],
    scope: 'organization',
    organizationId: 'A',
    keptUserId: 'u1',
    existingMemberNames: new Set(['a/u1']),
  })
  assert.deepEqual(plan.writes.map((write) => [write.path, write.kind ?? 'update']), [
    ['users/u1', 'update'],
    ['organizations/A/memberNames/u1', 'delete'],
  ])
})

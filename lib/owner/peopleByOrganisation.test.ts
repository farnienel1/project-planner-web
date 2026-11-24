/** Owner console People list (owner request 24 Nov): browse by organisation, and each organisation's line manager. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownerPeopleRows, selectOwnerPeople } from './directory.ts'
import { LINE_MANAGER_NOT_RECORDED_LABEL, organisationRoster, ownerLineManagerHere, ownerPersonIds, ownerPersonOrganisations } from './person360.ts'
import type { OwnerPersonRow } from './directory.ts'

const users = [
  { id: 'jane-a', data: { email: 'jane@x.com', firstName: 'Jane', surname: 'Smith', organizationId: 'org-a', passwordSet: true, assignedManagerUserIds: ['boss-a'], operativeMode: true } },
  { id: 'jane-b', data: { email: 'JANE@x.com', firstName: 'Jane', surname: 'S', organizationId: 'org-b', passwordSet: true, hasNoLineManager: true, adminAccess: true } },
  { id: 'boss-a', data: { email: 'boss@x.com', firstName: 'Bob', surname: 'Boss', organizationId: 'org-a', passwordSet: true, manager: true } },
  { id: 'other', data: { email: 'other@x.com', firstName: 'Olly', surname: 'Other', organizationId: 'org-b', passwordSet: true } },
]
const orgRows = [
  { id: 'org-a', name: 'Alpha', isTest: false },
  { id: 'org-b', name: 'Beta', isTest: false },
]

test('people: one row per email, filtered by organisation', () => {
  const rows = ownerPeopleRows(users, orgRows)
  const jane = rows.find((row) => row.name.startsWith('Jane'))
  assert.ok(jane)
  assert.deepEqual(jane.organizationIds, ['org-a', 'org-b'])
  assert.equal(rows.filter((row) => row.name.startsWith('Jane')).length, 1)
  const inA = selectOwnerPeople(rows, { organizationId: 'org-a' }).rows.map((row) => row.name).sort()
  assert.deepEqual(inA, ['Bob Boss', jane.name].sort())
  const inB = selectOwnerPeople(rows, { organizationId: 'org-b' }).rows.map((row) => row.name).sort()
  assert.deepEqual(inB, [jane.name, 'Olly Other'].sort())
  assert.equal(selectOwnerPeople(rows, { organizationId: 'org-none' }).total, 0)
  assert.equal(selectOwnerPeople(rows, {}).total, 3)
})

test('line manager here: resolved on that organisation\'s roster; none stored, none chosen, or no record here', () => {
  const rosterA = organisationRoster({ orgId: 'org-a', orgData: {}, allUserDocs: users })
  assert.deepEqual(rosterA.map((row) => row.id).sort(), ['boss-a', 'jane-a'])
  assert.deepEqual(ownerLineManagerHere(users[0], rosterA), { label: 'Bob Boss', names: ['Bob Boss'], recorded: true, incomplete: false })
  const rosterB = organisationRoster({ orgId: 'org-b', orgData: {}, allUserDocs: users })
  assert.deepEqual(ownerLineManagerHere(users[1], rosterB), { label: 'No line manager', names: [], recorded: true, incomplete: false })
  assert.equal(ownerLineManagerHere(users[3], rosterB).label, 'Not set')
  assert.deepEqual(ownerLineManagerHere(null, []), { label: LINE_MANAGER_NOT_RECORDED_LABEL, names: [], recorded: false, incomplete: false })
})

test('line manager here: an anchored member (users doc in another company) resolves, with this organisation\'s name for them', () => {
  // Jane is in org-a; her line manager "remote" belongs to org-z but is listed in org-a's members map (review of #445, 1).
  const docs = [
    { id: 'jane', data: { email: 'jane@x.com', firstName: 'Jane', surname: 'Smith', organizationId: 'org-a', passwordSet: true, assignedManagerUserIds: ['remote'] } },
    { id: 'remote', data: { email: 'r@x.com', firstName: 'Rita', surname: 'Home', organizationId: 'org-z', passwordSet: true, manager: true } },
  ]
  const orgData = { members: { remote: 'manager', jane: 'operative' } }
  const plain = ownerLineManagerHere(docs[0], organisationRoster({ orgId: 'org-a', orgData, allUserDocs: docs }))
  assert.equal(plain.label, 'Rita Home')
  // Without the members map she is not on org-a's roster: "Unknown person", flagged only when the read was cut short.
  const unanchored = ownerLineManagerHere(docs[0], organisationRoster({ orgId: 'org-a', orgData: {}, allUserDocs: docs }))
  assert.equal(unanchored.label, 'Unknown person')
  assert.equal(unanchored.incomplete, false)
  assert.equal(ownerLineManagerHere(docs[0], organisationRoster({ orgId: 'org-a', orgData: {}, allUserDocs: docs }), { truncated: true }).incomplete, true)
  // 1.82.0: org-a's own name for her wins (the same source as the "Name there" column).
  const named = ownerPersonOrganisations({
    organizationIds: ['org-a'],
    userDocs: [docs[0]],
    personIds: ['jane'],
    orgRows: [],
    orgDocs: [{ id: 'org-a', data: orgData }],
    memberships: new Map(),
    memberNames: new Map([['org-a', { remote: { firstName: 'Rita', surname: 'Alpha', displayName: 'Rita Alpha' } }]]),
    allUserDocs: docs,
  })
  assert.equal(named[0].lineManager?.label, 'Rita Alpha')
  assert.equal(named[0].nameHere, 'Jane Smith')
})

test('person organisations: name, level, active and line manager per organisation', () => {
  const personDocs = [users[0], users[1]]
  const row = { id: 'jane-a', userIds: ['jane-a', 'jane-b'] } as OwnerPersonRow
  const ids = ownerPersonIds(row, personDocs)
  const orgs = ownerPersonOrganisations({
    organizationIds: ['org-a', 'org-b', 'org-c'],
    userDocs: personDocs,
    personIds: ids,
    orgRows: [],
    orgDocs: [{ id: 'org-c', data: { members: { 'jane-a': 'manager' } } }],
    memberships: new Map([['org-c', { accountActive: false }]]),
    allUserDocs: users,
  })
  assert.deepEqual(
    orgs.map((org) => [org.id, org.level, org.active, org.lineManager?.label]),
    [
      ['org-a', 'operative', true, 'Bob Boss'],
      ['org-b', 'admin', true, 'No line manager'],
      ['org-c', 'manager', false, LINE_MANAGER_NOT_RECORDED_LABEL],
    ]
  )
  // Without the directory's users documents, the line manager is not worked out (never a guess).
  const without = ownerPersonOrganisations({ organizationIds: ['org-a'], userDocs: personDocs, personIds: ids, orgRows: [], orgDocs: [], memberships: new Map() })
  assert.equal(without[0].lineManager, null)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accountName,
  applyMemberNames,
  canWriteMemberName,
  displayNameInOrganization,
  memberNameEditTarget,
  memberNameFor,
  memberNameValidationError,
  memberNameWriteFields,
  parseMemberNameDocument,
  parseMemberNameDocuments,
  MEMBER_NAME_REQUIRED_MESSAGE,
  MEMBER_NAME_TOO_LONG_MESSAGE,
} from './memberNames'
import { parseUserDocument } from './peopleDocuments'
import { rosterMembersForOrganization } from './orgRoster'

const farnie = { id: 'UID-1', firstName: 'Farnie', surname: 'Nel', email: 'f@x.com', organizationId: 'orgA' }

test('1.81.0 no entry: the users document name, exactly as before (guardrail 3)', () => {
  const name = displayNameInOrganization({ person: farnie, names: {} })
  assert.deepEqual(name, { firstName: 'Farnie', surname: 'Nel', displayName: 'Farnie Nel', source: 'account' })
  assert.deepEqual(applyMemberNames([farnie], {})[0], farnie)
  assert.deepEqual(accountName({ displayName: 'Jo Bloggs Smith' }), { firstName: 'Jo', surname: 'Bloggs Smith', displayName: 'Jo Bloggs Smith', source: 'account' })
})

test('1.81.0 an entry wins in its organisation, matched without case and under former / same-email ids', () => {
  const names = parseMemberNameDocuments([{ id: 'uid-1', data: { firstName: ' Farns ', surname: 'Nel' } }, { id: 'blank', data: { firstName: ' ' } }])
  assert.equal(Object.keys(names).length, 1)
  assert.equal(displayNameInOrganization({ person: farnie, names }).displayName, 'Farns Nel')
  assert.equal(displayNameInOrganization({ person: farnie, names }).source, 'organization')
  const viaFormer = { id: 'NEW', firstName: 'Farnie', surname: 'Nel', formerUserIds: ['uid-1'] }
  assert.equal(memberNameFor(viaFormer, names)?.firstName, 'Farns')
  const [row] = applyMemberNames([{ ...farnie, lastName: 'Old', name: 'Old', displayName: 'Old', role: 'admin' }], names)
  assert.deepEqual(row, { ...farnie, firstName: 'Farns', surname: 'Nel', lastName: 'Nel', name: 'Farns Nel', displayName: 'Farns Nel', role: 'admin' })
  assert.equal(parseMemberNameDocument('x', { firstName: '', surname: '' }), null)
  assert.equal(parseMemberNameDocument('', { firstName: 'A' }), null)
})

test('1.81.0 parseUserDocument and rosterMembersForOrganization take the entry; other keys unchanged', () => {
  const plain = parseUserDocument('UID-1', farnie)!
  const named = parseUserDocument('UID-1', farnie, { memberName: { firstName: 'Farns', surname: 'Nel' } })!
  assert.equal(named.displayName, 'Farns Nel')
  assert.equal(named.firstName, 'Farns')
  assert.deepEqual({ ...named, firstName: plain.firstName, displayName: plain.displayName }, plain)
  assert.deepEqual(parseUserDocument('UID-1', farnie, { memberName: { firstName: ' ', surname: '' } }), plain)
  const roster = rosterMembersForOrganization({
    organizationId: 'orgB',
    users: [{ ...farnie, organizationId: 'orgA' }],
    members: { 'UID-1': 'manager' },
    memberNames: parseMemberNameDocuments([{ id: 'UID-1', data: { firstName: 'Farns', surname: 'Nel' } }]),
  })
  assert.equal(roster.people[0].firstName, 'Farns')
  assert.equal(roster.people[0].organizationLevel.level, 'manager')
  const without = rosterMembersForOrganization({ organizationId: 'orgB', users: [{ ...farnie, organizationId: 'orgA' }], members: { 'UID-1': 'manager' } })
  assert.equal(without.people[0].firstName, 'Farnie')
})

test('1.81.0 where an edit is saved: the home organisation keeps the users document', () => {
  assert.equal(memberNameEditTarget({ organizationId: 'orgA', homeOrganizationId: 'orgA' }), 'account')
  assert.equal(memberNameEditTarget({ organizationId: 'ORGA', homeOrganizationId: 'organizations/orgA' }), 'account')
  assert.equal(memberNameEditTarget({ organizationId: 'orgB', homeOrganizationId: 'orgA' }), 'organization')
  assert.equal(memberNameEditTarget({ organizationId: 'orgB', homeOrganizationId: '' }), 'account')
})

test('1.81.0 write shape, checks and who may write', () => {
  assert.deepEqual(memberNameWriteFields({ firstName: ' Farns ', surname: ' Nel ', writerUserId: 'a', platform: 'web' }), {
    firstName: 'Farns', surname: 'Nel', updatedBy: 'a', updatedFrom: 'web',
  })
  assert.equal(memberNameWriteFields({ firstName: '', surname: 'x', writerUserId: 'a', platform: 'web' }), null)
  assert.equal(memberNameValidationError({ firstName: '  ', surname: '' }), MEMBER_NAME_REQUIRED_MESSAGE)
  assert.equal(memberNameValidationError({ firstName: 'a', surname: 'b'.repeat(101) }), MEMBER_NAME_TOO_LONG_MESSAGE)
  assert.equal(canWriteMemberName({ writerUserId: 'U', subjectUserId: 'u', writerIsAdmin: false }), true)
  assert.equal(canWriteMemberName({ writerUserId: 'mgr', subjectUserId: 'u', writerIsAdmin: false }), false)
  assert.equal(canWriteMemberName({ writerUserId: 'adm', subjectUserId: 'u', writerIsAdmin: true }), true)
})

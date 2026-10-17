import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_DELETE_COPY,
  DELETED_PRODUCT_EVENT_USER_ID,
  DELETED_USER_DISPLAY_NAME,
  SOLE_ADMIN_CODE,
  adminLikeFromUserFields,
  collectMembershipIds,
  commentAnonymisePatch,
  findSoleAdminBlock,
  soleAdminErrorBody,
  ideaAuthorAnonymisePatch,
  isAdminLike,
  ownerAccountDeleteBlock,
  parseAccountDeleteBody,
  changedAnonymisePatch,
  pickCreatorSuccessor,
  placeholderDeleteFallbackPatch,
  profileAlreadyAnonymised,
  resolveAccountDeleteEmail,
  retryFinishesWithoutOrgScan,
  isUnusedInvitePlaceholder,
  unusedInvitationShouldDelete,
  rosterAnonymisePatch,
  timesheetSnapshotShouldStay,
  unsignedTimesheetAnonymisePatch,
  type OrgDeleteSnapshot,
} from './accountDelete.ts'

function org(partial: Partial<OrgDeleteSnapshot> & Pick<OrgDeleteSnapshot, 'orgId'>): OrgDeleteSnapshot {
  return {
    orgName: partial.orgName || 'North Ltd',
    creatorUserId: partial.creatorUserId || '',
    members: partial.members || {},
    memberFlags: partial.memberFlags || [],
    ...partial,
  }
}

test('rejects missing confirmation or password', () => {
  assert.equal(parseAccountDeleteBody({}).ok, false)
  assert.equal(parseAccountDeleteBody({ confirmation: 'DELETE' }).ok, false)
  assert.equal(parseAccountDeleteBody({ password: 'secret' }).ok, false)
  assert.equal(parseAccountDeleteBody({ confirmation: 'delete', password: 'secret' }).ok, false)
  const parsed = parseAccountDeleteBody({ confirmation: ' DELETE ', password: 'secret' })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.confirmation, ACCOUNT_DELETE_CONFIRMATION)
    assert.equal(parsed.password, 'secret')
  }
})

test('blocks the platform owner account', () => {
  const blocked = ownerAccountDeleteBlock('info@projectplanner.us')
  assert.equal(blocked?.status, 403)
  assert.equal(ownerAccountDeleteBlock('ada@site.com'), null)
})

test('sole admin of any org returns 409 payload fields', () => {
  const onlyAdmin = org({
    orgId: 'org-a',
    orgName: 'Solo Ltd',
    creatorUserId: 'u1',
    members: { u1: 'admin' },
    memberFlags: [{ uid: 'u1', flags: { isSuperAdmin: true, role: 'admin', memberRole: 'admin' } }],
  })
  const block = findSoleAdminBlock('u1', [onlyAdmin])
  assert.deepEqual(block, { code: SOLE_ADMIN_CODE, orgId: 'org-a', orgName: 'Solo Ltd' })
  assert.deepEqual(soleAdminErrorBody(block!), {
    error: 'You are the only admin of Solo Ltd. Transfer admin access first, or email info@projectplanner.us.',
    code: SOLE_ADMIN_CODE,
    orgId: 'org-a',
    orgName: 'Solo Ltd',
  })
})

test('adminAccess or members[uid]==admin counts as the last admin', () => {
  const byFlag = org({
    orgId: 'org-b',
    members: { u1: 'manager', u2: 'operative' },
    memberFlags: [
      { uid: 'u1', flags: { adminAccess: true, memberRole: 'manager' } },
      { uid: 'u2', flags: { role: 'operative', memberRole: 'operative' } },
    ],
  })
  assert.equal(findSoleAdminBlock('u1', [byFlag])?.orgId, 'org-b')

  const byMap = org({
    orgId: 'org-c',
    members: { u1: 'admin', u2: 'manager' },
    memberFlags: [
      { uid: 'u1', flags: { memberRole: 'admin' } },
      { uid: 'u2', flags: { role: 'manager', memberRole: 'manager' } },
    ],
  })
  assert.equal(findSoleAdminBlock('u1', [byMap])?.orgId, 'org-c')
})

test('another admin remaining is not a sole-admin block', () => {
  const twoAdmins = org({
    orgId: 'org-d',
    creatorUserId: 'u1',
    members: { u1: 'admin', u2: 'admin' },
    memberFlags: [
      { uid: 'u1', flags: { role: 'admin', memberRole: 'admin' } },
      { uid: 'u2', flags: { adminAccess: true, memberRole: 'admin' } },
    ],
  })
  assert.equal(findSoleAdminBlock('u1', [twoAdmins]), null)
  assert.equal(pickCreatorSuccessor('u1', twoAdmins), 'u2')
})

test('creator with no remaining admin is blocked before delete', () => {
  const creatorOnly = org({
    orgId: 'org-e',
    orgName: 'Empty Ltd',
    creatorUserId: 'u1',
    members: { u1: 'manager', u2: 'operative' },
    memberFlags: [
      { uid: 'u1', flags: { role: 'manager', memberRole: 'manager' } },
      { uid: 'u2', flags: { role: 'operative', memberRole: 'operative' } },
    ],
  })
  assert.equal(findSoleAdminBlock('u1', [creatorOnly])?.code, SOLE_ADMIN_CODE)
  assert.equal(pickCreatorSuccessor('u1', creatorOnly), null)
})

test('non-admin member can leave when another admin remains', () => {
  const crew = org({
    orgId: 'org-f',
    creatorUserId: 'admin1',
    members: { u1: 'operative', admin1: 'admin' },
    memberFlags: [
      { uid: 'u1', flags: { role: 'operative', memberRole: 'operative' } },
      { uid: 'admin1', flags: { isSuperAdmin: true, memberRole: 'admin' } },
    ],
  })
  assert.equal(findSoleAdminBlock('u1', [crew]), null)
  assert.equal(pickCreatorSuccessor('u1', crew), null)
})

test('isAdminLike reads the locked admin signals', () => {
  assert.equal(isAdminLike({ isSuperAdmin: true }), true)
  assert.equal(isAdminLike({ adminAccess: true }), true)
  assert.equal(isAdminLike({ permissions: { adminAccess: true } }), true)
  assert.equal(isAdminLike({ role: 'admin' }), true)
  assert.equal(isAdminLike({ memberRole: 'admin' }), true)
  assert.equal(isAdminLike({ role: 'manager', memberRole: 'manager' }), false)
  assert.deepEqual(adminLikeFromUserFields({ isSuperAdmin: true, role: 'admin', permissions: { adminAccess: true } }, 'admin'), {
    isSuperAdmin: true,
    adminAccess: false,
    role: 'admin',
    memberRole: 'admin',
    permissions: { adminAccess: true },
  })
})

test('roster anonymise uses Deleted user and clears contact fields that already exist', () => {
  const patch = rosterAnonymisePatch({
    firstName: 'Ada',
    surname: 'Lovelace',
    email: 'ada@site.com',
    mobileNumber: '07700',
    profilePhotoURL: 'https://example.com/a.jpg',
    vatNumber: 'GB1',
    utrNumber: 'UTR1',
    dayRate: 220,
  })
  assert.equal(patch.firstName, 'Deleted')
  assert.equal(patch.surname, 'user')
  assert.equal(patch.email, '')
  assert.equal(patch.mobileNumber, '')
  assert.equal(patch.profilePhotoURL, '')
  assert.equal(patch.vatNumber, '')
  assert.equal(patch.utrNumber, '')
  assert.equal('dayRate' in patch, false)
})

test('an already anonymised profile with no memberships does not need another org scan', () => {
  const scrubbed = {
    email: '',
    name: 'Deleted user',
    displayName: 'Deleted user',
    firstName: 'Deleted',
    isActive: true,
    passwordSet: true,
    role: 'operative',
    organizationId: '2C67391E-D1FE-4F9F-8055-7149ACDE1F96',
  }
  assert.equal(profileAlreadyAnonymised(scrubbed), true)
  assert.equal(retryFinishesWithoutOrgScan({ profile: scrubbed, membershipCount: 0 }), true)
  assert.equal(retryFinishesWithoutOrgScan({ profile: scrubbed, membershipCount: 1 }), false)
  const withSurname = { ...scrubbed, surname: 'user' }
  assert.deepEqual(changedAnonymisePatch(withSurname, rosterAnonymisePatch(withSurname)), {})

  const stillNamed = {
    email: 'farnienel@hotmail.com',
    name: 'Test Operative',
    displayName: 'Test Operative',
    firstName: 'Test',
    role: 'operative',
  }
  assert.equal(profileAlreadyAnonymised(stillNamed), false)
  assert.equal(retryFinishesWithoutOrgScan({ profile: stillNamed, membershipCount: 0 }), false)
  assert.equal(retryFinishesWithoutOrgScan({ profile: null, membershipCount: 0 }), false)

  const phoneLeft = { ...scrubbed, mobileNumber: '07700' }
  assert.equal(profileAlreadyAnonymised(phoneLeft), false)
})

test('unused invite placeholders are the passwordSet false users/{uuid} still holding the live email', () => {
  const email = 'farnienel@hotmail.com'
  assert.equal(
    isUnusedInvitePlaceholder({
      userId: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
      deletingUid: 'QAlPe29vLLP4spK554UtpaBLW7N2',
      email,
      userEmail: 'Farnienel@Hotmail.com',
      passwordSet: false,
    }),
    true
  )
  assert.equal(
    isUnusedInvitePlaceholder({
      userId: 'QAlPe29vLLP4spK554UtpaBLW7N2',
      deletingUid: 'QAlPe29vLLP4spK554UtpaBLW7N2',
      email,
      userEmail: email,
      passwordSet: false,
    }),
    false
  )
  assert.equal(
    isUnusedInvitePlaceholder({
      userId: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
      deletingUid: 'QAlPe29vLLP4spK554UtpaBLW7N2',
      email,
      userEmail: email,
      passwordSet: true,
    }),
    false
  )
  assert.equal(
    isUnusedInvitePlaceholder({
      userId: 'QAlPe29vLLP4spK554UtpaBLW7N2',
      deletingUid: 'other-auth-uid',
      email,
      userEmail: email,
      passwordSet: false,
    }),
    false
  )
  assert.equal(
    isUnusedInvitePlaceholder({
      userId: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
      deletingUid: 'QAlPe29vLLP4spK554UtpaBLW7N2',
      email,
      userEmail: email,
      passwordSet: undefined,
    }),
    false
  )
  assert.equal(unusedInvitationShouldDelete({ email, isUsed: false }), true)
  assert.equal(unusedInvitationShouldDelete({ email, isUsed: true }), false)
})

test('unsigned timesheet drafts anonymise; signed and exported snapshots stay', () => {
  const unsigned = { userId: 'u1', firstName: 'Ada', email: 'ada@site.com' }
  assert.equal(timesheetSnapshotShouldStay(unsigned), false)
  assert.deepEqual(unsignedTimesheetAnonymisePatch(unsigned), {
    firstName: 'Deleted',
    email: '',
  })

  const signed = {
    userId: 'u1',
    firstName: 'Ada',
    operativeSignedAt: '2026-10-01T09:00:00.000Z',
    operativeSignedByName: 'Ada Lovelace',
  }
  assert.equal(timesheetSnapshotShouldStay(signed), true)
  assert.deepEqual(unsignedTimesheetAnonymisePatch(signed), {})

  const exported = {
    userId: 'u1',
    exportedAt: '2026-10-02T09:00:00.000Z',
    firstName: 'Ada',
  }
  assert.equal(timesheetSnapshotShouldStay(exported), true)
  assert.deepEqual(unsignedTimesheetAnonymisePatch(exported), {})
})

test('ideas keep text; comments keep body; author display becomes Deleted user', () => {
  const idea = ideaAuthorAnonymisePatch({
    title: 'Export RAMS',
    details: 'PDF please',
    authorName: 'Ada',
    authorUserId: 'u1',
  })
  assert.deepEqual(idea, { authorName: DELETED_USER_DISPLAY_NAME })
  const comment = commentAnonymisePatch({
    body: 'Need this',
    authorName: 'Ada',
    authorUserId: 'u1',
  })
  assert.deepEqual(comment, { authorName: DELETED_USER_DISPLAY_NAME })
  assert.equal(DELETED_PRODUCT_EVENT_USER_ID, 'deleted')
})

test('membership walk unions orgMemberships, user doc, members map, and creator', () => {
  assert.deepEqual(
    collectMembershipIds({
      membershipDocIds: ['org-a', 'org-b'],
      userOrganizationId: 'org-c',
      memberMapOrgIds: ['org-a', 'org-d'],
      creatorOrgIds: ['org-e'],
    }),
    ['org-a', 'org-b', 'org-c', 'org-d', 'org-e']
  )
})

test('retry email prefers Auth, then the stored job email, then the profile', () => {
  assert.equal(
    resolveAccountDeleteEmail({
      authEmail: ' Auth@Site.com ',
      storedEmail: 'stored@site.com',
      profileEmail: 'profile@site.com',
    }),
    'auth@site.com'
  )
  assert.equal(
    resolveAccountDeleteEmail({
      authEmail: '',
      storedEmail: 'stored@site.com',
      profileEmail: 'profile@site.com',
    }),
    'stored@site.com'
  )
  assert.equal(resolveAccountDeleteEmail({ authEmail: '', storedEmail: '', profileEmail: 'Ada@Site.com' }), 'ada@site.com')
  assert.equal(resolveAccountDeleteEmail({ authEmail: '', storedEmail: '', profileEmail: '' }), '')
})

test('placeholder delete fallback writes Deleted user and clears email and phone', () => {
  const patch = placeholderDeleteFallbackPatch({
    firstName: 'Test',
    surname: 'Operative',
    email: 'farnienel@hotmail.com',
    mobileNumber: '07700',
  })
  assert.equal(patch.email, '')
  assert.equal(patch.firstName, 'Deleted')
  assert.equal(patch.surname, 'user')
  assert.equal(patch.mobileNumber, '')

  const missingKeys = placeholderDeleteFallbackPatch({ passwordSet: false })
  assert.equal(missingKeys.email, '')
  assert.equal(missingKeys.name, DELETED_USER_DISPLAY_NAME)
  assert.equal(missingKeys.mobileNumber, '')
})

test('confirm copy states login is deleted, records stay as Deleted user, subscription is not cancelled', () => {
  const text = ACCOUNT_DELETE_COPY.body.join(' ')
  assert.match(text, /login/)
  assert.match(text, /Deleted user/)
  assert.match(text, /does not cancel/)
  assert.equal(ACCOUNT_DELETE_COPY.rowLabel, 'Delete my account')
})

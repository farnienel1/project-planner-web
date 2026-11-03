'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { recipientMayReceivePush } = require('./pushRecipientGuard')
const canonical = require('./loadCanonical')

test('1.12.0: a push goes only to an active member of the row organisation', () => {
  const organization = { members: { U1: 'member' }, creatorUserId: 'FOUNDER' }
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'org-a', userId: 'U1', organization, user: { organizationId: 'org-a' } }), true)
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'org-a', userId: 'FOUNDER', organization, user: { organizationId: 'org-b' } }), true)
  // A uid from another company (a stranger's own organisation addressing a victim).
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'evil-org', userId: 'VICTIM', organization: { members: { X: 'admin' } }, user: { organizationId: 'org-a' } }), false)
  // A users document of this company, or a membership here, counts as membership.
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'org-a', userId: 'U2', organization, user: { organizationId: 'organizations/org-a' } }), true)
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'org-a', userId: 'U3', organization, user: { organizationId: 'org-b' }, membership: { role: 'manager' } }), true)
  // Deactivated: home users document false, or the membership here false.
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'org-a', userId: 'U1', organization, user: { organizationId: 'org-a', isActive: false } }), false)
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'org-a', userId: 'U3', organization, user: { organizationId: 'org-b' }, membership: { accountActive: false } }), false)
  // Deactivated in their home company only does not stop a push from another company they belong to.
  assert.equal(recipientMayReceivePush(canonical, { orgId: 'org-a', userId: 'U1', organization, user: { organizationId: 'org-b', isActive: false } }), true)
})

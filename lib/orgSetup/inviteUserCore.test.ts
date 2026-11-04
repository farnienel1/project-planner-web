import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('inviteUserCore blocks with the canonical live-claim rule, not any matching users row', () => {
  const source = readFileSync(new URL('./inviteUserCore.ts', import.meta.url), 'utf8')
  assert.match(source, /resolveInviteEmailClaim/)
  assert.match(source, /decision\.reuseUserId/)
  assert.match(source, /inviteEmailOrgLookupConstraints/)
  assert.match(source, /inviteWritesOperativeProfile/)
  assert.match(source, /userCreateRequiresAgeConfirmation/)
  assert.equal(source.includes('operativeProfiles'), false)
  assert.equal(source.includes('if (!existingInOrg.empty)'), false)
  assert.equal(source.includes('shouldReclaimOrgEmailPointer'), false)
  assert.equal(source.includes('findExistingAuthUserByEmail'), false)
  assert.equal(source.includes('liveOrgLookup'), false)
  assert.equal(source.includes('adminLookupAuthUserByEmail'), false)
  assert.match(source, /INVITE_LOOKUP_TIMEOUT_MS/)
})

test('1.23.1 inviteUserCore refuses an invite with no user level before any write', () => {
  const source = readFileSync(new URL('./inviteUserCore.ts', import.meta.url), 'utf8')
  assert.match(source, /userMissingLevel/)
  const guard = source.indexOf('const levelError = inviteLevelError(input)')
  assert.ok(guard > 0)
  // 1.31.0: the invitation is written in the Add User batch.
  assert.ok(guard < source.indexOf("batch.set(doc(db, 'invitations'"))
  assert.ok(guard < source.indexOf('loadInviteClaimState(input.organizationId'))
})

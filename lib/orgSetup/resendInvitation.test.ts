import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pickOpenInvitation } from './resendInvitation.ts'

test('scan 16 Nov: resend picks the newest unused invitation and keeps its stored level', () => {
  const picked = pickOpenInvitation([
    { id: 'used', data: { isUsed: true, role: 'admin', createdAt: new Date('2026-11-10') } },
    { id: 'old', data: { role: 'operative', firstName: 'Ann', createdAt: new Date('2026-11-01') } },
    { id: 'new', data: { role: 'manager', firstName: 'Ann', createdAt: { seconds: Date.parse('2026-11-05') / 1000 } } },
  ])
  assert.equal(picked?.id, 'new')
  assert.equal(picked?.role, 'manager')
  assert.equal(pickOpenInvitation([{ id: 'used', data: { isUsed: true } }]), null)
  // A legacy invitation with only permissions: the rulebook's `invitationRole`.
  assert.equal(pickOpenInvitation([{ id: 'p', data: { permissions: { operativeMode: true } } }])?.role, 'operative')
})

test('both resend buttons send the existing invitation and never re-run Add User', () => {
  for (const file of ['components/users/ManageUsersScreen.tsx', 'components/users/EditUserProfile.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /resendInvitationEmail\(/, file)
    assert.doesNotMatch(source, /inviteUser\(/, file)
  }
})

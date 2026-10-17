import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('inviteUserCore blocks with the canonical live-claim rule, not any matching users row', () => {
  const source = readFileSync(new URL('./inviteUserCore.ts', import.meta.url), 'utf8')
  assert.match(source, /resolveInviteEmailClaim/)
  assert.match(source, /decision\.reuseUserId/)
  assert.equal(source.includes('if (!existingInOrg.empty)'), false)
  assert.equal(source.includes('shouldReclaimOrgEmailPointer'), false)
})

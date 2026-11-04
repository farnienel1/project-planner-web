import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./userStore.ts', import.meta.url), 'utf8')

test('1.31.1 (F5): the same-email name sync skips pending invite placeholders unless an admin saves', () => {
  const fn = source.slice(source.indexOf('async function sameEmailUserRefs'), source.indexOf('async function linkedStaffRefs'))
  assert.match(fn, /includePending: boolean/)
  assert.match(fn, /if \(!includePending && entry\.data\(\)\.passwordSet !== true\) continue/)
  assert.match(source, /sameEmailUserRefs\(user, orgId, previousEmail, saverIsAdmin\)/)
})

test('1.31.1 (B-1): an operatives manager\'s delete-cleanup invitation query names invitedBy', () => {
  assert.match(source, /actorManagesOperatives\s*\?\s*query\(collection\(db, 'invitations'\), where\('organizationId', '==', orgId\), where\('email', '==', email\), where\('invitedBy', '==', invitationActorId\)\)/)
  assert.ok(source.indexOf('const actorManagesOperatives') < source.indexOf('const invitations = email'))
})

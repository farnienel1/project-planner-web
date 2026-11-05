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

test('1.31.1 (B-1, S-E) / 1.32.0: an operatives manager\'s delete-cleanup invitation queries name invitedBy as their id and their email', () => {
  // iOS stores invitedBy as the users-document email as typed; that can differ in case from the sign-in email.
  assert.match(source, /new Set\(\[invitationActorId, auth\?\.currentUser\?\.email \|\| '', \(auth\?\.currentUser\?\.email \|\| ''\)\.toLowerCase\(\), actor\?\.email \|\| ''\]/)
  // 1.32.0: the queries are the rulebook's `invitationListConstraints` (one per sender for an operatives manager), and
  // only a permission-denied read is skipped (`invitationReadErrorIsSkippable`).
  assert.match(source, /invitationListConstraints\(\{\s*organizationId: orgId,\s*email: email \|\| '',\s*actorManagesOperatives,\s*senderIds: invitationSenders,/)
  assert.match(source, /invitationReadErrorIsSkippable\(/)
  assert.ok(source.indexOf('const actorManagesOperatives') < source.indexOf('const invitationQueries'))
})

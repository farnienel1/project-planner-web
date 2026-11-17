/**
 * Rulebook 1.56.0 §9 / §17: the web leave listener's parts come from `leaveQueryPlan` — the whole collection for
 * everyone not at the operative level, one `userId in … OR operativeId in …` query for an operative, nothing for no
 * viewer — and re-planning targets the organisation last requested (review of #356).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leavePlanKey, leavePlanParts, leaveReplanTarget } from './readPlan.ts'

const role = (overrides: Record<string, boolean>) => ({
  isAdmin: false,
  isSuperAdmin: false,
  isManager: false,
  isOperativeMode: false,
  ...overrides,
})
const operative = (ids: string[]) => ({ role: role({ isOperativeMode: true }), ids, uid: ids[0] }) as never

test('1.56.0 leavePlanParts: admins, managers and a no-flag user keep the whole-collection listener (null)', () => {
  assert.equal(leavePlanParts({ role: role({ isAdmin: true }), ids: ['a'], uid: 'a' } as never, [], 'a@x.com'), null)
  assert.equal(leavePlanParts({ role: role({ isManager: true }), ids: ['m'], uid: 'm' } as never, [], null), null)
  assert.equal(leavePlanParts({ role: role({}), ids: ['n'], uid: 'n' } as never, [], null), null)
})

test('1.56.0 leavePlanParts: an operative gets one composite (or) part; the email only on userId', () => {
  const parts = leavePlanParts(operative(['UID']), ['UID', 'OP-1'], 'Op@X.com')
  assert.equal(parts?.length, 1)
  assert.equal(parts?.[0].id, 'own:UID,OP-1,Op@X.com,op@x.com|UID,OP-1')
  assert.ok(parts?.[0].filter, 'a composite filter, never a whole-collection part')
  assert.equal(parts?.[0].constraints, undefined)
})

test('1.56.0 leavePlanParts: no viewer → no part at all', () => {
  assert.deepEqual(leavePlanParts(null, ['x'], 'x@y.com'), [])
})

test('1.56.0 leave re-plan: own ids that arrive after subscribe (before the first snapshot) widen the listener', () => {
  // First load: operatives rows not loaded yet → the plan falls back to the users id and former ids.
  const first = leavePlanKey(leavePlanParts(operative(['UID', 'former']), [], 'op@x.com'))
  assert.match(first, /UID,former/)
  // The operatives rows arrive; the listener has not delivered yet (no loaded organisation) — it still re-plans the
  // requested organisation.
  const next = leavePlanKey(leavePlanParts(operative(['UID', 'former']), ['UID', 'former', 'OP-ROW'], 'op@x.com'))
  assert.notEqual(next, first)
  assert.equal(leaveReplanTarget({ requestedOrgId: 'ORG-A', plannedKey: first, nextKey: next, signedIn: true }), 'ORG-A')
  // Planned again: nothing more to do.
  assert.equal(leaveReplanTarget({ requestedOrgId: 'ORG-A', plannedKey: next, nextKey: next, signedIn: true }), null)
})

test('1.56.0 leave re-plan: after a company switch it re-plans the newly requested organisation, never the old one', () => {
  assert.equal(leaveReplanTarget({ requestedOrgId: 'ORG-B', plannedKey: 'own:a', nextKey: 'own:a,b', signedIn: true }), 'ORG-B')
})

test('1.56.0 leave re-plan: nothing while signed out or before any organisation was requested', () => {
  assert.equal(leaveReplanTarget({ requestedOrgId: 'ORG-A', plannedKey: 'all', nextKey: 'none', signedIn: false }), null)
  assert.equal(leaveReplanTarget({ requestedOrgId: null, plannedKey: null, nextKey: 'own:a', signedIn: true }), null)
})

test('1.56.0 leavePlanKey: all / none / parts', () => {
  assert.equal(leavePlanKey(null), 'all')
  assert.equal(leavePlanKey([]), 'none')
})

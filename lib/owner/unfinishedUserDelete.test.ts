import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLATFORM_OWNER_EMAIL } from '../canonical/passwordPolicy.ts'
import { unfinishedUserDeleteDecision, type UnfinishedUserDeleteInput } from './unfinishedUserDelete.ts'

const now = Date.parse('2026-11-16T09:00:00.000Z')
const fourteenMonthsAgo = new Date(Date.parse('2025-09-16T09:00:00.000Z'))
const lastWeek = new Date(now - 7 * 24 * 60 * 60 * 1000)

/** An abandoned founder: password set 14 months ago, an unnamed organisation of their own, no memberships. */
const abandoned: UnfinishedUserDeleteInput = {
  uid: 'u1',
  user: { email: 'gone@example.com', passwordSet: true, organizationId: 'org-1', createdAt: fourteenMonthsAgo },
  homeOrg: { state: 'found', fields: { name: '', creatorUserId: 'u1', members: { u1: 'admin' } } },
  memberships: { state: 'read', count: 0 },
  nowMs: now,
}

const refused = (input: UnfinishedUserDeleteInput) => {
  const decision = unfinishedUserDeleteDecision(input)
  return decision.allowed ? null : decision.status
}

test('H2: an abandoned unfinished sign-up may be deleted', () => {
  assert.deepEqual(unfinishedUserDeleteDecision(abandoned), { allowed: true })
  assert.equal(refused({ ...abandoned, homeOrg: { state: 'none' } }), null)
  assert.equal(refused({ ...abandoned, homeOrg: { state: 'missing' } }), null)
  // never set a password: recent is fine
  assert.equal(
    refused({ ...abandoned, user: { ...abandoned.user!, passwordSet: false, createdAt: lastWeek } }),
    null
  )
})

test('H2: a live person whose organisation is a real company is refused', () => {
  const live = { ...abandoned, homeOrg: { state: 'found' as const, fields: { name: 'Acme Electrical', members: { u1: 'admin' } } } }
  assert.equal(refused(live), 409)
})

test('H2: anyone with an organisation membership is refused', () => {
  assert.equal(refused({ ...abandoned, memberships: { state: 'read', count: 1 } }), 409)
})

test('H2: an unfinished organisation that has other members is refused', () => {
  const shared = {
    ...abandoned,
    homeOrg: { state: 'found' as const, fields: { name: '', members: { u1: 'admin', u2: 'operative' } } },
  }
  assert.equal(refused(shared), 409)
})

test('H2: a recent sign-up who set a password is refused (not abandoned yet)', () => {
  assert.equal(refused({ ...abandoned, user: { ...abandoned.user!, createdAt: lastWeek } }), 409)
  assert.equal(refused({ ...abandoned, user: { ...abandoned.user!, createdAt: undefined } }), 409)
})

test('H2: a ghost operative is a live person and is refused', () => {
  assert.equal(
    refused({ ...abandoned, user: { ...abandoned.user!, ghost: true, passwordSet: false, email: '' } }),
    409
  )
})

test('H2: unreadable organisation or memberships fail closed', () => {
  assert.equal(refused({ ...abandoned, homeOrg: { state: 'unreadable' } }), 503)
  assert.equal(refused({ ...abandoned, memberships: { state: 'unreadable' } }), 503)
})

test('H2: the owner account and a missing user are refused', () => {
  assert.equal(refused({ ...abandoned, user: { ...abandoned.user!, email: PLATFORM_OWNER_EMAIL } }), 400)
  assert.equal(refused({ ...abandoned, user: null }), 404)
})

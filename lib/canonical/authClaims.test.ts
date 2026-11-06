import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import {
  AUTH_CLAIMS_MAX_BYTES,
  authClaimsCoverOrganization,
  authClaimsEqual,
  authClaimsForPerson,
  authClaimsHomeOrganizationKey,
  authClaimsMarkerPath,
  authClaimsOrganizationAffectedUids,
  authClaimsRevokeAccess,
  authClaimsTokenIsStale,
  authClaimsUserInputsChanged,
  parseAuthClaims,
} from './authClaims'

const UID = 'u1'

function claims(input: Partial<Parameters<typeof authClaimsForPerson>[0]>) {
  return authClaimsForPerson({ uid: UID, user: null, organizations: {}, memberships: {}, stamp: 7, ...input }).claims.pp
}

test('1.32.4 auth claims: an admin of their home company', () => {
  const pp = claims({
    user: { organizationId: 'Org-A', role: 'admin', adminAccess: true },
    organizations: { 'Org-A': { members: { [UID]: 'admin' }, creatorUserId: UID } },
  })
  assert.deepEqual(pp, {
    v: 1,
    s: 7,
    h: 'Org-A',
    u: ['a', 'x'],
    o: { 'org-a': ['admin', 'admin', 'c', 'h', 'C', 'E', 'H', 'S', 'B'] },
  })
})

test('1.32.4 auth claims: an operative, a manager with operatives access and their toggles', () => {
  const op = claims({ user: { organizationId: 'A', role: 'operative', operativeMode: true }, organizations: { A: { members: { [UID]: 'member' } } } })
  assert.deepEqual(op.u, ['o', 'p', 'x'])
  assert.deepEqual(op.o.a, ['operative', 'member', 'c', 'h'])
  const mgr = claims({
    user: { organizationId: 'A', role: 'manager', manager: true, operatives: true, projects: true, permissions: { smallWorks: true } },
    organizations: { A: { members: { [UID]: 'manager' } } },
  })
  assert.deepEqual(mgr.u, ['k', 'q', 'x'])
  assert.deepEqual(mgr.o.a, ['manager', 'manager', 'c', 'h', 'P', 'W'])
  // Top-level flags win over `permissions` (staffFlag): projects off at the top level stays off.
  const off = claims({ user: { organizationId: 'A', manager: true, projects: false, permissions: { projects: true } }, organizations: {} })
  assert.deepEqual(off.o.a, ['manager', '', 'c', 'h'])
  // `1` counts as on, other truthy values do not (the rules' truthyBool).
  const legacy = claims({ user: { organizationId: 'A', adminAccess: 1 }, organizations: {} })
  assert.equal(legacy.o.a[0], 'admin')
  assert.equal(claims({ user: { organizationId: 'A', adminAccess: 'yes' }, organizations: {} }).o.a[0], 'member')
})

test('1.32.4 auth claims: a visitor (members map + membership here, users document of another company)', () => {
  const pp = claims({
    user: { organizationId: 'HOME', role: 'operative', operativeMode: true },
    organizations: { HOME: { members: { [UID]: 'member' } }, B: { members: { [UID]: 'manager' } } },
    memberships: { B: { role: 'manager', permissions: { projects: true, annualLeaveSelfBook: true } } },
  })
  assert.deepEqual(pp.o.b, ['manager', 'manager', 'c', 'P', 'B'])
  assert.deepEqual(pp.o.home, ['operative', 'member', 'c', 'h'])
  // Listed admin elsewhere: admin there (E), never by the home document (H).
  const admin = claims({ user: { organizationId: 'HOME' }, organizations: { HOME: {}, B: { members: { [UID]: 'admin' } } } })
  assert.deepEqual(admin.o.b, ['admin', 'admin', 'c', 'E'])
})

test('1.32.4 auth claims: deactivation and removal give no access', () => {
  const home = claims({ user: { organizationId: 'A', role: 'admin', isActive: false }, organizations: { A: { members: { [UID]: 'admin' } } } })
  assert.deepEqual(home.o.a, ['', 'admin', 'h'])
  assert.ok(home.u.includes('i'))
  const visitor = claims({
    user: { organizationId: 'HOME' },
    organizations: { B: { members: { [UID]: 'manager' } } },
    memberships: { B: { accountActive: false, isActive: true } },
  })
  assert.deepEqual(visitor.o.b, ['', 'manager'])
  // The members-map admin of a deactivated membership is still `E` (1.32.3 orgAdminEither), never a role or access.
  const listedAdmin = claims({ user: null, organizations: { B: { members: { [UID]: 'admin' } } }, memberships: { B: { isActive: false } } })
  assert.deepEqual(listedAdmin.o.b, ['', 'admin', 'E'])
  // Removed from the map, not the creator, not home: no entry at all.
  assert.deepEqual(claims({ user: { organizationId: 'HOME' }, organizations: { B: { members: {} } } }).o.b, undefined)
})

test('1.32.4 auth claims: creator, unknown roles, null entries', () => {
  const creator = claims({ user: null, organizations: { B: { creatorUserId: UID } } })
  assert.deepEqual(creator.o.b, ['', '', 'c', 'C', 'S', 'B'])
  assert.deepEqual(claims({ user: null, organizations: { B: { members: { [UID]: 'boss' } } } }).o.b, ['other', 'other', 'c'])
  assert.deepEqual(claims({ user: null, organizations: { B: { members: { [UID]: null } } } }).o.b, undefined)
  // An empty entry is membership (the rules' `!= null`) with no role.
  assert.deepEqual(claims({ user: null, organizations: { B: { members: { [UID]: '' } } } }).o.b, ['', '', 'c'])
})

test('1.32.4 auth claims: organisation ids stored as paths and references', () => {
  assert.equal(authClaimsHomeOrganizationKey('organizations/ABC'), 'abc')
  assert.equal(authClaimsHomeOrganizationKey(' Abc '), 'abc')
  assert.equal(authClaimsHomeOrganizationKey('x/y'), '')
  // A plain map with a `path` key is a map, not a reference (the rules' `is path` is false for it).
  assert.equal(authClaimsHomeOrganizationKey({ path: 'organizations/Q', id: 'Q' }), '')
  const pathString = claims({ user: { organizationId: 'organizations/ABC' }, organizations: {} })
  assert.equal(pathString.h, 'ABC')
  assert.equal(pathString.r, 'organizations/ABC')
  assert.deepEqual(pathString.o.abc, ['member', '', 'c', 'h'])
  class Ref {
    constructor(public path: string) {}
  }
  assert.equal(authClaimsHomeOrganizationKey(new Ref('organizations/Q')), 'q')
  const ref = claims({ user: { organizationId: new Ref('organizations/Q') }, organizations: {} })
  assert.equal(ref.h, 'Q')
  assert.equal(ref.r, false)
  assert.deepEqual(ref.o.q, ['member', '', 'c', 'h'])
})

test('1.32.4 auth claims: the size cap keeps the home organisation, then by role and id', () => {
  const organizations: Record<string, Record<string, unknown>> = {}
  for (let i = 0; i < 30; i += 1) organizations[`org-${String(i).padStart(2, '0')}-0123456789abcdef0123456789`] = { members: { [UID]: i % 2 ? 'manager' : 'admin' } }
  const result = authClaimsForPerson({ uid: UID, user: { organizationId: 'org-29-0123456789abcdef0123456789' }, organizations, stamp: 1 })
  const pp = result.claims.pp
  assert.ok(JSON.stringify({ pp }).length <= AUTH_CLAIMS_MAX_BYTES)
  assert.ok(pp.o['org-29-0123456789abcdef0123456789'], 'home kept')
  assert.ok(result.omittedOrganizationIds.length > 0)
  assert.equal(pp.x, result.omittedOrganizationIds.length)
  assert.equal(Object.keys(pp.o).length + result.omittedOrganizationIds.length, 30)
  // Admin entries are kept before manager entries.
  const keptRoles = Object.entries(pp.o).filter(([key]) => key !== 'org-29-0123456789abcdef0123456789').map(([, entry]) => entry[0])
  assert.ok(keptRoles.every((role) => role === 'admin'))
})

test('1.32.4 auth claims: parse, compare, revoke, inputs, affected people, client refresh', () => {
  const before = claims({ user: { organizationId: 'A', role: 'admin' }, organizations: { A: {} } })
  const after = claims({ user: { organizationId: 'A', role: 'admin', isActive: false }, organizations: { A: {} } })
  const parsed = parseAuthClaims({ pp: before })
  assert.equal(parsed?.organizations.a.role, 'admin')
  assert.equal(parsed?.organizations.a.access, true)
  assert.equal(parseAuthClaims({}), null)
  assert.equal(parseAuthClaims(null), null)
  assert.ok(authClaimsEqual(before, { ...before, s: 99 }))
  assert.ok(!authClaimsEqual(before, after))
  assert.ok(authClaimsRevokeAccess({ pp: before }, { pp: after }))
  assert.ok(!authClaimsRevokeAccess({ pp: after }, { pp: before }))
  assert.ok(!authClaimsRevokeAccess(undefined, { pp: before }))
  assert.ok(authClaimsUserInputsChanged({ role: 'manager' }, { role: 'admin' }))
  assert.ok(!authClaimsUserInputsChanged({ role: 'admin', pushTokens: ['a'] }, { role: 'admin', pushTokens: ['b'] }))
  assert.ok(authClaimsUserInputsChanged(null, { role: 'admin' }))
  assert.deepEqual(
    authClaimsOrganizationAffectedUids({ members: { a: 'admin', b: 'member' }, creatorUserId: 'a' }, { members: { a: 'admin', c: 'member' }, creatorUserId: 'c', billing: {} }),
    ['a', 'b', 'c']
  )
  assert.deepEqual(authClaimsOrganizationAffectedUids({ members: { a: 'admin' } }, { members: { a: 'admin' }, name: 'x' }), [])
  assert.deepEqual(authClaimsOrganizationAffectedUids(null, { members: { a: 'admin' }, creatorUserId: 'a' }), ['a'])
  assert.ok(authClaimsTokenIsStale(8, { pp: before }))
  assert.ok(!authClaimsTokenIsStale(7, { pp: before }))
  assert.ok(authClaimsTokenIsStale(7, {}))
  assert.ok(!authClaimsTokenIsStale(undefined, {}))
  assert.ok(authClaimsCoverOrganization({ pp: before }, 'A'))
  assert.ok(!authClaimsCoverOrganization({ pp: after }, 'A'))
  assert.equal(authClaimsMarkerPath(' u9 '), 'users/u9/private/authClaims')
})

test('1.32.4 auth claims: the packed script gives the same claims for documents from another realm', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const context = createContext({})
  runInContext(readFileSync(path.join(root, 'lib/canonical/dist/canonical-business.js'), 'utf8'), context)
  const packed = context.ProjectPlannerCanonical
  const input = {
    uid: UID,
    user: { organizationId: 'A', role: 'manager', manager: true, permissions: { projects: true } },
    organizations: { A: { members: { [UID]: 'manager' } }, B: { members: { [UID]: 'admin' } } },
    memberships: { B: { permissions: { smallWorks: true } } },
    stamp: 3,
  }
  assert.deepEqual(JSON.parse(JSON.stringify(packed.authClaimsForPerson(input))), JSON.parse(JSON.stringify(authClaimsForPerson(input))))
})

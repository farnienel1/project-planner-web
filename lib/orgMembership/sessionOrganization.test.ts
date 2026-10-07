import assert from 'node:assert/strict'
import test from 'node:test'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'
import { TimeoutError } from '../client/withTimeout.ts'
import { accessProbeFromReadError, destinationNeedsTrialScan, orgAccessProbeFromReads } from './membershipService.ts'
import {
  chooseWebSessionOrganization,
  probeSessionOrganizations,
  provisionalWebOrganizationId,
  SESSION_ORG_PROBE_MS,
  sessionUserForOrganizationProbe,
} from './webActiveOrg.ts'

const RACCORD = '2C67391E-D1FE-4F9F-8055-7149ACDE1F96'
const TEST_PRICING = '6b04f81d-a55e-41d2-8676-ecd116ad8450'

test('a remembered company stays selected when its read does not finish', () => {
  const choice = chooseWebSessionOrganization({
    rememberedOrganizationId: RACCORD,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'unknown', [TEST_PRICING]: 'allowed' },
  })
  assert.equal(choice.organizationId, RACCORD)
  assert.equal(choice.persistOrganizationId, RACCORD)
})

test('a remembered company is dropped only when the login is not a member', () => {
  const choice = chooseWebSessionOrganization({
    rememberedOrganizationId: RACCORD,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'denied', [TEST_PRICING]: 'allowed' },
  })
  assert.equal(choice.organizationId, TEST_PRICING)
  assert.equal(choice.persistOrganizationId, null)
})

test('a remembered web company is chosen on login when the user document names a different company', () => {
  for (const probe of ['unknown', 'allowed'] as const) {
    const choice = chooseWebSessionOrganization({
      rememberedOrganizationId: RACCORD,
      documentOrganizationId: TEST_PRICING,
      probes: { [RACCORD]: probe, [TEST_PRICING]: 'allowed' },
    })
    assert.equal(choice.organizationId, RACCORD)
    assert.equal(choice.persistOrganizationId, RACCORD)
  }
})

test('an explicit company stays selected when its read does not finish', () => {
  const choice = chooseWebSessionOrganization({
    explicitOrganizationId: RACCORD,
    rememberedOrganizationId: RACCORD,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'unknown', [TEST_PRICING]: 'allowed' },
  })
  assert.equal(choice.organizationId, RACCORD)
  assert.equal(choice.persistOrganizationId, RACCORD)
})

test('a missing or failed organisation read does not deny the remembered company', () => {
  assert.equal(
    orgAccessProbeFromReads({
      orgRead: 'missing',
      membershipRead: 'missing',
      listed: false,
      isCreator: false,
    }),
    'unknown'
  )
  assert.equal(
    orgAccessProbeFromReads({
      orgRead: 'failed',
      membershipRead: 'failed',
      listed: false,
      isCreator: false,
    }),
    'unknown'
  )
  assert.equal(
    orgAccessProbeFromReads({
      orgRead: 'loaded',
      membershipRead: 'missing',
      listed: false,
      isCreator: false,
    }),
    'denied'
  )
  assert.equal(
    orgAccessProbeFromReads({
      orgRead: 'loaded',
      membershipRead: 'active',
      listed: false,
      isCreator: false,
    }),
    'allowed'
  )
})

test('a thrown or unavailable organisation read is not a denied membership', () => {
  assert.equal(accessProbeFromReadError({ code: 'unavailable' }), 'unknown')
  assert.equal(accessProbeFromReadError({ code: 'deadline-exceeded' }), 'unknown')
  assert.equal(accessProbeFromReadError({ code: 'not-found' }), 'unknown')
  assert.equal(accessProbeFromReadError({ code: 'permission-denied' }), 'unknown')
  assert.equal(accessProbeFromReadError({ code: 'unauthenticated' }), 'unknown')
  assert.equal(accessProbeFromReadError(new TimeoutError('org get')), 'unknown')
})

test('a non-trial company does not wait on the membership discovery scan', () => {
  assert.equal(destinationNeedsTrialScan({ name: 'Raccord MEP' }), false)
  assert.equal(destinationNeedsTrialScan({ isTrial: true }), true)
  assert.equal(destinationNeedsTrialScan({ trialAccessBlocked: true }), true)
  assert.equal(destinationNeedsTrialScan(null), false)
})

test('an explicit switch wins over the company stored on the user document', () => {
  const choice = chooseWebSessionOrganization({
    explicitOrganizationId: RACCORD,
    rememberedOrganizationId: TEST_PRICING,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'allowed', [TEST_PRICING]: 'allowed' },
  })
  assert.equal(choice.organizationId, RACCORD)
})

test('organisation ids match ignoring case when choosing the session company', () => {
  const choice = chooseWebSessionOrganization({
    explicitOrganizationId: RACCORD.toLowerCase(),
    documentOrganizationId: TEST_PRICING,
    probes: new Map([[RACCORD, 'allowed' as const]]),
  })
  assert.equal(choice.organizationId, RACCORD.toLowerCase())
})

test('one saved membership does not shorten the search for other companies', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./membershipService.ts', import.meta.url), 'utf8')
  )
  assert.equal(source.includes('byId.size > 0 ? 1800'), false)
  assert.match(source, /discoveryBudgetMs = 12_000/)
  assert.match(source, /probeSessionOrganizations\(/)
  assert.equal(source.includes('await membershipForDeviceOrg'), false)
})

const adminPermissions: UserPermissions = {
  adminAccess: true,
  manager: true,
  operatives: true,
  skills: false,
  qualifications: true,
  materials: true,
  projects: true,
  smallWorks: true,
  operativeMode: false,
  siteAudit: true,
  subContractors: true,
  wholesalersOrderHistory: true,
}

function adminUser(): User {
  return {
    id: 'ada',
    email: 'ada@site.com',
    firstName: 'Ada',
    surname: 'Stone',
    organizationId: TEST_PRICING,
    role: UserRole.ADMIN,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: true,
    policyAccepted: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-06-01'),
    permissions: adminPermissions,
  }
}

test('the shell opens on the explicit company, then the remembered one, then the user document', () => {
  assert.equal(
    provisionalWebOrganizationId({
      explicitOrganizationId: RACCORD,
      rememberedOrganizationId: TEST_PRICING,
      documentOrganizationId: 'other',
    }),
    RACCORD
  )
  assert.equal(
    provisionalWebOrganizationId({
      rememberedOrganizationId: RACCORD,
      documentOrganizationId: TEST_PRICING,
    }),
    RACCORD
  )
  assert.equal(provisionalWebOrganizationId({ documentOrganizationId: TEST_PRICING }), TEST_PRICING)
})

test('a slow unknown probe keeps the remembered company and the admin menu', () => {
  const choice = chooseWebSessionOrganization({
    rememberedOrganizationId: RACCORD,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'unknown' },
  })
  const session = sessionUserForOrganizationProbe(adminUser(), TEST_PRICING, {
    organizationId: choice.organizationId,
    membership: null,
    listedRole: null,
    probe: 'unknown',
  })
  assert.equal(session.organizationId, RACCORD)
  assert.equal(session.role, UserRole.ADMIN)
  assert.equal(session.isSuperAdmin, true)
  assert.equal(session.permissions.adminAccess, true)
  assert.equal(session.permissions.projects, true)
})

test('a denied remembered company falls back to the company on the user document', () => {
  const choice = chooseWebSessionOrganization({
    rememberedOrganizationId: RACCORD,
    documentOrganizationId: TEST_PRICING,
    probes: { [RACCORD]: 'denied', [TEST_PRICING]: 'allowed' },
  })
  const session = sessionUserForOrganizationProbe(adminUser(), TEST_PRICING, {
    organizationId: choice.organizationId,
    membership: null,
    listedRole: null,
    probe: 'allowed',
  })
  assert.equal(choice.organizationId, TEST_PRICING)
  assert.equal(session.organizationId, TEST_PRICING)
  assert.equal(session.isSuperAdmin, true)
  assert.equal(session.permissions.adminAccess, true)
})

test('membership probes share one short wait and a slow read stays unknown', async () => {
  assert.ok(SESSION_ORG_PROBE_MS <= 3_000 && SESSION_ORG_PROBE_MS >= 1_000)
  let active = 0
  let maxActive = 0
  const started = Date.now()
  const probes = await probeSessionOrganizations(
    [RACCORD, TEST_PRICING, RACCORD.toLowerCase()],
    () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      return new Promise(() => {})
    },
    () => ({ probe: 'unknown' as const }),
    80
  )
  const elapsed = Date.now() - started
  assert.equal(probes.size, 2)
  assert.equal(maxActive, 2)
  for (const value of probes.values()) assert.equal(value.probe, 'unknown')
  assert.ok(elapsed < 500, `probes took ${elapsed}ms`)
})

test('the splash does not wait on a 20s organisation probe or four profile retries', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('../stores/authStore.ts', import.meta.url), 'utf8')
  )
  const innerStart = source.indexOf('async function loadSignedInProfileInner')
  const innerEnd = source.indexOf('export const useAuthStore')
  assert.ok(innerStart > 0 && innerEnd > innerStart)
  const inner = source.slice(innerStart, innerEnd)
  const marker = inner.indexOf('const documentOrganizationId = user.organizationId')
  assert.ok(marker > 0)
  const tail = inner.slice(marker)
  const publish = tail.indexOf('loading: false')
  const hydrate = tail.indexOf('void hydrateSignedInOrganization(')
  assert.ok(publish > 0 && hydrate > publish)
  assert.equal(/await hydrateSignedInOrganization\(/.test(tail), false)
  assert.equal(tail.includes('resolveWebSessionOrganization'), false)
  assert.equal(tail.includes('20_000'), false)
  assert.equal(/withTimeout\(\s*resolveWebSessionOrganization/.test(source), false)
  assert.equal(/withTimeout\(\s*getDoc\(doc\([^)]*organizations/.test(source), false)
  assert.match(source, /if \(useAuthStore\.getState\(\)\.user\?\.id === firebaseUser\.uid\) return/)
  const hydrateFn = source.slice(source.indexOf('async function hydrateSignedInOrganization'), innerStart)
  assert.match(hydrateFn, /resolveWebSessionOrganization/)
  assert.match(hydrateFn, /catch/)
  assert.equal(hydrateFn.includes('20_000'), false)
  assert.equal(hydrateFn.includes('PROFILE_LOAD_MS'), false)
})

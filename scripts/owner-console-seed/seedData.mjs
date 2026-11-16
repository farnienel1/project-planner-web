// Owner console seed (spec §6.2, PLAN §7): deterministic test data for the Firebase EMULATOR only.
// `buildOwnerConsoleSeed()` is pure: the unit tests read it directly, and seed.mjs writes it to the emulators.
// Expected figures are in expected.json, worked out by hand (README.md explains each number).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export { SEED_PROJECT_ID, SEED_PASSWORD, OWNER_EMAIL, SEED_NOW_MS, SEED_AUTH_USERS } from './seedConstants.mjs'
import { OWNER_EMAIL, SEED_NOW_MS } from './seedConstants.mjs'

const DAY = 24 * 60 * 60 * 1000
const at = (daysAgo) => new Date(SEED_NOW_MS - daysAgo * DAY)

function pad(n, width = 3) {
  return String(n).padStart(width, '0')
}

function person(id, organizationId, fields) {
  return {
    id,
    data: {
      organizationId,
      createdAt: at(400),
      updatedAt: at(10),
      isActive: true,
      passwordSet: true,
      ...fields,
    },
  }
}

function contractUsers() {
  const contract = JSON.parse(readFileSync(join(here, '../../lib/canonical/cross-platform-contract.json'), 'utf8'))
  const users = contract.collections.find((entry) => entry.id === 'users')
  // Old document shapes as web and iOS write them (createdAt as a {seconds,nanoseconds} map, lastName beside surname).
  return users.samples.map((sample) => ({
    id: `contract-${sample.docId}`,
    data: { ...sample.data, organizationId: 'org-small' },
  }))
}

export function buildOwnerConsoleSeed() {
  const orgs = []
  const users = []
  const invitations = []

  // The owner's own profile names the sentinel organisation (never a customer).
  orgs.push({ id: 'platform-owner', data: { name: 'Platform owner', createdAt: at(800) } })
  users.push(person('owner-uid', 'platform-owner', { email: OWNER_EMAIL, firstName: 'Platform', surname: 'Owner', role: 'admin' }))

  // 1. Large: 110 people — 1 super admin, 2 admins, 7 managers, 100 operatives (90 active, 5 inactive, 5 pending).
  const largeMembers = {}
  users.push(
    person('su-large', 'org-large', {
      email: 'superadmin@large.example', firstName: 'Sam', surname: 'Super', role: 'admin', isSuperAdmin: true, adminAccess: true,
      lastSeenAt: at(0.1),
    })
  )
  largeMembers['su-large'] = 'admin'
  for (let i = 1; i <= 2; i += 1) {
    users.push(person(`adm-large-${i}`, 'org-large', { email: `admin${i}@large.example`, firstName: 'Alex', surname: `Admin ${i}`, role: 'admin', adminAccess: true, lastSeenAt: at(1) }))
    largeMembers[`adm-large-${i}`] = 'admin'
  }
  for (let i = 1; i <= 7; i += 1) {
    users.push(person(`mgr-large-${i}`, 'org-large', { email: `manager${i}@large.example`, firstName: 'Mia', surname: `Manager ${i}`, role: 'manager', manager: true, lastSeenAt: at(2) }))
    largeMembers[`mgr-large-${i}`] = 'manager'
  }
  for (let i = 1; i <= 100; i += 1) {
    const id = `op-large-${pad(i)}`
    const inactive = i >= 91 && i <= 95
    const pending = i >= 96
    users.push(
      person(id, 'org-large', {
        email: `op${pad(i)}@large.example`,
        firstName: 'Olly',
        surname: `Operative ${pad(i)}`,
        role: 'operative',
        operativeMode: true,
        isActive: !inactive,
        passwordSet: !pending,
        ...(pending || inactive ? {} : { lastSeenAt: at(i % 30) }),
      })
    )
    largeMembers[id] = 'operative'
  }
  orgs.push({
    id: 'org-large',
    data: {
      name: 'Large Build Ltd', countryCode: 'GB', currencyCode: 'GBP', createdAt: at(500), creatorUserId: 'su-large',
      members: largeMembers,
      billing: { status: 'active', billingInterval: 'month', mrrPence: 9900, currentPeriodEnd: at(-20) },
    },
  })
  for (let i = 96; i <= 98; i += 1) {
    invitations.push({ id: `inv-large-${i}`, data: { organizationId: 'org-large', email: `op${pad(i)}@large.example`, isUsed: false, createdAt: at(20), role: 'operative' } })
  }
  invitations.push({ id: 'inv-large-used', data: { organizationId: 'org-large', email: 'op001@large.example', isUsed: true, createdAt: at(300), role: 'operative' } })

  // 2. Small (trial): a real person called "Test Valley" (not test data — D12), a person in two companies through two
  // users documents on one email, an anonymised deleted profile, a ghost operative, a person flagged internal, and the
  // two cross-platform contract users (old shapes).
  users.push(person('adm-small', 'org-small', { email: 'ann@small.example', firstName: 'Ann', surname: 'Small', role: 'admin', adminAccess: true, isSuperAdmin: true, lastSeenAt: at(3) }))
  users.push(person('op-small-1', 'org-small', { email: 'test.valley@small.example', firstName: 'Test', surname: 'Valley', role: 'operative', operativeMode: true, lastSeenAt: at(4) }))
  users.push(person('dual-1', 'org-small', { email: 'dee@dual.example', firstName: 'Dee', surname: 'Dual', role: 'manager', manager: true, updatedAt: at(1), lastSeenAt: at(5) }))
  users.push(person('deleted-small', 'org-small', { email: '', firstName: 'Deleted', surname: 'user', role: 'operative' }))
  users.push(person('ghost-small', 'org-small', { email: '', firstName: 'Gus', surname: 'Ghost', role: 'operative', operativeMode: true, ghost: true, passwordSet: false }))
  users.push(person('intern-1', 'org-small', { email: 'intern@small.example', firstName: 'Ivy', surname: 'Intern', role: 'operative', isInternal: true, lastSeenAt: at(6) }))
  users.push(...contractUsers())
  orgs.push({
    id: 'org-small',
    data: {
      name: 'Small Sparks', countryCode: 'GB', createdAt: at(60), creatorUserId: 'adm-small',
      members: { 'adm-small': 'admin', 'op-small-1': 'operative', 'dual-1': 'manager', 'ghost-small': 'operative', 'intern-1': 'operative', 'demo-3': 'operative' },
      billing: { status: 'trialing', trialEnd: at(-5) },
    },
  })

  // 3. Test / internal company.
  orgs.push({ id: 'org-test', data: { name: 'Demo Co (internal)', isInternal: true, isTest: true, createdAt: at(90), members: { 'demo-1': 'admin', 'demo-2': 'operative', 'demo-3': 'operative' } } })
  users.push(person('demo-1', 'org-test', { email: 'demo1@demo.example', firstName: 'Dana', surname: 'Demo', role: 'admin', adminAccess: true, lastSeenAt: at(1) }))
  users.push(person('demo-2', 'org-test', { email: 'demo2@demo.example', firstName: 'Dan', surname: 'Demo', role: 'operative', lastSeenAt: at(1) }))
  // Home is the test company, but also a member of a real one (Small Sparks): stays visible (review of #348 L6).
  users.push(person('demo-3', 'org-test', { email: 'demo3@demo.example', firstName: 'Del', surname: 'Demo', role: 'operative', lastSeenAt: at(1) }))

  // 4. Setup unfinished (no name stored).
  orgs.push({ id: 'org-unfinished', data: { createdAt: at(30), members: { 'unf-1': 'admin' } } })
  users.push(person('unf-1', 'org-unfinished', { email: 'unf@nowhere.example', firstName: 'Una', surname: 'Finished', role: 'admin', passwordSet: false }))

  // 5. Lapsed (unpaid). lap-2 is an old shape: the organisation stored as a path, lastName, createdAt as text.
  orgs.push({ id: 'org-lapsed', data: { name: 'Lapsed Ltd', createdAt: at(300), members: { 'lap-1': 'admin', 'lap-2': 'operative' }, billing: { status: 'unpaid', lastPaymentFailedAt: at(40) } } })
  users.push(person('lap-1', 'org-lapsed', { email: 'lap1@lapsed.example', firstName: 'Lee', surname: 'Lapsed', role: 'admin', lastSeenAt: at(45) }))
  users.push({
    id: 'lap-2',
    data: {
      organizationId: 'organizations/org-lapsed', email: 'lap2@lapsed.example', firstName: 'Lou', lastName: 'Lapsed', role: 'operative',
      isActive: true, passwordSet: true, createdAt: '2025-06-01T09:00:00.000Z',
    },
  })

  // 6. Scheduled for deletion (restorable by the platform owner until 10 Dec 2026).
  orgs.push({
    id: 'org-scheduled',
    data: {
      name: 'Closing Co', createdAt: at(200), members: { 'cls-1': 'admin' },
      deletion: { status: 'scheduled', requestedAt: at(6), requestedBy: 'cls-1', eraseAfter: new Date('2026-12-10T00:00:00.000Z'), restoreBy: 'platform_owner' },
    },
  })
  users.push(person('cls-1', 'org-scheduled', { email: 'cls@closing.example', firstName: 'Cleo', surname: 'Closing', role: 'admin', lastSeenAt: at(7) }))

  // 7. Non-GBP (Ireland, EUR). dual-2 is the second users document of Dee Dual.
  orgs.push({ id: 'org-eur', data: { name: 'Dublin Fitters', countryCode: 'IE', currencyCode: 'EUR', createdAt: at(150), members: { 'eur-1': 'admin', 'dual-2': 'manager' }, billing: { status: 'active', mrrPence: 4900 } } })
  users.push(person('eur-1', 'org-eur', { email: 'eoin@dublin.example', firstName: 'Eoin', surname: 'Fitter', role: 'admin', lastSeenAt: at(8) }))
  // One of Dee's two documents is flagged internal: the person stays visible (only every document flagged hides them).
  users.push(person('dual-2', 'org-eur', { email: 'Dee@Dual.example', firstName: 'Dee', surname: 'Dual', role: 'manager', updatedAt: at(50), lastSeenAt: at(9), isInternal: true }))

  // Product events and sessions over 14 months, web and iOS (the store loads only the page's period of these).
  const productEvents = []
  const productSessions = []
  for (let month = 0; month < 14; month += 1) {
    for (let k = 0; k < 3; k += 1) {
      const when = at(month * 30 + k)
      const userId = k === 0 ? 'su-large' : k === 1 ? 'adm-small' : 'eur-1'
      const organizationId = k === 0 ? 'org-large' : k === 1 ? 'org-small' : 'org-eur'
      productEvents.push({ id: `ev-${month}-${k}`, data: { eventName: 'page_viewed', userId, organizationId, createdAt: when, source: k === 2 ? 'ios' : 'web', path: '/dashboard' } })
      productSessions.push({ id: `se-${month}-${k}`, data: { userId, organizationId, startedAt: when, lastActivityAt: new Date(when.getTime() + 600_000) } })
    }
  }

  const productFeedback = [
    { id: 'fb-1', data: { title: 'Export to Excel', description: 'Please', status: 'open', productDecision: 'none', organizationId: 'org-large', userId: 'mgr-large-1', createdAt: at(3), voteCount: 2, commentCount: 0 } },
    { id: 'fb-2', data: { title: 'Dark mode', description: 'Night shifts', status: 'open', productDecision: 'planned', organizationId: 'org-small', userId: 'adm-small', createdAt: at(12), voteCount: 1, commentCount: 1 } },
  ]
  const interestRegistrations = [
    { id: 'ri-1', data: { name: 'Pat Prospect', email: 'pat@prospect.example', company: 'Prospect Electrical', status: 'new', createdAt: at(1), source: 'website' } },
    { id: 'ri-2', data: { name: 'Quinn Lead', email: 'quinn@lead.example', company: 'Lead Plumbing', status: 'contacted', createdAt: at(20), source: 'website' } },
  ]
  const adminAuditLog = [
    { id: 'audit-seed-1', data: { requestId: 'seed-req-1', action: 'ownerMarkInternal', phase: 'requested', actorUid: 'owner-uid', targetOrgId: 'org-test', at: at(90) } },
    { id: 'audit-seed-2', data: { requestId: 'seed-req-1', action: 'ownerMarkInternal', phase: 'completed', actorUid: 'owner-uid', targetOrgId: 'org-test', at: at(90) } },
  ]
  const erasedOrganizations = [{ id: 'org-gone', data: { erasedAt: at(100), name: 'Gone Ltd', status: 'erased' } }]

  // Timesheets across 14 months (signed, unsigned, reopened, no snapshot; PAYE and self-employed). Their money
  // figures are PR 6's fixtures; PR 1 only seeds the shapes so the pages have real documents to read.
  const timesheets = []
  for (let month = 0; month < 14; month += 1) {
    const start = new Date(Date.UTC(2025, 9 + month, 1))
    const key = start.toISOString().slice(0, 10)
    timesheets.push({
      orgId: 'org-large',
      id: `timesheet_op-large-001_${key}`,
      data: {
        userId: 'op-large-001', periodStart: key, employmentType: month % 4 === 0 ? 'paye' : 'self_employed',
        operativeSignedAt: month % 3 === 0 ? null : start, managerSignedAt: month % 3 === 1 ? start : null,
        priceWorkEntries: month % 5 === 0 ? [{ id: `pw-${month}`, title: 'Fit-out', amount: 120, jobNumber: 'J-1' }] : [],
        expenseEntries: month % 6 === 0 ? [{ id: `ex-${month}`, title: 'Parking', amount: 12.5 }] : [],
      },
    })
  }

  return { orgs, users, invitations, productEvents, productSessions, productFeedback, interestRegistrations, adminAuditLog, erasedOrganizations, timesheets }
}

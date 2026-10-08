import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User, UserPermissions } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { getDashboardNavItems } from './dashboardNavigation.ts'

function perms(partial: Partial<UserPermissions>): UserPermissions {
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: false,
    projects: false,
    smallWorks: false,
    operativeMode: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

function user(partial: Omit<Partial<User>, 'permissions'> & { permissions?: Partial<UserPermissions> }): User {
  return {
    id: 'U1',
    email: 'a@b.com',
    firstName: 'Ann',
    surname: 'Admin',
    organizationId: 'ORG',
    role: UserRole.BASIC,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    permissions: perms(partial.permissions ?? {}),
  }
}

test('Timesheets appears in the menu for a manager with direct reports and no operatives flag', () => {
  const manager = user({
    id: 'mgr',
    role: UserRole.MANAGER,
    permissions: { manager: true, operatives: false },
    employmentType: 'paye',
  })
  const report = user({
    id: 'op1',
    permissions: { operativeMode: true },
    assignedManagerUserIds: ['mgr'],
  })
  const ids = getDashboardNavItems(manager, null, [report]).map((item) => item.id)
  assert.equal(ids.includes('dashboard_timesheets'), true)
})

test('Variations is in the menu for admins and managers, and hidden for operatives', () => {
  const operative = user({ role: UserRole.OPERATIVE, permissions: { operativeMode: true } })
  const manager = user({ role: UserRole.MANAGER, permissions: { manager: true } })
  const admin = user({ role: UserRole.ADMIN, permissions: { adminAccess: true } })
  assert.equal(getDashboardNavItems(operative, null).some((item) => item.id === 'dashboard_variations'), false)
  assert.equal(getDashboardNavItems(manager, null).some((item) => item.id === 'dashboard_variations'), true)
  assert.equal(getDashboardNavItems(admin, null).some((item) => item.id === 'dashboard_variations'), true)
})

test('the menu follows saved profile toggles', () => {
  const manager = user({
    role: UserRole.MANAGER,
    permissions: {
      manager: true,
      projects: true,
      weeklyReports: false,
      dailyOverview: false,
      qualifications: false,
      wholesalersOrderHistory: false,
      operatives: false,
      subContractors: false,
    },
  })
  const ids = getDashboardNavItems(manager, null).map((item) => item.id)
  assert.equal(ids.includes('dashboard_projects'), true)
  assert.equal(ids.includes('dashboard_weekly_report'), false)
  assert.equal(ids.includes('dashboard_daily_overview'), false)
  assert.equal(ids.includes('dashboard_wholesalers'), false)
  assert.equal(ids.includes('dashboard_operatives'), false)
  assert.equal(ids.includes('dashboard_sub_contractors'), false)
  assert.equal(ids.includes('dashboard_qualifications'), true)
  assert.equal(ids.includes('dashboard_manage_users'), false)
  const operative = user({
    role: UserRole.OPERATIVE,
    permissions: { operativeMode: true, siteAudit: false, materials: true },
  })
  const operativeIds = getDashboardNavItems(operative, null).map((item) => item.id)
  assert.equal(operativeIds.includes('dashboard_site_audit'), false)
  assert.equal(operativeIds.includes('dashboard_weekly_report'), false)
  assert.equal(operativeIds.includes('dashboard_warnings'), false)
  assert.equal(operativeIds.includes('dashboard_manage_users'), false)
})

test('Feedback is in the organisation menu; Developer never is', () => {
  const operative = user({ role: UserRole.OPERATIVE, permissions: { operativeMode: true } })
  const manager = user({ role: UserRole.MANAGER, permissions: { manager: true } })
  const orgAdmin = user({ role: UserRole.ADMIN, permissions: { adminAccess: true, manager: true } })
  const superAdmin = user({ role: UserRole.ADMIN, isSuperAdmin: true, permissions: { adminAccess: true } })
  const owner = user({ email: 'info@projectplanner.us', isSuperAdmin: true, permissions: { adminAccess: true } })
  assert.equal(getDashboardNavItems(operative, null).some((item) => item.id === 'dashboard_ideas'), true)
  assert.equal(getDashboardNavItems(manager, null).some((item) => item.id === 'dashboard_ideas'), true)
  assert.equal(getDashboardNavItems(orgAdmin, null).some((item) => item.id === 'dashboard_ideas'), true)
  assert.equal(getDashboardNavItems(orgAdmin, null).find((item) => item.id === 'dashboard_ideas')?.label, 'Feedback')
  const storedIdeas = {
    settings: { uiLabels: { navigationLabels: { dashboard_ideas: 'Ideas' } } },
  } as Parameters<typeof getDashboardNavItems>[1]
  assert.equal(
    getDashboardNavItems(orgAdmin, storedIdeas).find((item) => item.id === 'dashboard_ideas')?.label,
    'Feedback'
  )
  assert.equal(getDashboardNavItems(superAdmin, null).some((item) => item.id === 'dashboard_developer'), false)
  assert.equal(getDashboardNavItems(owner, null).some((item) => item.id === 'dashboard_developer'), false)
  assert.equal(getDashboardNavItems(manager, null).some((item) => item.id === 'dashboard_developer'), false)
  assert.equal(getDashboardNavItems(orgAdmin, null).some((item) => item.id === 'dashboard_developer'), false)
})

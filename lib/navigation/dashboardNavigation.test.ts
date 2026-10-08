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

test('menu matrix covers each level and each permission toggle', () => {
  const ids = (person: User) => getDashboardNavItems(person, null).map((item) => item.id)
  const has = (person: User, id: string) => ids(person).includes(id)

  const operativeOn = user({
    role: UserRole.OPERATIVE,
    employmentType: 'self_employed',
    permissions: { operativeMode: true, materials: true, siteAudit: true },
  })
  const operativeOff = user({
    role: UserRole.OPERATIVE,
    employmentType: 'self_employed',
    permissions: { operativeMode: true, materials: false, siteAudit: false },
  })
  assert.deepEqual(ids(operativeOn), [
    'dashboard_home',
    'dashboard_projects',
    'dashboard_small_works',
    'dashboard_schedule',
    'dashboard_tasks',
    'dashboard_annual_leave',
    'dashboard_site_audit',
    'dashboard_timesheets',
    'dashboard_my_qualifications',
    'dashboard_ideas',
    'dashboard_change_organisation',
    'dashboard_settings',
    'dashboard_privacy',
    'dashboard_reset_password',
  ])
  assert.equal(has(operativeOff, 'dashboard_site_audit'), false)
  assert.equal(has(operativeOff, 'dashboard_my_qualifications'), true)
  assert.equal(has(operativeOff, 'dashboard_materials'), false)
  assert.equal(has(operativeOff, 'dashboard_projects'), true)
  for (const id of ['dashboard_weekly_report', 'dashboard_wholesalers', 'dashboard_operatives', 'dashboard_help', 'dashboard_warnings']) {
    assert.equal(has(operativeOn, id), false, id)
  }

  const staffOff = {
    adminAccess: false,
    manager: true,
    operatives: false,
    qualifications: false,
    projects: false,
    smallWorks: false,
    subContractors: false,
    weeklyReports: false,
    dailyOverview: false,
    annualLeaveSelfBook: false,
    wholesalersOrderHistory: false,
    siteAudit: true,
    materials: false,
    operativeMode: false,
  }
  const managerBase = {
    role: UserRole.MANAGER,
    employmentType: 'self_employed' as const,
    permissions: staffOff,
  }
  const managerOff = user(managerBase)
  assert.deepEqual(ids(managerOff), [
    'dashboard_home',
    'dashboard_clients',
    'dashboard_projects',
    'dashboard_small_works',
    'dashboard_schedule',
    'dashboard_warnings',
    'dashboard_tasks',
    'dashboard_annual_leave',
    'dashboard_site_audit',
    'dashboard_timesheets',
    'dashboard_variations',
    'dashboard_qualifications',
    'dashboard_materials',
    'dashboard_ideas',
    'dashboard_change_organisation',
    'dashboard_settings',
    'dashboard_help',
    'dashboard_privacy',
    'dashboard_reset_password',
  ])

  const managerToggleAdds: Record<string, string[]> = {
    adminAccess: [
      'dashboard_managers',
      'dashboard_site_map',
      'dashboard_job_types',
      'dashboard_sub_contractors',
      'dashboard_add_user',
      'dashboard_manage_users',
    ],
    operatives: ['dashboard_operatives', 'dashboard_add_user', 'dashboard_manage_users'],
    subContractors: ['dashboard_sub_contractors'],
    weeklyReports: ['dashboard_weekly_report'],
    dailyOverview: ['dashboard_daily_overview'],
    wholesalersOrderHistory: ['dashboard_wholesalers'],
    projects: [],
    smallWorks: [],
    qualifications: [],
    annualLeaveSelfBook: [],
  }
  for (const [key, added] of Object.entries(managerToggleAdds)) {
    const flipped = user({
      ...managerBase,
      permissions: { ...staffOff, [key]: true },
    })
    for (const id of added) assert.equal(has(flipped, id), true, `${key} should show ${id}`)
    assert.equal(has(flipped, 'dashboard_projects'), true, key)
    assert.equal(has(flipped, 'dashboard_small_works'), true, key)
    assert.equal(has(flipped, 'dashboard_qualifications'), true, key)
    if (key !== 'weeklyReports') assert.equal(has(flipped, 'dashboard_weekly_report'), false, key)
    if (key !== 'dailyOverview') assert.equal(has(flipped, 'dashboard_daily_overview'), false, key)
    if (key !== 'wholesalersOrderHistory') assert.equal(has(flipped, 'dashboard_wholesalers'), false, key)
    if (key !== 'operatives') assert.equal(has(flipped, 'dashboard_operatives'), false, key)
  }

  const adminOff = user({
    role: UserRole.ADMIN,
    employmentType: 'self_employed',
    permissions: { ...staffOff, adminAccess: false },
  })
  assert.equal(has(adminOff, 'dashboard_manage_users'), true)
  assert.equal(has(adminOff, 'dashboard_weekly_report'), false)
  assert.equal(has(adminOff, 'dashboard_operatives'), false)
  assert.equal(has(adminOff, 'dashboard_wholesalers'), false)
  assert.equal(has(adminOff, 'dashboard_qualifications'), true)
  assert.equal(has(adminOff, 'dashboard_my_qualifications'), false)
  const adminOn = user({
    role: UserRole.ADMIN,
    employmentType: 'self_employed',
    permissions: {
      adminAccess: true,
      manager: true,
      operatives: true,
      weeklyReports: true,
      dailyOverview: true,
      wholesalersOrderHistory: true,
      qualifications: true,
      projects: true,
      smallWorks: true,
      subContractors: true,
    },
  })
  for (const id of [
    'dashboard_operatives',
    'dashboard_weekly_report',
    'dashboard_daily_overview',
    'dashboard_wholesalers',
    'dashboard_projects',
    'dashboard_small_works',
  ]) {
    assert.equal(has(adminOn, id), true, id)
  }

  const superOff = user({
    role: UserRole.ADMIN,
    isSuperAdmin: true,
    employmentType: 'self_employed',
    permissions: { ...staffOff, adminAccess: true },
  })
  assert.equal(has(superOff, 'dashboard_operatives'), true)
  assert.equal(has(superOff, 'dashboard_wholesalers'), true)
  assert.equal(has(superOff, 'dashboard_qualifications'), true)
  assert.equal(has(superOff, 'dashboard_my_qualifications'), false)
  assert.equal(has(superOff, 'dashboard_weekly_report'), false)
  assert.equal(has(superOff, 'dashboard_daily_overview'), false)
  assert.equal(has(superOff, 'dashboard_projects'), true)
  const superOperative = user({
    role: UserRole.ADMIN,
    isSuperAdmin: true,
    employmentType: 'self_employed',
    permissions: { adminAccess: true, operativeMode: true, siteAudit: true, materials: true },
  })
  assert.equal(has(superOperative, 'dashboard_manage_users'), false)
  assert.equal(has(superOperative, 'dashboard_warnings'), false)
  assert.equal(has(superOperative, 'dashboard_my_qualifications'), false)
  assert.equal(has(superOperative, 'dashboard_wholesalers'), true)
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

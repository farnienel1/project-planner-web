/**
 * Owner 17 Nov: one Operatives page, an Add operative button on it, and an Operatives manager edits operatives on web
 * as on iOS (rulebook §11 / §16: `canManageOperatives`, never a manager, an admin or themselves).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User, UserPermissions } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { getDashboardNavItems } from '../navigation/dashboardNavigation.ts'
import { isQuickActionEligible } from '../home/quickActions.ts'
import {
  getAddUserLabel,
  isActingManagerOperativeManagementOnly,
  manageUsersAddButtonShown,
  peopleManagementHref,
} from '../permissions.ts'
import {
  canEditTargetUser,
  canOpenEditProfile,
  canOpenOperativeFromWarning,
  isManageableOperative,
} from './userEditPermissions.ts'
import { parseAppUserDocument } from '../ios-parity/converters.ts'
import { operativesManagerWritesAllowed } from '../permissions.ts'

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

function user(id: string, role: UserRole, permissions: Partial<UserPermissions>, extra: Partial<User> = {}): User {
  return {
    id,
    email: `${id}@site.com`,
    firstName: id,
    surname: 'Test',
    organizationId: 'ORG',
    role,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    permissions: perms(permissions),
    ...extra,
  }
}

const opsManager = user('ops-mgr', UserRole.MANAGER, { manager: true, operatives: true })
const plainManager = user('plain-mgr', UserRole.MANAGER, { manager: true, operatives: false })
const admin = user('admin', UserRole.ADMIN, { adminAccess: true })
const superAdmin = user('super', UserRole.ADMIN, { adminAccess: true }, { isSuperAdmin: true })
const operative = user('op', UserRole.OPERATIVE, { operativeMode: true })
const ghost = user('ghost', UserRole.OPERATIVE, { operativeMode: true }, { ghost: true, email: '', passwordSet: false })
const pendingOperative = user('pending-op', UserRole.OPERATIVE, { operativeMode: true }, { passwordSet: false })
// Operative by role only (no stored operativeMode flag): operative level by `permissionLevelOf`.
const roleOnlyOperative = user('role-op', UserRole.OPERATIVE, {})
const otherManager = user('other-mgr', UserRole.MANAGER, { manager: true })

test('an Operatives manager edits operatives (with or without a login), never managers, admins or themselves', () => {
  assert.equal(canEditTargetUser(opsManager, operative), true)
  assert.equal(canEditTargetUser(opsManager, ghost), true)
  assert.equal(canEditTargetUser(opsManager, pendingOperative), true)
  assert.equal(canEditTargetUser(opsManager, roleOnlyOperative), true)
  assert.equal(canEditTargetUser(opsManager, otherManager), false)
  assert.equal(canEditTargetUser(opsManager, admin), false)
  assert.equal(canEditTargetUser(opsManager, superAdmin), false)
  assert.equal(canEditTargetUser(opsManager, opsManager), false)
})

test('a manager without the Operatives toggle and an operative edit nobody; admins edit everyone but the Super Admin', () => {
  assert.equal(canEditTargetUser(plainManager, operative), false)
  assert.equal(canEditTargetUser(operative, roleOnlyOperative), false)
  assert.equal(canEditTargetUser(admin, operative), true)
  assert.equal(canEditTargetUser(admin, otherManager), true)
  assert.equal(canEditTargetUser(admin, superAdmin), false)
  assert.equal(canEditTargetUser(superAdmin, superAdmin), true)
  // The warning "Open operative" follows the same rule.
  assert.equal(canOpenOperativeFromWarning(opsManager, operative), true)
  assert.equal(canOpenOperativeFromWarning(plainManager, operative), false)
})

test('a flagless legacy manager is not an Operatives manager on web: the security rules ask for the manager flag', () => {
  // Rulebook `canManageOperatives` (and iOS) would say yes; firestore.rules `managerMayManageOperative` reads the
  // stored manager flag, so web keeps the rules' answer (follow-up for the owner, see the PR).
  const flagless = user('flagless', UserRole.BASIC, { operatives: true })
  assert.equal(isActingManagerOperativeManagementOnly(flagless), false)
  assert.equal(canEditTargetUser(flagless, operative), false)
})

test('one Operatives page: an Operatives manager has Operatives and no Manage users entry; admins keep both', () => {
  const ids = (viewer: User) => getDashboardNavItems(viewer, null).map((item) => item.id)
  assert.ok(ids(opsManager).includes('dashboard_operatives'))
  assert.ok(!ids(opsManager).includes('dashboard_manage_users'))
  assert.ok(ids(opsManager).includes('dashboard_add_user'))
  assert.ok(ids(admin).includes('dashboard_operatives'))
  assert.ok(ids(admin).includes('dashboard_manage_users'))
  assert.ok(!ids(plainManager).includes('dashboard_operatives'))
  assert.ok(!ids(plainManager).includes('dashboard_manage_users'))
  // Home quick actions follow the sidebar.
  assert.equal(isQuickActionEligible('staff-operatives', opsManager), true)
  assert.equal(isQuickActionEligible('staff-manage-users', opsManager), false)
  assert.equal(isQuickActionEligible('staff-add-user', opsManager), true)
  assert.equal(isQuickActionEligible('staff-manage-users', admin), true)
})

test('Manage users sends an Operatives manager to the Operatives page; admins stay', () => {
  assert.equal(peopleManagementHref(admin), '/dashboard/settings/users')
  assert.equal(peopleManagementHref(superAdmin), '/dashboard/settings/users')
  assert.equal(peopleManagementHref(opsManager), '/dashboard/operatives')
  assert.equal(peopleManagementHref(plainManager), null)
  assert.equal(peopleManagementHref(operative), null)
})

test('the Operatives page has an Add operative button for an Operatives manager', () => {
  assert.equal(manageUsersAddButtonShown('operatives', opsManager), true)
  assert.equal(getAddUserLabel(opsManager), 'Add operative')
  assert.equal(manageUsersAddButtonShown('operatives', admin), true)
  assert.equal(getAddUserLabel(admin), 'Add user')
  assert.equal(manageUsersAddButtonShown('operatives', plainManager), false)
  // Manage users (every level) keeps its Add user button for admins only.
  assert.equal(manageUsersAddButtonShown('all', admin), true)
  assert.equal(manageUsersAddButtonShown('all', opsManager), false)
})

function parsed(id: string, data: Record<string, unknown>): User {
  const result = parseAppUserDocument(id, { email: `${id}@site.com`, organizationId: 'ORG', firstName: id, surname: 'X', ...data })
  assert.ok(result.ok, `parse ${id}`)
  return (result as { ok: true; value: User }).value
}

// The caller as a stored home users document: manager and operatives at the top level (firestore.rules reads only these).
const storedOpsManager = parsed('stored-ops', { role: 'manager', manager: true, operatives: true })

test('review #367: a target still carrying a stored manager flag or an admin / manager role is refused, as the rules do', () => {
  const plain = parsed('t-plain', { role: 'operative', operativeMode: true })
  const managerFlag = parsed('t-mgr-flag', { operativeMode: true, manager: true })
  const managerFlagInMap = parsed('t-mgr-map', { operativeMode: true, permissions: { manager: true } })
  const managerRole = parsed('t-mgr-role', { operativeMode: true, role: 'manager' })
  const adminFlag = parsed('t-admin', { operativeMode: true, adminAccess: true })
  assert.equal(isManageableOperative(plain), true)
  assert.equal(isManageableOperative(managerFlag), false)
  assert.equal(isManageableOperative(managerFlagInMap), false)
  assert.equal(isManageableOperative(managerRole), false)
  assert.equal(isManageableOperative(adminFlag), false)
  assert.equal(canEditTargetUser(storedOpsManager, plain), true)
  assert.equal(canEditTargetUser(storedOpsManager, managerFlag), false)
  assert.equal(canEditTargetUser(storedOpsManager, managerRole), false)
  // Admins still edit them.
  const storedAdmin = parsed('stored-admin', { role: 'admin', adminAccess: true })
  assert.equal(canEditTargetUser(storedAdmin, managerFlag), true)
})

test('review #367: the caller side mirrors managerMayManageOperative — top-level flags and the home organisation', () => {
  const plain = parsed('t-plain-2', { role: 'operative', operativeMode: true })
  assert.equal(operativesManagerWritesAllowed(storedOpsManager), true)
  assert.equal(manageUsersAddButtonShown('operatives', storedOpsManager), true)
  // Flags only in the permissions map: the rules refuse, so nothing is offered.
  const mapOnly = parsed('map-only', { role: 'manager', permissions: { manager: true, operatives: true } })
  assert.equal(operativesManagerWritesAllowed(mapOnly), false)
  assert.equal(isActingManagerOperativeManagementOnly(mapOnly), false)
  assert.equal(canEditTargetUser(mapOnly, plain), false)
  assert.equal(manageUsersAddButtonShown('operatives', mapOnly), false)
  // Working in another company through a membership: the home users document names another organisation.
  const visiting: User = { ...storedOpsManager, organizationId: 'OTHER', homeOrganizationId: 'ORG' }
  assert.equal(operativesManagerWritesAllowed(visiting), false)
  assert.equal(canEditTargetUser(visiting, plain), false)
  assert.equal(manageUsersAddButtonShown('operatives', visiting), false)
  // Same organisation in another letter case still counts as home.
  assert.equal(operativesManagerWritesAllowed({ ...storedOpsManager, homeOrganizationId: 'org' }), true)
})

test('review #367: admins keep the profile Edit button for everyone, the Super Admin included', () => {
  const storedAdmin = parsed('stored-admin-2', { role: 'admin', adminAccess: true })
  const founder = parsed('founder', { role: 'admin', adminAccess: true, isSuperAdmin: true })
  assert.equal(canOpenEditProfile(storedAdmin, founder), true)
  assert.equal(canEditTargetUser(storedAdmin, founder), false)
  const plain = parsed('t-plain-3', { role: 'operative', operativeMode: true })
  assert.equal(canOpenEditProfile(storedOpsManager, plain), true)
  assert.equal(canOpenEditProfile(storedOpsManager, founder), false)
})

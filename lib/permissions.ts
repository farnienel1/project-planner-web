/**
 * iOS parity source: Core/UserStore.swift ~L436–897, Core/QualificationsAccessPolicy.swift
 * Spec: docs/ios-parity/01-data-model.md §9, Blueprint §1.4
 */

import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'
import { normalizeEmploymentType } from '@/lib/ios-parity/enums'

export type PermissionUser = User | null | undefined

export type WorkCatalogueKind = 'projects' | 'smallWorks' | 'all'

export type RoleTestingPreset = 'superAdmin' | 'admin' | 'manager' | 'operative'

export function parseUserPermissions(
  userData: Record<string, unknown>,
  _isSuperAdmin: boolean
): UserPermissions {
  const parsed = parseAppUserDocument('tmp', {
    ...userData,
    email: typeof userData.email === 'string' ? userData.email : 'x@x',
    organizationId: typeof userData.organizationId === 'string' ? userData.organizationId : 'org',
  })
  if (parsed.ok) return parsed.value.permissions
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
  }
}

/**
 * Role preview (UserStore.displayUser). Navigation only — data access still uses the real account.
 * Source: Core/UserStore.swift ~L101–185, Models/AppModels.swift RoleTestingPreset
 */
export function applyRoleTestingPreset(user: User, preset: RoleTestingPreset | null): User {
  if (!preset) return user
  const next: User = {
    ...user,
    permissions: { ...user.permissions },
  }
  switch (preset) {
    case 'superAdmin':
      next.isSuperAdmin = true
      next.role = UserRole.ADMIN
      next.permissions.operativeMode = false
      next.permissions.adminAccess = true
      next.permissions.manager = true
      break
    case 'admin':
      next.isSuperAdmin = false
      next.role = UserRole.ADMIN
      next.permissions.operativeMode = false
      next.permissions.adminAccess = true
      next.permissions.manager = true
      break
    case 'manager':
      next.isSuperAdmin = false
      next.role = UserRole.MANAGER
      next.permissions.operativeMode = false
      next.permissions.adminAccess = false
      next.permissions.manager = true
      next.permissions.operatives = true
      next.permissions.projects = true
      next.permissions.smallWorks = true
      break
    case 'operative':
      next.isSuperAdmin = false
      next.role = UserRole.OPERATIVE
      next.permissions.operativeMode = true
      next.permissions.adminAccess = false
      next.permissions.manager = false
      break
  }
  return next
}

function flag(user: PermissionUser, key: keyof UserPermissions): boolean {
  return user?.permissions?.[key] === true
}

/** UserStore.hasAdminAccess — operativeMode flag (not isOperativeMode) blocks. */
export function hasAdminAccess(user: PermissionUser): boolean {
  if (!user) return false
  if (user.permissions?.operativeMode) return false
  return user.isSuperAdmin === true || flag(user, 'adminAccess') || user.role === 'admin'
}

/** UserStore.isOperativeMode — admins are never operative. */
export function isOperativeMode(user: PermissionUser): boolean {
  if (!user) return false
  if (hasAdminAccess(user)) return false
  return flag(user, 'operativeMode') || user.role === 'operative'
}

export function isAnnualLeaveFeatureEnabled(user: PermissionUser): boolean {
  return user?.annualLeaveEnabled !== false
}

export function canManageUsers(user: PermissionUser): boolean {
  if (isOperativeMode(user)) return false
  return hasAdminAccess(user) || flag(user, 'adminAccess')
}

export function canViewOperatives(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return flag(user, 'manager') && flag(user, 'operatives')
}

export function canManageMaterialCatalogue(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || flag(user, 'manager')
}

export function canAccessWholesalers(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || flag(user, 'manager')
}

export function canViewWholesalerOrderHistory(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return flag(user, 'manager') && flag(user, 'wholesalersOrderHistory')
}

export function canManageSkills(_user?: PermissionUser): boolean {
  return false
}

export function canManageOrganisationQualifications(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return flag(user, 'qualifications')
}

export function canAccessQualificationsHub(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return flag(user, 'manager') || flag(user, 'qualifications')
}

export function canManageQualifications(user: PermissionUser): boolean {
  return canManageOrganisationQualifications(user)
}

/** Always true. Job lists are filtered by WorkAccess.visibleWorks. */
export function canViewProjects(_user?: PermissionUser): boolean {
  return true
}

export function canViewMaterials(user: PermissionUser): boolean {
  if (!user) return false
  if (isOperativeMode(user)) return flag(user, 'materials')
  return true
}

export function canViewSiteAudit(user: PermissionUser, profileLoading = false): boolean {
  if (!user) return profileLoading
  if (isOperativeMode(user)) return flag(user, 'siteAudit')
  return true
}

export function canEditProjects(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user) || user.isSuperAdmin) return true
  return flag(user, 'projects') || flag(user, 'smallWorks')
}

export function canEditOperatives(user: PermissionUser): boolean {
  return canViewOperatives(user)
}

export function canViewManagers(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user)
}

export function canEditManagers(user: PermissionUser): boolean {
  return canViewManagers(user)
}

export function canViewSkills(_user?: PermissionUser): boolean {
  return false
}

export function canEditSkills(_user?: PermissionUser): boolean {
  return false
}

export function canViewQualifications(user: PermissionUser): boolean {
  if (!user) return false
  if (isOperativeMode(user)) return true
  return canAccessQualificationsHub(user)
}

export function canEditQualifications(user: PermissionUser): boolean {
  return canViewQualifications(user)
}

export function canBookWork(user: PermissionUser): boolean {
  return !isOperativeMode(user)
}

export function canManageSubcontractors(user: PermissionUser, profileLoading = false): boolean {
  if (isOperativeMode(user)) return false
  if (profileLoading || !user) return true
  if (hasAdminAccess(user)) return true
  return flag(user, 'manager') && flag(user, 'subContractors')
}

export function canManageWorkCatalogue(
  user: PermissionUser,
  kind: WorkCatalogueKind
): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  if (!flag(user, 'manager')) return false
  if (kind === 'projects') return flag(user, 'projects')
  if (kind === 'smallWorks') return flag(user, 'smallWorks')
  return flag(user, 'projects') && flag(user, 'smallWorks')
}

export function canViewWeeklyReports(user: PermissionUser, profileLoading = false): boolean {
  if (isOperativeMode(user)) return false
  if (profileLoading || !user) return true
  return flag(user, 'weeklyReports')
}

export function canViewDailyOverview(user: PermissionUser, profileLoading = false): boolean {
  if (isOperativeMode(user)) return false
  if (profileLoading || !user) return true
  return user.permissions.dailyOverview !== false
}

export function canManageSiteAuditOperativeVisibility(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  return user.isSuperAdmin || flag(user, 'adminAccess') || flag(user, 'manager')
}

export function isActingManagerOperativeManagementOnly(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user) || hasAdminAccess(user)) return false
  return flag(user, 'manager') && flag(user, 'operatives')
}

export function canAccessOperativeAnnualLeaveDirectory(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return flag(user, 'manager') && flag(user, 'operatives')
}

export function canViewReports(user: PermissionUser): boolean {
  return !isOperativeMode(user)
}

export function canViewClients(user: PermissionUser): boolean {
  return !isOperativeMode(user)
}

export function canViewSiteMap(user: PermissionUser): boolean {
  return hasAdminAccess(user)
}

export function canViewMyQualifications(user: PermissionUser): boolean {
  return isOperativeMode(user)
}

export function canManageJobTypes(user: PermissionUser): boolean {
  return hasAdminAccess(user)
}

export function canManageOperativesOnly(user: PermissionUser): boolean {
  return isActingManagerOperativeManagementOnly(user)
}

export function canInviteOperatives(user: PermissionUser): boolean {
  return canManageUsers(user) || canManageOperativesOnly(user)
}

export function canAccessTeamSection(user: PermissionUser): boolean {
  return canManageUsers(user) || canManageOperativesOnly(user)
}

export function canViewHelp(user: PermissionUser): boolean {
  return !isOperativeMode(user)
}

export function canViewMySchedule(user: PermissionUser): boolean {
  return Boolean(user)
}

export function canViewSchedule(user: PermissionUser): boolean {
  return canViewDailyOverview(user)
}

export function canSelfBookMySchedule(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return flag(user, 'manager') && user.timesheetsEnabled === true
}

export function canAccessOrganisationSettingsHub(user: PermissionUser): boolean {
  return hasAdminAccess(user)
}

export function canConfigureRoleTesting(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  return user.isSuperAdmin || flag(user, 'adminAccess') || flag(user, 'manager')
}

function isTimesheetEligibleRole(user: PermissionUser): boolean {
  if (!user) return false
  return (
    isOperativeMode(user) ||
    flag(user, 'manager') ||
    flag(user, 'adminAccess') ||
    user.role === 'manager' ||
    user.role === 'admin'
  )
}

/** Simplified TimesheetPayrollPolicy.canAccessMyTimesheets — SE always; PAYE needs policy (section 17). */
export function canAccessMyTimesheets(user: PermissionUser): boolean {
  if (!user) return false
  return normalizeEmploymentType(user.employmentType) === 'self_employed'
}

export function canAccessOperativeTimesheets(
  user: PermissionUser,
  profileLoading = false,
  orgUsers: Array<NonNullable<PermissionUser>> = []
): boolean {
  if (!user) return false
  const managerLike =
    hasAdminAccess(user) || flag(user, 'manager') || user.isSuperAdmin || user.role === 'manager' || user.role === 'admin'
  if (!managerLike) return false
  if (hasAdminAccess(user) || user.isSuperAdmin) return true
  if (profileLoading) return true
  if (flag(user, 'operatives')) return true
  return orgUsers.some((member) => {
    if (!member || member.isActive === false) return false
    if (!member.permissions?.operativeMode) return false
    const ids = [
      ...(member.assignedManagerUserIds || []),
      member.assignedManagerUserId || '',
    ]
      .map((id) => id.trim())
      .filter(Boolean)
    return ids.includes(user.id)
  })
}

export function shouldShowTimesheetsDisabledMessage(user: PermissionUser): boolean {
  if (!user) return false
  if (canAccessMyTimesheets(user)) return false
  return isTimesheetEligibleRole(user)
}

/** UserStore.canAccessTimesheetsSurface ~L608 */
export function canAccessTimesheetsSurface(
  user: PermissionUser,
  profileLoading = false,
  orgUsers: Array<NonNullable<PermissionUser>> = []
): boolean {
  return (
    canAccessMyTimesheets(user) ||
    canAccessOperativeTimesheets(user, profileLoading, orgUsers) ||
    shouldShowTimesheetsDisabledMessage(user)
  )
}

/** Existing web name — maps to timesheets surface. */
export function canAccessTimesheets(user: PermissionUser): boolean {
  return canAccessTimesheetsSurface(user)
}

export function canEditTargetUserPermissions(
  actor: PermissionUser,
  target: PermissionUser,
  orgCreatorUserId?: string
): boolean {
  if (!actor || !target) return false
  if (orgCreatorUserId && target.id === orgCreatorUserId) return false
  if (isOperativeMode(actor)) return false
  if (hasAdminAccess(actor)) return true
  if (isActingManagerOperativeManagementOnly(actor)) {
    return isOperativeMode(target) || target.role === 'operative'
  }
  return false
}

export function canDeleteUser(
  actor: PermissionUser,
  target: PermissionUser,
  orgCreatorUserId?: string
): boolean {
  if (!actor || !target) return false
  if (orgCreatorUserId && target.id === orgCreatorUserId) return false
  if (actor.id === target.id && actor.isSuperAdmin) return false
  if (actor.isSuperAdmin) return true
  if (flag(actor, 'adminAccess') && !hasAdminAccess(target) && !target.isSuperAdmin) return true
  return false
}

export function getManageUsersLabel(user: PermissionUser, _organization?: unknown): string {
  if (canManageUsers(user)) return 'Manage users'
  return 'Manage operatives'
}

export function getAddUserLabel(user: PermissionUser): string {
  if (canManageUsers(user)) return 'Add user'
  return 'Add operative'
}

export function roleTestingPresetTitle(preset: RoleTestingPreset): string {
  switch (preset) {
    case 'superAdmin':
      return 'Super Admin'
    case 'admin':
      return 'Admin'
    case 'manager':
      return 'Manager'
    case 'operative':
      return 'Operative'
  }
}

export function roleTestingStorageKey(uid: string): string {
  return `roleTestingPreset.${uid}`
}

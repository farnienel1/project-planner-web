import type { Organization, User, UserPermissions } from '@/types'

export function isOperativeMode(user: User | null): boolean {
  return user?.permissions?.operativeMode === true
}

export function hasAdminAccess(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin'
}

/** Organisation settings hub (hours, leave defaults, payment runs, etc.) — administrators only. */
export function canAccessOrganisationSettingsHub(user: User | null): boolean {
  return hasAdminAccess(user)
}

export function canViewProjects(user: User | null): boolean {
  if (!user) return false
  return true
}

export function canViewOperatives(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return user.permissions.manager === true && user.permissions.operatives === true
}

export function canViewManagers(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user)
}

export function canViewClients(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return true
}

export function isAnnualLeaveFeatureEnabled(user: User | null): boolean {
  return user?.annualLeaveEnabled !== false
}

export function canViewSiteMap(user: User | null): boolean {
  return hasAdminAccess(user)
}

export function canViewSiteAudit(user: User | null): boolean {
  if (!user) return false
  if (isOperativeMode(user)) return user.permissions.siteAudit === true
  return true
}

export function canAccessTimesheets(user: User | null): boolean {
  if (!user) return false
  if (isOperativeMode(user)) return true
  return user.permissions.manager === true || hasAdminAccess(user) || user.permissions.projects === true
}

export function canManageSkills(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || user.permissions.skills === true || user.permissions.manager === true
}

export function canManageQualifications(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || user.permissions.qualifications === true
}

export function canViewMyQualifications(user: User | null): boolean {
  return isOperativeMode(user)
}

export function canManageJobTypes(user: User | null): boolean {
  return hasAdminAccess(user)
}

export function canAccessWholesalers(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || user.permissions.manager === true
}

export function canManageMaterialCatalogue(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || user.permissions.manager === true
}

export function canManageSubcontractors(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || user.permissions.manager === true
}

export function canManageUsers(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user)
}

export function canManageOperativesOnly(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return false
  return user.permissions.manager === true && user.permissions.operatives === true
}

/** Admins (any role) or managers with Operatives permission (operative invites only). */
export function canInviteOperatives(user: User | null): boolean {
  return canManageUsers(user) || canManageOperativesOnly(user)
}

/** Admins and managers with operative management can open team annual leave. */
export function canAccessOperativeAnnualLeaveDirectory(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return user.permissions.manager === true && user.permissions.operatives === true
}

export function canAccessTeamSection(user: User | null): boolean {
  return canManageUsers(user)
}

export function canViewHelp(user: User | null): boolean {
  return !isOperativeMode(user)
}

export function canViewSchedule(user: User | null): boolean {
  return canViewDailyOverview(user)
}

/** Org-wide daily booking overview (managers/admins with permission). */
export function canViewDailyOverview(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  return user.permissions.dailyOverview !== false
}

/** Weekly report — admins by default, or explicit weeklyReports permission. */
export function canViewWeeklyReports(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return user.permissions.weeklyReports === true
}

/** Personal schedule for the signed-in user (all roles, mirrors iOS My Schedule). */
export function canViewMySchedule(user: User | null): boolean {
  return Boolean(user)
}

/**
 * iOS My Schedule self-booking mode: admins/super-admins and managers with
 * timesheets enabled can book office / WFH / projects via managerSiteBookings.
 */
export function canSelfBookMySchedule(user: User | null): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  return user.permissions.manager === true && user.timesheetsEnabled === true
}

export function parseUserPermissions(
  userData: Record<string, unknown>,
  isSuperAdmin: boolean
): UserPermissions {
  const permissionsMap = (userData.permissions as Record<string, unknown> | undefined) ?? {}

  const readFlag = (key: string): boolean | undefined => {
    if (userData[key] === true) return true
    if (userData[key] === false) return false
    if (permissionsMap[key] === true) return true
    if (permissionsMap[key] === false) return false
    return undefined
  }

  // iOS parseAppUserDocument stores permission flags on the user doc root.
  const operativeMode = readFlag('operativeMode') === true

  if (operativeMode) {
    return {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: readFlag('materials') === true,
      projects: true,
      smallWorks: true,
      operativeMode: true,
      siteAudit: readFlag('siteAudit') !== false,
      subContractors: readFlag('subContractors') === true,
      wholesalersOrderHistory: readFlag('wholesalersOrderHistory') === true,
      annualLeaveSelfBook: readFlag('annualLeaveSelfBook') === true,
      weeklyReports: readFlag('weeklyReports') === true,
      dailyOverview: readFlag('dailyOverview') !== false,
    }
  }

  return {
    adminAccess: readFlag('adminAccess') === true || isSuperAdmin,
    manager: readFlag('manager') === true,
    operatives: readFlag('operatives') === true || (isSuperAdmin && readFlag('operatives') !== false),
    skills: readFlag('skills') === true || (isSuperAdmin && readFlag('skills') !== false),
    qualifications:
      readFlag('qualifications') === true || (isSuperAdmin && readFlag('qualifications') !== false),
    materials: readFlag('materials') !== false,
    projects: readFlag('projects') !== false || isSuperAdmin,
    smallWorks: readFlag('smallWorks') !== false || isSuperAdmin,
    operativeMode: false,
    siteAudit: readFlag('siteAudit') !== false,
    subContractors: readFlag('subContractors') === true,
    wholesalersOrderHistory: readFlag('wholesalersOrderHistory') !== false,
    annualLeaveSelfBook: readFlag('annualLeaveSelfBook') === true,
    weeklyReports: readFlag('weeklyReports') === true,
    dailyOverview: readFlag('dailyOverview') !== false,
  }
}

export function getManageUsersLabel(user: User | null, organization: Organization | null): string {
  if (canManageUsers(user)) return 'Manage users'
  return 'Manage operatives'
}

export function getAddUserLabel(user: User | null): string {
  if (canManageUsers(user)) return 'Add user'
  return 'Add operative'
}

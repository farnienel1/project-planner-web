/**
 * iOS parity source: Core/UserStore.swift ~L436–897, Core/QualificationsAccessPolicy.swift
 * Spec: docs/ios-parity/01-data-model.md §9, Blueprint §1.4
 */

import type { User, UserPermissions } from '@/types'
import {
  canEditWorkCatalogue,
  canViewStaffWarnings,
  type StaffAccountRole,
} from '@/lib/canonical'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'
import { normalizeEmploymentType } from '@/lib/ios-parity/enums'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'

export type PermissionUser = User | null | undefined

export type WorkCatalogueKind = 'projects' | 'smallWorks' | 'all'

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
    developerAccess: false,
  }
}

function flag(user: PermissionUser, key: keyof UserPermissions): boolean {
  return user?.permissions?.[key] === true
}

/** iOS staff check: manager flag, admin flag, or a manager/admin role. Super admin is handled by callers. */
function isStaffAccount(user: NonNullable<PermissionUser>): boolean {
  return (
    flag(user, 'manager') ||
    flag(user, 'adminAccess') ||
    user.role === 'admin' ||
    user.role === 'manager'
  )
}

/**
 * The account flags the canonical staff-access rule works from.
 * iOS resolves the same four flags from `UserStore` before calling the bundle.
 */
export function staffAccountRole(user: PermissionUser): StaffAccountRole {
  if (!user) return { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false }
  return {
    isSuperAdmin: user.isSuperAdmin === true,
    isAdmin: hasAdminAccess(user),
    isManager: flag(user, 'manager') || user.role === 'manager',
    isOperativeMode: isOperativeMode(user),
  }
}

/** Warnings list. Every admin and manager sees every warning. Operatives do not see the company warning scan. */
export function canViewWarnings(user: PermissionUser): boolean {
  if (!user) return false
  return canViewStaffWarnings(staffAccountRole(user))
}

/** Warning settings open organisation settings. Admin level only. */
export function canOpenWarningSettings(user: PermissionUser): boolean {
  return canAccessOrganisationSettingsHub(user)
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
  // Super admin keeps Operatives. Everyone else, including admins, follows the Operatives toggle.
  if (user.isSuperAdmin) return true
  return isStaffAccount(user) && flag(user, 'operatives')
}

export function canManageMaterialCatalogue(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || flag(user, 'manager')
}

export function canAccessWholesalers(user: PermissionUser): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  if (isOperativeMode(user)) return false
  return isStaffAccount(user) && flag(user, 'wholesalersOrderHistory')
}

export function canViewWholesalerOrderHistory(user: PermissionUser): boolean {
  return canAccessWholesalers(user)
}

export function canManageSkills(_user?: PermissionUser): boolean {
  return false
}

export function canManageOrganisationQualifications(user: PermissionUser): boolean {
  if (!user || isOperativeMode(user)) return false
  return user.isSuperAdmin === true || flag(user, 'qualifications')
}

/** iOS QualificationsAccessPolicy.canOpenQualificationsHub. The manage toggle hides the catalogue, not My Qualifications. */
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

/** Create project: super admin, or admin/manager who also have the Projects toggle. */
export function canCreateProject(user: PermissionUser): boolean {
  return canManageWorkCatalogue(user, 'projects')
}

/**
 * Add or edit a catalogue (canonical `canEditWorkCatalogue`). Super admin ignores the
 * toggles. Admins and managers follow them. A toggle that is off never hides the list;
 * that is `visibleWorks`.
 */
export function canManageWorkCatalogue(
  user: PermissionUser,
  kind: WorkCatalogueKind
): boolean {
  if (!user) return false
  const role = staffAccountRole(user)
  const toggles = { projects: flag(user, 'projects'), smallWorks: flag(user, 'smallWorks') }
  if (kind === 'all') {
    return canEditWorkCatalogue(role, 'projects', toggles) && canEditWorkCatalogue(role, 'smallWorks', toggles)
  }
  return canEditWorkCatalogue(role, kind, toggles)
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

/** Owner console only — info@projectplanner.us. Organisation admins never get this. */
export function canAccessDeveloperDashboard(user: PermissionUser): boolean {
  return isPlatformOwnerEmail(user?.email)
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
  const managerLike = hasAdminAccess(user) || flag(user, 'manager') || user.isSuperAdmin
  if (!managerLike) return false
  if (profileLoading) return true
  const hasAnyActiveOperative = orgUsers.some(
    (member) => Boolean(member?.permissions?.operativeMode) && member.isActive !== false
  )
  if (hasAdminAccess(user) || user.isSuperAdmin || user.role === 'admin') return hasAnyActiveOperative
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

/** iOS UserStore.shouldShowTimesheetsDisabledMessage — PAYE with no remaining My Timesheets. */
export function shouldShowTimesheetsDisabledMessage(
  user: PermissionUser,
  hasMyTimesheets = canAccessMyTimesheets(user)
): boolean {
  if (!user) return false
  if (hasMyTimesheets) return false
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
export function canAccessTimesheets(
  user: PermissionUser,
  profileLoading = false,
  orgUsers: Array<NonNullable<PermissionUser>> = []
): boolean {
  return canAccessTimesheetsSurface(user, profileLoading, orgUsers)
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
  if (target.isSuperAdmin) return false
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

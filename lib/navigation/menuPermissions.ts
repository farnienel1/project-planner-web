/**
 * iOS parity source: Core/UserStore.swift
 * Spec: docs/ios-parity/01-data-model.md §9
 *
 * Re-exports the Phase 2 permission port so existing imports keep working.
 */

export {
  isOperativeMode,
  hasAdminAccess,
  canAccessOrganisationSettingsHub,
  canViewProjects,
  canViewOperatives,
  canViewManagers,
  canViewClients,
  isAnnualLeaveFeatureEnabled,
  canViewSiteMap,
  canViewSiteAudit,
  canAccessTimesheets,
  canAccessTimesheetsSurface,
  canManageQualifications,
  canAccessQualificationsHub,
  canViewMyQualifications,
  canManageJobTypes,
  canAccessWholesalers,
  canManageMaterialCatalogue,
  canManageSubcontractors,
  canManageUsers,
  canManageOperativesOnly,
  canInviteOperatives,
  canAccessOperativeAnnualLeaveDirectory,
  canAccessTeamSection,
  canViewHelp,
  canViewSchedule,
  canViewDailyOverview,
  canViewWeeklyReports,
  canViewMySchedule,
  canSelfBookMySchedule,
  parseUserPermissions,
  getManageUsersLabel,
  getAddUserLabel,
} from '@/lib/permissions'

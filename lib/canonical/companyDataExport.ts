/**
 * Rulebook 1.71.0 §12 / §20 (owner decision 23 Nov, issue 11): who may export the company's data.
 *
 * "This is a feature for super admins only." The company data export (Settings → Company → Export company data)
 * downloads every company record — pay, leave, timesheets, contact details — in one file, so it is for the
 * organisation's Super Admin only: `isOrganizationSuperAdmin` (its creator, or `isSuperAdmin` on a users document
 * that names this organisation, the rules' `callerIsSuperAdminOf`). Never a deactivated person, never without an open
 * organisation. Other admins no longer see it (before 1.71.0 every admin outside operative mode did).
 *
 * Every way in asks this: the Settings company list, the Organisation hub row, the panel itself and the export
 * runner before its first read.
 */
import { isOrganizationSuperAdmin } from './organizationDeletion'

export type CompanyDataExportViewer = {
  id?: string | null
  isSuperAdmin?: boolean | null
  /** The users document's organisation (the signed-in user's home company). */
  organizationId?: string | null
  /** Web: the users document's own organisation when `organizationId` was swapped for the open one. */
  homeOrganizationId?: string | null
  isActive?: boolean | null
}

export type CompanyDataExportOrganization = { id?: string | null; creatorUserId?: unknown }

export const COMPANY_EXPORT_REFUSED_MESSAGE = 'Only the Super Admin can export company data.'

export function canExportCompanyData(
  viewer: CompanyDataExportViewer | null | undefined,
  organization: CompanyDataExportOrganization | null | undefined
): boolean {
  if (!viewer || viewer.isActive === false) return false
  const organizationId = String(organization?.id ?? '').trim()
  if (!organizationId) return false
  const home = String(viewer.homeOrganizationId ?? '').trim() || String(viewer.organizationId ?? '').trim()
  return isOrganizationSuperAdmin(
    { id: viewer.id ?? null, isSuperAdmin: viewer.isSuperAdmin === true, organizationId: home || null },
    { id: organizationId, creatorUserId: organization?.creatorUserId }
  )
}

/**
 * Company data export (launch checklist 2.1): who may run it.
 *
 * Admins and super admins outside operative mode only — `isAdminOutsideOperativeMode` (lib/canonical, rulebook §8;
 * the same people as firestore.rules `adminLikeUser`), and never a deactivated person (the rules refuse them every
 * organisation read, §14). The button is hidden from everyone else, but the security rules are the guard: every
 * read the export makes is one the rules allow an admin of the open organisation (see the README notes).
 */
import { isAdminOutsideOperativeMode } from '../canonical/leaveRequests'

type ExportViewer = Parameters<typeof isAdminOutsideOperativeMode>[0] & { isActive?: boolean | null }

export function canExportCompanyData(viewer: ExportViewer | null | undefined, organizationId?: string | null): boolean {
  if (!viewer || viewer.isActive === false) return false
  if (!String(organizationId ?? '').trim()) return false
  return isAdminOutsideOperativeMode(viewer)
}

export const COMPANY_EXPORT_REFUSED_MESSAGE = 'Only admins can export company data.'

/**
 * Company data export (launch checklist 2.1): who may run it.
 *
 * Rulebook 1.71.0 (owner decision 23 Nov, issue 11): the organisation's Super Admin only —
 * `canExportCompanyData` in lib/canonical (`isOrganizationSuperAdmin`), so iOS can ask the same rule. Never a
 * deactivated person. Every way in asks it (Settings company list, Organisation hub, the panel, the runner).
 */
export { canExportCompanyData, COMPANY_EXPORT_REFUSED_MESSAGE } from '../canonical/companyDataExport'

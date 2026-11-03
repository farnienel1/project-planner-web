// Transactional: no marketing content
import { emailBrand, emailDocument, emailHeading, emailText } from '@/lib/email/emailTheme'
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'
import { DELETION_RESTORE_DAYS } from '@/lib/canonical/organizationDeletion'

/**
 * Rulebook 1.15.0 §20: sent to the platform owner and the super admin when an organisation is deleted (scheduled for
 * erasure). `eraseOn` is the erase day as shown in the app (`organizationEraseDateLabel`).
 */
export function organizationDeletionEmailSubject(organizationName: string): string {
  return `Organisation deleted — ${sanitizeEmailHeader(organizationName || 'Project Planner')}`
}

export function buildOrganizationDeletionEmailHtml(params: {
  organizationName: string
  organizationId: string
  requestedByEmail: string
  eraseOn: string
  restorable: boolean
  stripeNote: string
}): string {
  const org = escapeHtml(params.organizationName || 'Your organisation')
  const restore = params.restorable
    ? `The super admin can restore it from Settings → Billing in the web app until ${escapeHtml(params.eraseOn)}.`
    : `It was deleted with the last member's account, so only Project Planner support (info@projectplanner.us) can restore it before ${escapeHtml(params.eraseOn)}.`
  return emailDocument({
    title: 'Organisation deleted',
    maxWidth: 560,
    body: [
      emailBrand(),
      emailHeading('Organisation deleted'),
      emailText(`${org} has been deleted by ${escapeHtml(params.requestedByEmail || 'its super admin')}. Nobody can open it now.`),
      emailText(
        `It will be erased on ${escapeHtml(params.eraseOn)} (${DELETION_RESTORE_DAYS} days). Every job, booking, timesheet, file and person in it is then removed for good.`
      ),
      emailText(restore),
      emailText(escapeHtml(params.stripeNote), 'muted'),
      emailText(`Organisation id: ${escapeHtml(params.organizationId)}`, 'muted', 'margin:0;'),
    ].join('\n'),
  })
}

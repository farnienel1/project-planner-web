// Transactional: no marketing content
/** Email sent to info@projectplanner.us when an admin asks for a login email change. */

import { emailDocument, emailLink, emailStrong, emailText } from '@/lib/email/emailTheme'
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'

export const LOGIN_EMAIL_FIX_INBOX = 'info@projectplanner.us'

export type LoginEmailFixDetails = {
  organizationName: string
  organizationId: string
  userName: string
  userId: string
  oldEmail: string
  newEmail: string
  note: string
}

function line(label: string, value: string): string {
  return emailText(`${emailStrong(`${escapeHtml(label)}:`, 'ink')} ${escapeHtml(value || '—')}`)
}

export function loginEmailFixMessage(
  details: LoginEmailFixDetails,
  options: { ownerConsoleUrl?: string } = {}
): { subject: string; html: string } {
  const org = details.organizationName.trim() || 'Organisation'
  const subject = sanitizeEmailHeader(`Login email change — ${org}`, 180)
  const rows = [
    emailText('An organisation admin asked Project Planner to change a login email.'),
    line('Organisation', `${org} (${details.organizationId})`),
    line('User', `${details.userName.trim() || 'User'} (${details.userId})`),
    line('Old email', details.oldEmail),
    line('New email', details.newEmail),
    line('Note', details.note.trim()),
  ]
  if (options.ownerConsoleUrl) {
    rows.push(emailText(emailLink(escapeHtml(options.ownerConsoleUrl), 'Open in the owner console'), 'ink', 'margin:0;'))
  }
  return { subject, html: emailDocument({ title: subject, body: rows.join('\n') }) }
}

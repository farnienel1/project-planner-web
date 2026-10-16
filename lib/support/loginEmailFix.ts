// Transactional: no marketing content
/** Email sent to info@projectplanner.us when an admin asks for a login email change. */

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
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || '—')}</p>`
}

export function loginEmailFixMessage(details: LoginEmailFixDetails): { subject: string; html: string } {
  const org = details.organizationName.trim() || 'Organisation'
  return {
    subject: sanitizeEmailHeader(`Login email change — ${org}`, 180),
    html: [
      '<p>An organisation admin asked Project Planner to change a login email.</p>',
      line('Organisation', `${org} (${details.organizationId})`),
      line('User', `${details.userName.trim() || 'User'} (${details.userId})`),
      line('Old email', details.oldEmail),
      line('New email', details.newEmail),
      line('Note', details.note.trim()),
    ].join('\n'),
  }
}

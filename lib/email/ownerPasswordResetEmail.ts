// Transactional: no marketing content
import { emailDocument, emailLink, emailText } from '@/lib/email/emailTheme'
import { escapeHtml } from '@/lib/security/htmlEscape'

/** Owner console "send password reset": `link` is the Firebase reset link, passed in unescaped. */
export function buildOwnerPasswordResetEmailHtml(link: string): string {
  return emailDocument({
    title: 'Reset your Project Planner password',
    maxWidth: 560,
    body: [
      emailText('A password reset was requested by Project Planner support.'),
      emailText(emailLink(escapeHtml(link), 'Choose a new password')),
      emailText('This link expires after one hour.', 'ink', 'margin:0;'),
    ].join('\n'),
  })
}

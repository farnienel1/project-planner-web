// Transactional: no marketing content
import { emailBrand, emailCode, emailDocument, emailHeading, emailText } from '@/lib/email/emailTheme'
import { escapeHtml } from '@/lib/security/htmlEscape'

export function buildMfaEmailHtml(code: string): string {
  const safe = escapeHtml(code)
  return emailDocument({
    title: 'Your verification code',
    maxWidth: 560,
    body: [
      emailBrand(),
      emailHeading('Your verification code'),
      emailText('Use this code to finish signing in. It expires in 10 minutes.'),
      emailCode(safe),
      emailText('If you did not try to sign in, you can ignore this email. Your password has not been changed.', 'muted', 'margin:0;'),
    ].join('\n'),
  })
}

export function mfaEmailSubject(): string {
  return 'Your Project Planner verification code'
}

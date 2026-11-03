// Transactional: no marketing content
import { emailDocument, emailStrong, emailText } from '@/lib/email/emailTheme'
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'
import type { SupportContactBody } from '@/lib/security/publicFormSchemas'

export function supportContactMessage(input: SupportContactBody): { subject: string; html: string } {
  const subject = sanitizeEmailHeader(`Project Planner support: ${input.topic}`, 180)
  return {
    subject,
    html: emailDocument({
      title: subject,
      body: [
        emailText(`${emailStrong(escapeHtml(input.name), 'ink')} wrote from ${escapeHtml(input.email)}.`),
        emailText(`Topic: ${escapeHtml(input.topic)}`),
        emailText(escapeHtml(input.message), 'ink', 'margin:0;'),
      ].join('\n'),
    }),
  }
}

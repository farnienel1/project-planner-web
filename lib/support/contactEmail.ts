// Transactional: no marketing content
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'
import type { SupportContactBody } from '@/lib/security/publicFormSchemas'

export function supportContactMessage(input: SupportContactBody): { subject: string; html: string } {
  return {
    subject: sanitizeEmailHeader(`Project Planner support: ${input.topic}`, 180),
    html: [
      `<p><strong>${escapeHtml(input.name)}</strong> wrote from ${escapeHtml(input.email)}.</p>`,
      `<p>Topic: ${escapeHtml(input.topic)}</p>`,
      `<p>${escapeHtml(input.message)}</p>`,
    ].join('\n'),
  }
}

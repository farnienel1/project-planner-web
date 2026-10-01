import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'
import { INTEREST_INBOX } from '@/lib/interest/inbox'
import type { InterestDraft } from '@/lib/interest/registration'

export async function sendInterestEmails(draft: Pick<
  InterestDraft,
  'firstName' | 'lastName' | 'company' | 'email' | 'phone' | 'role' | 'teamSize' | 'sectors' | 'currentTools' | 'message' | 'source' | 'campaign'
>): Promise<void> {
  const teamSize = draft.teamSize || 'team size not given'
  const campaign = draft.campaign
  const ownerHtml = `
    <p><strong>${escapeHtml(draft.firstName)} ${escapeHtml(draft.lastName)}</strong> at ${escapeHtml(draft.company)} registered interest.</p>
    <p>Role: ${escapeHtml(draft.role || 'not given')}<br/>
    Team size: ${escapeHtml(teamSize)}<br/>
    Email: ${escapeHtml(draft.email)}<br/>
    Phone: ${escapeHtml(draft.phone || 'not given')}<br/>
    Sectors: ${escapeHtml(draft.sectors.join(', ') || 'not given')}<br/>
    Currently using: ${escapeHtml(draft.currentTools || 'not given')}<br/>
    Source: ${escapeHtml(draft.source || 'direct')}${campaign ? ` / ${escapeHtml(campaign)}` : ''}</p>
    <p>${escapeHtml(draft.message || 'No message.')}</p>
  `
  const ackHtml = `
    <p>Hello ${escapeHtml(draft.firstName)},</p>
    <p>You're on the list. We'll email you when Project Planner opens, and ${escapeHtml(draft.company)} will be in the first group through the door.</p>
    <p>What happens next:</p>
    <p>1. The odd short update as we finish building. No spam, no newsletter.<br/>
    2. An invite before it goes public, with a free trial.<br/>
    3. A setup call so you start with your own jobs and people in it.</p>
    <p>If you need us before then, reply to this email or write to ${escapeHtml(INTEREST_INBOX)}.</p>
    <p>Project Planner</p>
  `
  const company = sanitizeEmailHeader(draft.company, 120) || 'a company'
  await sendProjectPlannerEmail({
    to: INTEREST_INBOX,
    subject: sanitizeEmailHeader(`New interest — ${company} (${teamSize} on the tools)`, 180),
    html: ownerHtml,
    replyTo: draft.email,
  })
  await sendProjectPlannerEmail({
    to: draft.email,
    subject: "You're on the Project Planner list",
    html: ackHtml,
    replyTo: INTEREST_INBOX,
  })
}

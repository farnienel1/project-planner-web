import { getAppBaseUrl, sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'
import { INTEREST_INBOX } from '@/lib/interest/inbox'
import type { InterestDraft } from '@/lib/interest/registration'
import { LEGAL_ENTITY } from '@/lib/legal/customerLegalPack'
import { isInterestEmailSuppressed } from '@/lib/interest/suppressionStore'
import {
  interestUnsubscribeApiPath,
  interestUnsubscribePagePath,
  mintInterestUnsubscribeToken,
} from '@/lib/interest/unsubscribeToken'

export function buildInterestOwnerHtml(
  draft: Pick<
    InterestDraft,
    'firstName' | 'lastName' | 'company' | 'email' | 'phone' | 'role' | 'teamSize' | 'sectors' | 'currentTools' | 'message' | 'source' | 'campaign'
  >
): string {
  const teamSize = draft.teamSize || 'team size not given'
  const campaign = draft.campaign
  return `
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
}

export function buildInterestAckHtml(input: {
  firstName: string
  company: string
  unsubscribeUrl: string
}): string {
  return `
    <p>Hello ${escapeHtml(input.firstName)},</p>
    <p>You're on the list. We'll email you when Project Planner opens, and ${escapeHtml(input.company)} will be in the first group through the door.</p>
    <p>What happens next:</p>
    <p>1. The odd short update as we finish building. No spam, no newsletter.<br/>
    2. An invite before it goes public, with a free trial.<br/>
    3. A setup call so you start with your own jobs and people in it.</p>
    <p>If you need us before then, reply to this email or write to ${escapeHtml(INTEREST_INBOX)}.</p>
    <p>Project Planner</p>
    <p style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
      ${escapeHtml(LEGAL_ENTITY.name)}<br/>
      ${escapeHtml(LEGAL_ENTITY.registeredOffice)}<br/>
      <a href="mailto:${escapeHtml(LEGAL_ENTITY.privacyEmail)}">${escapeHtml(LEGAL_ENTITY.privacyEmail)}</a><br/>
      <a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe from Project Planner updates</a>
    </p>
  `
}

export function interestAckUnsubscribeHeaders(unsubscribeApiUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeApiUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

export async function sendInterestEmails(
  draft: Pick<
    InterestDraft,
    'firstName' | 'lastName' | 'company' | 'email' | 'phone' | 'role' | 'teamSize' | 'sectors' | 'currentTools' | 'message' | 'source' | 'campaign'
  >,
  options?: { isSuppressed?: (email: string) => Promise<boolean> }
): Promise<'sent' | 'skipped'> {
  const teamSize = draft.teamSize || 'team size not given'
  const company = sanitizeEmailHeader(draft.company, 120) || 'a company'
  await sendProjectPlannerEmail({
    to: INTEREST_INBOX,
    subject: sanitizeEmailHeader(`New interest — ${company} (${teamSize} on the tools)`, 180),
    html: buildInterestOwnerHtml(draft),
    replyTo: draft.email,
  })

  const suppressed = await (options?.isSuppressed ?? isInterestEmailSuppressed)(draft.email)
  if (suppressed) return 'skipped'

  const minted = mintInterestUnsubscribeToken(draft.email)
  const base = getAppBaseUrl().replace(/\/$/, '')
  const pageUrl = `${base}${interestUnsubscribePagePath(minted.token)}`
  const apiUrl = `${base}${interestUnsubscribeApiPath(minted.token)}`
  await sendProjectPlannerEmail({
    to: draft.email,
    subject: "You're on the Project Planner list",
    html: buildInterestAckHtml({
      firstName: draft.firstName,
      company: draft.company,
      unsubscribeUrl: pageUrl,
    }),
    replyTo: INTEREST_INBOX,
    headers: interestAckUnsubscribeHeaders(apiUrl),
  })
  return 'sent'
}

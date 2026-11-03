import { getAppBaseUrl, sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { emailDocument, emailFooter, emailLink, emailStrong, emailText } from '@/lib/email/emailTheme'
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
  return emailDocument({
    title: 'New interest',
    body: [
      emailText(
        `${emailStrong(`${escapeHtml(draft.firstName)} ${escapeHtml(draft.lastName)}`, 'ink')} at ${escapeHtml(draft.company)} registered interest.`
      ),
      emailText(`Role: ${escapeHtml(draft.role || 'not given')}<br/>
    Team size: ${escapeHtml(teamSize)}<br/>
    Email: ${escapeHtml(draft.email)}<br/>
    Phone: ${escapeHtml(draft.phone || 'not given')}<br/>
    Sectors: ${escapeHtml(draft.sectors.join(', ') || 'not given')}<br/>
    Currently using: ${escapeHtml(draft.currentTools || 'not given')}<br/>
    Source: ${escapeHtml(draft.source || 'direct')}${campaign ? ` / ${escapeHtml(campaign)}` : ''}`),
      emailText(escapeHtml(draft.message || 'No message.'), 'ink', 'margin:0;'),
    ].join('\n'),
  })
}

export function buildInterestAckHtml(input: {
  firstName: string
  company: string
  unsubscribeUrl: string
}): string {
  return emailDocument({
    title: "You're on the Project Planner list",
    body: [
      emailText(`Hello ${escapeHtml(input.firstName)},`),
      emailText(
        `You're on the list. We'll email you when Project Planner opens, and ${escapeHtml(input.company)} will be in the first group through the door.`
      ),
      emailText('What happens next:'),
      emailText(`1. The odd short update as we finish building. No spam, no newsletter.<br/>
    2. An invite before it goes public, with a free trial.<br/>
    3. A setup call so you start with your own jobs and people in it.`),
      emailText(`If you need us before then, reply to this email or write to ${escapeHtml(INTEREST_INBOX)}.`),
      emailText('Project Planner', 'ink', 'margin:0;'),
      emailFooter(`${escapeHtml(LEGAL_ENTITY.name)}<br/>
      ${escapeHtml(LEGAL_ENTITY.registeredOffice)}<br/>
      ${emailLink(`mailto:${escapeHtml(LEGAL_ENTITY.privacyEmail)}`, escapeHtml(LEGAL_ENTITY.privacyEmail))}<br/>
      ${emailLink(escapeHtml(input.unsubscribeUrl), 'Unsubscribe from Project Planner updates')}`),
    ].join('\n'),
  })
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

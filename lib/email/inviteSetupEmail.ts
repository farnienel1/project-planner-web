// Transactional: no marketing content
import { getAppBaseUrl } from '@/lib/email/resendClient'
import {
  WELCOME_EMAIL_HTML_TEMPLATE,
  WELCOME_EMAIL_TEXT_TEMPLATE,
} from '@/lib/email/welcomeEmailPack'
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'

export type InviteSetupEmailParams = {
  to: string
  firstName: string
  organizationName: string
  invitationId: string
  role: 'manager' | 'operative' | 'admin'
}

const PACK_TOKEN = /\{\{(FirstName|CompanyName|SetupLink|RecipientEmail)\}\}/g

function fillPackTokens(template: string, tokens: Record<string, string>): string {
  return template.replace(PACK_TOKEN, (_, key: string) => tokens[key] ?? '')
}

export function inviteSetupPasswordUrl(invitationId: string): string {
  return `${getAppBaseUrl()}/setup-password.html?token=${encodeURIComponent(invitationId)}`
}

export function buildInviteSetupEmailHtml(params: InviteSetupEmailParams): string {
  const setupUrl = inviteSetupPasswordUrl(params.invitationId)
  return fillPackTokens(WELCOME_EMAIL_HTML_TEMPLATE, {
    FirstName: escapeHtml(params.firstName.trim() || 'there'),
    CompanyName: escapeHtml(params.organizationName.trim()),
    SetupLink: escapeHtml(setupUrl),
    RecipientEmail: escapeHtml(params.to.trim()),
  }).trim()
}

export function buildInviteSetupEmailText(params: InviteSetupEmailParams): string {
  const setupUrl = inviteSetupPasswordUrl(params.invitationId)
  return fillPackTokens(WELCOME_EMAIL_TEXT_TEMPLATE, {
    FirstName: params.firstName.trim() || 'there',
    CompanyName: params.organizationName.trim(),
    SetupLink: setupUrl,
    RecipientEmail: params.to.trim(),
  }).trim()
}

export function inviteSetupEmailSubject(organizationName: string): string {
  return `Welcome to Project Planner — ${sanitizeEmailHeader(organizationName)}`
}

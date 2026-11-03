// Transactional: no marketing content
import { getAppBaseUrl } from '@/lib/email/resendClient'
import {
  emailBrand,
  emailButton,
  emailDocument,
  emailHeading,
  emailLink,
  emailStrong,
  emailText,
} from '@/lib/email/emailTheme'
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'

export type OrgAdditionEmailParams = {
  to: string
  firstName: string
  organizationName: string
}

export function orgAdditionEmailSubject(organizationName: string): string {
  return `${sanitizeEmailHeader(organizationName)} has invited you to join their organisation on Project Planner`
}

export function buildOrgAdditionEmailHtml(params: OrgAdditionEmailParams): string {
  const signInUrl = `${getAppBaseUrl()}/dashboard/change-organisation`
  const safeName = escapeHtml(params.firstName.trim() || 'there')
  const safeOrg = escapeHtml(params.organizationName)

  return emailDocument({
    title: 'A new organisation has been added to your account',
    maxWidth: 560,
    body: [
      emailBrand(),
      emailHeading('A new organisation has been added to your account'),
      emailText(`Hi ${safeName},`),
      emailText(`${emailStrong(safeOrg)} has invited you to join their organisation on Project Planner.`),
      emailText(
        'You are already part of another organisation, so you will now see both organisations within your account. Sign in with your existing password — no new password is needed.'
      ),
      emailButton(signInUrl, 'View organisations'),
      emailText(
        `If the button doesn&rsquo;t work, copy this link into your browser:<br />${emailLink(signInUrl, signInUrl)}`,
        'small',
        'margin:32px 0 0 0;'
      ),
    ].join('\n'),
  })
}

// Transactional: no marketing content
import { getAppBaseUrl } from '@/lib/email/resendClient'
import { billingTermsParagraphHtml } from '@/lib/email/billingPurchaseEmail'
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

export type ConfirmAccountEmailParams = {
  to: string
  firstName: string
  organizationName: string
  confirmationToken: string
}

export function confirmAccountUrl(confirmationToken: string): string {
  return `${getAppBaseUrl()}/confirm-account?token=${encodeURIComponent(confirmationToken)}`
}

export function buildConfirmAccountEmailHtml(params: ConfirmAccountEmailParams): string {
  const setupUrl = confirmAccountUrl(params.confirmationToken)
  const safeName = escapeHtml(params.firstName.trim() || 'there')
  const safeOrg = escapeHtml(params.organizationName)
  const safeUrl = escapeHtml(setupUrl)

  return emailDocument({
    title: 'Confirm your account',
    maxWidth: 560,
    body: [
      emailBrand(),
      emailHeading('Confirm your account'),
      emailText(`Hi ${safeName},`),
      emailText(
        `Your organisation ${emailStrong(safeOrg)} is set up and your subscription is active. Click the button below to confirm this email address and open your Project Planner account.`
      ),
      billingTermsParagraphHtml(),
      emailText('Until you confirm, you will not be able to sign in on the web or the mobile apps.'),
      emailButton(safeUrl, 'Confirm my account'),
      emailText(
        'After confirming you will land on the Project Planner login page. Sign in with the email and password you chose during setup, then review and accept the customer terms.',
        'muted'
      ),
      emailText(
        `If the button doesn&rsquo;t work, copy this link into your browser:<br />${emailLink(safeUrl, safeUrl)}`,
        'small',
        'margin:32px 0 0 0;'
      ),
    ].join('\n'),
  })
}

export function confirmAccountEmailSubject(organizationName: string): string {
  return `Confirm your Project Planner account — ${sanitizeEmailHeader(organizationName)}`
}

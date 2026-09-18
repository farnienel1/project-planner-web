import { getAppBaseUrl } from '@/lib/email/resendClient'
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

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
      <p style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Project Planner</p>
      <h1 style="font-size: 24px; margin: 12px 0;">Confirm your account</h1>
      <p>Hi ${safeName},</p>
      <p>
        Your organisation <strong>${safeOrg}</strong> is set up and your subscription is active.
        Click the button below to confirm this email address and open your Project Planner account.
      </p>
      <p>Until you confirm, you will not be able to sign in on the web or the mobile apps.</p>
      <p style="margin: 28px 0;">
        <a href="${safeUrl}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; display: inline-block;">
          Confirm my account
        </a>
      </p>
      <p style="font-size: 14px; color: #475569;">
        After confirming you will land on the Project Planner login page. Sign in with the email and password you chose during setup, then review and accept the customer terms.
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
        If the button doesn&rsquo;t work, copy this link into your browser:<br />
        <a href="${safeUrl}">${safeUrl}</a>
      </p>
    </div>
  `.trim()
}

export function confirmAccountEmailSubject(organizationName: string): string {
  return `Confirm your Project Planner account — ${sanitizeEmailHeader(organizationName)}`
}

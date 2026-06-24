import { getAppBaseUrl } from '@/lib/email/resendClient'

export type InviteSetupEmailParams = {
  to: string
  firstName: string
  organizationName: string
  invitationId: string
  role: 'manager' | 'operative' | 'admin'
}

export function buildInviteSetupEmailHtml(params: InviteSetupEmailParams): string {
  const setupUrl = `${getAppBaseUrl()}/setup-password?invitation=${encodeURIComponent(params.invitationId)}`
  const roleLabel =
    params.role === 'admin' ? 'administrator' : params.role === 'manager' ? 'manager' : 'operative'
  const appStoreUrl = 'https://apps.apple.com/app/project-planner'

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
      <p style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Project Planner</p>
      <h1 style="font-size: 24px; margin: 12px 0;">Set up your ${roleLabel} account</h1>
      <p>Hi ${params.firstName.trim() || 'there'},</p>
      <p>
        You&rsquo;ve been invited to join <strong>${params.organizationName}</strong> on Project Planner as a
        <strong>${roleLabel}</strong>.
      </p>
      <p>Choose a password to activate your account:</p>
      <p style="margin: 28px 0;">
        <a href="${setupUrl}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; display: inline-block;">
          Set up password
        </a>
      </p>
      <p style="font-size: 14px; color: #475569;">
        After setting your password you can sign in on the web or download the iOS app:
        <a href="${appStoreUrl}">App Store</a>
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
        If the button doesn&rsquo;t work, copy this link into your browser:<br />
        <a href="${setupUrl}">${setupUrl}</a>
      </p>
    </div>
  `.trim()
}

export function inviteSetupEmailSubject(organizationName: string): string {
  return `Set up your Project Planner account — ${organizationName}`
}

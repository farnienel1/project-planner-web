import { getAppBaseUrl } from '@/lib/email/resendClient'

export type OrgAdditionEmailParams = {
  to: string
  firstName: string
  organizationName: string
}

export function orgAdditionEmailSubject(organizationName: string): string {
  return `${organizationName} has invited you to join their organisation on Project Planner`
}

export function buildOrgAdditionEmailHtml(params: OrgAdditionEmailParams): string {
  const signInUrl = `${getAppBaseUrl()}/dashboard/change-organisation`

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
      <p style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Project Planner</p>
      <h1 style="font-size: 24px; margin: 12px 0;">A new organisation has been added to your account</h1>
      <p>Hi ${params.firstName.trim() || 'there'},</p>
      <p>
        <strong>${params.organizationName}</strong> has invited you to join their organisation on Project Planner.
      </p>
      <p>
        You are already part of another organisation, so you will now see both organisations within your account.
        Sign in with your existing password — no new password is needed.
      </p>
      <p style="margin: 28px 0;">
        <a href="${signInUrl}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; display: inline-block;">
          View organisations
        </a>
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
        If the button doesn&rsquo;t work, copy this link into your browser:<br />
        <a href="${signInUrl}">${signInUrl}</a>
      </p>
    </div>
  `.trim()
}

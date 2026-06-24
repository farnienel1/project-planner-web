import { NextRequest, NextResponse } from 'next/server'
import { inviteSetupEmailSubject, buildInviteSetupEmailHtml } from '@/lib/email/inviteSetupEmail'
import { sendResendEmail } from '@/lib/email/resendClient'

export const runtime = 'nodejs'

type SendBody = {
  invitationId?: string
  organizationName?: string
  firstName?: string
  role?: 'manager' | 'operative' | 'admin'
  to?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendBody
    const { invitationId, organizationName, firstName, role, to } = body

    if (!invitationId || !organizationName?.trim() || !firstName?.trim() || !role || !to?.trim()) {
      return NextResponse.json(
        { error: 'invitationId, organizationName, firstName, role, and to are required' },
        { status: 400 }
      )
    }

    const email = to.trim().toLowerCase()

    await sendResendEmail({
      to: email,
      subject: inviteSetupEmailSubject(organizationName.trim()),
      html: buildInviteSetupEmailHtml({
        to: email,
        firstName: firstName.trim(),
        organizationName: organizationName.trim(),
        invitationId,
        role,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invite email'
    console.error('[invites/send-setup-email]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { orgAdditionEmailSubject, buildOrgAdditionEmailHtml } from '@/lib/email/orgAdditionEmail'
import { sendResendEmail } from '@/lib/email/resendClient'

export const runtime = 'nodejs'

type SendBody = {
  organizationName?: string
  firstName?: string
  to?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendBody
    const { organizationName, firstName, to } = body

    if (!organizationName?.trim() || !firstName?.trim() || !to?.trim()) {
      return NextResponse.json(
        { error: 'organizationName, firstName, and to are required' },
        { status: 400 }
      )
    }

    const email = to.trim().toLowerCase()

    await sendResendEmail({
      to: email,
      subject: orgAdditionEmailSubject(organizationName.trim()),
      html: buildOrgAdditionEmailHtml({
        to: email,
        firstName: firstName.trim(),
        organizationName: organizationName.trim(),
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send org addition email'
    console.error('[invites/send-org-addition-email]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

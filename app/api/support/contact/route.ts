import { NextRequest, NextResponse } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { jsonError } from '@/lib/security/apiGuard'
import { guardPublicForm } from '@/lib/security/publicFormGuard'
import { supportContactBodySchema } from '@/lib/security/publicFormSchemas'
import { SUPPORT_EMAIL } from '@/lib/marketing/content'
import { supportContactMessage } from '@/lib/support/contactEmail'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const guarded = await guardPublicForm(request, supportContactBodySchema, {
    scope: 'support-contact',
    limit: 5,
    windowMs: 60 * 60 * 1000,
  })
  if (!guarded.ok) return guarded.response
  if (guarded.silent) return NextResponse.json({ ok: true })

  const message = supportContactMessage(guarded.value)
  try {
    await sendProjectPlannerEmail({
      to: SUPPORT_EMAIL,
      subject: message.subject,
      html: message.html,
      replyTo: guarded.value.email,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[support/contact]', error)
    return jsonError("That didn't send.", 502)
  }
}

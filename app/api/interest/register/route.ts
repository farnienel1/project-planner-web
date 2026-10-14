import { NextRequest, NextResponse } from 'next/server'
import { InterestAdminUnavailable } from '@/lib/interest/adminStore'
import { saveInterestRegistration } from '@/lib/interest/repository'
import { sendInterestEmails } from '@/lib/interest/notifyEmail'
import { buildInterestDraft } from '@/lib/interest/registration'
import { jsonError } from '@/lib/security/apiGuard'
import { guardPublicForm } from '@/lib/security/publicFormGuard'
import { interestRegisterBodySchema } from '@/lib/security/publicFormSchemas'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const guarded = await guardPublicForm(request, interestRegisterBodySchema, {
    scope: 'interest-register',
    limit: 8,
    windowMs: 60 * 60 * 1000,
  })
  if (!guarded.ok) return guarded.response
  if (guarded.silent) return NextResponse.json({ ok: true })

  const built = buildInterestDraft({
    firstName: guarded.value.firstName,
    lastName: guarded.value.lastName,
    company: guarded.value.company,
    email: guarded.value.email,
    phone: guarded.value.phone,
    role: guarded.value.role,
    teamSize: guarded.value.teamSize,
    sectors: guarded.value.sectors,
    currentTools: guarded.value.currentTools,
    message: guarded.value.message,
    consent: guarded.value.consent,
    honeypot: guarded.value.website,
    source: guarded.value.source,
    campaign: guarded.value.campaign,
    referrer: guarded.value.referrer,
    pagePath: guarded.value.pagePath,
    userAgent: guarded.value.userAgent,
  })
  if (!built.ok) return jsonError('Check the form and try again.', 400)
  if (built.silent) return NextResponse.json({ ok: true })
  try {
    const id = await saveInterestRegistration(built.draft)
    if (process.env.NODE_ENV === 'production' || !process.env.FIRESTORE_EMULATOR_HOST) {
      await sendInterestEmails(built.draft).catch((error) => {
        console.error('[interest] email failed after save', error)
      })
    }
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      return jsonError('Registration storage is not configured.', 503)
    }
    console.error('[interest] save failed', error)
    return jsonError("That didn't send.", 500)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { sendInterestEmails } from '@/lib/interest/notifyEmail'
import { buildInterestDraft } from '@/lib/interest/registration'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'interest-notify', 8, 60 * 60 * 1000)
  if (limited) return limited
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response
  const built = buildInterestDraft({
    firstName: text(body.value.firstName),
    lastName: text(body.value.lastName),
    company: text(body.value.company),
    email: text(body.value.email),
    phone: text(body.value.phone),
    role: text(body.value.role),
    teamSize: text(body.value.teamSize),
    sectors: Array.isArray(body.value.sectors) ? body.value.sectors.filter((item): item is string => typeof item === 'string') : [],
    currentTools: text(body.value.currentTools),
    message: text(body.value.message),
    consent: body.value.consent === true,
    honeypot: text(body.value.website),
    source: text(body.value.source),
    campaign: text(body.value.campaign),
    referrer: text(body.value.referrer),
    pagePath: text(body.value.pagePath),
    userAgent: text(body.value.userAgent),
  })
  if (!built.ok) return jsonError('That registration could not be emailed.', 400)
  if (built.silent) return NextResponse.json({ ok: true })
  await sendInterestEmails(built.draft)
  return NextResponse.json({ ok: true })
}

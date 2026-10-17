import { NextRequest, NextResponse } from 'next/server'
import { lookupLiveOrgForEmail } from '@/lib/orgSetup/liveOrgLookupAdmin'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { firstZodError, honeypotFilled, liveOrgLookupBodySchema } from '@/lib/security/publicFormSchemas'
import { enforceAppCheckOnAuthGate } from '@/lib/security/verifyAppCheckToken'

export const runtime = 'nodejs'

const EMPTY: { hasLiveOrg: false } = { hasLiveOrg: false }

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'live-org-lookup', 10, 10 * 60 * 1000)
  if (limited) return limited

  const checked = await enforceAppCheckOnAuthGate(request)
  if (checked) return checked

  const body = await readJsonBody<unknown>(request)
  if (!body.ok) return body.response

  const parsed = liveOrgLookupBodySchema.safeParse(body.value)
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400)
  if (honeypotFilled(parsed.data.website)) {
    return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const result = await lookupLiveOrgForEmail(parsed.data.email)
    return NextResponse.json(
      { hasLiveOrg: result.hasLiveOrg === true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } })
  }
}

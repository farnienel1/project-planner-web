import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { firstZodError, honeypotFilled, publicGateBodySchema } from '@/lib/security/publicFormSchemas'
import { enforceAppCheckOnAuthGate } from '@/lib/security/verifyAppCheckToken'

export const runtime = 'nodejs'

const LIMITS: Record<string, { scope: string; limit: number; windowMs: number }> = {
  login: { scope: 'public-login', limit: 20, windowMs: 10 * 60 * 1000 },
  signup: { scope: 'public-signup', limit: 8, windowMs: 60 * 60 * 1000 },
  'reset-request': { scope: 'public-reset-request', limit: 5, windowMs: 60 * 60 * 1000 },
  'reset-complete': { scope: 'public-reset-complete', limit: 10, windowMs: 10 * 60 * 1000 },
  'developer-login': { scope: 'public-developer-login', limit: 20, windowMs: 10 * 60 * 1000 },
  'invite-setup': { scope: 'public-invite-setup', limit: 20, windowMs: 10 * 60 * 1000 },
}

export async function POST(request: NextRequest) {
  const checked = await enforceAppCheckOnAuthGate(request)
  if (checked) return checked

  const body = await readJsonBody<unknown>(request)
  if (!body.ok) return body.response

  const parsed = publicGateBodySchema.safeParse(body.value)
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400)

  const limits = LIMITS[parsed.data.form]
  if (!limits) return jsonError('Unknown form.', 400)
  const limited = enforceRateLimit(request, limits.scope, limits.limit, limits.windowMs)
  if (limited) return limited

  if (honeypotFilled(parsed.data.website)) return NextResponse.json({ ok: true, proceed: false })
  return NextResponse.json({ ok: true, proceed: true })
}

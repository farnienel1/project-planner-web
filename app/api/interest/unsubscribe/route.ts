import { NextRequest, NextResponse } from 'next/server'
import { InterestAdminUnavailable } from '@/lib/interest/adminStore'
import { applyInterestUnsubscribe } from '@/lib/interest/unsubscribe'
import { resolveUnsubscribeToken, verifyInterestUnsubscribeToken } from '@/lib/interest/unsubscribeToken'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { firstZodError, honeypotFilled, interestUnsubscribeBodySchema } from '@/lib/security/publicFormSchemas'

export const runtime = 'nodejs'

/**
 * RFC 8058 one-click. No login and no App Check — Gmail posts from the mail
 * client, which cannot send an App Check JWT.
 */
async function tokenFromRequest(request: NextRequest): Promise<
  | { ok: true; silent: true }
  | { ok: true; silent: false; token: string }
  | { ok: false; response: NextResponse }
> {
  const queryToken = request.nextUrl.searchParams.get('token')
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await readJsonBody<unknown>(request)
    if (!body.ok) return { ok: false, response: body.response }
    const parsed = interestUnsubscribeBodySchema.safeParse(body.value)
    if (!parsed.success) return { ok: false, response: jsonError(firstZodError(parsed.error), 400) }
    if (honeypotFilled(parsed.data.website)) return { ok: true, silent: true }
    const resolved = resolveUnsubscribeToken({
      queryToken,
      bodyToken: parsed.data.token,
      bodyEmail: parsed.data.email,
    })
    if (!resolved.ok) {
      return {
        ok: false,
        response: jsonError(
          resolved.reason === 'email-only'
            ? 'That unsubscribe link is not valid.'
            : 'That unsubscribe link is not valid.',
          400
        ),
      }
    }
    return { ok: true, silent: false, token: resolved.token }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text()
    const form = new URLSearchParams(text)
    const resolved = resolveUnsubscribeToken({
      queryToken,
      bodyToken: form.get('token'),
      bodyEmail: form.get('email'),
    })
    if (!resolved.ok) {
      return { ok: false, response: jsonError('That unsubscribe link is not valid.', 400) }
    }
    return { ok: true, silent: false, token: resolved.token }
  }

  const resolved = resolveUnsubscribeToken({ queryToken })
  if (!resolved.ok) {
    return { ok: false, response: jsonError('That unsubscribe link is not valid.', 400) }
  }
  return { ok: true, silent: false, token: resolved.token }
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'interest-unsubscribe', 30, 60 * 60 * 1000)
  if (limited) return limited

  const extracted = await tokenFromRequest(request)
  if (!extracted.ok) return extracted.response
  if (extracted.silent) return NextResponse.json({ ok: true })

  const claims = verifyInterestUnsubscribeToken(extracted.token)
  if (!claims) return jsonError('That unsubscribe link is not valid.', 400)

  try {
    await applyInterestUnsubscribe(claims)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      return jsonError('Unsubscribe storage is not configured.', 503)
    }
    console.error('[interest] unsubscribe failed', error)
    return jsonError("That didn't send.", 500)
  }
}

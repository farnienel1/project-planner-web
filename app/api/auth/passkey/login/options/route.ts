import { NextRequest, NextResponse } from 'next/server'

import { encodePasskeyChallenge, writePasskeyCookie } from '@/lib/auth/passkeys/passkeyChallenge'
import { PASSKEY_CHALLENGE_TTL_MS } from '@/lib/auth/passkeys/passkeyConfig'
import { isRelyingParty, passkeysOffResponse, requestRelyingParty } from '@/lib/auth/passkeys/passkeyRoute'
import { beginPasskeyLogin } from '@/lib/auth/passkeys/passkeyService'
import { enforceRateLimit, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

type Body = { next?: string; ownerOnly?: boolean }

/** Start a passkey sign-in (button or browser autofill). Signed out; the challenge is bound to this browser. */
export async function POST(request: NextRequest) {
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-login-options', 60, 10 * 60 * 1000)
  if (limited) return limited
  const rp = requestRelyingParty(request)
  if (!isRelyingParty(rp)) return rp
  const hasBody = Number(request.headers.get('content-length') || '0') > 0
  const body = hasBody ? await readJsonBody<Body>(request, 2048) : { ok: true as const, value: {} as Body }
  if (!body.ok) return body.response
  const begun = await beginPasskeyLogin({ rp, next: body.value.next, ownerOnly: body.value.ownerOnly === true })
  const response = NextResponse.json({ options: begun.options }, { headers: { 'Cache-Control': 'no-store' } })
  writePasskeyCookie(response.cookies, request, encodePasskeyChallenge(begun.cookie), PASSKEY_CHALLENGE_TTL_MS)
  return response
}

import { NextRequest, NextResponse } from 'next/server'
import {
  clientIp,
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { enforceAppCheckOnAuthGate } from '@/lib/security/verifyAppCheckToken'
import { firebaseAdminConfigured, verifyAuthPassword } from '@/lib/owner/identityToolkitAdmin'
import {
  ownerAccountDeleteBlock,
  parseAccountDeleteBody,
  resolveAccountDeleteEmail,
  soleAdminErrorBody,
} from '@/lib/account/accountDelete'
import { evaluateAccountOrgs, executeAccountDelete, readAccountDeleteJobEmail } from '@/lib/account/accountDeleteAdmin'
import { clearMfaCookies } from '@/lib/auth/mfa/mfaCookies'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'account-delete', 8, 15 * 60 * 1000)
  if (limited) return limited

  const checked = await enforceAppCheckOnAuthGate(request)
  if (checked) return checked

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const ownerBlock = ownerAccountDeleteBlock(user.email)
  if (ownerBlock) return jsonError(ownerBlock.error, ownerBlock.status)

  const body = await readJsonBody<{ confirmation?: string; password?: string }>(request)
  if (!body.ok) return body.response
  const parsed = parseAccountDeleteBody(body.value)
  if (!parsed.ok) return jsonError(parsed.error, parsed.status)

  let email = resolveAccountDeleteEmail({ authEmail: user.email })
  if (!email && firebaseAdminConfigured()) {
    email = await readAccountDeleteJobEmail(user.uid)
  }
  if (!email) return jsonError('Type DELETE and enter your password to delete your account.', 400)
  const passwordOk = await verifyAuthPassword(email, parsed.password)
  if (!passwordOk) return jsonError('Password is incorrect.', 401)

  if (!firebaseAdminConfigured()) {
    return jsonError(
      'Account deletion is unavailable on this server. Email info@projectplanner.us.',
      501
    )
  }

  try {
    const evaluation = await evaluateAccountOrgs(user.uid)
    if ('block' in evaluation) {
      return NextResponse.json(soleAdminErrorBody(evaluation.block), {
        status: 409,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    await executeAccountDelete({
      uid: user.uid,
      email,
      snapshots: evaluation.snapshots,
      ip: clientIp(request),
    })

    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    clearMfaCookies(response.cookies, request)
    return response
  } catch (error) {
    console.error('[account/delete]', error)
    return jsonError(clientSafeMessage(error, 'Could not delete your account.'), 502)
  }
}

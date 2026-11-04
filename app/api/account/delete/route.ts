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
  COMPANY_DELETE_REQUIRED_CODE,
  HANDOVER_REQUIRED_CODE,
  missingCompanyConfirmations,
  ownerAccountDeleteBlock,
  parseAccountDeleteBody,
  resolveAccountDeleteEmail,
} from '@/lib/account/accountDelete'
import { evaluateAccountOrgs, executeAccountDelete, readAccountDeleteJobEmail } from '@/lib/account/accountDeleteAdmin'
import { clearMfaCookies } from '@/lib/auth/mfa/mfaCookies'
import { ACCOUNT_DELETE_WITH_COMPANY_MESSAGE, ACCOUNT_HANDOVER_REQUIRED_MESSAGE } from '@/lib/canonical/organizationDeletion'
import { scheduleOrganizationDeletion } from '@/lib/organizationDeletion/server'

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
    // Rulebook 1.15.0 `accountDeletionPath`: a super admin with other active members hands super admin over first;
    // the super admin who is the only member deletes the company with the account (company name + DELETE).
    const evaluation = await evaluateAccountOrgs(user.uid)
    if ('handover' in evaluation) {
      return NextResponse.json(
        {
          error: ACCOUNT_HANDOVER_REQUIRED_MESSAGE,
          code: HANDOVER_REQUIRED_CODE,
          orgId: evaluation.handover.orgId,
          orgName: evaluation.handover.orgName,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const missing = missingCompanyConfirmations(evaluation.paths, parsed.companyNames)
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: ACCOUNT_DELETE_WITH_COMPANY_MESSAGE,
          code: COMPANY_DELETE_REQUIRED_CODE,
          orgs: missing.map((row) => ({ orgId: row.orgId, orgName: row.orgName })),
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    // The company first (locked for 30 days, restorable only by the platform owner since nobody is left), then the
    // account as before.
    for (const row of evaluation.paths.filter((entry) => entry.path === 'delete_with_company')) {
      await scheduleOrganizationDeletion({
        organizationId: row.orgId,
        requestedBy: user.uid,
        requestedByEmail: email,
        restoreBy: 'platform_owner',
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

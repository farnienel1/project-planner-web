import { NextRequest, NextResponse } from 'next/server'
import {
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { encodeSigned, MFA_OK_TTL_MS, writeMfaCookie, type MfaOk } from '@/lib/auth/mfa/mfaCookies'
import { bearerToken, firestoreGet, readBool, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { clampString, isValidUuid } from '@/lib/security/validation'
import { mfaSetupGrantAllowed } from '@/lib/security/mfaSetupGrant'
import { membershipAllows, membershipFromOrgFields, parseOrganizationId, timestampMs } from '@/lib/security/requireOrgAccess'

export const runtime = 'nodejs'

type GrantBody = {
  invitationId?: string
  organizationId?: string
}

/** First-time invite / owner-create / new company only: allow the app without a 2FA code. */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'mfa-grant-setup', 8, 10 * 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  if (!user.uid) return jsonError('Sign in required', 401)

  const hasBody = Number(request.headers.get('content-length') || '0') > 0
  const body = hasBody
    ? await readJsonBody<GrantBody>(request)
    : { ok: true as const, value: {} as GrantBody }
  if (!body.ok) return body.response

  const token = bearerToken(request)
  let accountConfirmed: boolean | null = null
  let invitationEmailMatches = false
  let invitationIsUsed = false
  let invitationUsedAtMs: number | null = null
  let isOrgAdmin = false
  let orgCreatedAtMs: number | null = null

  try {
    const userDoc = await firestoreGet(token, `users/${user.uid}`)
    if (userDoc) {
      const plain = restFieldsToPlain(userDoc.fields)
      if (plain.accountConfirmed === false) accountConfirmed = false
      else if (plain.accountConfirmed === true || readBool(userDoc.fields, 'accountConfirmed')) accountConfirmed = true
    }
  } catch {
    accountConfirmed = null
  }

  const invitationId = clampString(body.value.invitationId, 80)
  if (invitationId && isValidUuid(invitationId) && user.email) {
    try {
      const invitation = await firestoreGet(token, `invitations/${invitationId}`)
      if (invitation) {
        const plain = restFieldsToPlain(invitation.fields)
        invitationEmailMatches =
          typeof plain.email === 'string' && plain.email.trim().toLowerCase() === user.email
        invitationIsUsed = plain.isUsed === true
        invitationUsedAtMs = timestampMs(plain.usedAt)
      }
    } catch {
      /* invitation proof is optional when another allow path matches */
    }
  }

  const organizationId = parseOrganizationId(body.value.organizationId)
  if (organizationId) {
    try {
      const orgDoc = await firestoreGet(token, `organizations/${organizationId}`)
      if (orgDoc) {
        const plain = restFieldsToPlain(orgDoc.fields)
        isOrgAdmin = membershipAllows(membershipFromOrgFields(plain, user.uid), 'admin')
        orgCreatedAtMs = timestampMs(plain.createdAt)
      }
    } catch {
      /* org proof is optional when another allow path matches */
    }
  }

  if (
    !mfaSetupGrantAllowed({
      isPlatformOwner: isPlatformOwnerEmail(user.email),
      accountConfirmed,
      invitationEmailMatches,
      invitationIsUsed,
      invitationUsedAtMs,
      isOrgAdmin,
      orgCreatedAtMs,
      nowMs: Date.now(),
    })
  ) {
    return jsonError('Two-factor verification is required for this account', 403)
  }

  const ok: MfaOk = { uid: user.uid, exp: Date.now() + MFA_OK_TTL_MS }
  const response = NextResponse.json({ ok: true, skipped: true })
  writeMfaCookie(response.cookies, request, 'challenge', '', 0)
  writeMfaCookie(response.cookies, request, 'ok', encodeSigned(ok), MFA_OK_TTL_MS)
  return response
}

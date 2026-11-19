import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, enforceRateLimitKey, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOrgAccess } from '@/lib/security/requireOrgAccess'
import { clampString, isValidEmail } from '@/lib/security/validation'
import { bearerToken, firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { canEditTargetUser } from '@/lib/staff/userEditPermissions'
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'
import { isGhostUser } from '@/lib/canonical/userRosterSegment'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import { AuthAccountNotFoundError, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import {
  FIREBASE_RESET_NO_LOGIN_MESSAGE,
  firebaseDefaultPasswordReset,
  sendBrandedPasswordReset,
} from '@/lib/auth/passwordResetServer'

const NO_STORE = { 'Cache-Control': 'no-store' }

export const ADMIN_RESET_NOT_ALLOWED_MESSAGE = 'You cannot send a password reset to this person.'
export const ADMIN_RESET_NOT_SET_UP_MESSAGE = "This person hasn't finished setting up their login yet."
export const ADMIN_RESET_NO_LOGIN_MESSAGE = 'No login exists for this email yet.'

type Deps = {
  sendBranded?: typeof sendBrandedPasswordReset
  sendFirebase?: typeof firebaseDefaultPasswordReset
}

/**
 * Manage Users / Edit User "Send password reset" (review of #361): signed in, and only for a person the caller may
 * edit — `canEditTargetUser` (admins, and an Operatives manager for an operative; never the Super Admin unless the
 * caller is one), the rule the screens already used to show the button. The target is read from Firestore with the
 * caller's token, so the address is the stored one, never one sent by the client. No per-email cap (it is not the
 * public route); a per-caller limit only. The real result is reported: the branded email, else Firebase's own, else
 * an error the admin sees.
 */
export async function handleAdminPasswordReset(request: NextRequest, deps: Deps = {}): Promise<NextResponse> {
  const limited = enforceRateLimit(request, 'admin-password-reset', 60, 10 * 60 * 1000)
  if (limited) return limited
  const body = await readJsonBody<{ organizationId?: unknown; userId?: unknown }>(request, 4096)
  if (!body.ok) return body.response
  const access = await requireOrgAccess(request, typeof body.value.organizationId === 'string' ? body.value.organizationId : '', 'staff')
  if (!access.ok) return access.response
  const perCaller = enforceRateLimitKey('admin-password-reset-uid', access.user.uid, 60, 10 * 60 * 1000)
  if (perCaller) return perCaller
  const userId = clampString(typeof body.value.userId === 'string' ? body.value.userId : '', 128) || ''
  if (!userId || userId.includes('/')) return jsonError('userId is required', 400)

  const token = bearerToken(request)
  let callerPlain: Record<string, unknown> | null = null
  let targetPlain: Record<string, unknown> | null = null
  let orgPlain: Record<string, unknown> = {}
  try {
    const [callerDoc, targetDoc, orgDoc] = await Promise.all([
      firestoreGet(token, `users/${access.user.uid}`),
      firestoreGet(token, `users/${userId}`),
      firestoreGet(token, `organizations/${access.organizationId}`),
    ])
    callerPlain = callerDoc ? restFieldsToPlain(callerDoc.fields) : null
    targetPlain = targetDoc ? restFieldsToPlain(targetDoc.fields) : null
    orgPlain = orgDoc ? restFieldsToPlain(orgDoc.fields) : {}
  } catch {
    return jsonError('Could not read that person. Try again.', 502)
  }
  if (!targetPlain) return jsonError('Person not found', 404)

  const members = orgPlain.members && typeof orgPlain.members === 'object' ? (orgPlain.members as Record<string, unknown>) : {}
  const targetInOrg = documentOrganizationId(targetPlain.organizationId) === access.organizationId || userId in members
  if (!targetInOrg) return jsonError(ADMIN_RESET_NOT_ALLOWED_MESSAGE, 403)

  const target = parseOrgUser(userId, targetPlain)
  if (!target) return jsonError('Person not found', 404)
  const callerInOrg = callerPlain && documentOrganizationId(callerPlain.organizationId) === access.organizationId
  const caller = callerInOrg ? parseOrgUser(access.user.uid, callerPlain!) : null
  const allowed = caller
    ? canEditTargetUser(caller, target)
    : // A member from another company: their level here is the organisation's members map.
      (access.membership.isCreator || access.membership.role === 'admin') && (!target.isSuperAdmin || access.membership.isCreator)
  if (!allowed) return jsonError(ADMIN_RESET_NOT_ALLOWED_MESSAGE, 403)
  if (isGhostUser(targetPlain) || targetPlain.passwordSet !== true) return jsonError(ADMIN_RESET_NOT_SET_UP_MESSAGE, 400)
  const email = String(targetPlain.email || '').trim().toLowerCase()
  if (!isValidEmail(email)) return jsonError(ADMIN_RESET_NOT_SET_UP_MESSAGE, 400)

  const continueUrl = passwordResetActionSettings(email).url
  const sendBranded = deps.sendBranded ?? sendBrandedPasswordReset
  const sendFirebase = deps.sendFirebase ?? firebaseDefaultPasswordReset
  let status = 'sent'
  try {
    if (!firebaseAdminConfigured() || !process.env.EMAIL_SERVER_KEY?.trim()) throw new Error('not configured')
    await sendBranded({ email, continueUrl, reason: 'admin', idToken: token })
  } catch (error) {
    if (error instanceof AuthAccountNotFoundError) {
      console.info('[users/send-password-reset]', 'no_account')
      return jsonError(ADMIN_RESET_NO_LOGIN_MESSAGE, 404)
    }
    try {
      await sendFirebase(email, continueUrl)
      status = 'sent_firebase_fallback'
    } catch (fallbackError) {
      console.info('[users/send-password-reset]', 'failed')
      const message = fallbackError instanceof Error && fallbackError.message === FIREBASE_RESET_NO_LOGIN_MESSAGE
        ? ADMIN_RESET_NO_LOGIN_MESSAGE
        : 'Could not send the password reset email. Try again.'
      return jsonError(message, message === ADMIN_RESET_NO_LOGIN_MESSAGE ? 404 : 502)
    }
  }
  // Status only: never the address or the link.
  console.info('[users/send-password-reset]', status)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

import { NextRequest, NextResponse } from 'next/server'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimit, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { ownerFreshnessRefusal, requireOwnerSession } from '@/lib/owner/requireOwner'
import { ownerReasonError } from '@/lib/owner/personActions'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import { isValidDocumentId, isValidEmail } from '@/lib/security/validation'
import { adminLookupAuthEmail, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { firebaseDefaultPasswordReset, sendBrandedPasswordReset } from '@/lib/auth/passwordResetServer'
import { bearerToken, firestoreGet, readString } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

const lastSent = new Map<string, number>()

/**
 * POST /api/owner/send-password-reset `{ uid, reason }` — the owner emails a person a password reset link.
 * Owner decision 24 Nov ("it's password related so needs to be safe"): a reason is required on every way in, the
 * owner must have entered a code within the last 10 minutes (as the other risky person actions), and the audit entry
 * is written before anything is sent. The address is read from the person's own records (users document, then
 * Firebase Auth), never from the request.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-reset', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwnerSession(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readApiBody(request, apiObject({ uid: apiText(128), reason: apiText(1000) }))
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  // Mass-assignment audit 17 Nov: the uid goes into a document path, so only a plain document id.
  if (!isValidDocumentId(uid)) return jsonError('Choose a person first.', 400)
  const reasonError = ownerReasonError(body.value.reason)
  if (reasonError) return jsonError(reasonError, 400)
  const reason = (body.value.reason || '').trim()
  const notFresh = ownerFreshnessRefusal(owner, false)
  if (notFresh) return notFresh

  const token = bearerToken(request)
  let email = ''
  const userDoc = await firestoreGet(token, `users/${uid}`).catch(() => null)
  const fromDoc = userDoc ? readString(userDoc.fields, 'email').toLowerCase() : ''
  if (fromDoc) email = fromDoc
  if (firebaseAdminConfigured()) {
    const fromAuth = await adminLookupAuthEmail(uid).catch(() => null)
    if (fromAuth) email = fromAuth
  }

  if (!isValidEmail(email)) return jsonError('A valid login email is required to send a reset.', 400)

  const prev = lastSent.get(`${uid}:${email}`) || 0
  if (Date.now() - prev < 2 * 60 * 1000) {
    return jsonError('Wait two minutes before sending another reset to this user.', 429, 120)
  }

  const settings = passwordResetActionSettings(email)

  let audit: OwnerAuditRun
  try {
    audit = await beginOwnerAudit(request, owner.uid, {
      action: 'ownerSendPasswordReset',
      targetUserId: uid,
      reason,
      after: { email },
    })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }

  try {
    let sent = false
    if (firebaseAdminConfigured()) {
      try {
        // The same branded email as Forgot password, worded for support.
        await sendBrandedPasswordReset({ email, continueUrl: settings.url, reason: 'support', idToken: token })
        sent = true
      } catch (adminError) {
        // Never the link or the address in the log.
        console.warn('[owner/send-password-reset] admin path failed, trying Auth email', adminError instanceof Error ? adminError.name : 'error')
      }
    }
    if (!sent) {
      await firebaseDefaultPasswordReset(email, settings.url)
    }
    lastSent.set(`${uid}:${email}`, Date.now())
    await audit.complete()
    return NextResponse.json({ ok: true, email, requestId: audit.requestId })
  } catch (error) {
    console.error('[owner/send-password-reset]', error)
    await audit.fail(error)
    return jsonError(error instanceof Error ? error.message : 'Could not send a password reset email.', 502)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimit, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { requireOwner } from '@/lib/owner/requireOwner'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import { isValidDocumentId, isValidEmail } from '@/lib/security/validation'
import { adminLookupAuthEmail, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { firebaseDefaultPasswordReset, sendBrandedPasswordReset } from '@/lib/auth/passwordResetServer'
import { bearerToken, firestoreGet, readString } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

const lastSent = new Map<string, number>()

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-reset', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readApiBody(request, apiObject({ uid: apiText(128), email: apiText(254) }))
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  let email = (body.value.email || '').trim().toLowerCase()
  // Mass-assignment audit 17 Nov: the uid goes into a document path, so only a plain document id.
  if (uid && !isValidDocumentId(uid)) return jsonError('uid is not valid', 400)

  const token = bearerToken(request)
  if (uid) {
    const userDoc = await firestoreGet(token, `users/${uid}`).catch(() => null)
    const fromDoc = userDoc ? readString(userDoc.fields, 'email').toLowerCase() : ''
    if (fromDoc) email = fromDoc
    if (firebaseAdminConfigured()) {
      const fromAuth = await adminLookupAuthEmail(uid).catch(() => null)
      if (fromAuth) email = fromAuth
    }
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
      targetUserId: uid || undefined,
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

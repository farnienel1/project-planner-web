import { NextRequest, NextResponse } from 'next/server'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { clientIp, enforceRateLimit, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { isValidEmail } from '@/lib/security/validation'
import { maskEmail } from '@/lib/auth/maskEmail'
import { adminUpdateAuthEmail, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { bearerToken, firestoreDelete, firestoreGet, firestorePatch, readString, stringField } from '@/lib/owner/firestoreRest'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-change-email', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ uid?: string; newEmail?: string; reason?: string; sendReset?: boolean }>(request)
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  const newEmail = (body.value.newEmail || '').trim().toLowerCase()
  const reason = (body.value.reason || '').trim()
  const sendReset = body.value.sendReset !== false
  if (!uid || !isValidEmail(newEmail)) return jsonError('Choose a user and enter a valid new login email.', 400)
  if (isPlatformOwnerEmail(newEmail)) return jsonError('That email is reserved for the platform owner.', 400)
  if (uid === owner.uid) return jsonError('The owner login email cannot be changed from this console.', 400)
  if (!firebaseAdminConfigured()) {
    return jsonError(
      'Changing a login email needs FIREBASE_SERVICE_ACCOUNT_JSON on the server so Auth can be updated. Password reset still works without it.',
      501
    )
  }

  const token = bearerToken(request)
  const userDoc = await firestoreGet(token, `users/${uid}`)
  if (!userDoc) return jsonError('That user record was not found.', 404)
  const oldEmail = readString(userDoc.fields, 'email').toLowerCase()
  const organizationId = readString(userDoc.fields, 'organizationId')
  if (isPlatformOwnerEmail(oldEmail)) {
    return jsonError('The owner login email cannot be changed from this console.', 400)
  }
  if (oldEmail && oldEmail === newEmail) {
    return jsonError('That is already the login email.', 400)
  }

  try {
    await adminUpdateAuthEmail(uid, newEmail)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Could not update the Firebase login email.', 502)
  }

  try {
    await firestorePatch(token, `users/${uid}`, { email: stringField(newEmail) }, ['email'])
    if (organizationId && oldEmail) {
      await firestoreDelete(token, `organizations/${organizationId}/userEmails/${encodeURIComponent(oldEmail)}`).catch(() => undefined)
    }
    if (organizationId) {
      await firestorePatch(
        token,
        `organizations/${organizationId}/userEmails/${encodeURIComponent(newEmail)}`,
        { userId: stringField(uid) },
        ['userId']
      ).catch(() => undefined)
    }
  } catch (error) {
    console.error('[owner/change-email] firestore', error)
    return jsonError(
      'Firebase Auth email was updated, but the user record could not be saved. Try again or contact support with the user id.',
      502
    )
  }

  if (sendReset) {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (apiKey) {
      const settings = passwordResetActionSettings(newEmail)
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: newEmail, continueUrl: settings.url }),
      }).catch(() => undefined)
    }
  }

  await writeAuditLog(request, {
    action: 'ownerChangeUserEmail',
    actorUid: owner.uid,
    targetUserId: uid,
    targetOrgId: organizationId || undefined,
    before: { email: maskEmail(oldEmail) },
    after: { email: maskEmail(newEmail), reason, sendReset },
    ip: clientIp(request),
  })
  return NextResponse.json({ ok: true, uid, email: newEmail })
}

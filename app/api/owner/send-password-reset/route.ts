import { NextRequest, NextResponse } from 'next/server'
import { clientIp, enforceRateLimit, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import { isValidEmail } from '@/lib/security/validation'
import { maskEmail } from '@/lib/auth/maskEmail'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { adminLookupAuthEmail, adminPasswordResetLink, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { bearerToken, firestoreGet, readString } from '@/lib/owner/firestoreRest'
import { escapeHtml } from '@/lib/security/htmlEscape'

export const runtime = 'nodejs'

const lastSent = new Map<string, number>()

async function sendOobViaApiKey(email: string, continueUrl: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) throw new Error('Firebase is not configured on the server.')
  const run = async (includeContinue: boolean) =>
    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        includeContinue
          ? { requestType: 'PASSWORD_RESET', email, continueUrl }
          : { requestType: 'PASSWORD_RESET', email }
      ),
    })
  let response = await run(true)
  if (!response.ok) response = await run(false)
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok) {
    const message = data.error?.message || ''
    if (message.includes('EMAIL_NOT_FOUND')) {
      throw new Error('No Firebase login exists for that email yet. They may still be on an unused invite.')
    }
    if (message.includes('INVALID_CONTINUE_URI')) {
      throw new Error('Password reset continue URL is not allowed on this Firebase project.')
    }
    throw new Error(data.error?.message || 'Could not send a password reset email.')
  }
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-reset', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ uid?: string; email?: string }>(request)
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  let email = (body.value.email || '').trim().toLowerCase()

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

  try {
    let sent = false
    if (firebaseAdminConfigured()) {
      try {
        const link = await adminPasswordResetLink(email, settings.url)
        await sendProjectPlannerEmail({
          to: email,
          subject: 'Reset your Project Planner password',
          html: `<p>A password reset was requested by Project Planner support.</p><p><a href="${escapeHtml(link)}">Choose a new password</a></p><p>This link expires after one hour.</p>`,
        })
        sent = true
      } catch (adminError) {
        console.warn('[owner/send-password-reset] admin path failed, trying Auth email', adminError)
      }
    }
    if (!sent) {
      await sendOobViaApiKey(email, settings.url)
    }
    lastSent.set(`${uid}:${email}`, Date.now())
    await writeAuditLog(request, {
      action: 'ownerSendPasswordReset',
      actorUid: owner.uid,
      targetUserId: uid || undefined,
      after: { email: maskEmail(email) },
      ip: clientIp(request),
    })
    return NextResponse.json({ ok: true, email })
  } catch (error) {
    console.error('[owner/send-password-reset]', error)
    return jsonError(error instanceof Error ? error.message : 'Could not send a password reset email.', 502)
  }
}

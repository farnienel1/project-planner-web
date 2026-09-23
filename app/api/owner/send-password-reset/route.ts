import { NextRequest, NextResponse } from 'next/server'
import { clientIp, enforceRateLimit, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import { isValidEmail } from '@/lib/security/validation'
import { maskEmail } from '@/lib/auth/maskEmail'

export const runtime = 'nodejs'

const lastSent = new Map<string, number>()

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-reset', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ uid?: string; email?: string }>(request)
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  const email = (body.value.email || '').trim().toLowerCase()
  if (!isValidEmail(email)) return jsonError('A valid login email is required to send a reset.', 400)

  const prev = lastSent.get(email) || 0
  if (Date.now() - prev < 2 * 60 * 1000) {
    return jsonError('Wait two minutes before sending another reset to this user.', 429, 120)
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) return jsonError('Firebase is not configured on the server.', 500)
  const settings = passwordResetActionSettings(email)

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
          continueUrl: settings.url,
        }),
      }
    )
    if (!response.ok) {
      return jsonError('Could not send a password reset email.', 502)
    }
    lastSent.set(email, Date.now())
    await writeAuditLog(request, {
      action: 'ownerSendPasswordReset',
      actorUid: owner.uid,
      targetUserId: uid || undefined,
      after: { email: maskEmail(email) },
      ip: clientIp(request),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[owner/send-password-reset]', error)
    return jsonError('Could not send a password reset email.', 502)
  }
}

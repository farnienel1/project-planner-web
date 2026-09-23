import { NextRequest, NextResponse } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail } from '@/lib/security/validation'
import { getAppBaseUrl } from '@/lib/email/resendClient'
import { maskEmail } from '@/lib/auth/maskEmail'
import { PLATFORM_OWNER_EMAIL } from '@/lib/platform/owner'
import { bearerToken } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'support-email-fix', 5, 24 * 60 * 60 * 1000)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const body = await readJsonBody<{
    orgId?: string
    targetUid?: string
    suggestedEmail?: string
    note?: string
  }>(request)
  if (!body.ok) return body.response
  const orgId = clampString(body.value.orgId, 80) || ''
  const targetUid = clampString(body.value.targetUid, 80) || ''
  const suggestedEmail = (clampString(body.value.suggestedEmail, 254) || '').toLowerCase()
  const note = clampString(body.value.note, 500) || ''
  if (!orgId || !targetUid || !isValidEmail(suggestedEmail)) {
    return jsonError('orgId, targetUid and a valid suggestedEmail are required', 400)
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const token = bearerToken(request)
  if (!projectId || !token) return jsonError('Sign in required', 401)

  try {
    const created = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/supportRequests`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            orgId: { stringValue: orgId },
            requestedByUid: { stringValue: user.uid },
            targetUid: { stringValue: targetUid },
            suggestedEmail: { stringValue: suggestedEmail },
            note: { stringValue: note },
            status: { stringValue: 'open' },
            createdAt: { timestampValue: new Date().toISOString() },
          },
        }),
      }
    )
    if (!created.ok) {
      return jsonError('Could not store that support request. Publish the updated Firestore rules first.', 502)
    }
    const deepLink = `${getAppBaseUrl()}/developer/users?fix=${encodeURIComponent(targetUid)}`
    await sendProjectPlannerEmail({
      to: PLATFORM_OWNER_EMAIL,
      subject: 'Login email fix requested',
      html: `<p>An organisation admin asked Project Planner to fix a login email.</p>
        <p>Suggested email: ${maskEmail(suggestedEmail)}</p>
        <p>Note: ${note || '—'}</p>
        <p><a href="${deepLink}">Open in the owner console</a></p>`,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[support/login-email]', error)
    return jsonError(clientSafeMessage(error, 'Could not send that request.'), 502)
  }
}

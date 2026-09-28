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
import { PLATFORM_OWNER_EMAIL } from '@/lib/platform/owner'
import { bearerToken, firestoreGet, readString } from '@/lib/owner/firestoreRest'
import { LOGIN_EMAIL_FIX_INBOX, loginEmailFixMessage } from '@/lib/support/loginEmailFix'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'support-email-fix', 5, 24 * 60 * 60 * 1000)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const body = await readJsonBody<{
    orgId?: string
    orgName?: string
    targetUid?: string
    targetName?: string
    currentEmail?: string
    suggestedEmail?: string
    note?: string
  }>(request)
  if (!body.ok) return body.response
  const orgId = clampString(body.value.orgId, 80) || ''
  const targetUid = clampString(body.value.targetUid, 80) || ''
  const suggestedEmail = (clampString(body.value.suggestedEmail, 254) || '').toLowerCase()
  const note = clampString(body.value.note, 500) || ''
  const orgNameHint = clampString(body.value.orgName, 160) || ''
  const targetNameHint = clampString(body.value.targetName, 160) || ''
  const currentEmailHint = (clampString(body.value.currentEmail, 254) || '').toLowerCase()
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
      console.error('[support/login-email] could not store the request', created.status)
    }
    let userDoc: Awaited<ReturnType<typeof firestoreGet>> = null
    let orgDoc: Awaited<ReturnType<typeof firestoreGet>> = null
    try {
      userDoc = await firestoreGet(token, `users/${targetUid}`)
      orgDoc = await firestoreGet(token, `organizations/${orgId}`)
    } catch (readError) {
      console.error('[support/login-email] could not read org or user', readError)
    }
    const oldEmail = (userDoc ? readString(userDoc.fields, 'email') : currentEmailHint).toLowerCase()
    const storedName = userDoc
      ? `${readString(userDoc.fields, 'firstName')} ${readString(userDoc.fields, 'surname')}`.trim()
      : ''
    const message = loginEmailFixMessage({
      organizationName: (orgDoc ? readString(orgDoc.fields, 'name') : '') || orgNameHint,
      organizationId: orgId,
      userName: storedName || targetNameHint,
      userId: targetUid,
      oldEmail: oldEmail || currentEmailHint,
      newEmail: suggestedEmail,
      note,
    })
    const deepLink = `${getAppBaseUrl()}/developer/users?fix=${encodeURIComponent(targetUid)}`
    await sendProjectPlannerEmail({
      to: LOGIN_EMAIL_FIX_INBOX || PLATFORM_OWNER_EMAIL,
      subject: message.subject,
      html: `${message.html}<p><a href="${deepLink}">Open in the owner console</a></p>`,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[support/login-email]', error)
    return jsonError(clientSafeMessage(error, 'Could not send that request.'), 502)
  }
}

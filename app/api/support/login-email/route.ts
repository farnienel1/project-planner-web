import { NextRequest, NextResponse } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { isValidDocumentId, isValidEmail } from '@/lib/security/validation'
import { getAppBaseUrl } from '@/lib/email/resendClient'
import { PLATFORM_OWNER_EMAIL } from '@/lib/platform/owner'
import { bearerToken, firestoreGet, readString, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { organizationMemberActive, parseOrganizationName } from '@/lib/canonical'
import { requireOrgAccessForUser } from '@/lib/security/requireOrgAccess'
import { LOGIN_EMAIL_FIX_INBOX, loginEmailFixMessage } from '@/lib/support/loginEmailFix'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'support-email-fix', 5, 24 * 60 * 60 * 1000)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  // Mass-assignment audit 17 Nov: only these keys are read. The organisation name, the person's name and their current
  // email come from the stored documents, never from the request (the old `orgName` / `targetName` / `currentEmail`
  // hints are ignored).
  const body = await readApiBody(
    request,
    apiObject({ orgId: apiText(80), targetUid: apiText(128), suggestedEmail: apiText(254), note: apiText(500) })
  )
  if (!body.ok) return body.response
  const orgId = body.value.orgId
  const targetUid = body.value.targetUid
  const suggestedEmail = body.value.suggestedEmail.toLowerCase()
  const note = body.value.note
  if (!orgId || !targetUid || !isValidEmail(suggestedEmail)) {
    return jsonError('orgId, targetUid and a valid suggestedEmail are required', 400)
  }
  if (!isValidDocumentId(targetUid)) return jsonError('targetUid is not valid', 400)

  const access = await requireOrgAccessForUser(request, user, orgId, 'admin')
  if (!access.ok) return access.response

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const token = bearerToken(request)
  if (!projectId || !token) return jsonError('Sign in required', 401)

  // Mass-assignment audit 17 Nov: the person must belong to the caller's organisation (rulebook
  // `organizationMemberActive`: a key of `members`, the creator, a users document of it, or a membership there) before
  // anything is stored or emailed — an admin of one company can never file a request about someone elsewhere.
  let userDoc: Awaited<ReturnType<typeof firestoreGet>> = null
  let orgDoc: Awaited<ReturnType<typeof firestoreGet>> = null
  let membershipDoc: Awaited<ReturnType<typeof firestoreGet>> = null
  try {
    // A users document the security rules refuse to this admin is not one of their organisation's people: read as none.
    ;[userDoc, orgDoc] = await Promise.all([
      firestoreGet(token, `users/${targetUid}`).catch(() => null),
      firestoreGet(token, `organizations/${access.organizationId}`),
    ])
    membershipDoc = await firestoreGet(token, `users/${targetUid}/orgMemberships/${access.organizationId}`).catch(() => null)
  } catch (readError) {
    console.error('[support/login-email] could not read org or user', readError)
    return jsonError('Could not check that person. Try again.', 503)
  }
  const belongs = organizationMemberActive({
    organizationId: access.organizationId,
    userId: targetUid,
    organization: orgDoc ? restFieldsToPlain(orgDoc.fields) : null,
    user: userDoc ? restFieldsToPlain(userDoc.fields) : null,
    membership: membershipDoc ? restFieldsToPlain(membershipDoc.fields) : null,
  }).member
  if (!userDoc || !belongs) return jsonError('That person is not in your organisation.', 404)

  try {
    const created = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/supportRequests`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            orgId: { stringValue: access.organizationId },
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
    const oldEmail = readString(userDoc.fields, 'email').toLowerCase()
    const storedName = `${readString(userDoc.fields, 'firstName')} ${readString(userDoc.fields, 'surname')}`.trim()
    const deepLink = `${getAppBaseUrl()}/developer/users?fix=${encodeURIComponent(targetUid)}`
    const message = loginEmailFixMessage({
      organizationName: parseOrganizationName(orgDoc ? restFieldsToPlain(orgDoc.fields) : undefined),
      organizationId: access.organizationId,
      userName: storedName,
      userId: targetUid,
      oldEmail,
      newEmail: suggestedEmail,
      note,
    }, { ownerConsoleUrl: deepLink })
    await sendProjectPlannerEmail({
      to: LOGIN_EMAIL_FIX_INBOX || PLATFORM_OWNER_EMAIL,
      subject: message.subject,
      html: message.html,
      idToken: token,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[support/login-email]', error)
    return jsonError(clientSafeMessage(error, 'Could not send that request.'), 502)
  }
}

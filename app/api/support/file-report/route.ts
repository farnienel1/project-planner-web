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
import { getAppBaseUrl } from '@/lib/email/resendClient'
import { PLATFORM_OWNER_EMAIL } from '@/lib/platform/owner'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { requireOrgAccessForUser } from '@/lib/security/requireOrgAccess'
import { SUPPORT_EMAIL } from '@/lib/marketing/content'
import { escapeHtml } from '@/lib/security/htmlEscape'
import {
  CONTENT_REPORTS_COLLECTION,
  contentReportFirestoreFields,
  contentReportMessage,
  parseContentReportInput,
  type ContentReportInput,
} from '@/lib/reports/contentReport'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'support-file-report', 8, 60 * 60 * 1000)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const body = await readJsonBody<ContentReportInput>(request)
  if (!body.ok) return body.response

  const parsed = parseContentReportInput(body.value, { uid: user.uid, email: user.email })
  if (!parsed.ok) return jsonError(parsed.error, 400)

  const access = await requireOrgAccessForUser(request, user, parsed.value.orgId, 'member')
  if (!access.ok) return access.response

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const token = bearerToken(request)
  if (!projectId || !token) return jsonError('Sign in required', 401)

  const fields = contentReportFirestoreFields(parsed.value)
  const restFields: Record<string, { stringValue: string } | { timestampValue: string }> = {
    createdAt: { timestampValue: new Date().toISOString() },
  }
  for (const [key, value] of Object.entries(fields)) {
    restFields[key] = { stringValue: value }
  }

  try {
    const created = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${CONTENT_REPORTS_COLLECTION}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: restFields }),
      }
    )
    if (!created.ok) {
      console.error('[support/file-report] could not store the report', created.status)
    }
    const message = contentReportMessage(parsed.value)
    const deepLink = `${getAppBaseUrl()}/developer`
    await sendProjectPlannerEmail({
      to: SUPPORT_EMAIL || PLATFORM_OWNER_EMAIL,
      subject: message.subject,
      html: `${message.html}<p><a href="${escapeHtml(deepLink)}">Open in the owner console</a></p>`,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[support/file-report]', error)
    return jsonError(clientSafeMessage(error, 'Could not send that report.'), 502)
  }
}

import { NextRequest } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { managerExportEmailHTML } from '@/lib/timesheets/timesheetExport'
import {
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail } from '@/lib/security/validation'

export const runtime = 'nodejs'

type DownloadLink = { fileName?: string; url?: string }

type ExportBody = {
  recipientEmail?: string
  recipientName?: string
  organizationName?: string
  weekTitle?: string
  paymentRunStamp?: string
  timesheetCount?: number
  attachmentNames?: string[]
  downloadLinks?: DownloadLink[]
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'timesheet-export-email', 12, 10 * 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<ExportBody>(request, 200_000)
  if (!body.ok) return body.response

  const recipientEmail = clampString(body.value.recipientEmail, 254)
  const recipientName = clampString(body.value.recipientName, 120) || 'there'
  const organizationName = clampString(body.value.organizationName, 200)
  const weekTitle = clampString(body.value.weekTitle, 120)
  const paymentRunStamp = clampString(body.value.paymentRunStamp, 80)
  if (!recipientEmail || !isValidEmail(recipientEmail) || !organizationName || !weekTitle || !paymentRunStamp) {
    return jsonError('recipientEmail, organizationName, weekTitle, and paymentRunStamp are required', 400)
  }

  const names = Array.isArray(body.value.attachmentNames)
    ? body.value.attachmentNames.map((name) => clampString(name, 200)).filter((name): name is string => Boolean(name))
    : []
  const downloadLinks = Array.isArray(body.value.downloadLinks)
    ? body.value.downloadLinks
        .map((link) => {
          const fileName = clampString(link.fileName, 200)
          const url = clampString(link.url, 2000)
          if (!fileName || !url || !/^https?:\/\//i.test(url)) return null
          return { fileName, url }
        })
        .filter((link): link is { fileName: string; url: string } => Boolean(link))
    : []
  const timesheetCount =
    typeof body.value.timesheetCount === 'number' && Number.isFinite(body.value.timesheetCount)
      ? Math.max(1, Math.min(Math.round(body.value.timesheetCount), 80))
      : Math.max(1, downloadLinks.length || names.length)

  if (names.length === 0 && downloadLinks.length === 0) {
    return jsonError('At least one timesheet file is required', 400)
  }

  const html = managerExportEmailHTML({
    recipientName,
    weekTitle,
    paymentRunStamp,
    organizationName,
    attachmentNames: names.length > 0 ? names : downloadLinks.map((link) => link.fileName),
    downloadLinks,
    timesheetCount,
  })

  try {
    await sendProjectPlannerEmail({
      to: recipientEmail.toLowerCase(),
      subject: `Signed timesheets for filing — ${paymentRunStamp} — ${organizationName}`,
      html,
      fromName: organizationName,
    })
  } catch (error) {
    console.error('[timesheets/export-email]', error)
    return jsonError(clientSafeMessage(error, 'Failed to send timesheet export email'), 500)
  }

  return Response.json({ ok: true, emailed: timesheetCount })
}

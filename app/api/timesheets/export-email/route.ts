import { NextRequest } from 'next/server'
import { sendProjectPlannerEmail, type ProjectPlannerEmailAttachment } from '@/lib/email/resendClient'
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
type PdfAttachment = { fileName?: string; filename?: string; content?: string }

type ExportBody = {
  recipientEmail?: string
  recipientName?: string
  organizationName?: string
  weekTitle?: string
  paymentRunStamp?: string
  timesheetCount?: number
  attachmentNames?: string[]
  downloadLinks?: DownloadLink[]
  pdfAttachments?: PdfAttachment[]
}

const MAX_PDF_ATTACHMENTS = 80
const MAX_PDF_BASE64_CHARS = 2_000_000

function parsePdfAttachments(raw: PdfAttachment[] | undefined): ProjectPlannerEmailAttachment[] {
  if (!Array.isArray(raw)) return []
  const attachments: ProjectPlannerEmailAttachment[] = []
  for (const row of raw.slice(0, MAX_PDF_ATTACHMENTS)) {
    const filename = clampString(row.fileName || row.filename, 200)
    const content = typeof row.content === 'string' ? row.content.replace(/\s+/g, '') : ''
    if (!filename || !content) continue
    if (/[\\/]/.test(filename) || !filename.toLowerCase().endsWith('.pdf')) continue
    if (content.length > MAX_PDF_BASE64_CHARS) continue
    if (content.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(content)) continue
    attachments.push({
      filename,
      content,
      type: 'application/pdf',
      content_type: 'application/pdf',
    })
  }
  return attachments
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'timesheet-export-email', 12, 10 * 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<ExportBody>(request, 8_000_000)
  if (!body.ok) return body.response

  const recipientEmail = clampString(body.value.recipientEmail, 254)
  const recipientName = clampString(body.value.recipientName, 120) || 'there'
  const organizationName = clampString(body.value.organizationName, 200)
  const weekTitle = clampString(body.value.weekTitle, 120)
  const paymentRunStamp = clampString(body.value.paymentRunStamp, 80)
  if (!recipientEmail || !isValidEmail(recipientEmail) || !organizationName || !weekTitle || !paymentRunStamp) {
    return jsonError('recipientEmail, organizationName, weekTitle, and paymentRunStamp are required', 400)
  }

  const attachments = parsePdfAttachments(body.value.pdfAttachments)
  const names = Array.isArray(body.value.attachmentNames)
    ? body.value.attachmentNames.map((name) => clampString(name, 200)).filter((name): name is string => Boolean(name))
    : attachments.map((row) => row.filename)
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
      ? Math.max(1, Math.min(Math.round(body.value.timesheetCount), MAX_PDF_ATTACHMENTS))
      : Math.max(1, attachments.length || downloadLinks.length || names.length)

  if (names.length === 0 && downloadLinks.length === 0 && attachments.length === 0) {
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
  const mail = {
    to: recipientEmail.toLowerCase(),
    subject: `Signed timesheets for filing — ${paymentRunStamp} — ${organizationName}`,
    html,
    fromName: organizationName,
  }

  try {
    await sendProjectPlannerEmail({ ...mail, attachments })
  } catch (error) {
    if (attachments.length === 0) {
      console.error('[timesheets/export-email]', error)
      return jsonError(clientSafeMessage(error, 'Failed to send timesheet export email'), 500)
    }
    try {
      await sendProjectPlannerEmail(mail)
    } catch (retryError) {
      console.error('[timesheets/export-email]', retryError)
      return jsonError(clientSafeMessage(retryError, 'Failed to send timesheet export email'), 500)
    }
  }

  return Response.json({ ok: true, emailed: timesheetCount, attached: attachments.length })
}

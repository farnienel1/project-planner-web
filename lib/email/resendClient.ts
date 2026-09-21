export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  )
}

/** Same HTTP function iOS uses (`ResendEmailService.swift` → Outlook / Microsoft 365). */
export const PROJECT_PLANNER_EMAIL_FUNCTION_URL =
  'https://us-central1-project-planner-f986c.cloudfunctions.net/sendProjectPlannerEmail'

function emailFunctionUrl(): string {
  return process.env.EMAIL_FUNCTION_URL?.trim() || PROJECT_PLANNER_EMAIL_FUNCTION_URL
}

function fromName(): string {
  return process.env.EMAIL_FROM_NAME?.trim() || 'Project Planner'
}

function replyTo(): string | undefined {
  const value = process.env.EMAIL_REPLY_TO?.trim()
  return value || 'info@projectplanner.us'
}

export type ProjectPlannerEmailAttachment = {
  filename: string
  content: string
  type?: string
  content_type?: string
}

export async function sendProjectPlannerEmail(params: {
  to: string
  subject: string
  html: string
  cc?: string
  replyTo?: string
  fromName?: string
  attachments?: ProjectPlannerEmailAttachment[]
}): Promise<void> {
  const payload: Record<string, unknown> = {
    to: params.to,
    subject: params.subject,
    html: params.html,
    fromName: params.fromName?.trim() || fromName(),
    replyTo: params.replyTo?.trim() || replyTo() || 'info@projectplanner.us',
  }
  if (params.cc?.trim()) payload.cc = params.cc.trim()
  if (params.attachments?.length) {
    payload.attachments = params.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      type: attachment.type || 'application/pdf',
      content_type: attachment.content_type || attachment.type || 'application/pdf',
    }))
  }

  const response = await fetch(emailFunctionUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const body = await response.text()
  if (!response.ok) {
    let detail = body || `Email function error (${response.status})`
    try {
      const parsed = JSON.parse(body) as { error?: string; message?: string }
      detail = parsed.error || parsed.message || detail
    } catch {
      // keep raw body
    }
    throw new Error(detail)
  }
}

/** @deprecated Use sendProjectPlannerEmail — kept so existing API routes keep compiling. */
export const sendResendEmail = sendProjectPlannerEmail

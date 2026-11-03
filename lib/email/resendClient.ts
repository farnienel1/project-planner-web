export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  )
}

/**
 * The authenticated email Cloud Function (`functions/email`, docs/EMAIL_FUNCTION.md). Web API routes call it in
 * server mode: `X-Project-Planner-Server-Key` (Netlify env `EMAIL_SERVER_KEY`, the same value as the function's
 * `EMAIL_SERVER_KEY` secret) plus, when the route has a signed-in user, that user's Firebase ID token. The route has
 * already checked the caller and rendered the HTML; the function fixes the From address and display name (the
 * organisation's name when `orgId` is given), checks attachments and rate-limits per user.
 *
 * Replaces the open `sendProjectPlannerEmail` function (no auth; any HTML to any address).
 */
export const PROJECT_PLANNER_EMAIL_FUNCTION_URL =
  'https://us-central1-project-planner-f986c.cloudfunctions.net/sendEmail'

export const EMAIL_SERVER_KEY_HEADER = 'X-Project-Planner-Server-Key'

function emailFunctionUrl(): string {
  return process.env.EMAIL_FUNCTION_URL?.trim() || PROJECT_PLANNER_EMAIL_FUNCTION_URL
}

function serverKey(): string {
  return process.env.EMAIL_SERVER_KEY?.trim() || ''
}

export type ProjectPlannerEmailAttachment = {
  filename: string
  /** Base64. PDF, XLSX or CSV only; the function decides the content type from the extension. */
  content: string
  type?: string
  content_type?: string
}

export async function sendProjectPlannerEmail(params: {
  to: string
  subject: string
  html: string
  /** Optional plaintext alternative. */
  text?: string
  /** Reply-To address (e.g. the visitor on the support form, the sender of a material request). */
  replyTo?: string
  /** The organisation the email is about: its name becomes the From display name. */
  orgId?: string
  /** The signed-in user's Firebase ID token, when the route has one (audit and per-user rate limit). */
  idToken?: string | null
  attachments?: ProjectPlannerEmailAttachment[]
  /** Only List-Unsubscribe / List-Unsubscribe-Post are passed on by the function. */
  headers?: Record<string, string>
}): Promise<void> {
  const key = serverKey()
  if (!key) {
    throw new Error('Email is not configured on this server (EMAIL_SERVER_KEY is not set).')
  }
  const data: Record<string, unknown> = {
    subject: params.subject,
    html: params.html,
  }
  if (params.text?.trim()) data.text = params.text
  if (params.replyTo?.trim()) data.replyTo = params.replyTo.trim()
  if (params.headers && Object.keys(params.headers).length) data.headers = params.headers

  const payload: Record<string, unknown> = {
    template: 'web_rendered',
    to: [params.to],
    data,
  }
  if (params.orgId?.trim()) payload.orgId = params.orgId.trim()
  if (params.attachments?.length) {
    payload.attachments = params.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
    }))
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [EMAIL_SERVER_KEY_HEADER]: key,
  }
  if (params.idToken?.trim()) headers.Authorization = `Bearer ${params.idToken.trim()}`

  const response = await fetch(emailFunctionUrl(), {
    method: 'POST',
    headers,
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

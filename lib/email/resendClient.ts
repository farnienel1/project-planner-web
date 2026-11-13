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

/** Longest wait for the email function before the send is reported as failed. */
export const EMAIL_FUNCTION_TIMEOUT_MS = 20_000

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
  /**
   * Send as `"<signed-in user's name> via Project Planner"` from the verified address (`data.fromCaller`). Needs the
   * user's `idToken`; the function uses their own profile name, never one given here.
   */
  fromCaller?: boolean
  /** CC the signed-in user on this one message (`data.ccCaller`). Needs `idToken`. */
  ccCaller?: boolean
  /**
   * Idempotency key (functions/email/requestDedupe.js): the function sends a request with the same id to the same
   * recipient once and answers a repeat with the first send's result. Reuse it when retrying the same request.
   */
  requestId?: string
}): Promise<ProjectPlannerEmailResult> {
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
  if (params.fromCaller) data.fromCaller = true
  if (params.ccCaller) data.ccCaller = true

  const payload: Record<string, unknown> = {
    template: 'web_rendered',
    to: [params.to],
    data,
  }
  if (params.orgId?.trim()) payload.orgId = params.orgId.trim()
  if (params.requestId?.trim()) payload.requestId = params.requestId.trim()
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

  // A slow function call fails visibly (with a reason) instead of hanging the request until the host cuts it off.
  let response: Response
  try {
    response = await fetch(emailFunctionUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(EMAIL_FUNCTION_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('The email service did not answer in time. Check your sent items before sending again.')
    }
    throw error
  }

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
  return parseEmailFunctionResult(body)
}

/** The deployed email function predates `web_rendered_batch`: send one call per recipient instead. */
export class EmailBatchUnsupportedError extends Error {
  constructor() {
    super('The email function does not support web_rendered_batch yet')
    this.name = 'EmailBatchUnsupportedError'
  }
}

/** Per-recipient outcome of one `web_rendered_batch` call. */
export type ProjectPlannerEmailBatchResult = {
  results: Array<{ to: string; id: string | null; cc: string[] }>
  /** Recipients the provider refused (lower case). */
  failed: string[]
  /** The function's own reason when it refused the whole request. */
  error?: string
}

/**
 * Several messages the route rendered (one per recipient) in ONE call to the email function (`web_rendered_batch`,
 * functions/email/templates.js): one cold start, one rate-limit count, one Resend batch, instead of a call per
 * recipient. `fromCaller`, `ccCaller` and `replyTo` apply to every message. A partial failure answers with the
 * refused recipients in `failed`; when every message failed the function answers 502 and this returns them all in
 * `failed` with its reason (it does not throw). Throws `EmailBatchUnsupportedError` when the deployed function does
 * not know the template yet (deploy order), and an Error for anything else (no answer, refused before sending).
 */
export async function sendProjectPlannerEmailBatch(params: {
  messages: Array<{ to: string; subject: string; html: string; text?: string }>
  replyTo?: string
  orgId?: string
  idToken?: string | null
  fromCaller?: boolean
  ccCaller?: boolean
  requestId?: string
}): Promise<ProjectPlannerEmailBatchResult> {
  const key = serverKey()
  if (!key) {
    throw new Error('Email is not configured on this server (EMAIL_SERVER_KEY is not set).')
  }
  const messages = params.messages.map((row) => ({
    to: row.to.trim().toLowerCase(),
    subject: row.subject,
    html: row.html,
    ...(row.text?.trim() ? { text: row.text } : {}),
  }))
  const data: Record<string, unknown> = { messages }
  if (params.replyTo?.trim()) data.replyTo = params.replyTo.trim()
  if (params.fromCaller) data.fromCaller = true
  if (params.ccCaller) data.ccCaller = true
  const payload: Record<string, unknown> = {
    template: 'web_rendered_batch',
    to: messages.map((row) => row.to),
    data,
  }
  if (params.orgId?.trim()) payload.orgId = params.orgId.trim()
  if (params.requestId?.trim()) payload.requestId = params.requestId.trim()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [EMAIL_SERVER_KEY_HEADER]: key,
  }
  if (params.idToken?.trim()) headers.Authorization = `Bearer ${params.idToken.trim()}`

  let response: Response
  try {
    response = await fetch(emailFunctionUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(EMAIL_FUNCTION_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('The email service did not answer in time. Check your sent items before sending again.')
    }
    throw error
  }
  const text = await response.text()
  let parsed: {
    error?: string
    message?: string
    failed?: unknown
    results?: Array<{ to?: unknown; id?: unknown; cc?: unknown }>
  } = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = {}
  }
  const detail = parsed.error || parsed.message || text || `Email function error (${response.status})`
  if (!response.ok) {
    if (response.status === 400 && /unknown template web_rendered_batch/i.test(detail)) throw new EmailBatchUnsupportedError()
    // 502: the provider refused every message — report them as failed, like a partial failure.
    if (response.status === 502) {
      const failed = Array.isArray(parsed.failed) ? parsed.failed.filter((row): row is string => typeof row === 'string') : []
      return { results: [], failed: failed.length ? failed : messages.map((row) => row.to), error: detail }
    }
    throw new Error(detail)
  }
  const results = (Array.isArray(parsed.results) ? parsed.results : []).map((row) => ({
    to: typeof row?.to === 'string' ? row.to.toLowerCase() : '',
    id: typeof row?.id === 'string' ? row.id : null,
    cc: Array.isArray(row?.cc) ? row.cc.filter((value): value is string => typeof value === 'string') : [],
  }))
  const failed = Array.isArray(parsed.failed) ? parsed.failed.filter((row): row is string => typeof row === 'string') : []
  return { results, failed: failed.map((row) => row.toLowerCase()) }
}

/** What the email function reports for a send: the Resend message ids and whether it honoured `ccCaller`. */
export type ProjectPlannerEmailResult = {
  ids: string[]
  /** CC addresses the function put on the message (empty when it ignored `ccCaller`, e.g. an older deploy). */
  cc: string[]
  /** False when the deployed function predates `ccCaller` / `fromCaller`. */
  ccSupported: boolean
}

export function parseEmailFunctionResult(body: string): ProjectPlannerEmailResult {
  try {
    const parsed = JSON.parse(body) as { results?: Array<{ id?: string | null; cc?: string[] }>; ccSupported?: boolean }
    const results = Array.isArray(parsed.results) ? parsed.results : []
    return {
      ids: results.map((row) => (typeof row?.id === 'string' ? row.id : '')).filter(Boolean),
      cc: results.flatMap((row) => (Array.isArray(row?.cc) ? row.cc.filter((value) => typeof value === 'string') : [])),
      ccSupported: parsed.ccSupported === true,
    }
  } catch {
    return { ids: [], cc: [], ccSupported: false }
  }
}

/** @deprecated Use sendProjectPlannerEmail — kept so existing API routes keep compiling. */
export const sendResendEmail = sendProjectPlannerEmail

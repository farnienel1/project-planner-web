import { NextRequest, NextResponse, after } from 'next/server'
import { enforceRateLimit, readJsonBody } from '@/lib/security/apiGuard'
import { clampString, isValidEmail } from '@/lib/security/validation'
import { getAppBaseUrl, sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  PASSWORD_RESET_EMAIL_SUBJECT,
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
} from '@/lib/email/passwordResetEmail'
import {
  AuthAccountNotFoundError,
  GoogleAccessTokenError,
  adminPasswordResetLink,
  firebaseAdminConfigured,
} from '@/lib/owner/identityToolkitAdmin'
import { firebaseDefaultPasswordReset } from '@/lib/auth/passwordResetServer'
import { consumeAuthEmailBudget } from '@/lib/auth/authEmailBudget'
import {
  PASSWORD_RESET_FALLBACK_RESPONSE,
  PASSWORD_RESET_FIXED_RESPONSE_MS,
  PASSWORD_RESET_GENERIC_RESPONSE,
  PASSWORD_RESET_PER_EMAIL_LIMIT,
  PASSWORD_RESET_PER_EMAIL_WINDOW_MS,
  PASSWORD_RESET_PER_IP_LIMIT,
  PASSWORD_RESET_PER_IP_WINDOW_MS,
  passwordResetContinueUrl,
  runPasswordReset,
  type PasswordResetStatus,
} from '@/lib/auth/passwordResetRequest'

const NO_STORE = { 'Cache-Control': 'no-store' }

function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER_KEY?.trim())
}

/**
 * Keeps background work running after the answer (`after()`: on Netlify through the function's `waitUntil`). Outside
 * a request scope (tests, scripts) `after` throws; the promise is already running and is simply left to finish.
 */
export function deferAfterResponse(work: Promise<unknown>): void {
  try {
    after(() => work)
  } catch {
    // Not in a request scope: nothing to register.
  }
}

export type PasswordResetDepsOverride = {
  /** Answer after this long (tests pass 0). */
  fixedResponseMs?: number
  /** Where the background work goes (tests collect it to await it). */
  defer?: (work: Promise<unknown>) => void
  /** Per-email budget (tests use memory; production: Firestore, `consumeAuthEmailBudget`). */
  allowEmail?: (email: string) => Promise<boolean>
}

/**
 * Forgot password (web forgot-password page and developer login; iOS after its hand-off). Unauthenticated, no App
 * Check yet (iOS sends no token; see the PR). A valid request always gets `{ ok: true }` after exactly
 * `PASSWORD_RESET_FIXED_RESPONSE_MS`, whatever happens: the link and the email run in the background, so neither the
 * answer nor its time says whether the account exists. When the branded email cannot be made or sent, the server
 * asks Firebase to send its own reset email instead (API-key `sendOobCode`), so a reset is never lost.
 * Only when this server cannot make links or send email at all does it answer 503 `{ fallback: 'firebase' }`, decided
 * before any account is looked at. Logs carry the status only, never the address, the link or the code.
 */
export async function handlePasswordResetRequest(
  request: NextRequest,
  options: PasswordResetDepsOverride = {}
): Promise<NextResponse> {
  const limited = enforceRateLimit(request, 'password-reset', PASSWORD_RESET_PER_IP_LIMIT, PASSWORD_RESET_PER_IP_WINDOW_MS)
  if (limited) return limited

  const body = await readJsonBody<{ email?: unknown; continueUrl?: unknown }>(request, 4096)
  if (!body.ok) return body.response
  const email = (clampString(typeof body.value.email === 'string' ? body.value.email : '', 254) || '').trim().toLowerCase()
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400, headers: NO_STORE })
  }
  if (!firebaseAdminConfigured() || !emailConfigured()) {
    console.info('[auth/password-reset]', 'not_configured')
    return NextResponse.json(PASSWORD_RESET_FALLBACK_RESPONSE, { status: 503, headers: NO_STORE })
  }

  const continueUrl = passwordResetContinueUrl(email, body.value.continueUrl, getAppBaseUrl())
  const allowEmail =
    options.allowEmail ??
    ((address: string) =>
      consumeAuthEmailBudget('password-reset', address, PASSWORD_RESET_PER_EMAIL_LIMIT, PASSWORD_RESET_PER_EMAIL_WINDOW_MS))

  const work = (async (): Promise<PasswordResetStatus> => {
    let status = await runPasswordReset(
      { email, continueUrl },
      {
        configured: () => true,
        allowEmail,
        generateLink: (address, url) => adminPasswordResetLink(address, url),
        isAccountMissing: (error) => error instanceof AuthAccountNotFoundError,
        isSetupError: (error) => error instanceof GoogleAccessTokenError,
        sendEmail: async ({ to, link }) => {
          await sendProjectPlannerEmail({
            to,
            subject: PASSWORD_RESET_EMAIL_SUBJECT,
            html: buildPasswordResetEmailHtml({ to, link }),
            text: buildPasswordResetEmailText({ to, link }),
            rateBucket: 'auth',
          })
        },
      }
    )
    // A setup failure found only now (a bad service-account key) or a failed link / send: Firebase sends its own email.
    if (status === 'not_configured' || status === 'link_failed' || status === 'send_failed') {
      try {
        await firebaseDefaultPasswordReset(email, continueUrl)
        status = 'sent_firebase_fallback'
      } catch {
        status = 'fallback_failed'
      }
    }
    // Status only: never the address, the link or the code.
    console.info('[auth/password-reset]', status)
    return status
  })().catch(() => {
    console.info('[auth/password-reset]', 'fallback_failed')
    return 'fallback_failed' as PasswordResetStatus
  })
  ;(options.defer ?? deferAfterResponse)(work)

  const fixed = options.fixedResponseMs ?? PASSWORD_RESET_FIXED_RESPONSE_MS
  if (fixed > 0) await new Promise((resolve) => setTimeout(resolve, fixed))
  return NextResponse.json(PASSWORD_RESET_GENERIC_RESPONSE, { status: 200, headers: NO_STORE })
}

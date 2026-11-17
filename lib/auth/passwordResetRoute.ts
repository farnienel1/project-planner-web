import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, readJsonBody } from '@/lib/security/apiGuard'
import { rateLimit } from '@/lib/security/rateLimit'
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
import {
  PASSWORD_RESET_FALLBACK_RESPONSE,
  PASSWORD_RESET_GENERIC_RESPONSE,
  PASSWORD_RESET_MIN_RESPONSE_MS,
  PASSWORD_RESET_PER_EMAIL_LIMIT,
  PASSWORD_RESET_PER_EMAIL_WINDOW_MS,
  PASSWORD_RESET_PER_IP_LIMIT,
  PASSWORD_RESET_PER_IP_WINDOW_MS,
  passwordResetContinueUrl,
  runPasswordReset,
} from '@/lib/auth/passwordResetRequest'

const NO_STORE = { 'Cache-Control': 'no-store' }

function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER_KEY?.trim())
}

/**
 * Forgot password (web forgot-password page, developer login, Manage Users / Edit User "Send password reset";
 * iOS after its hand-off). Unauthenticated. A valid request always gets `{ ok: true }` — whether or not the
 * account exists, the per-email budget is spent or the send failed — so nobody can learn which emails have
 * accounts. Only when this server cannot make links or send email at all does it answer 503
 * `{ fallback: 'firebase' }`, decided before any account is looked at; the client then asks Firebase to send its
 * own default email. Logs carry the status only, never the address, the link or the code.
 */
export async function handlePasswordResetRequest(
  request: NextRequest,
  options: { minResponseMs?: number } = {}
): Promise<NextResponse> {
  const minResponseMs = options.minResponseMs ?? PASSWORD_RESET_MIN_RESPONSE_MS
  const limited = enforceRateLimit(request, 'password-reset', PASSWORD_RESET_PER_IP_LIMIT, PASSWORD_RESET_PER_IP_WINDOW_MS)
  if (limited) return limited

  const body = await readJsonBody<{ email?: unknown; continueUrl?: unknown }>(request, 4096)
  if (!body.ok) return body.response
  const email = (clampString(typeof body.value.email === 'string' ? body.value.email : '', 254) || '').trim().toLowerCase()
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400, headers: NO_STORE })
  }

  const started = Date.now()
  const continueUrl = passwordResetContinueUrl(email, body.value.continueUrl, getAppBaseUrl())
  const status = await runPasswordReset(
    { email, continueUrl },
    {
      configured: () => firebaseAdminConfigured() && emailConfigured(),
      allowEmail: (address) =>
        rateLimit(`password-reset-email:${address}`, PASSWORD_RESET_PER_EMAIL_LIMIT, PASSWORD_RESET_PER_EMAIL_WINDOW_MS).ok,
      generateLink: (address, url) => adminPasswordResetLink(address, url),
      isAccountMissing: (error) => error instanceof AuthAccountNotFoundError,
      isSetupError: (error) => error instanceof GoogleAccessTokenError,
      sendEmail: async ({ to, link }) => {
        await sendProjectPlannerEmail({
          to,
          subject: PASSWORD_RESET_EMAIL_SUBJECT,
          html: buildPasswordResetEmailHtml({ to, link }),
          text: buildPasswordResetEmailText({ to, link }),
        })
      },
    }
  )
  // Status only: never the address, the link or the code.
  console.info('[auth/password-reset]', status)

  if (status === 'not_configured') {
    return NextResponse.json(PASSWORD_RESET_FALLBACK_RESPONSE, { status: 503, headers: NO_STORE })
  }
  const wait = minResponseMs - (Date.now() - started)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  return NextResponse.json(PASSWORD_RESET_GENERIC_RESPONSE, { status: 200, headers: NO_STORE })
}

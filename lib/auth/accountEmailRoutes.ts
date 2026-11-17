import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, isFirebaseUser, readJsonBody, requireFirebaseUser } from '@/lib/security/apiGuard'
import { rateLimit } from '@/lib/security/rateLimit'
import { clampString, isValidEmail } from '@/lib/security/validation'
import { getAppBaseUrl, sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  CHANGE_EMAIL_SUBJECT,
  VERIFY_EMAIL_SUBJECT,
  buildChangeEmailHtml,
  buildChangeEmailText,
  buildVerifyEmailHtml,
  buildVerifyEmailText,
} from '@/lib/email/accountEmails'
import {
  AuthAccountNotFoundError,
  AuthEmailTakenError,
  GoogleAccessTokenError,
  adminEmailActionLink,
  firebaseAdminConfigured,
} from '@/lib/owner/identityToolkitAdmin'
import {
  PASSWORD_RESET_FALLBACK_RESPONSE,
  PASSWORD_RESET_GENERIC_RESPONSE,
  PASSWORD_RESET_PER_EMAIL_LIMIT,
  PASSWORD_RESET_PER_EMAIL_WINDOW_MS,
  PASSWORD_RESET_PER_IP_LIMIT,
  PASSWORD_RESET_PER_IP_WINDOW_MS,
  allowedAccountEmailContinueUrl,
  runPasswordReset,
  type PasswordResetStatus,
} from '@/lib/auth/passwordResetRequest'

/**
 * Signed-in account emails sent by Project Planner instead of Firebase (owner request 17 Nov):
 * `POST /api/auth/verify-email` (resend the verification link) and `POST /api/auth/change-email { newEmail }`
 * (confirm a new login email, web `verifyBeforeUpdateEmail`). Both need the caller's Firebase ID token and act only
 * on that account: the current address is read from the verified token, never from the request. Every outcome of a
 * valid request answers the same `{ ok: true }`; 503 `{ fallback: 'firebase' }` only when the server cannot send at
 * all (the client then uses Firebase's own email). Logs carry the status only.
 */

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Firebase asks for a sign-in within this window before an email change (`auth/requires-recent-login`). */
export const CHANGE_EMAIL_RECENT_LOGIN_MS = 5 * 60 * 1000
export const CHANGE_EMAIL_RECENT_LOGIN_CODE = 'requires-recent-login'
export const CHANGE_EMAIL_RECENT_LOGIN_MESSAGE = 'For your security, sign out and sign in again, then change your email.'

function configured(): boolean {
  return firebaseAdminConfigured() && Boolean(process.env.EMAIL_SERVER_KEY?.trim())
}

function bearer(request: NextRequest): string {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

/** `auth_time` of an ID token Auth has already accepted (`requireFirebaseUser`), in ms; null when unreadable. */
export function idTokenAuthTimeMs(idToken: string): number | null {
  const part = idToken.split('.')[1]
  if (!part) return null
  try {
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { auth_time?: unknown }
    const seconds = Number(payload.auth_time)
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null
  } catch {
    return null
  }
}

function answer(status: PasswordResetStatus, route: string): NextResponse {
  // Status only: never the address, the link or the code.
  console.info(`[auth/${route}]`, status)
  if (status === 'not_configured') {
    return NextResponse.json(PASSWORD_RESET_FALLBACK_RESPONSE, { status: 503, headers: NO_STORE })
  }
  return NextResponse.json(PASSWORD_RESET_GENERIC_RESPONSE, { status: 200, headers: NO_STORE })
}

function linkErrorDeps() {
  return {
    isAccountMissing: (error: unknown) => error instanceof AuthAccountNotFoundError,
    isEmailTaken: (error: unknown) => error instanceof AuthEmailTakenError,
    isSetupError: (error: unknown) => error instanceof GoogleAccessTokenError,
  }
}

export async function handleVerifyEmailRequest(request: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(request, 'verify-email', PASSWORD_RESET_PER_IP_LIMIT, PASSWORD_RESET_PER_IP_WINDOW_MS)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const body = await readJsonBody<{ continueUrl?: unknown }>(request, 4096)
  const requested = body.ok ? body.value?.continueUrl : undefined
  const email = (user.email || '').trim().toLowerCase()
  if (!email || user.emailVerified) return answer(email ? 'already_verified' : 'no_account', 'verify-email')
  const continueUrl = allowedAccountEmailContinueUrl(requested, getAppBaseUrl())
  const status = await runPasswordReset(
    { email, continueUrl: continueUrl || '' },
    {
      configured,
      allowEmail: () => rateLimit(`verify-email-uid:${user.uid}`, PASSWORD_RESET_PER_EMAIL_LIMIT, PASSWORD_RESET_PER_EMAIL_WINDOW_MS).ok,
      generateLink: (address) => adminEmailActionLink({ requestType: 'VERIFY_EMAIL', email: address, continueUrl }),
      ...linkErrorDeps(),
      sendEmail: async ({ to, link }) => {
        await sendProjectPlannerEmail({
          to,
          subject: VERIFY_EMAIL_SUBJECT,
          html: buildVerifyEmailHtml({ to, link }),
          text: buildVerifyEmailText({ to, link }),
          idToken: bearer(request),
        })
      },
    }
  )
  return answer(status, 'verify-email')
}

export async function handleChangeEmailRequest(
  request: NextRequest,
  options: { nowMs?: number } = {}
): Promise<NextResponse> {
  const limited = enforceRateLimit(request, 'change-email', PASSWORD_RESET_PER_IP_LIMIT, PASSWORD_RESET_PER_IP_WINDOW_MS)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const body = await readJsonBody<{ newEmail?: unknown; continueUrl?: unknown }>(request, 4096)
  if (!body.ok) return body.response
  const newEmail = (clampString(typeof body.value.newEmail === 'string' ? body.value.newEmail : '', 254) || '')
    .trim()
    .toLowerCase()
  if (!isValidEmail(newEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400, headers: NO_STORE })
  }
  const current = (user.email || '').trim().toLowerCase()
  if (!current) return answer('no_account', 'change-email')
  if (newEmail === current) {
    return NextResponse.json({ error: 'That is already your login email.' }, { status: 400, headers: NO_STORE })
  }
  const authTime = idTokenAuthTimeMs(bearer(request))
  const now = options.nowMs ?? Date.now()
  if (!authTime || now - authTime > CHANGE_EMAIL_RECENT_LOGIN_MS) {
    return NextResponse.json(
      { error: CHANGE_EMAIL_RECENT_LOGIN_MESSAGE, code: CHANGE_EMAIL_RECENT_LOGIN_CODE },
      { status: 401, headers: NO_STORE }
    )
  }
  const continueUrl = allowedAccountEmailContinueUrl(body.value.continueUrl, getAppBaseUrl())
  const status = await runPasswordReset(
    { email: newEmail, continueUrl: continueUrl || '' },
    {
      configured,
      allowEmail: () => rateLimit(`change-email-uid:${user.uid}`, PASSWORD_RESET_PER_EMAIL_LIMIT, PASSWORD_RESET_PER_EMAIL_WINDOW_MS).ok,
      // The account is the caller's own (`current`, from the verified token); `newEmail` is only the destination.
      generateLink: (destination) =>
        adminEmailActionLink({ requestType: 'VERIFY_AND_CHANGE_EMAIL', email: current, newEmail: destination, continueUrl }),
      ...linkErrorDeps(),
      sendEmail: async ({ to, link }) => {
        await sendProjectPlannerEmail({
          to,
          subject: CHANGE_EMAIL_SUBJECT,
          html: buildChangeEmailHtml({ to, link }),
          text: buildChangeEmailText({ to, link }),
          idToken: bearer(request),
        })
      },
    }
  )
  return answer(status, 'change-email')
}

import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  PASSWORD_RESET_EMAIL_SUBJECT,
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
  type PasswordResetEmailReason,
} from '@/lib/email/passwordResetEmail'
import { adminPasswordResetLink } from '@/lib/owner/identityToolkitAdmin'
import { identityToolkitBase } from '@/lib/owner/googleApis'

/** No Firebase login for that email (the API-key path's `EMAIL_NOT_FOUND`). */
export const FIREBASE_RESET_NO_LOGIN_MESSAGE = 'No Firebase login exists for that email yet. They may still be on an unused invite.'

/**
 * Firebase's own password reset email (the API-key `accounts:sendOobCode`, no `returnOobLink`): the fallback when the
 * branded email could not be made or sent. Tried with the continue URL first, then without it.
 */
export async function firebaseDefaultPasswordReset(email: string, continueUrl: string): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) throw new Error('Firebase is not configured on the server.')
  const run = async (includeContinue: boolean) =>
    fetch(`${identityToolkitBase()}/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        includeContinue && continueUrl
          ? { requestType: 'PASSWORD_RESET', email, continueUrl }
          : { requestType: 'PASSWORD_RESET', email }
      ),
    })
  let response = await run(true)
  if (!response.ok && continueUrl) response = await run(false)
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!response.ok) {
    const message = data.error?.message || ''
    if (message.includes('EMAIL_NOT_FOUND')) throw new Error(FIREBASE_RESET_NO_LOGIN_MESSAGE)
    if (message.includes('INVALID_CONTINUE_URI')) {
      throw new Error('Password reset continue URL is not allowed on this Firebase project.')
    }
    throw new Error(data.error?.message || 'Could not send a password reset email.')
  }
}

/** Makes the reset link with the service account and sends the branded email (account-email rate bucket). */
export async function sendBrandedPasswordReset(input: {
  email: string
  continueUrl: string
  reason?: PasswordResetEmailReason
  idToken?: string | null
}): Promise<void> {
  const link = await adminPasswordResetLink(input.email, input.continueUrl)
  await sendProjectPlannerEmail({
    to: input.email,
    subject: PASSWORD_RESET_EMAIL_SUBJECT,
    html: buildPasswordResetEmailHtml({ to: input.email, link, reason: input.reason }),
    text: buildPasswordResetEmailText({ to: input.email, link, reason: input.reason }),
    idToken: input.idToken,
    rateBucket: 'auth',
  })
}

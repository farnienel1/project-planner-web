import { sendEmailVerification, verifyBeforeUpdateEmail, type User } from 'firebase/auth'
import { emulatorsRequested } from '@/lib/firebase/emulators'

export const VERIFY_EMAIL_ROUTE = '/api/auth/verify-email'
export const CHANGE_EMAIL_ROUTE = '/api/auth/change-email'

/**
 * The branded account emails (owner request 17 Nov). Each posts to its route with the signed-in user's ID token; the
 * route answers `{ ok: true }` when it handled the request. Only when the server says it cannot send at all
 * (503 `fallback: 'firebase'`), or the app runs on the local Auth emulator, does the client ask Firebase to send its
 * own default email, so nothing is lost. Any other failure throws with the route's message.
 */
async function postAccountEmail(
  user: User,
  url: string,
  body: Record<string, unknown>,
  fallback: () => Promise<void>
): Promise<void> {
  if (emulatorsRequested()) {
    await fallback()
    return
  }
  const idToken = await user.getIdToken()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; fallback?: string; error?: string }
  if (response.ok && data.ok) return
  if (response.status === 503 && data.fallback === 'firebase') {
    await fallback()
    return
  }
  throw new Error(data.error || 'Could not send the email. Try again.')
}

/** Resend the verification link to the signed-in user's own address (was `sendEmailVerification`). */
export async function requestEmailVerification(user: User): Promise<void> {
  await postAccountEmail(user, VERIFY_EMAIL_ROUTE, {}, () => sendEmailVerification(user))
}

/** Ask to change the signed-in user's own login email (was `verifyBeforeUpdateEmail`). */
export async function requestEmailChange(user: User, newEmail: string): Promise<void> {
  const next = newEmail.trim().toLowerCase()
  await postAccountEmail(user, CHANGE_EMAIL_ROUTE, { newEmail: next }, () => verifyBeforeUpdateEmail(user, next))
}

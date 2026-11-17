/**
 * How long Add user and Give app access wait for the invitation email request (owner bug 17 Nov: a save never holds
 * the screen on a secondary step). The invitation is already saved. On time-out the request is cancelled
 * (`withAbortTimeout`), but the server may already have sent the email, so the screen says it may still arrive and asks
 * the admin to check before resending (review of #371) — never a plain "could not be sent".
 */
export const INVITE_EMAIL_TIMEOUT_MS = 20_000
export const INVITE_EMAIL_TIMEOUT_MESSAGE = 'the email service did not answer in time'

/** The note shown when the email request timed out (the email may still arrive). */
export function inviteEmailTimeoutNote(email: string): string {
  return `The email service did not answer in time, so ${email} may or may not get the email. Check with them before sending it again.`
}

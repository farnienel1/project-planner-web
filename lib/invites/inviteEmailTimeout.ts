/**
 * How long Add user and Give app access wait for the invitation email request (owner bug 17 Nov: a save never holds
 * the screen on a secondary step). The invitation is already saved; on time-out the screen says the email could not be
 * sent, as for any email failure.
 */
export const INVITE_EMAIL_TIMEOUT_MS = 20_000
export const INVITE_EMAIL_TIMEOUT_MESSAGE = 'the email service did not answer in time'

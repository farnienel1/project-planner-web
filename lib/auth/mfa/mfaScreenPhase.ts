/**
 * What the /auth/mfa screen does next, and whether it may show the code form yet (owner 24 Nov: a passkey sign-in
 * must never flash the emailed-code screen). The screen starts in a neutral "Signing you in…" state and shows the code
 * form only once the server says this sign-in still needs a code, or something went wrong. Display only: the server's
 * MFA status decides who is verified, so a password sign-in still has to enter the emailed code.
 */

export type MfaScreenStep = 'checking' | 'goToApp' | 'enterCode' | 'sendCode'

/** After `/api/auth/mfa/status`: verified (a passkey or a still-valid pass) goes on; a code already sent is entered. */
export function mfaStepAfterStatus(status: { verified?: boolean; pending?: boolean }): MfaScreenStep {
  if (status.verified === true) return 'goToApp'
  if (status.pending === true) return 'enterCode'
  return 'sendCode'
}

/** After asking for a code: a skipped code (the server's own rule) goes on, otherwise the code is entered. */
export function mfaStepAfterStart(result: { skipped?: boolean }): MfaScreenStep {
  return result.skipped === true ? 'goToApp' : 'enterCode'
}

/** How long the neutral state may last before the full screen shows anyway (so the person is never left with nothing). */
export const MFA_SCREEN_CHECKING_MAX_MS = 10_000

export const MFA_SCREEN_SIGNING_IN_TEXT = 'Signing you in…'

/**
 * The code form shows only when a code is needed, after an error, or once the neutral state has lasted too long while
 * the answer is still unknown. Once the server has said "verified" (goToApp) a slow hand-over never shows the form
 * (review of #449); an error on the way still does.
 */
export function mfaShowsCodeForm(input: { step: MfaScreenStep; hasError: boolean; waitedTooLong: boolean }): boolean {
  if (input.hasError) return true
  if (input.step === 'goToApp') return false
  if (input.waitedTooLong) return true
  return input.step === 'enterCode'
}

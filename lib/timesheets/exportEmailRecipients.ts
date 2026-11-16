/**
 * Who the signed timesheets export email may go to (rulebook 1.54.1 §8, §16; platform scan 16 Nov).
 *
 * The export email carries every exported person's invoice PDF (rates and pay), so it goes to the person running the
 * export only: their signed-in (Firebase Auth) email. The screen has never offered any other address — no typed
 * address, no organisation accounts or finance address (organisations store none) and no exported person. The same
 * pattern as `materialOrderRecipientCheck` (saved, known addresses only; typed addresses capped — here at 0).
 *
 * Before 1.54.1 the route sent to whatever `recipientEmail` the request named, so any manager could mail the PDFs and
 * links to an outside address under the company's sender identity.
 */

/** Typed addresses beyond the caller's own (none for this email). */
export const TIMESHEET_EXPORT_TYPED_RECIPIENTS_MAX = 0

export const TIMESHEET_EXPORT_RECIPIENT_REFUSED_MESSAGE =
  'Timesheet exports are emailed to your own sign-in email address only.'

export const TIMESHEET_EXPORT_NO_SIGN_IN_EMAIL_MESSAGE =
  'Your account has no sign-in email address, so the export could not be emailed.'

function normalizedEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export type TimesheetExportRecipientCheck =
  | { allowed: true; recipient: string }
  | { allowed: false; reason: 'no_caller_email' | 'not_caller'; message: string }

/**
 * `requested` is the address the screen sent; `callerEmail` the email on the signed-in user's ID token (not checked as verified). Allowed
 * only when they are the same address (case and spaces ignored); the recipient is then the caller's own address.
 */
export function timesheetExportRecipientCheck(input: {
  requested: unknown
  callerEmail: unknown
}): TimesheetExportRecipientCheck {
  const caller = normalizedEmail(input?.callerEmail)
  if (!caller) return { allowed: false, reason: 'no_caller_email', message: TIMESHEET_EXPORT_NO_SIGN_IN_EMAIL_MESSAGE }
  const requested = normalizedEmail(input?.requested)
  if (requested && requested !== caller) {
    return { allowed: false, reason: 'not_caller', message: TIMESHEET_EXPORT_RECIPIENT_REFUSED_MESSAGE }
  }
  return { allowed: true, recipient: caller }
}

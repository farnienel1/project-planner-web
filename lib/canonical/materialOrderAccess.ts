/**
 * Who sends material quotes and orders, and to whom (rulebook §16; 1.15.0, owner decisions round 6).
 *
 *   - `canSendMaterialOrders(viewer)`: admins and super admins outside operative mode, and managers. Operatives never
 *     send a quote or order and never see quote / order history (`canViewMaterialOrderHistory` is the same test). The
 *     per-user Materials toggle does not gate a manager or admin: it is locked on for both
 *     (`MANAGER_LOCKED_ON_PERMISSION_FIELDS`, `effectivePermissions`), so every manager and admin may send. For an
 *     operative the Materials toggle only opens the job's material list.
 *   - Recipients (`materialOrderRecipientCheck`): any contact saved on one of the organisation's wholesalers, the
 *     sender's own copy, and at most `MATERIAL_ORDER_TYPED_RECIPIENTS_MAX` (3) typed addresses that are not saved on a
 *     wholesaler, per send. At least one recipient besides the sender.
 *
 * The security rules (`materialSendRecords` create and read: admins and managers of the organisation), the web send
 * route and the email function (`material_request`) apply the same tests. Pure, JSON in / JSON out.
 */

import { isStaffAccount, type StaffAccountRole } from './staffAccess'

/** Typed one-off addresses (not saved on any wholesaler) allowed in one send. */
export const MATERIAL_ORDER_TYPED_RECIPIENTS_MAX = 3

export const MATERIAL_ORDER_SEND_REFUSED_MESSAGE = 'Only admins and managers can send quotes and orders.'
export const MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE =
  'Add at most 3 email addresses that are not saved on a wholesaler. Save a regular supplier as a wholesaler contact.'
export const MATERIAL_ORDER_NO_RECIPIENT_MESSAGE = 'Choose a wholesaler contact or add an email address.'

/** A viewer as the staff flags (`StaffAccountRole`) or as a level (`{ level: 'admin' | 'manager' | 'operative' }`). */
export type MaterialOrderViewer = StaffAccountRole | { level: string | null | undefined; isSuperAdmin?: boolean } | null | undefined

/** Admins and super admins outside operative mode, and managers. Never an operative. */
export function canSendMaterialOrders(viewer: MaterialOrderViewer): boolean {
  if (!viewer || typeof viewer !== 'object') return false
  if ('level' in viewer) {
    const level = typeof viewer.level === 'string' ? viewer.level.trim().toLowerCase() : ''
    return level === 'admin' || level === 'manager'
  }
  return isStaffAccount(viewer as StaffAccountRole)
}

function normalizedEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export type MaterialOrderRecipientCheck =
  | { ok: true; saved: string[]; typed: string[]; self: boolean }
  | { ok: false; reason: 'invalid' | 'none' | 'too_many_typed'; message: string; typed: string[] }

/**
 * Splits one send's recipient addresses (compared without case, duplicates once) into saved wholesaler contacts
 * (`savedContactEmails`), typed one-off addresses and the sender's own copy (`senderEmail`). Refused when an address
 * is not an email (`invalid`), when nobody but the sender is addressed (`none`), or when more than
 * `MATERIAL_ORDER_TYPED_RECIPIENTS_MAX` typed addresses are given (`too_many_typed`).
 */
export function materialOrderRecipientCheck(input: {
  recipients: ReadonlyArray<unknown>
  savedContactEmails: ReadonlyArray<unknown>
  senderEmail?: unknown
}): MaterialOrderRecipientCheck {
  const saved = new Set((input?.savedContactEmails || []).map(normalizedEmail).filter(Boolean))
  const self = normalizedEmail(input?.senderEmail)
  const seen = new Set<string>()
  const savedOut: string[] = []
  const typed: string[] = []
  let includesSelf = false
  for (const raw of input?.recipients || []) {
    const email = normalizedEmail(raw)
    if (!email || !looksLikeEmail(email)) {
      return { ok: false, reason: 'invalid', message: 'Every recipient must be a valid email address.', typed }
    }
    if (seen.has(email)) continue
    seen.add(email)
    if (saved.has(email)) savedOut.push(email)
    else if (self && email === self) includesSelf = true
    else typed.push(email)
  }
  if (typed.length > MATERIAL_ORDER_TYPED_RECIPIENTS_MAX) {
    return { ok: false, reason: 'too_many_typed', message: MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE, typed }
  }
  if (savedOut.length + typed.length === 0) {
    return { ok: false, reason: 'none', message: MATERIAL_ORDER_NO_RECIPIENT_MESSAGE, typed }
  }
  return { ok: true, saved: savedOut, typed, self: includesSelf }
}

/** The From display name suffix on mail sent for a signed-in user: `"<name> via Project Planner"`. */
export const MATERIAL_REQUEST_FROM_SUFFIX = ' via Project Planner'

/**
 * The subject of a material quote or order email (rulebook §16, 1.24.0): `Quote request — <job number> — <company>`
 * for a quote, `Material order request — <job number> — <company>` otherwise. The values are used as given (callers
 * pass them trimmed); the em dashes are part of the subject.
 */
export function materialRequestEmailSubject(requestType: unknown, jobNumber: unknown, companyName: unknown): string {
  const job = jobNumber == null ? '' : String(jobNumber)
  const company = companyName == null ? '' : String(companyName)
  return requestType === 'quote' ? `Quote request — ${job} — ${company}` : `Material order request — ${job} — ${company}`
}

export type MaterialRequestEmailEnvelope = {
  subject: string
  /** `"<caller name> via Project Planner"`, or '' — the sender then uses the organisation From. */
  fromName: string
  /** The caller's email (lower case), or '' when it is not an email. */
  replyTo: string
  /** The caller's email in CC (one message per recipient, the sender copied), or [] when it is not an email. */
  cc: string[]
}

/**
 * The envelope of one material quote / order email (rulebook §16, 1.24.0), shared by the web send route and the email
 * function's `material_request` template so both build the same subject, From name, Reply-To and CC:
 *   - `subject`: `materialRequestEmailSubject(requestType, jobNumber, companyName)`;
 *   - `fromName`: `<caller.name> via Project Planner` — the caller's own verified profile name, never a name from the
 *     request; '' when the name is blank or is just the caller's email (the organisation From is used instead);
 *   - `replyTo` and `cc`: the caller's verified email (lower case); '' / [] when it is not an email.
 * The address the message is sent from is never the caller's (the sending service's verified address). The sender
 * decides whether to apply `fromName` / `cc` (the request's `fromCaller` / `ccCaller`); this only builds them.
 */
export function materialRequestEmailEnvelope(input: {
  requestType: unknown
  jobNumber: unknown
  companyName: unknown
  caller?: { name?: unknown; email?: unknown } | null
}): MaterialRequestEmailEnvelope {
  const name = typeof input?.caller?.name === 'string' ? input.caller.name.trim() : ''
  const email = normalizedEmail(input?.caller?.email)
  const validEmail = email && looksLikeEmail(email) ? email : ''
  const fromName = name && name.toLowerCase() !== email ? `${name}${MATERIAL_REQUEST_FROM_SUFFIX}` : ''
  return {
    subject: materialRequestEmailSubject(input?.requestType, input?.jobNumber, input?.companyName),
    fromName,
    replyTo: validEmail,
    cc: validEmail ? [validEmail] : [],
  }
}

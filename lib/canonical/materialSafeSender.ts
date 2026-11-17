/**
 * Rulebook 1.59.0 §16 (owner decision 17 Nov): the first quote or order email the organisation sends to a wholesaler
 * address carries, at the top, a red box asking the recipient to add the sender to their safe senders. "First" means
 * no earlier `materialSendRecords` of the organisation lists that address as a recipient (without case). The server
 * decides it — the web send route and the email function's `material_request` (so iPhone sends get it too) — from the
 * records it reads; the apps never decide it. A failed read of the records shows no box (the send is never blocked).
 */

export const MATERIAL_REQUEST_SAFE_SENDER_NOTICE =
  'Please add this email address to your safe senders list, or mark it as not spam, so you receive all quote and order requests from us.'

function emailKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Every recipient address on the organisation's stored send records (`materialSendRecords/*.recipients[].email`,
 * as `parseMaterialSendRecordDocument` returns them, or raw documents), lower case, once each.
 */
export function materialSendRecordRecipientEmails(
  records: ReadonlyArray<{ recipients?: ReadonlyArray<{ email?: unknown } | null> | null } | null> | null | undefined
): string[] {
  const out = new Set<string>()
  for (const record of records || []) {
    for (const recipient of (record && Array.isArray(record.recipients) ? record.recipients : []) as ReadonlyArray<{ email?: unknown } | null>) {
      const email = emailKey(recipient?.email)
      if (email) out.add(email)
    }
  }
  return [...out]
}

/**
 * Whether this send is the organisation's first contact with `recipientEmail`: no earlier send record lists it.
 * `previousRecipientEmails` null = the records could not be read → false (no box; the send goes ahead).
 */
export function materialRequestIsFirstContact(
  recipientEmail: unknown,
  previousRecipientEmails: ReadonlyArray<string> | null | undefined
): boolean {
  const email = emailKey(recipientEmail)
  if (!email || previousRecipientEmails == null) return false
  return !previousRecipientEmails.some((value) => emailKey(value) === email)
}

/** The red box text for this recipient, or null when it is not a first contact. */
export function materialRequestSafeSenderNotice(
  recipientEmail: unknown,
  previousRecipientEmails: ReadonlyArray<string> | null | undefined
): string | null {
  return materialRequestIsFirstContact(recipientEmail, previousRecipientEmails) ? MATERIAL_REQUEST_SAFE_SENDER_NOTICE : null
}

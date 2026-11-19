/**
 * Rulebook 1.59.0 §16 (owner decision 17 Nov): the first quote or order email the organisation sends to a wholesaler
 * address carries, at the top, a red box asking the recipient to add the sender to their safe senders.
 *
 * Review of #370 (L2): "first" is read from one small document per address the organisation has emailed,
 * `organizations/{orgId}/materialContacts/{email}` (`MATERIAL_CONTACTS_COLLECTION`, `materialContactPath`; the id is the
 * address, trimmed and lower case), so a send reads one document per recipient whatever the history. The server
 * decides — the web send route and the email function's `material_request` (so iPhone sends get it too) — with the same
 * read, and after a send creates the documents of the new addresses (`materialContactCreateFields`, created once, never
 * changed). A read that fails shows no box and never stops the send; the sender's own copy never has it. Addresses
 * emailed before 1.59.0 are written once by `scripts/backfill-material-contacts.mjs` from the stored send records
 * (`materialSendRecordRecipientEmails`).
 */

export const MATERIAL_REQUEST_SAFE_SENDER_NOTICE =
  'Please add this email address to your safe senders list, or mark it as not spam, so you receive all quote and order requests from us.'

export const MATERIAL_CONTACTS_COLLECTION = 'materialContacts'

function emailKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** The document id for an address: trimmed and lower case; null when it cannot be a document id. */
export function materialContactKey(email: unknown): string | null {
  const key = emailKey(email)
  if (!key || key.includes('/') || key === '.' || key === '..' || key.length > 400 || /^__.*__$/.test(key)) return null
  return key
}

/** `organizations/{orgId}/materialContacts/{email}`, or null for an unusable organisation id or address. */
export function materialContactPath(organizationId: unknown, email: unknown): string | null {
  const org = typeof organizationId === 'string' ? organizationId.trim() : ''
  const key = materialContactKey(email)
  if (!org || org.includes('/') || !key) return null
  return `organizations/${org}/${MATERIAL_CONTACTS_COLLECTION}/${key}`
}

/** The create shape of a contact document: only `firstSentAt`, the server time (the rules require the request time). */
export function materialContactCreateFields(): { fields: Record<string, never>; serverTimestampFields: ['firstSentAt'] } {
  return { fields: {}, serverTimestampFields: ['firstSentAt'] }
}

/**
 * Every recipient address on the organisation's stored send records (`materialSendRecords/*.recipients[].email`, as
 * `parseMaterialSendRecordDocument` returns them, or raw documents), lower case, once each — for the backfill.
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
 * Whether this send is the organisation's first contact with the address: `contactKnown` is whether its
 * `materialContacts` document exists — false → first contact; true → not; null (the read failed) → false (no box).
 */
export function materialRequestIsFirstContact(recipientEmail: unknown, contactKnown: boolean | null | undefined): boolean {
  return materialContactKey(recipientEmail) !== null && contactKnown === false
}

/** The red box text for this recipient, or null when it is not a first contact. */
export function materialRequestSafeSenderNotice(recipientEmail: unknown, contactKnown: boolean | null | undefined): string | null {
  return materialRequestIsFirstContact(recipientEmail, contactKnown) ? MATERIAL_REQUEST_SAFE_SENDER_NOTICE : null
}

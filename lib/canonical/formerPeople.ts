/**
 * Rulebook 1.59.0 §11, §21 (owner decision 17 Nov, "yes, perfect solution"): former people on old bookings.
 *
 * Deleting a person keeps their past bookings, leave, timesheets and pay history (§2, §11), but bookings store no
 * name of the booked person, so before 1.59.0 those rows read "Unknown person · 6A9632BA" once the users document was
 * gone. Now the delete leaves one small record, `organizations/{orgId}/deletedPeople/{id}`, with exactly
 * `displayName`, `email`, `personIds` (every id they went by, `personIdSet` plus `operatives` / `managers` rows on
 * their email), `deletedAt` (server time) and `deletedBy` — nothing else. `resolveBookingPerson`, `scheduleRowPerson`
 * and `unresolvedBookingPeople` read it, so the row shows "Former: Jane Smith"; Data health lists former people apart
 * ("Former person · Jane Smith"). When Add User / Add operative / a ghost create uses an email a former person had,
 * the app offers to link their old ids to the new person (`formerPersonLinkWriteFields`, the admin identity-link write).
 *
 * The record is written by whoever may run the delete (admins; an operatives manager for an operative), read by the
 * organisation's staff (admins and managers), and never changed or deleted by an app (security rules §16).
 */

import { personIdSet, type PersonRosterRow } from './personIds'
import { documentInstantMs } from './peopleDocuments'
import { writeMetadataFields, type WritePlatform } from './writeMetadata'

export const DELETED_PEOPLE_COLLECTION = 'deletedPeople'
/** The only fields of a `deletedPeople` record (the security rules allow exactly these). */
export const FORMER_PERSON_FIELDS = ['displayName', 'email', 'personIds', 'deletedAt', 'deletedBy'] as const
/** At most this many ids on one record (the rules check the same). */
export const FORMER_PERSON_IDS_MAX = 50
export const FORMER_PERSON_NAME_MAX = 200
export const FORMER_PERSON_EMAIL_MAX = 320
/** The name kept when the person deleted their own account (§12): no name and no email are kept. */
export const FORMER_PERSON_ANONYMOUS_NAME = 'Deleted user'
/** The chip on a former person's scheduling row (in place of `UNRESOLVED_BOOKING_PERSON_CHIP`). */
export const FORMER_PERSON_CHIP = 'Former person'
/**
 * Review of #370 (L1): shown to the person who deleted someone when the former-person record was refused (security
 * rules older than 1.59.0, or the record did not match the deleted document). The delete itself went ahead.
 */
export const FORMER_PERSON_RECORD_SKIPPED_MESSAGE =
  'Deleted. Their past bookings could not keep their name, so they will show as "Unknown person". An admin can link them to a person in Settings → Data health.'
export const FORMER_PERSON_LINK_TITLE = 'This email belonged to a former person'
export const FORMER_PERSON_LINK_ACTION = 'Link their old records'
export const FORMER_PERSON_LINK_SKIP = 'Keep separate'
export const FORMER_PERSON_LINK_ADMIN_ONLY_NOTE = 'Only an admin can link a former person’s old records. Ask an admin to do it in Data health.'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function idKey(value: unknown): string {
  return text(value).toLowerCase()
}

/** `organizations/{orgId}/deletedPeople/{personId}`, or null for an unusable id. */
export function formerPersonPath(organizationId: unknown, personId: unknown): string | null {
  const org = text(organizationId)
  const id = text(personId)
  if (!org || !id || org.includes('/') || id.includes('/')) return null
  return `organizations/${org}/${DELETED_PEOPLE_COLLECTION}/${id}`
}

/**
 * Whether a delete keeps a record: the person has at least one booking, manager site booking, leave record, timesheet
 * or pay history row under any of their ids. A count the app could not read (`null`) counts as "may have records", so
 * a refused or failed read never loses a name; a count not checked (missing) counts as none.
 */
export function formerPersonRecordNeeded(counts: {
  bookings?: number | null
  managerSiteBookings?: number | null
  leaveRecords?: number | null
  timesheets?: number | null
  payHistoryRows?: number | null
} | null | undefined): boolean {
  const values = Object.values(counts || {})
  return values.some((value) => value === null || (typeof value === 'number' && value > 0))
}

export type FormerPersonSource = {
  id: string
  firstName?: string | null
  lastName?: string | null
  surname?: string | null
  name?: string | null
  displayName?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
}

export type FormerPersonRecordWrite = {
  fields: { displayName: string; email: string; personIds: string[]; deletedBy: string }
  /** The app sets these to its SDK's server timestamp (the rules require the request time). */
  serverTimestampFields: ['deletedAt']
}

/**
 * The record written when `person` is deleted (create only, document id = `person.id`). Review of #370 (M1): it holds
 * only what the deleted document itself carries, so the security rules can check it against that document —
 * `personIds` = the id, then the document's `formerUserIds` and `sameEmailUserIds` (a users document) or its account
 * links `linkedIds` (`linkedUserId` / `userId` / `uid` of an `operatives` / `managers` row), exactly as stored, at most
 * `FORMER_PERSON_IDS_MAX`; `email` its email, trimmed and lower case; `displayName` "first surname" (else "first
 * lastName"), else its `displayName`, `name` or email. Each deleted `operatives` / `managers` row gets its own record
 * (bookings filed under a row id). `anonymised` (the person deleted their own account, §12): the name is
 * `FORMER_PERSON_ANONYMOUS_NAME` and no email is kept. Null when the id is unusable or the deleter is unknown.
 */
export function formerPersonRecordFields(input: {
  person: FormerPersonSource & { linkedIds?: ReadonlyArray<unknown> | null }
  deletedBy: string
  anonymised?: boolean | null
}): FormerPersonRecordWrite | null {
  const person = input?.person
  const id = text(person?.id)
  const deletedBy = text(input?.deletedBy)
  if (!id || id.includes('/') || !deletedBy) return null
  const email = idKey(person.email)
  const ids: string[] = []
  const seen = new Set<string>()
  const add = (raw: unknown) => {
    // Exactly as stored (the rules compare stored values); blank and duplicate (without case) ids left out.
    const value = typeof raw === 'string' ? raw : ''
    const k = value.trim().toLowerCase()
    if (!k || seen.has(k) || ids.length >= FORMER_PERSON_IDS_MAX) return
    seen.add(k)
    ids.push(value)
  }
  add(id)
  for (const list of [person.formerUserIds, person.sameEmailUserIds, person.linkedIds]) {
    for (const value of Array.isArray(list) ? list : []) add(value)
  }
  const anonymised = input.anonymised === true
  const first = text(person.firstName)
  const surname = text(person.surname)
  const name =
    (surname ? `${first} ${surname}` : `${first} ${text(person.lastName)}`).trim() ||
    text(person.displayName) ||
    text(person.name) ||
    email
  return {
    fields: {
      displayName: anonymised ? FORMER_PERSON_ANONYMOUS_NAME : name || FORMER_PERSON_ANONYMOUS_NAME,
      email: anonymised ? '' : email,
      personIds: ids,
      deletedBy,
    },
    serverTimestampFields: ['deletedAt'],
  }
}

export type FormerPerson = {
  /** The document id (the deleted person's id). */
  id: string
  displayName: string
  /** Lower case, or null (anonymised or none). */
  email: string | null
  /** Every id they went by, the document id first. */
  personIds: string[]
  deletedAtMs: number | null
  deletedBy: string | null
}

/** Reads a `deletedPeople` document. Never drops it for a missing field: the name falls back to the email, then "Deleted user". */
export function parseFormerPersonDocument(docId: unknown, data: Record<string, unknown> | null | undefined): FormerPerson | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const ids: string[] = [id]
  const seen = new Set<string>([id.toLowerCase()])
  for (const raw of Array.isArray(row.personIds) ? row.personIds : []) {
    const value = text(raw)
    if (!value || seen.has(value.toLowerCase())) continue
    seen.add(value.toLowerCase())
    ids.push(value)
  }
  const email = idKey(row.email) || null
  return {
    id,
    displayName: text(row.displayName) || email || FORMER_PERSON_ANONYMOUS_NAME,
    email,
    personIds: ids,
    deletedAtMs: documentInstantMs(row.deletedAt),
    deletedBy: text(row.deletedBy) || null,
  }
}

/** A former person as the booking readers take it (a parsed record is one). */
export type FormerPersonInput = { id: string; displayName: string; email?: string | null; personIds?: ReadonlyArray<string> | null; deletedAtMs?: number | null }

/** The former person a stored id names (the record id or any of its `personIds`, without case); the latest deleted wins. */
export function formerPersonForId<T extends FormerPersonInput>(personId: unknown, formerPeople: ReadonlyArray<T> | null | undefined): T | null {
  const needle = idKey(personId)
  if (!needle) return null
  let found: T | null = null
  for (const person of formerPeople || []) {
    if (!person) continue
    const hit = idKey(person.id) === needle || (person.personIds || []).some((value) => idKey(value) === needle)
    if (!hit) continue
    if (!found || (person.deletedAtMs ?? 0) > (found.deletedAtMs ?? 0)) found = person
  }
  return found
}

/** "Former: Jane Smith" — the scheduling row and every booking label for a former person. */
export function formerPersonLabel(name: unknown): string {
  return `Former: ${text(name) || FORMER_PERSON_ANONYMOUS_NAME}`
}

/** "Former person · Jane Smith" — Data health → Bookings not linked to a person. */
export function formerPersonDataHealthLabel(name: unknown): string {
  return `Former person · ${text(name) || FORMER_PERSON_ANONYMOUS_NAME}`
}

/**
 * The former people whose email is `email` (without case) and who still have an id no current person goes by — the
 * ones Add User / Add operative / a ghost create offers to link. An anonymised record has no email and is never
 * offered. Latest deleted first.
 */
export function formerPeopleForEmail<T extends FormerPersonInput>(input: {
  email: unknown
  formerPeople: ReadonlyArray<T> | null | undefined
  roster?: ReadonlyArray<PersonRosterRow> | null
}): T[] {
  const email = idKey(input?.email)
  if (!email) return []
  const taken = new Set<string>()
  for (const row of input.roster || []) for (const id of personIdSet(row, null)) taken.add(idKey(id))
  return (input.formerPeople || [])
    .filter((person) => person && idKey(person.email) === email)
    .filter((person) => [person.id, ...(person.personIds || [])].some((id) => idKey(id) && !taken.has(idKey(id))))
    .sort((a, b) => (b.deletedAtMs ?? 0) - (a.deletedAtMs ?? 0))
}

/** "Jane Smith used this email before they were deleted. Link their old bookings, leave and history to this person?" */
export function formerPersonLinkOfferMessage(people: ReadonlyArray<FormerPersonInput>): string {
  const names = [...new Set((people || []).map((row) => text(row.displayName)).filter(Boolean))]
  const who = names.length === 0 ? 'A former person' : names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${who} used this email before they were deleted. Link their old bookings, leave and history to this person?`
}

/**
 * The partial update of the new person's `users/{uid}` that links former people's ids: `arrayUnion` onto
 * `formerUserIds` of every id of the given former people that is not the person's own id and not already listed
 * (without case), plus write metadata — the admin identity-link write (§16; `linkBookingPersonWriteFields` pattern).
 * Each app maps `arrayUnion` to its SDK and adds its server `updatedAt`. Null when nothing is left to add or the
 * metadata is invalid.
 */
export function formerPersonLinkWriteFields(input: {
  person: { id: string; formerUserIds?: ReadonlyArray<string> | null }
  formerPeople: ReadonlyArray<FormerPersonInput>
  actorUserId: string
  platform: WritePlatform
}): { arrayUnion: { formerUserIds: string[] }; set: { updatedBy: string; updatedFrom: string } } | null {
  const own = idKey(input?.person?.id)
  if (!own) return null
  const listed = new Set((input.person.formerUserIds || []).map(idKey))
  const ids: string[] = []
  for (const person of input.formerPeople || []) {
    for (const raw of [person.id, ...(person.personIds || [])]) {
      const value = text(raw)
      const k = value.toLowerCase()
      if (!value || value.includes('/') || k === own || listed.has(k)) continue
      listed.add(k)
      ids.push(value)
    }
  }
  if (ids.length === 0) return null
  const metadata = writeMetadataFields(input.actorUserId, input.platform)
  if (!metadata) return null
  return { arrayUnion: { formerUserIds: ids }, set: { ...metadata } }
}

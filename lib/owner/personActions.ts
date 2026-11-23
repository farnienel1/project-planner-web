/**
 * Owner console person actions (PLAN §4, §8 PR 5): the pure parts — input checks and the exact writes — so they are
 * tested without Firestore. Writes use the rulebook's partial-update helpers (§1: only the changed fields, never a
 * whole-document set): `userProfileWriteFields` for `users/{uid}`, `operativeRowWriteFields` /
 * `managerRowWriteFields` for the `operatives` / `managers` rows the apps copy a person's name onto.
 */
import {
  managerRowWriteFields,
  operativeRowWriteFields,
  userProfileWriteFields,
  type DocumentWriteFields,
} from '@/lib/canonical/peopleDocuments'
import type { RestUpdateWrite } from '@/lib/owner/firestoreRest'
import type { PlainDoc } from '@/lib/owner/directory'

/** PLAN §4: every action needs a reason of 3–500 characters (stored in the audit log, emails masked). */
export const OWNER_REASON_MIN = 3
export const OWNER_REASON_MAX = 500
export const OWNER_NAME_MAX = 80

/** The refusal text for a missing or bad reason, or null when it is fine. */
export function ownerReasonError(reason: string | null | undefined): string | null {
  const value = (reason || '').trim()
  if (value.length < OWNER_REASON_MIN) return `Give a reason of at least ${OWNER_REASON_MIN} characters (it is kept in the audit log).`
  if (value.length > OWNER_REASON_MAX) return `The reason is too long (at most ${OWNER_REASON_MAX} characters).`
  return null
}

const CONTROL = /[\u0000-\u001f\u007f]/

/** A first name or surname: 1–OWNER_NAME_MAX characters after trimming, no control characters. */
export function ownerNamePartError(label: string, value: string | null | undefined): string | null {
  const text = (value || '').trim()
  if (!text) return `Enter the ${label}.`
  if (text.length > OWNER_NAME_MAX) return `The ${label} is too long (at most ${OWNER_NAME_MAX} characters).`
  if (CONTROL.test(text)) return `The ${label} has characters that cannot be saved.`
  return null
}

/**
 * The name fields both apps write when a person's name changes (web `userStore.identityFields`, iOS the same):
 * first name, surname, `lastName` (older readers), and `name` / `displayName` as "first surname".
 */
export function ownerNameFields(firstName: string, surname: string) {
  const first = firstName.trim()
  const last = surname.trim()
  const full = `${first} ${last}`.trim()
  return { firstName: first, surname: last, lastName: last, name: full, displayName: full }
}

export type RosterRowDoc = PlainDoc & { organizationId: string; collection: 'operatives' | 'managers' }

export type NameChangePlan = {
  writes: RestUpdateWrite[]
  /** What the preview shows: one line per document, never an email. */
  users: { id: string; organizationId: string }[]
  rows: { organizationId: string; collection: 'operatives' | 'managers'; id: string }[]
  /** Nothing differs from what is stored. */
  unchanged: boolean
}

function toWrite(path: string, fields: DocumentWriteFields): RestUpdateWrite | null {
  const set: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields.set)) {
    if (typeof value === 'string') set[key] = value
  }
  const remove = fields.remove.filter((key) => !(key in set))
  if (!Object.keys(set).length && !remove.length) return null
  return { path, set, remove }
}

/**
 * The writes for "Change name": every users document of the person (one email, every organisation — the directory
 * fold) and every `operatives` / `managers` row on the person's email in their organisations (the rows the apps copy
 * the name onto, matched by email without case as web `linkedStaffRefs` does). Only fields that change are written.
 */
export function ownerNameChangePlan(input: {
  firstName: string
  surname: string
  userDocs: readonly PlainDoc[]
  rosterRows: readonly RosterRowDoc[]
}): NameChangePlan {
  const next = ownerNameFields(input.firstName, input.surname)
  const writes: RestUpdateWrite[] = []
  const users: NameChangePlan['users'] = []
  const rows: NameChangePlan['rows'] = []
  for (const doc of input.userDocs) {
    const write = toWrite(`users/${doc.id}`, userProfileWriteFields(doc.data || {}, next))
    if (!write) continue
    writes.push(write)
    const org = doc.data?.organizationId
    users.push({ id: doc.id, organizationId: typeof org === 'string' ? org : '' })
  }
  for (const row of input.rosterRows) {
    const helper = row.collection === 'operatives' ? operativeRowWriteFields : managerRowWriteFields
    const write = toWrite(`organizations/${row.organizationId}/${row.collection}/${row.id}`, helper(row.data || {}, next))
    if (!write) continue
    writes.push(write)
    rows.push({ organizationId: row.organizationId, collection: row.collection, id: row.id })
  }
  return { writes, users, rows, unchanged: writes.length === 0 }
}

/** Roster rows whose stored email is one of the person's emails, without case. */
export function rosterRowsForEmails<T extends { data?: Record<string, unknown> }>(rows: readonly T[], emails: readonly string[]): T[] {
  const keys = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))
  if (!keys.size) return []
  return rows.filter((row) => {
    const email = row.data?.email
    return typeof email === 'string' && keys.has(email.trim().toLowerCase())
  })
}

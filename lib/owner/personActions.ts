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
import { isAnonymisedDeletedProfile, type RosterSegmentProfile } from '@/lib/canonical/userRosterSegment'
import type { RestUpdateWrite } from '@/lib/owner/firestoreRest'
import type { PlainDoc } from '@/lib/owner/directory'
import { MEMBER_NAMES_COLLECTION, memberNameEditPlan } from '@/lib/canonical/memberNames'
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'

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

/** A document as read, with its `updateTime` (the write precondition). */
export type ReadDoc = PlainDoc & { updateTime?: string }

export type RosterRowDoc = ReadDoc & { organizationId: string; collection: 'operatives' | 'managers' }

export const NAME_CHANGE_DELETED_MESSAGE =
  'One of this person’s records is an anonymised deleted profile, so the name is not changed from here.'

/** Review of #434: refuse a rename when any users document of the person is an anonymised deleted profile. */
export function nameChangeRefusal(userDocs: readonly PlainDoc[]): string | null {
  return userDocs.some((doc) => isAnonymisedDeletedProfile((doc.data || {}) as RosterSegmentProfile)) ? NAME_CHANGE_DELETED_MESSAGE : null
}

function emailOf(doc: PlainDoc): string {
  const email = doc.data?.email
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

/**
 * The users documents a rename may touch (review of #434): those whose stored email is one of the person's emails
 * (without case), or that have no email (an invite placeholder or a ghost). A document listed in `sameEmailUserIds`
 * whose email has since changed belongs to someone else now and is never renamed.
 */
export function renameableUserDocs<T extends PlainDoc>(userDocs: readonly T[], personEmails: readonly string[]): T[] {
  const emails = new Set(personEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))
  return userDocs.filter((doc) => {
    const email = emailOf(doc)
    return !email || emails.has(email)
  })
}

export type NameChangePlan = {
  writes: RestUpdateWrite[]
  /** What the preview shows: one line per document, never an email. */
  users: { id: string; organizationId: string }[]
  rows: { organizationId: string; collection: 'operatives' | 'managers'; id: string }[]
  /** 1.81.0: the organisations whose own name for the person (`memberNames`) is set (`set`) or removed (`removed`). */
  memberNames: { organizationId: string; action: 'set' | 'removed' }[]
  /** Nothing differs from what is stored. */
  unchanged: boolean
}

function toWrite(path: string, fields: DocumentWriteFields, updateTime?: string): RestUpdateWrite | null {
  const set: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields.set)) {
    if (typeof value === 'string') set[key] = value
  }
  const remove = fields.remove.filter((key) => !(key in set))
  if (!Object.keys(set).length && !remove.length) return null
  return updateTime ? { path, set, remove, updateTime } : { path, set, remove }
}

/**
 * The writes for "Change name": every users document of the person (one email, every organisation — the directory
 * fold) and every `operatives` / `managers` row on the person's email in their organisations (the rows the apps copy
 * the name onto, matched by email without case as web `linkedStaffRefs` does). Only fields that change are written.
 */
export function ownerNameChangePlan(input: {
  firstName: string
  surname: string
  userDocs: readonly ReadDoc[]
  rosterRows: readonly RosterRowDoc[]
  /**
   * 1.81.0 (rulebook §11 "Names per organisation"): `all` (default) — every users document and roster row, as before,
   * and every organisation's own name for the person is removed (`memberNames` of `organizationIds` × the person's
   * users ids), so the new name shows everywhere; `organization` — only `organizationId`: its own name for the person
   * (`memberNames/{keptUserId}`) and its roster rows; users documents are not touched.
   */
  scope?: 'all' | 'organization'
  organizationId?: string
  organizationIds?: readonly string[]
  keptUserId?: string
  /** Lower-case `orgId/uid` keys of the `memberNames` entries that exist (only those are removed for `all`). */
  existingMemberNames?: ReadonlySet<string>
}): NameChangePlan {
  const next = ownerNameFields(input.firstName, input.surname)
  const writes: RestUpdateWrite[] = []
  const users: NameChangePlan['users'] = []
  const rows: NameChangePlan['rows'] = []
  const memberNames: NameChangePlan['memberNames'] = []
  if (input.scope === 'organization') {
    const org = (input.organizationId || '').trim()
    const kept = (input.keptUserId || '').trim()
    // Rulebook 1.82.0 §11 (`memberNameEditPlan`, owner 24 Nov): the organisation's own name for them is always set;
    // on the person's home organisation its users documents take the name as well (account emails and older builds
    // read them). No other organisation's name changes.
    const keptDoc = input.userDocs.find((doc) => doc.id === kept)
    const home = keptDoc ? documentOrganizationId(keptDoc.data?.organizationId) : null
    if (org && kept && memberNameEditPlan({ organizationId: org, homeOrganizationId: home }).writeAccount) {
      for (const doc of input.userDocs) {
        if ((documentOrganizationId(doc.data?.organizationId) || '').toLowerCase() !== org.toLowerCase()) continue
        const write = toWrite(`users/${doc.id}`, userProfileWriteFields(doc.data || {}, next), doc.updateTime)
        if (!write) continue
        writes.push(write)
        users.push({ id: doc.id, organizationId: org })
      }
    }
    if (org && kept) {
      writes.push({
        path: `organizations/${org}/${MEMBER_NAMES_COLLECTION}/${kept}`,
        set: { firstName: input.firstName.trim(), surname: input.surname.trim() },
        kind: 'upsert',
      })
      memberNames.push({ organizationId: org, action: 'set' })
    }
    for (const row of input.rosterRows) {
      if (row.organizationId !== org) continue
      const helper = row.collection === 'operatives' ? operativeRowWriteFields : managerRowWriteFields
      const write = toWrite(`organizations/${row.organizationId}/${row.collection}/${row.id}`, helper(row.data || {}, next), row.updateTime)
      if (!write) continue
      writes.push(write)
      rows.push({ organizationId: row.organizationId, collection: row.collection, id: row.id })
    }
    return { writes, users, rows, memberNames, unchanged: writes.length === 0 }
  }
  for (const org of input.organizationIds || []) {
    for (const doc of input.userDocs) {
      if (!input.existingMemberNames?.has(`${org}/${doc.id}`.toLowerCase())) continue
      writes.push({ path: `organizations/${org}/${MEMBER_NAMES_COLLECTION}/${doc.id}`, set: {}, kind: 'delete' })
      if (!memberNames.some((row) => row.organizationId === org)) memberNames.push({ organizationId: org, action: 'removed' })
    }
  }
  for (const doc of input.userDocs) {
    const write = toWrite(`users/${doc.id}`, userProfileWriteFields(doc.data || {}, next), doc.updateTime)
    if (!write) continue
    writes.push(write)
    const org = doc.data?.organizationId
    users.push({ id: doc.id, organizationId: typeof org === 'string' ? org : '' })
  }
  for (const row of input.rosterRows) {
    const helper = row.collection === 'operatives' ? operativeRowWriteFields : managerRowWriteFields
    const write = toWrite(`organizations/${row.organizationId}/${row.collection}/${row.id}`, helper(row.data || {}, next), row.updateTime)
    if (!write) continue
    writes.push(write)
    rows.push({ organizationId: row.organizationId, collection: row.collection, id: row.id })
  }
  return { writes, users, rows, memberNames, unchanged: writes.length === 0 }
}

/**
 * Roster rows of the person: stored email is one of the person's emails (without case), or — for a row with no email,
 * such as a converted ghost's operatives row — the row id is one of the person's ids (review of #434).
 */
export function rosterRowsForPerson<T extends { id: string; data?: Record<string, unknown> }>(
  rows: readonly T[],
  emails: readonly string[],
  personIds: readonly string[] = []
): T[] {
  const keys = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))
  const ids = new Set(personIds.map((id) => id.trim().toLowerCase()).filter(Boolean))
  return rows.filter((row) => {
    const email = typeof row.data?.email === 'string' ? row.data.email.trim().toLowerCase() : ''
    if (email) return keys.has(email)
    return ids.has(row.id.toLowerCase())
  })
}

/** Roster rows whose stored email is one of the person's emails, without case. */
export function rosterRowsForEmails<T extends { id: string; data?: Record<string, unknown> }>(rows: readonly T[], emails: readonly string[]): T[] {
  return rosterRowsForPerson(rows, emails, [])
}

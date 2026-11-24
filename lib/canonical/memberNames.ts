/**
 * A person's name in one organisation (rulebook §11 "Names per organisation", 1.81.0; owner decision 24 Nov).
 *
 * One account (one email and password, one `users/{uid}` document) can belong to several companies. Before 1.81.0 its
 * name lived only on that users document, so every company showed the same name. From 1.81.0 a company may give the
 * person their own name there: `organizations/{orgId}/memberNames/{uid}` `{ firstName, surname }` plus write
 * metadata. Every member of the company reads it; the company's admins and the person themself write it.
 *
 * The name shown in organisation O is `displayNameInOrganization`: O's `memberNames` entry for any id the person goes
 * by when it holds a name, else the users document's name exactly as before 1.81.0 — so every company with no entry
 * reads unchanged (guardrail 3). Where an edit is saved is `memberNameEditTarget`: in the person's home organisation
 * (the one their users document names) the users document, as before, and the home company's own entry (if any) is
 * removed so the edit shows; in any other organisation the entry. Pure.
 */

import { documentOrganizationId } from './peopleDocuments'
import { writeMetadataFields } from './writeMetadata'

export const MEMBER_NAMES_COLLECTION = 'memberNames'
/** The only name fields an entry stores (plus `updatedAt`, `updatedBy`, `updatedFrom`). */
export const MEMBER_NAME_FIELDS = ['firstName', 'surname'] as const
/** Characters per part, the same on both apps and in the security rules. */
export const MEMBER_NAME_MAX_LENGTH = 100
export const MEMBER_NAME_REQUIRED_MESSAGE = 'Enter a first name.'
export const MEMBER_NAME_TOO_LONG_MESSAGE = `Names are ${MEMBER_NAME_MAX_LENGTH} characters at most.`
/** Shown when a writer who may not change this person's name in this company tries (security rules §16). */
export const MEMBER_NAME_REFUSED_MESSAGE = "Only an admin can change this person's name in this company."

export type MemberName = {
  /** The users id the entry is filed under (its document id, stored case). */
  userId: string
  firstName: string
  surname: string
  displayName: string
}

/** `{ lower-case users id: entry }` for one organisation. */
export type MemberNames = Record<string, MemberName>

export type NameInOrganization = {
  firstName: string
  surname: string
  displayName: string
  /** `organization`: from this company's entry; `account`: the users document's name (no entry). */
  source: 'organization' | 'account'
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function key(id: unknown): string {
  return text(id).toLowerCase()
}

export function memberNamePath(organizationId: string, userId: string): string {
  return `organizations/${text(organizationId)}/${MEMBER_NAMES_COLLECTION}/${text(userId)}`
}

/** One `memberNames/{uid}` document. Null when there is no id or neither part holds a name (no entry). */
export function parseMemberNameDocument(docId: unknown, data: Record<string, unknown> | null | undefined): MemberName | null {
  const userId = text(docId)
  if (!userId || !data || typeof data !== 'object') return null
  const firstName = text(data.firstName)
  const surname = text(data.surname) || text(data.lastName)
  const displayName = `${firstName} ${surname}`.trim()
  if (!displayName) return null
  return { userId, firstName, surname, displayName }
}

/** Every entry of one organisation, keyed by lower-case users id (ids compare without case, §1). */
export function parseMemberNameDocuments(
  docs: ReadonlyArray<{ id: unknown; data: Record<string, unknown> | null | undefined }> | null | undefined
): MemberNames {
  const out: MemberNames = {}
  for (const row of docs || []) {
    const parsed = parseMemberNameDocument(row?.id, row?.data)
    if (parsed) out[key(parsed.userId)] = parsed
  }
  return out
}

export type NamedPerson = {
  id?: unknown
  firstName?: unknown
  surname?: unknown
  lastName?: unknown
  name?: unknown
  displayName?: unknown
  formerUserIds?: unknown
  sameEmailUserIds?: unknown
}

function personIds(person: NamedPerson | null | undefined): string[] {
  const ids: string[] = []
  const add = (value: unknown) => {
    const id = key(value)
    if (id && !ids.includes(id)) ids.push(id)
  }
  add(person?.id)
  for (const field of [person?.formerUserIds, person?.sameEmailUserIds]) {
    if (Array.isArray(field)) for (const value of field) add(value)
  }
  return ids
}

/** The entry that names this person in the organisation: their own id first, then any id they go by. */
export function memberNameFor(person: NamedPerson | null | undefined, names: MemberNames | null | undefined): MemberName | null {
  if (!names) return null
  for (const id of personIds(person)) {
    const entry = names[id]
    if (entry) return entry
  }
  return null
}

/** The users document's own name (first name and surname, else a stored single name split on its first space). */
export function accountName(person: NamedPerson | null | undefined): NameInOrganization {
  let firstName = text(person?.firstName)
  let surname = text(person?.surname) || text(person?.lastName)
  const combined = text(person?.displayName) || text(person?.name)
  if (!firstName && !surname && combined) {
    const space = combined.indexOf(' ')
    firstName = space < 0 ? combined : combined.slice(0, space).trim()
    surname = space < 0 ? '' : combined.slice(space + 1).trim()
  }
  return { firstName, surname, displayName: `${firstName} ${surname}`.trim() || combined, source: 'account' }
}

/**
 * This person's name in this organisation: the organisation's entry (`memberNameFor`), else `accountName`. Pass
 * `names` (every entry of the open organisation) or `memberName` (the one entry, already found).
 */
export function displayNameInOrganization(input: {
  person: NamedPerson | null | undefined
  names?: MemberNames | null
  memberName?: MemberName | null
}): NameInOrganization {
  const entry = input?.memberName ?? memberNameFor(input?.person, input?.names)
  if (entry) return { firstName: entry.firstName, surname: entry.surname, displayName: entry.displayName, source: 'organization' }
  return accountName(input?.person)
}

/**
 * Lays each organisation entry over the people (the roster fold, `rosterMembersForOrganization`, both apps' rosters):
 * `firstName`, `surname`, `lastName` (when present), `name` / `displayName` (when present) take the organisation's
 * name. A person with no entry is returned unchanged (the same object). Every other field is kept.
 */
export function applyMemberNames<T extends NamedPerson>(people: ReadonlyArray<T>, names: MemberNames | null | undefined): T[] {
  if (!names || Object.keys(names).length === 0) return [...people]
  return people.map((person) => {
    const entry = memberNameFor(person, names)
    if (!entry) return person
    const next: Record<string, unknown> = { ...person, firstName: entry.firstName, surname: entry.surname }
    if ('lastName' in (person as object)) next.lastName = entry.surname
    if ('name' in (person as object)) next.name = entry.displayName
    if ('displayName' in (person as object)) next.displayName = entry.displayName
    return next as T
  })
}

/**
 * Where an edit of this person's name in `organizationId` is saved: `account` (their users document, as before 1.81.0
 * — their home organisation, the one that document names) or `organization` (this company's `memberNames` entry).
 * A users document with no organisation is treated as home (it is the only place its name can go).
 */
export function memberNameEditTarget(input: {
  organizationId: unknown
  /** The users document's stored `organizationId` (id, path or reference). */
  homeOrganizationId: unknown
}): 'account' | 'organization' {
  const org = key(input?.organizationId)
  const home = key(documentOrganizationId(input?.homeOrganizationId))
  if (!org || !home) return 'account'
  return org === home ? 'account' : 'organization'
}

/** A name edit's check, before it is saved anywhere. Null when it may be saved. */
export function memberNameValidationError(input: { firstName: unknown; surname: unknown }): string | null {
  const firstName = text(input?.firstName)
  const surname = text(input?.surname)
  if (!firstName) return MEMBER_NAME_REQUIRED_MESSAGE
  if (firstName.length > MEMBER_NAME_MAX_LENGTH || surname.length > MEMBER_NAME_MAX_LENGTH) return MEMBER_NAME_TOO_LONG_MESSAGE
  return null
}

/**
 * The fields of a `memberNames/{uid}` write (a whole-document set: the entry has no other fields). The app adds its
 * SDK server timestamp as `updatedAt`. Null when the name is refused (`memberNameValidationError`).
 */
export function memberNameWriteFields(input: {
  firstName: unknown
  surname: unknown
  writerUserId: unknown
  platform: unknown
}): Record<string, unknown> | null {
  if (memberNameValidationError(input)) return null
  return {
    firstName: text(input.firstName),
    surname: text(input.surname),
    ...(writeMetadataFields(input.writerUserId, input.platform) ?? {}),
  }
}

/**
 * Who may write a person's entry in an organisation (the security rules hold the same): the person themself, or an
 * admin of that organisation (outside operative mode). Nobody else, Operatives managers included.
 */
export function canWriteMemberName(input: { writerUserId: unknown; subjectUserId: unknown; writerIsAdmin: boolean }): boolean {
  const writer = key(input?.writerUserId)
  if (!writer) return false
  return writer === key(input?.subjectUserId) || input?.writerIsAdmin === true
}

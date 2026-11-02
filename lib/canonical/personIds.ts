/**
 * Every id one person goes by, read from a roster (rulebook §8, §13).
 *
 * A person can have several `users` documents and ids: their own `id`, invite placeholder ids from before
 * sign-up (`formerUserIds`), other documents on the same email (`sameEmailUserIds`, from `rosterPeople`),
 * and any roster row that shares their email (compared without case). `personIdSet` returns all of them, so a
 * recipient or approver list can leave the person out under every id. Ids keep their stored case and compare
 * without case.
 */

import type { StaffAccountRole } from './staffAccess'

/** A roster row as the line-manager and notification rules read it. Only `id` is required. */
export type PersonRosterRow = {
  id: string
  email?: string | null
  /** Missing counts as active. */
  isActive?: boolean | null
  /** The resolved staff role (web `staffAccountRole`, iOS `UserStore`), or the stored `role` string. */
  role?: StaffAccountRole | string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  /** Same as `formerUserIds` (the `userTimesheetSubjects` / `materialOrderRecipients` spelling). */
  formerIds?: ReadonlyArray<string> | null
  /** Same as `sameEmailUserIds` (the `userTimesheetSubjects` / `materialOrderRecipients` spelling). */
  aliasIds?: ReadonlyArray<string> | null
  assignedManagerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserId?: string | null
  hasNoLineManager?: boolean | null
}

/** Anything with at least an id and optionally the alias fields. */
export type PersonIdsInput = {
  id?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  formerIds?: ReadonlyArray<string> | null
  aliasIds?: ReadonlyArray<string> | null
}

export function idText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function idKey(value: unknown): string {
  return idText(value).toLowerCase()
}

function ownIds(person: PersonIdsInput | null | undefined): string[] {
  if (!person) return []
  return [
    person.id,
    ...(person.formerUserIds ?? []),
    ...(person.sameEmailUserIds ?? []),
    ...(person.formerIds ?? []),
    ...(person.aliasIds ?? []),
  ]
    .map(idText)
    .filter(Boolean)
}

function validRoster<T extends { id?: string | null }>(roster: ReadonlyArray<T> | null | undefined): T[] {
  return (roster || []).filter((member) => member && typeof member === 'object' && idText(member.id))
}

/** Missing `isActive` counts as active. */
export function rosterMemberActive(member: { isActive?: boolean | null } | null | undefined): boolean {
  return Boolean(member) && member!.isActive !== false
}

/** The roster row whose own id is `id` (without case), else the first row that lists `id` as an alias. */
export function rosterMemberFor<T extends PersonRosterRow>(
  id: unknown,
  roster: ReadonlyArray<T> | null | undefined
): T | undefined {
  const key = idKey(id)
  if (!key) return undefined
  const members = validRoster(roster)
  return (
    members.find((member) => idKey(member.id) === key) ??
    members.find((member) => ownIds(member).some((alias) => idKey(alias) === key))
  )
}

/**
 * Every id of `person`: their id, `formerUserIds`, `sameEmailUserIds`, and the ids (with their aliases) of every
 * roster row that is the same person — same id, lists one of their ids, or shares their email (without case).
 * De-duplicated without case, stored case kept, the person's own id first.
 */
export function personIdSet(
  person: PersonIdsInput | null | undefined,
  roster?: ReadonlyArray<PersonRosterRow> | null
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (id: string) => {
    const key = idKey(id)
    if (!key || seen.has(key)) return false
    seen.add(key)
    out.push(idText(id))
    return true
  }
  for (const id of ownIds(person)) add(id)
  if (out.length === 0) return []
  const emails = new Set<string>()
  const personEmail = idKey(person?.email)
  if (personEmail) emails.add(personEmail)
  const members = validRoster(roster)
  // Grow until no roster row adds an id or email (an alias of an alias is the same person).
  let grew = true
  for (let pass = 0; grew && pass < 8; pass += 1) {
    grew = false
    for (const member of members) {
      const ids = ownIds(member)
      const email = idKey(member.email)
      const same = ids.some((id) => seen.has(idKey(id))) || (email !== '' && emails.has(email))
      if (!same) continue
      for (const id of ids) if (add(id)) grew = true
      if (email && !emails.has(email)) {
        emails.add(email)
        grew = true
      }
    }
  }
  return out
}

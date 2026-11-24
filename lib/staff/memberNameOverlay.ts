/**
 * Rulebook 1.81.0 §11 "Names per organisation": lay this organisation's `memberNames` entries over web `User` rows
 * (`memberNameFor` decides the entry). Pure: `memberNamesLive` feeds the stores through it.
 */
import { memberNameFor, memberNameWriterManagesOperative, type MemberNames } from '@/lib/canonical/memberNames'
import type { User } from '@/types'

export type Overlay = { firstName: string; surname: string; accountFirstName: string; accountSurname: string }
export type NamedUser = User & { orgNameOverlay?: Overlay }

/** The users document's own name under any organisation name laid over this user. */
export function accountNameOf(user: Pick<User, 'firstName' | 'surname'> & { orgNameOverlay?: Overlay }): { firstName: string; surname: string } {
  const mark = user.orgNameOverlay
  if (mark && user.firstName === mark.firstName && user.surname === mark.surname) {
    return { firstName: mark.accountFirstName, surname: mark.accountSurname }
  }
  return { firstName: user.firstName, surname: user.surname }
}

/** Whether this user's shown name is this organisation's own entry. */
export function hasOrganizationName(user: { firstName: string; surname: string; orgNameOverlay?: Overlay }): boolean {
  const mark = user.orgNameOverlay
  return Boolean(mark && user.firstName === mark.firstName && user.surname === mark.surname)
}

/** One user with the entries laid over (`memberNameFor`); the same object when nothing changes. */
export function overlayMemberName<T extends NamedUser | null>(user: T, entries: MemberNames): T {
  if (!user) return user
  return overlayOne(user as NamedUser, entries) as T
}

export function overlayOne<T extends NamedUser>(user: T, entries: MemberNames): T {
  const base = accountNameOf(user)
  const entry = memberNameFor(user, entries)
  if (!entry) {
    if (!user.orgNameOverlay) return user
    const { orgNameOverlay: _removed, ...rest } = user
    void _removed
    return { ...rest, firstName: base.firstName, surname: base.surname } as T
  }
  const mark = user.orgNameOverlay
  if (
    mark &&
    user.firstName === entry.firstName &&
    user.surname === entry.surname &&
    mark.accountFirstName === base.firstName &&
    mark.accountSurname === base.surname
  ) {
    return user
  }
  return {
    ...user,
    firstName: entry.firstName,
    surname: entry.surname,
    orgNameOverlay: { firstName: entry.firstName, surname: entry.surname, accountFirstName: base.firstName, accountSurname: base.surname },
  }
}

/** A list with the entries laid over; the same array when no user changes. */
export function overlayMemberNames<T extends NamedUser>(users: readonly T[], entries: MemberNames): T[] {
  let changed = false
  const next = users.map((user) => {
    const row = overlayOne(user, entries)
    if (row !== user) changed = true
    return row
  })
  return changed ? next : (users as T[])
}


/**
 * Rulebook 1.82.0 §11 (owner correction 24 Nov) `memberNameWriterManagesOperative`, with web `User` rows passed in
 * the shape the rulebook's level and toggle readers take (`{ ...permissions, role }`, as every web caller of
 * `canManageOperatives` does): the writer manages operatives in the open organisation and the subject is an operative
 * there, whatever their home company.
 */
export function webWriterManagesOperative(writer: User | null | undefined, subject: User | null | undefined): boolean {
  if (!writer || !subject) return false
  return memberNameWriterManagesOperative({
    writer: { ...writer.permissions, role: writer.role },
    subject: { ...subject.permissions, role: subject.role },
  })
}

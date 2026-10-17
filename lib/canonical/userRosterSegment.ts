/**
 * Active / Inactive / Pending for Manage Users, Managers, and Operatives.
 *
 * Screens stay in each app. Both platforms call these instead of a local
 * passwordSet / isActive switch. An anonymised deleted profile is Inactive
 * even when those flags are still true. A leftover invite row that still
 * identifies someone after `userEmails` dropped the claim is not a live
 * pending invite — `listedRosterUsers` removes it.
 */

export const ANONYMISED_DELETED_USER_NAME = 'Deleted user'

export const ROSTER_SEGMENTS = ['active', 'inactive', 'pending'] as const
export type RosterSegment = (typeof ROSTER_SEGMENTS)[number]

export type RosterSegmentProfile = {
  email?: string | null
  firstName?: string | null
  surname?: string | null
  lastName?: string | null
  name?: string | null
  displayName?: string | null
  passwordSet?: boolean | null
  isActive?: boolean | null
  mobileNumber?: string | null
  mobile?: string | null
  phone?: string | null
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value: unknown): string {
  return trimmed(value).toLowerCase()
}

function namesEqualDeletedUser(value: string): boolean {
  return value.toLowerCase() === ANONYMISED_DELETED_USER_NAME.toLowerCase()
}

/** firstName + surname, or the single Deleted-user name / displayName. */
export function rosterPersonName(profile: RosterSegmentProfile): string {
  const first = trimmed(profile.firstName)
  const surname = trimmed(profile.surname) || trimmed(profile.lastName)
  const combined = `${first} ${surname}`.trim()
  if (combined) return combined
  return trimmed(profile.name) || trimmed(profile.displayName)
}

function rosterPhone(profile: RosterSegmentProfile): string {
  return trimmed(profile.mobileNumber) || trimmed(profile.mobile) || trimmed(profile.phone)
}

/**
 * Empty email and the rosterAnonymisePatch name: firstName Deleted + surname
 * user, or a single "Deleted user" on firstName / name / displayName.
 * passwordSet and isActive on that document do not make it Active.
 */
export function isAnonymisedDeletedProfile(profile: RosterSegmentProfile | null | undefined): boolean {
  if (!profile) return false
  if (normalizeEmail(profile.email)) return false
  if (namesEqualDeletedUser(rosterPersonName(profile))) return true
  if (namesEqualDeletedUser(trimmed(profile.name))) return true
  if (namesEqualDeletedUser(trimmed(profile.displayName))) return true
  return false
}

export function rosterSegment(profile: RosterSegmentProfile): RosterSegment {
  if (isAnonymisedDeletedProfile(profile)) return 'inactive'
  if (profile.passwordSet === true) return profile.isActive === true ? 'active' : 'inactive'
  return 'pending'
}

export function matchesRosterSegment(profile: RosterSegmentProfile, segment: RosterSegment): boolean {
  return rosterSegment(profile) === segment
}

export function rosterStatusLabel(profile: RosterSegmentProfile): 'Active' | 'Inactive' | 'Pending' {
  const segment = rosterSegment(profile)
  if (segment === 'active') return 'Active'
  if (segment === 'inactive') return 'Inactive'
  return 'Pending'
}

export function normalizeClaimedEmails(claimedEmails?: readonly string[] | null): string[] | null {
  if (claimedEmails == null) return null
  return claimedEmails.map((email) => normalizeEmail(email)).filter(Boolean)
}

/**
 * Pending row that still identifies someone after their invite claim was removed.
 * `claimedEmails` is the set of `organizations/{orgId}/userEmails` document ids
 * from a successful read. Null / omitted means that read failed, so a pending
 * invite with an email is kept.
 */
export function isIdentifiablePendingLeftover(
  profile: RosterSegmentProfile,
  claimedEmails?: readonly string[] | null
): boolean {
  if (profile.passwordSet === true) return false
  if (isAnonymisedDeletedProfile(profile)) return false
  const email = normalizeEmail(profile.email)
  const name = rosterPersonName(profile)
  const phone = rosterPhone(profile)
  const namedPerson = Boolean(name) && !namesEqualDeletedUser(name)
  const identifiable = Boolean(email) || namedPerson || Boolean(phone)
  if (!identifiable) return false
  if (!email) return true
  const claimed = normalizeClaimedEmails(claimedEmails)
  if (claimed == null) return false
  return !claimed.includes(email)
}

/** Rows the people lists may show. */
export function listedRosterUsers<T extends RosterSegmentProfile>(
  users: readonly T[],
  claimedEmails?: readonly string[] | null
): T[] {
  return users.filter((user) => !isIdentifiablePendingLeftover(user, claimedEmails))
}

/**
 * People who may appear in current warnings, Daily Overview unbooked rows,
 * new weekly-report warnings, and scheduling / book-labour pickers.
 * Historic bookings keep the stored name. Re-invite is a new row.
 */
export function listedCurrentLabourPeople<T extends RosterSegmentProfile>(
  people: readonly T[]
): T[] {
  return people.filter((person) => !isAnonymisedDeletedProfile(person))
}

export const DELETED_USER_DISPLAY_NAME = ANONYMISED_DELETED_USER_NAME
export const userRosterSegment = rosterSegment
export const matchesUserRosterSegment = matchesRosterSegment
export const rosterPersonDisplayName = rosterPersonName
export type RosterPerson = RosterSegmentProfile

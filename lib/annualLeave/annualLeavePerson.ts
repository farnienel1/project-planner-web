import type { Operative, User } from '@/types'
import { isPendingPerson } from '@/lib/staff/pendingPeople'
import {
  annualLeaveTeamPeople,
  annualLeaveTeamPersonIsCurrent,
  annualLeaveTeamTabVisible,
  ghostBadgeLabel,
  normalizeDocumentId,
  type AnnualLeaveTeamCandidate,
} from '@/lib/canonical'
import { bookingIdsForAccount } from '@/lib/canonical/bookingPerson'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { samePersonIds } from '@/lib/staff/userRosterUtils'

export interface AnnualLeavePerson {
  id: string
  displayName: string
  subtitle: string
  tradeLabel: string
  firstNameSort: string
  surnameSort: string
  userId?: string
  operativeId?: string
  /**
   * Rulebook 1.40.0 (guardrail 1): every id this person's leave may be filed under, lower case —
   * `leaveRecordsForAccount` (the users id, former and same-email ids, catalogue rows on their email, the email).
   */
  leaveIds?: string[]
}

export type AnnualLeavePersonSort = 'firstName' | 'surname' | 'trade'

function displayNameForUser(user: User): string {
  const name = `${user.firstName} ${user.surname}`.trim()
  return name || user.email
}

function operativeTradeLabel(op: Operative): string {
  const data = op as Operative & { tradeTypeCustom?: string; tradeTypePreset?: string }
  const custom = data.tradeTypeCustom?.trim() ?? ''
  if (custom) return custom
  const preset = data.tradeTypePreset?.trim() ?? ''
  return preset || 'General'
}

function userTradeLabel(user: User, operative?: Operative): string {
  if (operative) return operativeTradeLabel(operative)
  if (user.permissions.manager) return 'Management'
  const custom = user.tradeTypeCustom?.trim() ?? ''
  if (custom) return custom
  const preset = user.tradeTypePreset?.trim() ?? ''
  return preset || 'General'
}

function nameParts(display: string, operative?: Operative): { first: string; last: string } {
  if (operative?.firstName) {
    return { first: operative.firstName, last: operative.lastName }
  }
  const parts = display.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return { first: parts[0], last: parts[parts.length - 1] }
  }
  return { first: display, last: display }
}

type TeamCandidate = AnnualLeaveTeamCandidate & { source: { user?: User; operative?: Operative } }

/**
 * Every person Annual leave → Team could list (rulebook 1.40.0): one candidate per users document (pending invites
 * marked as not signed up), then each active catalogue `operatives` row with no account. Which of them a viewer sees is
 * the rulebook's `annualLeaveTeamPeople`; this only shapes the rows.
 */
function teamCandidates(users: User[], operatives: Operative[]): TeamCandidate[] {
  const roster = users
  const out: TeamCandidate[] = []
  for (const user of users) {
    if (!user?.id) continue
    out.push({
      ...rulebookPerson(user, roster),
      firstName: user.firstName,
      surname: user.surname,
      // A web `status: pending` invite is a pending invite whatever `passwordSet` says.
      passwordSet: isPendingPerson(user) ? false : user.passwordSet,
      isActive: user.isActive !== false,
      ghost: user.ghost === true,
      source: { user },
    })
  }
  for (const op of operatives) {
    const email = (op.email || '').trim().toLowerCase()
    const linkedUser = email
      ? users.find((u) => (u.email || '').trim().toLowerCase() === email)
      : users.find((u) => normalizeDocumentId(u.id) === normalizeDocumentId(op.id))
    // A row that belongs to an account is that person's (the users row above), never a second person.
    if (linkedUser) continue
    out.push({
      id: op.id,
      email: op.email || '',
      firstName: op.firstName,
      surname: op.lastName,
      isActive: op.isActive !== false,
      catalogueOperative: true,
      source: { operative: op },
    })
  }
  return out
}

function teamRow(candidate: TeamCandidate, users: User[], operatives: Operative[], userIdAliases?: Record<string, string>): AnnualLeavePerson {
  const user = candidate.source.user
  if (user) {
    const email = (user.email || '').toLowerCase()
    const linkedOp = email ? operatives.find((op) => (op.email || '').trim().toLowerCase() === email) : operatives.find((op) => op.id === user.id)
    const trade = userTradeLabel(user, linkedOp)
    const display = displayNameForUser(user)
    const { first, last } = nameParts(display, linkedOp)
    let roleHint = 'Team member'
    if (user.permissions.operativeMode || user.role === 'operative') roleHint = 'Operative'
    else if (user.permissions.adminAccess || user.role === 'admin' || user.isSuperAdmin) roleHint = 'Admin'
    else if (user.permissions.manager) roleHint = 'Manager'
    const account = {
      id: user.id,
      email: user.email,
      formerIds: user.formerUserIds ?? [],
      aliasIds: Array.from(samePersonIds(user.id, users, userIdAliases)),
    }
    return {
      id: `user-${user.id}`,
      displayName: display,
      subtitle: `${roleHint} · ${user.email || ghostBadgeLabel(user)}`,
      tradeLabel: trade,
      firstNameSort: first,
      surnameSort: last,
      userId: user.id,
      operativeId: linkedOp?.id,
      leaveIds: leaveIdKeys(account, operatives),
    }
  }
  const op = candidate.source.operative!
  const display = `${op.firstName} ${op.lastName}`.trim() || op.email
  return {
    id: `op-${op.id}`,
    displayName: display,
    subtitle: `Operative · ${op.email || 'No email'}`,
    tradeLabel: operativeTradeLabel(op),
    firstNameSort: op.firstName,
    surnameSort: op.lastName,
    userId: undefined,
    operativeId: op.id,
    leaveIds: [normalizeDocumentId(op.id), (op.email || '').trim().toLowerCase()].filter(Boolean),
  }
}

/** `leaveRecordsForAccount`'s ids for one account, lower case (the email included). */
function leaveIdKeys(account: { id: string; email?: string | null; formerIds?: readonly string[]; aliasIds?: readonly string[] }, operatives: Operative[]): string[] {
  const ids = bookingIdsForAccount(account, operatives.map((op) => ({ id: op.id, email: op.email })))
  const email = (account.email || '').trim().toLowerCase()
  return Array.from(new Set([...ids.map((id) => id.toLowerCase()), ...(email ? [email] : [])]))
}

/**
 * Rulebook 1.40.0 `annualLeaveTeamPeople`: the people on this viewer's Team list — admins every current person
 * (self-bookers included), anyone else the people they line-manage; never the viewer, a deleted profile or a pending
 * invite.
 */
export function teamLeavePeopleFor(
  viewer: User | null | undefined,
  users: User[],
  operatives: Operative[],
  userIdAliases?: Record<string, string>
): AnnualLeavePerson[] {
  if (!viewer) return []
  const roster = rulebookRoster(users)
  const listed = annualLeaveTeamPeople({ viewer: rulebookPerson(viewer, users), people: teamCandidates(users, operatives), roster })
  return listed.map((candidate) => teamRow(candidate, users, operatives, userIdAliases))
}

/** Rulebook 1.40.0 `annualLeaveTeamTabVisible`: admins, and anyone who line-manages at least one current person. */
export function teamLeaveTabVisible(viewer: User | null | undefined, users: User[], operatives: Operative[]): boolean {
  if (!viewer) return false
  return annualLeaveTeamTabVisible({ viewer: rulebookPerson(viewer, users), people: teamCandidates(users, operatives), roster: rulebookRoster(users) })
}

/** Every current person as a Team row, unfiltered (used to look a person up by id, e.g. from a notification). */
export function buildAnnualLeavePeople(users: User[], operatives: Operative[]): AnnualLeavePerson[] {
  return teamCandidates(users, operatives)
    .filter((candidate) => annualLeaveTeamPersonIsCurrent(candidate))
    .map((candidate) => teamRow(candidate, users, operatives))
}

export function sortAnnualLeavePeople(
  people: AnnualLeavePerson[],
  sortMode: AnnualLeavePersonSort
): AnnualLeavePerson[] {
  const rows = [...people]
  switch (sortMode) {
    case 'firstName':
      rows.sort((a, b) => a.firstNameSort.localeCompare(b.firstNameSort, undefined, { sensitivity: 'base' }))
      break
    case 'surname':
      rows.sort((a, b) => a.surnameSort.localeCompare(b.surnameSort, undefined, { sensitivity: 'base' }))
      break
    case 'trade':
      rows.sort((a, b) => {
        const tradeCmp = a.tradeLabel.localeCompare(b.tradeLabel, undefined, { sensitivity: 'base' })
        if (tradeCmp !== 0) return tradeCmp
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
      })
      break
  }
  return rows
}

export function bookingMatchesPerson(
  booking: { userId?: string; operativeId?: string },
  person: AnnualLeavePerson
): boolean {
  // Ids compare without case (rulebook §1 `normalizeDocumentId`); 1.40.0: every id the person goes by
  // (`leaveRecordsForAccount`), not only the two ids on the row.
  const ids = new Set([...(person.leaveIds ?? []), normalizeDocumentId(person.userId), normalizeDocumentId(person.operativeId)].filter(Boolean))
  const bookingUser = normalizeDocumentId(booking.userId)
  const bookingOperative = normalizeDocumentId(booking.operativeId)
  return (bookingUser !== '' && ids.has(bookingUser)) || (bookingOperative !== '' && ids.has(bookingOperative))
}

export function resolvePersonName(
  booking: { userId?: string; operativeId?: string },
  users: User[],
  operatives: Operative[]
): string {
  if (booking.userId) {
    const user = users.find((u) => u.id === booking.userId)
    if (user) return displayNameForUser(user)
  }
  if (booking.operativeId) {
    const op = operatives.find((o) => normalizeDocumentId(o.id) === normalizeDocumentId(booking.operativeId))
    if (op) return `${op.firstName} ${op.lastName}`.trim() || op.email
  }
  return 'Unknown'
}

/**
 * The web `User` as the rulebook's line-manager, leave and notification rules read it (rulebook §8, §9, §13).
 *
 * Every canonical call that takes a person or a roster (`lineManagerIds`, `leaveApproverIds`,
 * `canSelfBookAnnualLeave`, `timesheetSelfSigned`, `lineManagerRequiredError`, `personIdSet`, the
 * `notificationRecipients` functions) gets the full person from here: id, email, active flag, resolved role,
 * the role flags, every alias id and the line-manager fields. No rule is decided here.
 */

import type { User } from '@/types'
import { staffAccountRole } from '@/lib/permissions'
import { personIdSet, type NotificationRosterMember, type StaffAccountRole } from '@/lib/canonical'

export type RulebookPerson = NotificationRosterMember & {
  id: string
  role: StaffAccountRole
  isSuperAdmin: boolean
  adminAccess: boolean
  /** Same as `adminAccess` (iOS `isAdmin` spelling). */
  isAdmin: boolean
  manager: boolean
  operativeMode: boolean
  annualLeaveSelfBook: boolean
  annualLeaveEnabled: boolean | null
}

function emailKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function ids(values: ReadonlyArray<string> | null | undefined): string[] {
  return (values || []).map((value) => String(value ?? '').trim()).filter(Boolean)
}

/** Other `users` rows on the same email (without case): the person's `sameEmailUserIds`. */
export function sameEmailUserIdsFor(user: Pick<User, 'id' | 'email'>, users: ReadonlyArray<Pick<User, 'id' | 'email'>>): string[] {
  const email = emailKey(user.email)
  if (!email) return []
  return users.filter((row) => row && row.id && row.id !== user.id && emailKey(row.email) === email).map((row) => row.id)
}

/** One person, filled in from the roster for `sameEmailUserIds`. */
export function rulebookPerson(user: User, users: ReadonlyArray<User> = []): RulebookPerson {
  const permissions = user.permissions || ({} as User['permissions'])
  return {
    id: user.id,
    email: user.email ?? null,
    isActive: user.isActive !== false,
    // 1.16.0: the signed-up account is the notice recipient (`notificationRecipientAccountId`).
    passwordSet: typeof user.passwordSet === 'boolean' ? user.passwordSet : null,
    role: staffAccountRole(user),
    isSuperAdmin: user.isSuperAdmin === true,
    adminAccess: permissions.adminAccess === true,
    isAdmin: permissions.adminAccess === true,
    manager: permissions.manager === true,
    operativeMode: permissions.operativeMode === true,
    annualLeaveSelfBook: permissions.annualLeaveSelfBook === true,
    annualLeaveEnabled: user.annualLeaveEnabled ?? null,
    formerUserIds: ids(user.formerUserIds),
    sameEmailUserIds: sameEmailUserIdsFor(user, users),
    assignedManagerUserIds: ids(user.assignedManagerUserIds),
    assignedManagerUserId: String(user.assignedManagerUserId ?? '').trim() || null,
    hasNoLineManager: user.hasNoLineManager === true,
  }
}

/** The organisation roster for the rules: one `rulebookPerson` per `users` row. */
export function rulebookRoster(users: ReadonlyArray<User>): RulebookPerson[] {
  const list = (users || []).filter((user) => user && user.id)
  return list.map((user) => rulebookPerson(user, list))
}

/** Every id the signed-in person goes by (`personIdSet`): their inbox owner ids. */
export function inboxOwnerIds(user: User | null | undefined, users: ReadonlyArray<User> = []): string[] {
  if (!user?.id) return []
  return personIdSet(rulebookPerson(user, users), rulebookRoster(users))
}

import type { WarningScopeRosterRow } from '@/lib/canonical'
import type { User } from '@/types'

/**
 * Web `User` rows as `warningScopeFor` reads them (rulebook 1.31.0 §5): ids, email, active flag, level flags and the
 * line-manager fields, with the roster fold's same-email ids (`userIdAliases`: duplicate id → kept id) on the person
 * kept, so the viewer's reports and their own ids are found under every users document.
 */
export function warningScopeRoster(
  users: ReadonlyArray<User>,
  userIdAliases?: Readonly<Record<string, string>> | null
): WarningScopeRosterRow[] {
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    role: user.role ?? null,
    isSuperAdmin: user.isSuperAdmin ?? null,
    adminAccess: user.permissions?.adminAccess ?? null,
    manager: user.permissions?.manager ?? null,
    operativeMode: user.permissions?.operativeMode ?? null,
    formerUserIds: user.formerUserIds ?? [],
    sameEmailUserIds: Object.entries(userIdAliases || {})
      .filter(([alias, kept]) => kept === user.id && alias !== user.id)
      .map(([alias]) => alias),
    assignedManagerUserIds: user.assignedManagerUserIds ?? null,
    assignedManagerUserId: user.assignedManagerUserId ?? null,
    hasNoLineManager: user.hasNoLineManager ?? null,
  }))
}

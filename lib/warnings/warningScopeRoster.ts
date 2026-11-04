import { WARNING_SCOPE_ALL, warningScopeFor, type JobAccessViewer, type WarningScope, type WarningScopeRosterRow } from '@/lib/canonical'
import type { Operative, Project, User } from '@/types'

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

/**
 * The viewer's warning scope (`warningScopeFor`, rulebook 1.31.0 §5): admins everything; a manager themselves, their
 * reports and the jobs they manage. The Warnings scan and Book labour both build it here, so the two unbooked lists
 * are identical for the same viewer. No viewer → everything.
 */
export function orgWarningScope(input: {
  viewer?: JobAccessViewer | null
  projects: ReadonlyArray<Pick<Project, 'id' | 'managerId' | 'managerIds' | 'managerUserIds'>>
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
  users: ReadonlyArray<User>
  userIdAliases?: Readonly<Record<string, string>> | null
  operatives: ReadonlyArray<Pick<Operative, 'id' | 'email'>>
  enforcedReads?: boolean
}): WarningScope {
  if (!input.viewer) return WARNING_SCOPE_ALL
  return warningScopeFor({
    viewer: input.viewer,
    jobs: input.projects.map((project) => ({
      id: project.id,
      managerId: project.managerId ?? null,
      managerIds: project.managerIds ?? [],
      managerUserIds: project.managerUserIds ?? [],
    })),
    managers: input.managers ?? null,
    roster: warningScopeRoster(input.users, input.userIdAliases),
    operatives: input.operatives.map((operative) => ({ id: operative.id, email: operative.email })),
    enforced: input.enforcedReads === true,
  })
}

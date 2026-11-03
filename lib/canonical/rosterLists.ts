/**
 * Rulebook 1.23.0 §11 (audit findings 9 and 20): which people list a person is on, and who counts as a manager or
 * admin when a double booking is split into a High (operative) or Medium (manager / admin) clash.
 *
 * Before 1.23.0 each app decided list membership itself: web put a user with no level flag on Operatives and kept
 * admins by role on Managers; iOS put that user on no list (unless a `managers` row placed them on Managers) and
 * left admins by role off Managers. Now one rule, the person's level (`permissionLevelOf`, §11), decides:
 *   - Admins: the admin level (super admin, `adminAccess`, or the `admin` / `super_admin` role).
 *   - Operatives: the operative level (operative mode, or the `operative` role with no admin flag).
 *   - Managers: everyone else — the manager flag, the `manager` role, and a user with no level flag at all (that
 *     person already reads as manager level everywhere else: their toggles, `lineManagerCandidates`, Change user type).
 * Every person is on exactly one list. A `managers` record never moves a person between lists: a person with no flag
 * is already on Managers, and the level (role) decides the rest.
 *
 * Pure, JSON in / JSON out.
 */

import { permissionLevelOf, storedPermissionFlag } from './permissionLevels'
import { idText } from './personIds'
import { rosterPeople, type RosterDocument } from './scheduleSources'
import { listedRosterUsers, type RosterSegmentProfile } from './userRosterSegment'

export type RosterListKind = 'admins' | 'managers' | 'operatives'

/** A `users` row as the people lists read it: the stored level fields plus the segment fields. */
export type RosterListRow = RosterSegmentProfile & {
  id: string
  role?: string | null
  isSuperAdmin?: boolean | null
  adminAccess?: boolean | null
  operativeMode?: boolean | null
  manager?: boolean | null
  permissions?: Record<string, unknown> | null
  /** Last write, for choosing which of two documents on one email is kept (`rosterPeople`). */
  updatedAtMs?: number | null
  formerUserIds?: ReadonlyArray<string> | null
}

/** The one people list this person is on (rulebook 1.23.0 §11): their level, `permissionLevelOf`. */
export function rosterListKind(row: RosterListRow | null | undefined): RosterListKind {
  const level = permissionLevelOf(row ?? {})
  if (level === 'admin') return 'admins'
  if (level === 'operative') return 'operatives'
  return 'managers'
}

function displayName(row: RosterListRow): string {
  return `${String(row.firstName ?? '').trim()} ${String(row.surname ?? row.lastName ?? '').trim()}`.trim()
}

/**
 * The people on the Operatives, Managers or Admins list (rulebook 1.23.0 §11): the rows whose `rosterListKind` is
 * `kind`, one per email (`rosterPeople` keeps the admin, signed-in, newest, active document), without identifiable
 * leftovers of a removed invite (`listedRosterUsers` with `claimedEmails`), sorted by first name and surname
 * (ignoring case), then id. Active / Inactive / Pending within the list stays `rosterSegment`.
 */
export function rosterListFor<T extends RosterListRow>(
  kind: RosterListKind,
  roster: ReadonlyArray<T> | null | undefined,
  claimedEmails?: ReadonlyArray<string> | null
): T[] {
  const inList = (roster || []).filter((row) => row && idText(row.id) && rosterListKind(row) === kind)
  const byId = new Map<string, T>()
  for (const row of inList) if (!byId.has(idText(row.id))) byId.set(idText(row.id), row)
  const docs: RosterDocument[] = inList.map((row) => ({
    id: idText(row.id),
    email: row.email ?? '',
    passwordSet: row.passwordSet ?? undefined,
    isActive: row.isActive ?? undefined,
    firstName: row.firstName ?? undefined,
    surname: row.surname ?? undefined,
    admin: kind === 'admins',
    listed: true,
    updatedAtMs: typeof row.updatedAtMs === 'number' ? row.updatedAtMs : null,
    formerUserIds: [...(row.formerUserIds || [])],
  }))
  const kept = rosterPeople(docs).people.flatMap((person) => {
    const row = byId.get(idText(person.id))
    return row ? [row] : []
  })
  return listedRosterUsers(kept, claimedEmails).sort(
    (a, b) =>
      displayName(a).localeCompare(displayName(b), 'en', { sensitivity: 'base' }) ||
      idText(a.id).localeCompare(idText(b.id))
  )
}

/**
 * Rulebook 1.23.0 §5 (audit finding 20): the roster ids whose double bookings are manager clashes (Medium,
 * `managerClashGroups`) rather than operative clashes (High, `operativeClashGroups`): active people (missing
 * `isActive` counts as active) at the admin level, or with the manager flag (stored top level or in `permissions`;
 * with neither stored, the `manager` role, as `effectivePermissions` reads it). This is the rule both apps already used
 * (web `isManagerOrAdminUser`, iOS `managerOrAdminUsers`: active and manager flag or admin), now written once; it is not the Managers list (a person with no flag is on Managers but
 * their clashes stay operative clashes). Ids keep their stored case, de-duplicated without case, in roster order.
 */
export function clashManagerIds(roster: ReadonlyArray<RosterListRow> | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of roster || []) {
    const id = idText(row?.id)
    if (!id || row.isActive === false) continue
    const manager =
      storedPermissionFlag(row, 'manager') ??
      (typeof row.role === 'string' && row.role.trim().toLowerCase() === 'manager')
    if (permissionLevelOf(row) !== 'admin' && manager !== true) continue
    if (seen.has(id.toLowerCase())) continue
    seen.add(id.toLowerCase())
    out.push(id)
  }
  return out
}

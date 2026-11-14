/**
 * Permission toggles by user level (rulebook §8, §11; 1.11.0, owner decisions round 3).
 *
 * One catalogue for every platform: which permission toggles a person has in effect, which are locked, and which rows
 * Manage Users shows on Add User, its summary and Edit User. Before 1.11.0 the three screens showed different sets
 * (iOS Add User hid Materials, Site audit and Wholesalers and saved them on silently; Edit User showed Wholesalers but
 * not Materials or Site audit) and an admin's stored toggles decided what the admin could open.
 *
 *   - Admins and super admins: every toggle in `USER_PERMISSION_FIELDS` reads on and is locked, Admin Access and
 *     Operatives included, whatever is stored — except the two self-manage toggles (1.28.0), Annual Leave Management
 *     (`annualLeaveSelfBook`) and Timesheet self-sign (`timesheetSelfSign`), which an admin's toggles can change. The
 *     Super Admin reads both on and locked (they may be the only admin). `operativeMode` reads off: an admin has no operative mode (only operative-level
 *     users get it, at setup). Existing user documents are never rewritten; the values are derived when read.
 *   - Managers: the stored toggles (defaults below), editable — except Materials and Site audit, always on and locked.
 *   - Operatives: the stored toggles; Materials and Site audit are the only rows.
 *
 * The annual leave allowance fields (`annualLeaveEnabled`, days per year, leave year, carry-over) are not permission
 * toggles; they stay editable for every level. Pure, JSON in / JSON out.
 */

import { USER_PERMISSION_FIELDS, type PermissionToggleDef, type UserPermissionField } from './userProfile'

export type PermissionLevel = 'admin' | 'manager' | 'operative'

/**
 * The permission toggles an admin can change (1.28.0, the self-manage toggles): Annual Leave Management and Timesheet
 * self-sign. Locked on for the Super Admin.
 */
export const ADMIN_EDITABLE_PERMISSION_FIELDS: ReadonlyArray<UserPermissionField> = ['annualLeaveSelfBook', 'timesheetSelfSign']

/**
 * Toggles that exist for admins only (1.28.0): never shown for a manager or operative, always read off for them, and
 * never written by a save at that level — the stored value stays underneath, so promoting back restores it.
 * 1.32.0 (owner decision 5 Nov): `weeklyReports` — the Weekly report is for admins and super admins only (locked on for
 * them); a manager's stored `weeklyReports: true` reads off and is never rewritten.
 */
export const ADMIN_ONLY_PERMISSION_FIELDS: ReadonlyArray<UserPermissionField> = ['timesheetSelfSign', 'weeklyReports']

/**
 * Toggles always on for a manager (and an admin), shown on and locked (owner decision, 1.11.0): Materials and Site
 * audit. They stay editable for operatives. Wholesalers is not one of them: a manager can genuinely have it off
 * (web `canAccessWholesalers` and iOS read the stored flag), so it stays an editable manager toggle.
 */
export const MANAGER_LOCKED_ON_PERMISSION_FIELDS: ReadonlyArray<UserPermissionField> = ['materials', 'siteAudit']

/** Toggles that read on when nothing is stored (both apps' readers, `parseUserDocument`, `ORG_MEMBERSHIP_DEFAULT_ON`). */
export const PERMISSION_DEFAULT_ON: ReadonlyArray<UserPermissionField> = [
  'materials',
  'siteAudit',
  'wholesalersOrderHistory',
  'dailyOverview',
]

/** Shown under a locked admin toggle. The level is changed with "Change user type". */
export const ADMIN_LOCKED_PERMISSION_MESSAGE = 'Administrators have this on. Change user type to remove admin access.'

/** 1.28.0: shown under the Super Admin's self-manage toggles (always on, locked). */
export const SUPER_ADMIN_SELF_MANAGE_MESSAGE =
  'The Super Admin always books their own leave and signs their own timesheet.'

/** 1.28.0: shown under the viewer's own self-manage toggles — nobody changes their own (rulebook §11). */
export const OWN_SELF_MANAGE_MESSAGE = 'You cannot change your own self-manage toggles. Ask another admin.'

/** 1.28.0: shown under a PAYE admin's Timesheet self-sign toggle (greyed out; PAYE has no My Timesheets). */
export const TIMESHEET_SELF_SIGN_PAYE_NOTE = 'Not used while PAYE — PAYE has no timesheets.'

function bool(value: unknown): boolean | null {
  if (value === true || value === false) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0
  if (typeof value === 'string') {
    const token = value.trim().toLowerCase()
    if (token === 'true' || token === 'yes' || token === '1') return true
    if (token === 'false' || token === 'no' || token === '0') return false
  }
  return null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** A stored flag: the top-level key, else `permissions.{key}`; null when neither is stored. */
export function storedPermissionFlag(user: unknown, key: string): boolean | null {
  const row = record(user)
  const top = bool(row[key])
  if (top != null) return top
  return bool(record(row.permissions)[key])
}

/**
 * Rulebook 1.31.0 §11 (audit finding 5): THE reader for a permission or level flag on a users document, a membership
 * or a roster row — the top-level value when one is stored (true / false, 1 / 0, "yes" / "no"), else `permissions.{key}`,
 * else off. Every rule reads flags through it (`effectivePermissions`, `permissionLevelOf`, the self-manage and
 * line-manager rules); firestore.rules `staffFlag` reads the same way. Before 1.31.0 the self-manage rules (and the
 * security rules) counted a flag on when it was on in EITHER place, while every screen read the top-level value first.
 */
export function userPermissionFlag(user: unknown, key: string): boolean {
  return storedPermissionFlag(user, key) === true
}

function roleToken(user: unknown): string {
  const role = record(user).role
  return typeof role === 'string' ? role.trim().toLowerCase().replace(/[\s-]/g, '_') : ''
}

/** The Super Admin: `organizationSuperAdmin` when given, else `isSuperAdmin` (top level or `permissions`) or the `super_admin` role. */
function storedSuperAdmin(user: unknown): boolean {
  // 1.28.0: `organizationSuperAdmin` (`isOrganizationSuperAdmin`: the creator of the organisation being worked in, or
  // its super admin users document) decides when given; otherwise the stored flag.
  const perOrganization = record(user).organizationSuperAdmin
  if (typeof perOrganization === 'boolean') return perOrganization
  const role = roleToken(user)
  return storedPermissionFlag(user, 'isSuperAdmin') === true || role === 'super_admin' || role === 'superadmin'
}

function storedPaye(user: unknown): boolean {
  const value = record(user).employmentType
  return typeof value === 'string' && value.trim().toLowerCase() === 'paye'
}

/**
 * The person's level from their stored flags: `admin` for a super admin, `adminAccess` (top level or
 * `permissions`) or the `admin` / `super_admin` role — a stray `operativeMode` flag never demotes an admin; then
 * `operative` for the operative-mode flag or the `operative` role; else `manager`.
 */
export function permissionLevelOf(user: unknown): PermissionLevel {
  const role = roleToken(user)
  if (
    storedPermissionFlag(user, 'isSuperAdmin') === true ||
    storedPermissionFlag(user, 'adminAccess') === true ||
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'superadmin'
  ) {
    return 'admin'
  }
  if (storedPermissionFlag(user, 'operativeMode') === true || role === 'operative') return 'operative'
  return 'manager'
}

/**
 * The toggles locked for this person (rulebook §11): for an admin every `USER_PERMISSION_FIELDS` key except the
 * self-manage toggles (`ADMIN_EDITABLE_PERMISSION_FIELDS`; Admin Access, Operatives and Operative mode included); for
 * the Super Admin every key (1.28.0: both self-manage toggles always on); for a manager Materials and Site audit
 * (`MANAGER_LOCKED_ON_PERMISSION_FIELDS`, always on) and the admin-only toggles (`ADMIN_ONLY_PERMISSION_FIELDS`,
 * always off); for an operative the admin-only toggles.
 * `level` overrides the level read from `user` (an Add User draft, a pending "Change user type").
 */
export function lockedPermissionFields(user: unknown, level?: PermissionLevel | null): UserPermissionField[] {
  const resolved = level ?? permissionLevelOf(user)
  if (resolved === 'manager') return [...MANAGER_LOCKED_ON_PERMISSION_FIELDS, ...ADMIN_ONLY_PERMISSION_FIELDS]
  if (resolved !== 'admin') return [...ADMIN_ONLY_PERMISSION_FIELDS]
  if (storedSuperAdmin(user)) return [...USER_PERMISSION_FIELDS]
  return USER_PERMISSION_FIELDS.filter((key) => !ADMIN_EDITABLE_PERMISSION_FIELDS.includes(key))
}

/**
 * The toggles in effect for this person — the values every permission check reads (rulebook §8, §11, 1.11.0):
 *   - admin: every toggle true except `operativeMode` (false) and the self-manage toggles `annualLeaveSelfBook` and
 *     `timesheetSelfSign` (stored, else false); the Super Admin reads both self-manage toggles true (1.28.0);
 *   - operative: stored values; `operativeMode` true; `adminAccess`, `manager`, `operatives`, `qualifications` off;
 *     `projects` / `smallWorks` on (their bookings' jobs); `materials` stored, else off; `siteAudit` stored, else on;
 *   - manager level: stored values, `PERMISSION_DEFAULT_ON` on when not stored, the rest off; Materials and Site
 *     audit always on; `manager` stored, else the `manager` role; `adminAccess` and `operativeMode` false.
 *   - manager and operative: `timesheetSelfSign` false (admins only, 1.28.0) whatever is stored — a demoted admin's
 *     stored value stays underneath and reads again after a promotion.
 * `skills` is retired (the skills catalogue is not managed in the apps): false except for an admin.
 */
export function effectivePermissions(
  user: unknown,
  level?: PermissionLevel | null
): Record<UserPermissionField, boolean> {
  const resolved = level ?? permissionLevelOf(user)
  const out = {} as Record<UserPermissionField, boolean>
  const stored = (key: UserPermissionField, fallback: boolean) => storedPermissionFlag(user, key) ?? fallback
  if (resolved === 'admin') {
    for (const key of USER_PERMISSION_FIELDS) out[key] = true
    out.operativeMode = false
    const superAdmin = storedSuperAdmin(user)
    out.annualLeaveSelfBook = superAdmin || stored('annualLeaveSelfBook', false)
    out.timesheetSelfSign = superAdmin || stored('timesheetSelfSign', false)
    return out
  }
  for (const key of USER_PERMISSION_FIELDS) out[key] = stored(key, PERMISSION_DEFAULT_ON.includes(key))
  out.skills = false
  out.adminAccess = false
  for (const key of ADMIN_ONLY_PERMISSION_FIELDS) out[key] = false
  if (resolved === 'operative') {
    out.operativeMode = true
    out.manager = false
    out.operatives = false
    out.qualifications = false
    out.materials = stored('materials', false)
    out.projects = true
    out.smallWorks = true
    return out
  }
  out.operativeMode = false
  out.manager = stored('manager', roleToken(user) === 'manager')
  for (const key of MANAGER_LOCKED_ON_PERMISSION_FIELDS) out[key] = true
  return out
}

/**
 * 1.32.0 (owner decision 5 Nov): who may open the Weekly report — admins and super admins only (outside operative mode;
 * an admin has none, 1.11.0). Read from the level, so a promotion gives it and a demotion takes it away; a manager's
 * stored `weeklyReports` is ignored. Every way in (menu, Home tile, quick action, deep link, help link, the page itself)
 * asks this.
 */
export function canOpenWeeklyReport(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  if ((user as { isActive?: unknown }).isActive === false) return false
  return permissionLevelOf(user) === 'admin' && effectivePermissions(user).weeklyReports === true
}

/** One permission value in effect (`effectivePermissions(user)[key]`). */
export function effectivePermission(user: unknown, key: UserPermissionField): boolean {
  return effectivePermissions(user)[key] === true
}

/**
 * A save of `users/{uid}` (or an invitation / membership `permissions`) for an admin never writes a locked toggle to
 * a value other than its effective one (rulebook §11): returns `fields` without top-level `{key}`, dotted
 * `permissions.{key}` and `permissions` map entries that would do so. Removing a locked key is allowed (it still
 * reads on). For a manager or operative `fields` comes back unchanged.
 */
export function withoutLockedPermissionWrites<T extends Record<string, unknown>>(
  user: unknown,
  fields: T,
  level?: PermissionLevel | null
): T {
  const locked = lockedPermissionFields(user, level)
  if (locked.length === 0) return fields
  const effective = effectivePermissions(user, level)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields || {})) {
    const dotted = key.startsWith('permissions.') ? key.slice('permissions.'.length) : null
    const field = (dotted ?? key) as UserPermissionField
    if (locked.includes(field) && (dotted != null || key === field) && typeof value === 'boolean' && value !== effective[field]) {
      continue
    }
    if (key === 'permissions' && value && typeof value === 'object' && !Array.isArray(value)) {
      const map: Record<string, unknown> = {}
      for (const [inner, flag] of Object.entries(value as Record<string, unknown>)) {
        const innerField = inner as UserPermissionField
        if (locked.includes(innerField) && typeof flag === 'boolean' && flag !== effective[innerField]) continue
        map[inner] = flag
      }
      out[key] = map
      continue
    }
    out[key] = value
  }
  return out as T
}

/**
 * `next` for a `users/{uid}` update (`userProfileWriteFields`, rulebook §11, 1.11.0) with locked toggles left as
 * stored: when the stored person (`before`) keeps their level, a toggle locked for that level
 * (`lockedPermissionFields`) is never written — not at the top level, and inside a `permissions` map its stored value
 * (or nothing) is kept — so a save never writes a locked toggle false and never rewrites stored toggles. Changing the
 * level ("Change user type") is not stripped, except (1.28.0) that a change away from admin never writes the
 * admin-only toggles (`ADMIN_ONLY_PERMISSION_FIELDS`). The Super Admin's self-manage toggles are locked (read on), so
 * a save never stores the derived on values.
 */
export function keepStoredLockedPermissions(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): Record<string, unknown> {
  if (!before || !next || typeof next !== 'object') return next
  const level = permissionLevelOf(before)
  const nextLevel = permissionLevelOf({ ...before, ...next })
  // 1.28.0: a level change leaving admin never writes the admin-only toggles (Timesheet self-sign reads off for the
  // new level; the stored value stays underneath and reads again after a promotion back).
  const locked =
    nextLevel !== level
      ? nextLevel === 'admin'
        ? []
        : [...ADMIN_ONLY_PERMISSION_FIELDS]
      : lockedPermissionFields(before, level)
  if (locked.length === 0) return next
  const out: Record<string, unknown> = { ...next }
  for (const key of locked) {
    if (key === 'adminAccess') continue
    delete out[key]
    delete out[`permissions.${key}`]
  }
  const map = out.permissions
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    const stored = record(before.permissions)
    const kept: Record<string, unknown> = { ...(map as Record<string, unknown>) }
    for (const key of locked) {
      if (stored[key] !== undefined) kept[key] = stored[key]
      else delete kept[key]
    }
    out.permissions = kept
  }
  return out
}

// MARK: - Manage Users rows (Add User, its summary, Edit User)

export type PermissionToggleMode = 'add' | 'edit' | 'summary'

export type PermissionToggleRow = {
  field: UserPermissionField
  label: string
  help: string
  /** Shown on this screen for this level. */
  visible: boolean
  /** The switch can be changed (false: shown on and greyed out, or not shown). */
  editable: boolean
  /** On or off: the person's effective value, or the level's Add User default. */
  value: boolean
  /**
   * 1.28.0: why a visible row is greyed out when it is not the level lock — `SUPER_ADMIN_SELF_MANAGE_MESSAGE` for the
   * Super Admin's self-manage toggles, `TIMESHEET_SELF_SIGN_PAYE_NOTE` for a PAYE admin's Timesheet self-sign. Null
   * otherwise (a screen shows its usual locked copy).
   */
  note: string | null
}

/** 1.42.0 §11: the Projects toggle's row text (`PERMISSION_TOGGLE_CATALOGUE`), shown by both apps. */
export const PROJECTS_TOGGLE_LABEL = 'Projects — add & edit'
export const PROJECTS_TOGGLE_HELP =
  'Add new projects, edit any project and choose its managers. Without this, a manager still sees every project and can edit the projects they manage.'
/** 1.42.0 §11: the Small works toggle's row text (`PERMISSION_TOGGLE_CATALOGUE`), shown by both apps. */
export const SMALL_WORKS_TOGGLE_LABEL = 'Small Works — add & edit'
export const SMALL_WORKS_TOGGLE_HELP =
  'Add new small works, edit any small works job and choose its managers. Without this, a manager still sees every small works job and can edit the small works they manage.'

type CatalogueRow = { field: UserPermissionField; label: string; help: string; levels: ReadonlyArray<PermissionLevel> }

/**
 * Every Manage Users permission row, in the order both apps show them (iOS Edit User order, then Materials and Site
 * audit). `operativeMode` and `skills` are never rows: operative mode is the level, chosen with the account type.
 */
export const PERMISSION_TOGGLE_CATALOGUE: ReadonlyArray<CatalogueRow> = [
  { field: 'adminAccess', label: 'Admin Access', help: 'Gives Manage Users and organisation settings. Change user type to give or remove it.', levels: ['admin'] },
  // 1.42.0 (owner decision 13 Nov, option B): the Projects / Small works toggle is an add-and-edit permission, never a
  // view permission — every manager sees every job (§17, 1.33.0). With it a manager adds jobs of that kind, edits any
  // job of that kind and changes its managers (`canCreateJob`, `canChangeJobManagers`, `canEditJob`); without it they
  // still edit the details of the jobs they manage. Bookings are `canWriteBooking` either way.
  { field: 'projects', label: PROJECTS_TOGGLE_LABEL, help: PROJECTS_TOGGLE_HELP, levels: ['admin', 'manager'] },
  { field: 'smallWorks', label: SMALL_WORKS_TOGGLE_LABEL, help: SMALL_WORKS_TOGGLE_HELP, levels: ['admin', 'manager'] },
  { field: 'weeklyReports', label: 'Weekly Report', help: 'Admins and super admins open the Weekly report; it is not offered to managers.', levels: ['admin'] },
  { field: 'dailyOverview', label: 'Daily Overview', help: 'Can open Daily Overview from Home. If off, that tile is hidden.', levels: ['admin', 'manager'] },
  {
    field: 'subContractors',
    label: 'Sub Contractors',
    help: 'Can add and manage sub contractor records. If off, Sub Contractors is hidden on Home and menus. They can still book existing subcontractors on jobs.',
    levels: ['admin', 'manager'],
  },
  {
    field: 'annualLeaveSelfBook',
    label: 'Annual Leave Management',
    help: 'Can book their own annual leave. If off, this user requests leave for approval.',
    levels: ['admin', 'manager'],
  },
  {
    field: 'timesheetSelfSign',
    label: 'Timesheet self-sign',
    help: "Sign your own timesheet and generate the invoice without a line manager's signature.",
    levels: ['admin'],
  },
  {
    field: 'operatives',
    label: 'Operatives',
    help:
      'Can add and manage operatives and view their details. If off, they can still schedule active operatives onto the jobs they manage, but do not see Manage Operatives or full operative profiles.',
    levels: ['admin', 'manager'],
  },
  {
    field: 'qualifications',
    label: 'Manage Qualifications',
    help: 'Can add and edit organisation qualification templates. If off, they see My Qualifications and can still assign templates others have added.',
    levels: ['admin', 'manager'],
  },
  {
    field: 'wholesalersOrderHistory',
    label: 'Wholesalers',
    help: 'Can view and manage the Wholesalers page, including quote and order history. If off, that page is not available.',
    levels: ['admin', 'manager'],
  },
  {
    field: 'materials',
    label: 'Materials',
    help: 'Can open material lists on projects and small works. Operatives cannot send quotes or place orders.',
    levels: ['admin', 'manager', 'operative'],
  },
  { field: 'siteAudit', label: 'Site audit', help: 'Can view and submit site audits.', levels: ['admin', 'manager', 'operative'] },
]

/**
 * What Add User starts with for each level (rulebook §11, 1.14.0): **every toggle the adder can change starts off**
 * — the rows `permissionToggleRows` shows for that level and does not lock — and the adder turns them on one by one.
 * Locked toggles keep their locked value: an admin has every toggle on and locked except the self-manage toggles
 * (Annual Leave Management, Timesheet self-sign; 1.28.0), which start off; a manager has Materials and Site audit locked on. Flags that are not toggles keep the
 * level's value (`manager` true for a manager, `operativeMode` true and `projects` / `smallWorks` on for an operative).
 * Only for a new person: changing an existing person's user type never resets their saved toggles
 * (`accountTypePermissions`).
 */
export function addUserPermissionDefaults(level: PermissionLevel): Record<UserPermissionField, boolean> {
  const resolved: PermissionLevel = level === 'admin' || level === 'operative' ? level : 'manager'
  const out =
    resolved === 'admin'
      ? effectivePermissions({}, 'admin')
      : resolved === 'operative'
        ? effectivePermissions({}, 'operative')
        : effectivePermissions({ manager: true }, 'manager')
  const locked = new Set(lockedPermissionFields({}, resolved))
  for (const row of PERMISSION_TOGGLE_CATALOGUE) {
    if (!row.levels.includes(resolved) || locked.has(row.field)) continue
    out[row.field] = false
  }
  return out
}

/**
 * The Manage Users permission rows (rulebook §11, 1.11.0): one ordered list used by Add User (`add`), its summary
 * (`summary`) and Edit User (`edit`) on every platform, so the three never show different sets.
 *   - `admin`: every row visible, on and locked except the self-manage toggles (Annual Leave Management, Timesheet
 *     self-sign; 1.28.0). The Super Admin's self-manage rows are on and locked (`note` SUPER_ADMIN_SELF_MANAGE_MESSAGE);
 *     a PAYE admin's Timesheet self-sign row is shown greyed out (`note` TIMESHEET_SELF_SIGN_PAYE_NOTE, not editable);
 *     with `viewerIsSubject` the viewer's own self-manage rows are not editable (`note` OWN_SELF_MANAGE_MESSAGE).
 *   - `manager`: every row except Admin Access and Timesheet self-sign (admins only); Materials and Site audit on and locked, the rest editable (Wholesalers
 *     included).
 *   - `operative`: Materials and Site audit only.
 * `value` is `effectivePermissions(user, level)` when `user` is given (Edit User, or the Add User draft), else the
 * level's Add User default. `summary` rows are never editable. Rows not visible are still returned (`visible`
 * false) so a screen can list what is off.
 */
export function permissionToggleRows(input: {
  level: PermissionLevel
  user?: unknown
  mode: PermissionToggleMode
  /** 1.28.0: the viewer is this person — their own self-manage rows are not editable (`OWN_SELF_MANAGE_MESSAGE`). */
  viewerIsSubject?: boolean | null
}): PermissionToggleRow[] {
  const level: PermissionLevel = input?.level === 'admin' || input?.level === 'operative' ? input.level : 'manager'
  const values = input?.user != null ? effectivePermissions(input.user, level) : addUserPermissionDefaults(level)
  const locked = lockedPermissionFields(input?.user ?? {}, level)
  const superAdmin = level === 'admin' && storedSuperAdmin(input?.user)
  const paye = storedPaye(input?.user)
  return PERMISSION_TOGGLE_CATALOGUE.map((row) => {
    const visible = row.levels.includes(level)
    const selfManage = level === 'admin' && ADMIN_EDITABLE_PERMISSION_FIELDS.includes(row.field)
    const payeTimesheet = level === 'admin' && row.field === 'timesheetSelfSign' && paye && !superAdmin
    const own = selfManage && input?.viewerIsSubject === true && !superAdmin
    const note =
      selfManage && superAdmin
        ? SUPER_ADMIN_SELF_MANAGE_MESSAGE
        : payeTimesheet
          ? TIMESHEET_SELF_SIGN_PAYE_NOTE
          : own
            ? OWN_SELF_MANAGE_MESSAGE
            : null
    return {
      field: row.field,
      label: row.label,
      help: row.help,
      visible,
      editable: visible && input?.mode !== 'summary' && !locked.includes(row.field) && !payeTimesheet && !own,
      value: values[row.field] === true,
      note,
    }
  })
}

/**
 * The `permissions` map a save writes for this level (Add User invitation and placeholder, Edit User): the
 * effective values of `draft` for `level`, every key of `USER_PERMISSION_FIELDS`. An admin's locked toggles are on and
 * `operativeMode` off whatever the draft says.
 */
export function permissionsWriteMap(draft: unknown, level: PermissionLevel): Record<UserPermissionField, boolean> {
  return effectivePermissions(draft, level)
}

/** Shown beside a pay rate on a PAYE person's Add User summary and Edit User (§8): PAYE days pay 0. */
export const PAYE_RATE_NOT_USED_NOTE = 'Not used while PAYE. Kept for days they are self-employed.'

// MARK: - Operatives toggle (owner decision round 3)

/**
 * Add operatives, open Manage Operatives and full operative profiles, and change an operative's pay: an admin or
 * super admin (Operatives is locked on for them), or a manager with the Operatives toggle. Never an operative.
 */
export function canManageOperatives(user: unknown): boolean {
  const level = permissionLevelOf(user)
  if (level === 'operative') return false
  return effectivePermissions(user, level).operatives === true
}

/**
 * Schedule an operative onto a job: every admin and manager whatever the Operatives toggle — they see every live
 * active operative in scheduling pickers (`listedCurrentLabourPeople`) — but a manager only on the jobs they manage
 * (`canWriteBooking`). Never an operative.
 */
export function canScheduleOperatives(user: unknown): boolean {
  return permissionLevelOf(user) !== 'operative'
}

/** Manager and admin rows of `PERMISSION_TOGGLE_CATALOGUE` as `{ key, title, description }` (older call sites). */
export const MANAGER_PERMISSION_TOGGLES: PermissionToggleDef[] = PERMISSION_TOGGLE_CATALOGUE.filter((row) =>
  row.levels.includes('admin')
).map((row) => ({ key: row.field, title: row.label, description: row.help }))

/** Operative rows of `PERMISSION_TOGGLE_CATALOGUE` (Materials, Site audit). */
export const OPERATIVE_PERMISSION_TOGGLES: PermissionToggleDef[] = PERMISSION_TOGGLE_CATALOGUE.filter((row) =>
  row.levels.includes('operative')
).map((row) => ({ key: row.field, title: row.label, description: row.help }))

// MARK: - Change user type (1.11.0)

/**
 * The toggles a person gets when "Change user type" moves them to `kind` (rulebook §11; 1.11.0 presets, **1.15.0 owner
 * decision round 6: a type change keeps every saved toggle**). Before 1.15.0 a change kept Projects, Small Works, Weekly
 * Report and Daily Overview and preset the rest, so manager → admin → manager lost the person's toggles.
 *   - Every toggle keeps its stored value (top level, else `permissions.{key}`; `storedPermissionFlag`); a toggle never
 *     stored keeps the value it reads as (`PERMISSION_DEFAULT_ON`, else off).
 *   - Only the level flags change: admin `adminAccess` on, `operativeMode` off, `manager` on; manager `adminAccess`
 *     off, `operativeMode` off, `manager` on; operative `adminAccess` off, `operativeMode` on, `manager` off.
 * An admin still reads every toggle on and locked except the self-manage toggles (`effectivePermissions`); the stored
 * values stay underneath and read again after a demotion. Timesheet self-sign (admins only) reads off after a demotion
 * and its stored value is kept, so a promotion back restores it (1.28.0). Returns every `USER_PERMISSION_FIELDS` key.
 */
export function accountTypePermissions(
  kind: PermissionLevel,
  previous?: unknown
): Record<UserPermissionField, boolean> {
  const out = {} as Record<UserPermissionField, boolean>
  for (const key of USER_PERMISSION_FIELDS) {
    out[key] = storedPermissionFlag(previous, key) ?? PERMISSION_DEFAULT_ON.includes(key)
  }
  // 1.31.0 (owner decision): a demoted admin keeps Annual Leave Management as they had it — the value they read as an
  // admin (the Super Admin reads it on), never a reset.
  if (permissionLevelOf(previous) === 'admin' && storedPermissionFlag(previous, 'annualLeaveSelfBook') == null) {
    out.annualLeaveSelfBook = storedSuperAdmin(previous)
  }
  out.adminAccess = kind === 'admin'
  out.operativeMode = kind === 'operative'
  out.manager = kind !== 'operative'
  return out
}

/**
 * The toggles a "Change user type" save writes (1.15.0): the stored toggles (`accountTypePermissions(kind, person)`),
 * then the screen's values only for the toggles the new level can change (`permissionToggleRows` editable: an admin
 * only Annual Leave Management; a manager every row but Admin Access, Materials and Site audit; an operative Materials
 * and Site audit). A screen that shows an admin's toggles all on can never write them over the stored values.
 */
export function accountTypeWritePermissions(
  kind: PermissionLevel,
  person: unknown,
  screen?: Record<string, unknown> | null
): Record<UserPermissionField, boolean> {
  const out = accountTypePermissions(kind, person)
  if (!screen || typeof screen !== 'object') return out
  const locked = new Set(lockedPermissionFields({}, kind))
  for (const row of PERMISSION_TOGGLE_CATALOGUE) {
    if (!row.levels.includes(kind) || locked.has(row.field)) continue
    const value = bool(screen[row.field])
    if (value != null) out[row.field] = value
  }
  return out
}

/**
 * Shown when the person's profile belongs to another company: their type here changes (membership and members entry),
 * their profile there does not.
 */
export const ACCOUNT_TYPE_OTHER_COMPANY_NOTE =
  "This person's profile belongs to another company. Their user type changes here only; their profile in the other company is not changed."
export const ACCOUNT_TYPE_SUPER_ADMIN_MESSAGE =
  'The Super Admin stays an administrator. Pass Super Admin to another admin first (Change Super Admin).'

export type AccountTypeChangeWrite =
  | { path: string; kind: 'userProfile'; fields: Record<string, unknown> }
  | { path: string; kind: 'organizationMember'; fields: Record<string, unknown> }
  | { path: string; kind: 'membership'; role: string; permissions: Record<UserPermissionField, boolean> }

function sameOrg(value: unknown, organizationId: string): boolean {
  const raw = typeof value === 'string' ? value.trim() : ''
  const id = raw.includes('/') ? raw.split('/').filter(Boolean).pop() ?? '' : raw
  return id !== '' && id.toLowerCase() === organizationId.trim().toLowerCase()
}

/**
 * Every write that changes a person's user type in one organisation (rulebook §11, §14; 1.11.0). Before 1.11.0 web
 * wrote only `users/{uid}`, so `members.{uid}` and the membership kept the old role and the next sign-in or organisation
 * switch put the old level back. One plan for both apps, written as one batch:
 *   1. `users/{uid}`: `role`, the level flags and every toggle (top level and `permissions.{key}`) from
 *      `accountTypeWritePermissions(kind, person, permissions)` — every stored toggle kept (1.15.0), the screen's
 *      values only for toggles the new level can change; `isSuperAdmin` false unless the person stays an admin — only
 *      when that document's `organizationId` is this organisation;
 *   2. every same-email users document whose `organizationId` is this organisation, the same fields;
 *   3. `organizations/{orgId}` `members.{uid}` = the role — always;
 *   4. `users/{uid}/orgMemberships/{orgId}` role and nested permissions (`orgMembershipWriteFields` shape; an admin
 *      write, created when missing) — always.
 * When the person's `users/{uid}.organizationId` is another company, steps 1–2 for that document are left out (it is
 * not this organisation's to rewrite; their level here is read from the membership and members entry,
 * `organizationLevelFor`) and `note` is `ACCOUNT_TYPE_OTHER_COMPANY_NOTE`. Refused (`super_admin`) when a super admin
 * would stop being an admin. Only admins and super admins of the organisation may run it (security rules).
 */
export function accountTypeChangeWrites(input: {
  person: Record<string, unknown> & { id: string }
  kind: PermissionLevel
  organizationId: string
  roster?: ReadonlyArray<Record<string, unknown> & { id: string }> | null
  /**
   * The toggles the admin set on the Change user type screen: only those the new level can change are taken
   * (`accountTypeWritePermissions`); every other toggle keeps its stored value (1.15.0).
   */
  permissions?: Record<string, unknown> | null
  /** 1.31.0: `organizations/{orgId}.members` as loaded — same-email documents listed there get the new role too. */
  members?: Record<string, unknown> | null
}):
  | { ok: true; role: PermissionLevel; permissions: Record<UserPermissionField, boolean>; writes: AccountTypeChangeWrite[]; note: string | null }
  | { ok: false; reason: 'super_admin' | 'invalid'; message: string } {
  const person = input?.person
  const org = typeof input?.organizationId === 'string' ? input.organizationId.trim() : ''
  const uid = typeof person?.id === 'string' ? person.id.trim() : ''
  const kind = input?.kind
  if (!person || !uid || !org || (kind !== 'admin' && kind !== 'manager' && kind !== 'operative')) {
    return { ok: false, reason: 'invalid', message: 'Choose a user type.' }
  }
  const otherCompany =
    person.organizationId != null && String(person.organizationId).trim() !== '' && !sameOrg(person.organizationId, org)
  if (storedPermissionFlag(person, 'isSuperAdmin') === true && kind !== 'admin') {
    return { ok: false, reason: 'super_admin', message: ACCOUNT_TYPE_SUPER_ADMIN_MESSAGE }
  }
  const permissions = accountTypeWritePermissions(kind, person, input.permissions ?? null)
  // 1.31.0 (audit finding 9): only the fields whose stored value differs are written (top level and
  // `permissions.{key}` each compared with what is stored), so a type change never writes back a toggle another admin
  // changed since — the level flags and `role` always differ or are resent. `person` is the stored document.
  const storedMap = person.permissions && typeof person.permissions === 'object' ? (person.permissions as Record<string, unknown>) : {}
  const levelFlags = new Set<string>(['adminAccess', 'operativeMode', 'manager'])
  const fields: Record<string, unknown> = { role: kind }
  for (const key of USER_PERMISSION_FIELDS) {
    if (levelFlags.has(key) || bool(person[key]) !== permissions[key]) fields[key] = permissions[key]
    if (levelFlags.has(key) || bool(storedMap[key]) !== permissions[key]) fields[`permissions.${key}`] = permissions[key]
  }
  fields.isSuperAdmin = kind === 'admin' && storedPermissionFlag(person, 'isSuperAdmin') === true
  // 1.31.0: "No line manager" is for admins only — leaving admin clears it (the person then needs a line manager).
  if (kind !== 'admin' && person.hasNoLineManager === true) fields.hasNoLineManager = false
  const writes: AccountTypeChangeWrite[] = otherCompany ? [] : [{ path: `users/${uid}`, kind: 'userProfile', fields }]
  // Same-email documents: the level only (their stored toggles are their own and are not loaded here).
  const levelOnly: Record<string, unknown> = { role: kind, isSuperAdmin: false }
  for (const key of levelFlags) {
    levelOnly[key] = permissions[key as UserPermissionField]
    levelOnly[`permissions.${key}`] = permissions[key as UserPermissionField]
  }
  if (kind !== 'admin') levelOnly.hasNoLineManager = false
  const members = input.members && typeof input.members === 'object' ? input.members : null
  const memberFields: Record<string, unknown> = { [`members.${uid}`]: kind }
  const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : ''
  if (email) {
    for (const row of input.roster || []) {
      const id = typeof row?.id === 'string' ? row.id.trim() : ''
      if (!id || id === uid) continue
      if (String(row.email ?? '').trim().toLowerCase() !== email) continue
      if (!sameOrg(row.organizationId, org)) continue
      writes.push({ path: `users/${id}`, kind: 'userProfile', fields: { ...levelOnly } })
      // 1.31.0 (audit finding 3): a same-email document already listed in `members` gets the same role, so the roster
      // never shows a half-applied type for the document the email fold keeps. Never adds a new members entry.
      const listedKey = members ? Object.keys(members).find((key) => key.trim().toLowerCase() === id.toLowerCase()) : undefined
      if (listedKey && !listedKey.includes('.')) memberFields[`members.${listedKey}`] = kind
    }
  }
  writes.push({ path: `organizations/${org}`, kind: 'organizationMember', fields: memberFields })
  writes.push({ path: `users/${uid}/orgMemberships/${org}`, kind: 'membership', role: kind, permissions })
  return { ok: true, role: kind, permissions, writes, note: otherCompany ? ACCOUNT_TYPE_OTHER_COMPANY_NOTE : null }
}

// MARK: - Half-applied user type (1.12.2)

/** Shown in Manage Users and Edit User when the user type is not the same on every document that decides it. */
export const ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE =
  "This person's user type was only partly saved. Press Save to finish it on every record."

/**
 * Whether a person's user type is the same on every document that decides it in one organisation (rulebook §11,
 * 1.12.2). A change made by an older iOS build (it wrote only `users/{uid}`) or a save interrupted after the profile
 * write leaves `organizations/{orgId}.members.{uid}` (and the membership) on the old type; the security rules read the
 * members entry, so the person may still be an admin there while every screen shows a manager.
 *
 * The users document of this organisation is the source (it is what both apps show and edit). Out of sync when:
 *   - the members entry is `admin` and the profile is not an admin, or the profile is an admin and the members entry
 *     is not `admin` (or missing);
 *   - the members entry is `manager` or `operative` and differs from the profile's level;
 *   - a membership is given and its `role` is `admin` / `manager` / `operative` and differs from the profile's level.
 * A `member` entry (older data, any non-admin level) only counts for the admin test. A profile of another company is
 * never judged (its level here is the members entry, `organizationLevelFor`). `repair` is the level to re-apply with
 * `accountTypeChangeWrites`, else null.
 */
export function accountTypeSyncState(input: {
  person: Record<string, unknown> & { id: string }
  organizationId: string
  members?: Record<string, unknown> | null
  membership?: Record<string, unknown> | null
}): { inSync: boolean; level: PermissionLevel | null; membersRole: string | null; repair: PermissionLevel | null } {
  const person = input?.person
  const org = typeof input?.organizationId === 'string' ? input.organizationId.trim() : ''
  const uid = typeof person?.id === 'string' ? person.id.trim() : ''
  if (!person || !uid || !org || !sameOrg(person.organizationId, org)) {
    return { inSync: true, level: null, membersRole: null, repair: null }
  }
  const level = permissionLevelOf(person)
  const members = input.members && typeof input.members === 'object' ? input.members : {}
  const rawEntry = Object.entries(members).find(([key]) => key.trim().toLowerCase() === uid.toLowerCase())?.[1]
  const membersRole = typeof rawEntry === 'string' && rawEntry.trim() ? rawEntry.trim().toLowerCase() : null
  const explicit = (role: string | null) => role === 'admin' || role === 'manager' || role === 'operative'
  let inSync = (membersRole === 'admin') === (level === 'admin')
  if (inSync && explicit(membersRole) && membersRole !== level) inSync = false
  const membershipRole =
    input.membership && typeof input.membership.role === 'string' ? input.membership.role.trim().toLowerCase() : null
  if (inSync && explicit(membershipRole) && membershipRole !== level) inSync = false
  return { inSync, level, membersRole, repair: inSync ? null : level }
}

/**
 * Shared user document: the fields both apps read and write on `users/{uid}`,
 * when PAYE ↔ self-employed takes effect, and the permission toggles shown
 * on Edit User.
 *
 * Screens stay in each app. The document shape and the employment-day rule
 * must not be calculated twice.
 */

import { dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'

export const EMPLOYMENT_TYPES = ['paye', 'self_employed'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export type AccountKind = 'operative' | 'manager' | 'admin'

export type AccountFlags = {
  isSuperAdmin?: boolean
  role?: string | null
  adminAccess?: boolean
  manager?: boolean
  operativeMode?: boolean
}

/**
 * Firestore keys on `users/{uid}` that both apps must keep in sync.
 * A platform that writes a subset must not delete the others.
 */
export const USER_DOCUMENT_FIELDS = [
  'firstName',
  'surname',
  'email',
  'mobileNumber',
  'role',
  'isActive',
  'passwordSet',
  'status',
  'isSuperAdmin',
  'organizationId',
  'permissions',
  'assignedManagerUserId',
  'assignedManagerUserIds',
  'hasNoLineManager',
  'dayRate',
  'hourlyRate',
  'payBasis',
  'tradeTypePreset',
  'tradeTypeCustom',
  'employmentType',
  'employmentTypeTransitionFrom',
  'employmentTypeEffectiveAt',
  'annualLeaveEnabled',
  'annualLeaveDaysPerYear',
  'annualLeaveYearStartMonth',
  'annualLeaveYearEndMonth',
  'annualLeaveCarriesOver',
  'employmentStartDate',
  'annualLeaveYearAllowance',
  'annualLeaveYearAllowanceKey',
  'timesheetsEnabled',
  // vatNumber and utrNumber live at users/{uid}/private/taxIds (sensitiveProfile.ts).
  'lastSeenAt',
  'profilePhotoURL',
  // Set with the new download URL on every photo upload; devices refresh the cached avatar when it changes.
  'profilePhotoUpdatedAt',
  'pushTokens',
  'pushTokenUpdatedAt',
  'notificationPreferences',
  'formerUserIds',
  // Rulebook 1.31.1 (F5): the invitation an account was created from (written once, with the invitation marked used in
  // the same batch); the security rules accept a placeholder copy only with it.
  'invitationId',
  // Rulebook 1.34.0 (§11): a ghost operative (bookable, no app login) and, on a converted operatives row, the email kept
  // aside for "Give app access". Accepting an invitation never copies either onto the account.
  'ghost',
  'inviteEmailHint',
] as const

/**
 * `users/{authUid}.formerUserIds`: invite placeholder ids this account used
 * before sign-up. Bookings, leave, and warning exclusions saved under a
 * placeholder stay with the person after the placeholder document is deleted.
 */
export const USER_FORMER_IDS_FIELD = 'formerUserIds'

/** Read `formerUserIds` as a clean id list. */
export function parseFormerUserIds(data: Record<string, unknown> | null | undefined): string[] {
  const raw = data?.[USER_FORMER_IDS_FIELD]
  if (!Array.isArray(raw)) return []
  const ids = new Set<string>()
  for (const value of raw) {
    const id = typeof value === 'string' ? value.trim() : ''
    if (id) ids.add(id)
  }
  return [...ids]
}

/**
 * Fields to write on `users/{authUid}` when an invite placeholder is copied onto it.
 * Keeps every id already recorded and adds the placeholder id. Writing the
 * account's own id, or a blank id, changes nothing.
 */
export function inviteMigrationFormerIdWriteFields(input: {
  placeholderId: string | null | undefined
  authUid: string
  existing?: Record<string, unknown> | null
}): Record<string, string[]> {
  const ids = parseFormerUserIds(input.existing)
  const placeholder = String(input.placeholderId || '').trim()
  if (placeholder && placeholder !== input.authUid.trim() && !ids.includes(placeholder)) ids.push(placeholder)
  return ids.length > 0 ? { [USER_FORMER_IDS_FIELD]: ids } : {}
}

/**
 * Self-create only (`request.auth.uid == userId`). Admin/manager invite
 * placeholders must omit these — Path 2/4 in firestore.rules do not require them.
 */
export const USER_SELF_CREATE_AGE_FIELDS = [
  'ageConfirmed',
  'ageConfirmedAt',
  'ageConfirmedYears',
] as const

/**
 * Age confirmation is required only when the signed-in user is creating
 * `users/{their uid}`. An admin invite of a different placeholder id is not
 * self-create.
 */
export function userCreateRequiresAgeConfirmation(input: {
  creatorUserId?: string | null
  targetUserId?: string | null
}): boolean {
  const creator = typeof input.creatorUserId === 'string' ? input.creatorUserId.trim() : ''
  const target = typeof input.targetUserId === 'string' ? input.targetUserId.trim() : ''
  return creator.length > 0 && creator === target
}

export const USER_PERMISSION_FIELDS = [
  'adminAccess',
  'manager',
  'operatives',
  'skills',
  'qualifications',
  'materials',
  'projects',
  'smallWorks',
  'operativeMode',
  'siteAudit',
  'subContractors',
  'wholesalersOrderHistory',
  'annualLeaveSelfBook',
  // 1.28.0: admins only (`ADMIN_ONLY_PERMISSION_FIELDS`); reads off for a manager or operative.
  'timesheetSelfSign',
  'weeklyReports',
  'dailyOverview',
] as const

export type UserPermissionField = (typeof USER_PERMISSION_FIELDS)[number]

/**
 * 1.40.0 (owner decision 13 Nov, item 19): read without case or surrounding spaces — "PAYE", "Paye" and " paye " are
 * PAYE everywhere (timesheets, pay, the leave allowance). Before 1.40.0 only the exact text `paye` was PAYE here, so a
 * person stored as "PAYE" was paid and timesheeted as self-employed. Anything else, a missing value included, is
 * self-employed (§8).
 */
export function normalizeEmploymentType(raw: unknown): EmploymentType {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (value === 'paye') return 'paye'
  return 'self_employed'
}

export function employmentTypeLabel(raw: unknown): 'PAYE' | 'Self-Employed' {
  return normalizeEmploymentType(raw) === 'paye' ? 'PAYE' : 'Self-Employed'
}

export function accountKindFromFlags(flags: AccountFlags): AccountKind {
  if (flags.isSuperAdmin) return 'admin'
  if (flags.adminAccess || flags.role === 'admin') return 'admin'
  if (flags.operativeMode) return 'operative'
  return 'manager'
}

export type EmploymentTypeUser = {
  employmentType?: string | null
  employmentTypeTransitionFrom?: string | null
  employmentTypeEffectiveAt?: Date | string | number | null
}

function validDay(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}

/**
 * 1.40.0: the stored effective-dated change, as organisation-zone day keys: `before` until `effectiveDayKey`, `after`
 * from it. Null when no change is stored (or its date does not read): the person is `employmentType` on every day.
 * The same reading as `employmentTypeOnDay`, for callers that need a whole range at once.
 */
export function employmentTypeTransition(
  user: EmploymentTypeUser,
  timeZone?: string | null
): { before: EmploymentType; after: EmploymentType; effectiveDayKey: string } | null {
  const from = user.employmentTypeTransitionFrom
  const effectiveAt = validDay(user.employmentTypeEffectiveAt)
  if (!from || !effectiveAt) return null
  return {
    before: normalizeEmploymentType(from),
    after: normalizeEmploymentType(user.employmentType),
    effectiveDayKey: dayKeyInZone(effectiveAt, zoneOrLondon(timeZone)),
  }
}

/**
 * PAYE or self-employed on a calendar day.
 * Before `employmentTypeEffectiveAt`, the person is still `employmentTypeTransitionFrom`.
 * On and after that day they are `employmentType`.
 */
export function employmentTypeOnDay(
  user: EmploymentTypeUser,
  date: Date,
  timeZone?: string | null
): EmploymentType {
  const current = normalizeEmploymentType(user.employmentType)
  const from = user.employmentTypeTransitionFrom
  const day = validDay(date)
  const effectiveAt = validDay(user.employmentTypeEffectiveAt)
  if (!from || !day || !effectiveAt) return current
  const zone = zoneOrLondon(timeZone)
  if (dayKeyInZone(day, zone) < dayKeyInZone(effectiveAt, zone)) {
    return normalizeEmploymentType(from)
  }
  return current
}

export function isBillableSelfEmployedDay(
  user: EmploymentTypeUser,
  date: Date,
  timeZone?: string | null
): boolean {
  return employmentTypeOnDay(user, date, timeZone) === 'self_employed'
}

export type EmploymentTypeChange = {
  employmentType: EmploymentType
  employmentTypeTransitionFrom: string | null
  employmentTypeEffectiveAt: Date | null
}

/**
 * What to write when an editor changes employment type.
 * 1.40.0 (owner decision 13 Nov, item 18): "immediately" — and a date on or before today — stores TODAY (the first
 * instant of today in the organisation zone) as the effective date, with the old type as `employmentTypeTransitionFrom`,
 * so every day before today keeps the old type: past timesheets and leave are unchanged and a new PAYE allowance is
 * pro rata from today. (Before 1.40.0 it cleared the transition, re-typing every past day.) A future date keeps the
 * old type until that working day, as before.
 */
export function applyEmploymentTypeChange(input: {
  previousType?: string | null
  nextType?: string | null
  previousTransitionFrom?: string | null
  previousEffectiveAt?: Date | string | number | null
  effectiveAt: Date | 'immediate'
  now?: Date
  timeZone?: string | null
}): EmploymentTypeChange {
  const next = normalizeEmploymentType(input.nextType)
  const previous = normalizeEmploymentType(input.previousType)
  if (next === previous) {
    const existing = validDay(input.previousEffectiveAt)
    return {
      employmentType: next,
      employmentTypeTransitionFrom: input.previousTransitionFrom ? String(input.previousTransitionFrom) : null,
      employmentTypeEffectiveAt: existing ?? null,
    }
  }
  const zone = zoneOrLondon(input.timeZone)
  const todayKey = dayKeyInZone(input.now ?? new Date(), zone)
  const when = input.effectiveAt === 'immediate' ? undefined : validDay(input.effectiveAt)
  if (!when || dayKeyInZone(when, zone) <= todayKey) {
    return { employmentType: next, employmentTypeTransitionFrom: previous, employmentTypeEffectiveAt: dateFromDayKeyInZone(todayKey, zone) }
  }
  return {
    employmentType: next,
    employmentTypeTransitionFrom: previous,
    employmentTypeEffectiveAt: when,
  }
}

/** Label under Employment date on Edit User. */
export function employmentEffectiveLabel(
  user: EmploymentTypeUser,
  now = new Date(),
  timeZone?: string | null
): string {
  const effectiveAt = validDay(user.employmentTypeEffectiveAt)
  if (!effectiveAt || !user.employmentTypeTransitionFrom) return 'Effective immediately'
  const zone = zoneOrLondon(timeZone)
  if (dayKeyInZone(now, zone) >= dayKeyInZone(effectiveAt, zone)) return 'Effective immediately'
  const [year, month, day] = dayKeyInZone(effectiveAt, zone).split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[(month || 1) - 1]} ${year}`
}

export type PermissionToggleDef = {
  key: UserPermissionField
  title: string
  description: string
}

// 1.11.0: the Manage Users toggle rows are `permissionToggleRows` / `PERMISSION_TOGGLE_CATALOGUE` in
// permissionLevels.ts (`MANAGER_PERMISSION_TOGGLES` / `OPERATIVE_PERMISSION_TOGGLES` are derived there).

export const ADMIN_ACCESS_LOCKED_MESSAGE =
  'Change user type at the bottom of their profile, to enable admin level access.'

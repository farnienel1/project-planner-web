/**
 * Shared user document: the fields both apps read and write on `users/{uid}`,
 * when PAYE ↔ self-employed takes effect, and the permission toggles shown
 * on Edit User.
 *
 * Screens stay in each app. The document shape and the employment-day rule
 * must not be calculated twice.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
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
  'annualLeaveYearAllowance',
  'annualLeaveYearAllowanceKey',
  'timesheetsEnabled',
  'vatNumber',
  'utrNumber',
  'lastSeenAt',
  'profilePhotoURL',
] as const

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
  'weeklyReports',
  'dailyOverview',
] as const

export type UserPermissionField = (typeof USER_PERMISSION_FIELDS)[number]

export function normalizeEmploymentType(raw: unknown): EmploymentType {
  if (raw === 'paye') return 'paye'
  if (raw === 'self_employed' || raw === 'selfEmployed') return 'self_employed'
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
 * Immediate (or a date on/before today) clears the transition.
 * A future date keeps the old type until that working day.
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
  if (input.effectiveAt === 'immediate') {
    return { employmentType: next, employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null }
  }
  const when = validDay(input.effectiveAt)
  if (!when || dayKeyInZone(when, zone) <= todayKey) {
    return { employmentType: next, employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null }
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

/** Operative Edit User toggles. Order matches iOS EditUserView. */
export const OPERATIVE_PERMISSION_TOGGLES: PermissionToggleDef[] = [
  {
    key: 'materials',
    title: 'Materials',
    description:
      'Can access material lists in projects and small works. They will not be able to send quotes or place orders.',
  },
  {
    key: 'siteAudit',
    title: 'Site audit',
    description: 'Can view and submit site audits.',
  },
]

export const ADMIN_ACCESS_LOCKED_MESSAGE =
  'Change user type at the bottom of their profile, to enable admin level access.'

/** Manager and admin Edit User toggles. Order and copy match iOS EditUserView. */
export const MANAGER_PERMISSION_TOGGLES: PermissionToggleDef[] = [
  {
    key: 'adminAccess',
    title: 'Admin Access',
    description: 'Gives Manage Users.',
  },
  {
    key: 'projects',
    title: 'Projects',
    description:
      'Can create, edit, and add projects. If off, they still see projects they are assigned to as a manager or booked onto — scheduling and other job tools stay available, but they cannot add or edit project details.',
  },
  {
    key: 'smallWorks',
    title: 'Small Works',
    description:
      'Can create, edit, and add small works. If off, they still see small works they are assigned to as a manager or booked onto — scheduling and other job tools stay available, but they cannot add or edit small works details.',
  },
  {
    key: 'weeklyReports',
    title: 'Weekly Report',
    description: 'Can open Weekly Report from Home. If off, that tile is hidden.',
  },
  {
    key: 'dailyOverview',
    title: 'Daily Overview',
    description: 'Can open Daily Overview from Home. If off, that tile is hidden.',
  },
  {
    key: 'subContractors',
    title: 'Sub Contractors',
    description:
      'Can add and manage sub contractor records. If off, Sub Contractors is hidden on Home and menus. They can still book existing subcontractors on jobs.',
  },
  {
    key: 'annualLeaveSelfBook',
    title: 'Annual Leave Management',
    description:
      'Can book their own annual leave. If off, this user requests leave for approval.',
  },
  {
    key: 'operatives',
    title: 'Operatives',
    description:
      'Can manage operatives and view their details. If turned off, the user can still assign operatives to projects and small works, but will not see the Manage Operatives screen or full operative profiles.',
  },
  {
    key: 'qualifications',
    title: 'Manage Qualifications',
    description:
      'When on, this manager can add and edit organisational qualification templates. When off, qualifications shows only My Qualifications, and they can still assign templates others have already added.',
  },
  {
    key: 'wholesalersOrderHistory',
    title: 'Wholesalers',
    description:
      'Can view and manage the Wholesalers page, including quote and order history. If off, that page is not available.',
  },
]

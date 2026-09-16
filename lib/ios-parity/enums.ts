/**
 * iOS parity source: Models/BookingModels.swift, Models/AppModels.swift, Models/ProjectModels.swift
 * Spec: docs/ios-parity/01-data-model.md §4
 */

export const USER_ROLES = ['basic', 'admin', 'manager', 'operative', 'viewer'] as const
export type UserRoleRaw = (typeof USER_ROLES)[number]

export const EMPLOYMENT_TYPES = ['paye', 'self_employed'] as const
export type EmploymentTypeRaw = (typeof EMPLOYMENT_TYPES)[number]

export const BOOKING_STATUSES = ['Confirmed', 'Tentative', 'Cancelled', 'Completed'] as const
export type BookingStatusRaw = (typeof BOOKING_STATUSES)[number]

export const TIME_SLOTS = ['AM', 'PM', 'FULL DAY', 'Evening', 'Overtime', 'CUSTOM_HOURS'] as const
export type TimeSlotRaw = (typeof TIME_SLOTS)[number]

export const MANAGER_TIME_SLOTS = ['AM', 'PM', 'FULL_DAY', 'CUSTOM_HOURS'] as const
export type ManagerTimeSlotRaw = (typeof MANAGER_TIME_SLOTS)[number]

export const MANAGER_LOCATION_TYPES = [
  'project',
  'small_work',
  'office',
  'working_from_home',
  'site_survey',
  'custom',
] as const
export type ManagerLocationTypeRaw = (typeof MANAGER_LOCATION_TYPES)[number]

export const HOLIDAY_STATUSES = ['pending', 'approved', 'rejected'] as const
export type HolidayStatusRaw = (typeof HOLIDAY_STATUSES)[number]

export const HOLIDAY_TIME_SLOTS = ['FULL DAY', 'AM', 'PM'] as const

export const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const
export const TASK_STATUSES = ['To Do', 'In Progress', 'Completed'] as const

export const JOB_TYPES = ['CAT A', 'CAT B', 'Small Works', 'Maintenance'] as const

export const LEGACY_MANAGER_VALUES = [
  'N/A',
  'Adam',
  'Billey',
  'Charley',
  'Farnie',
  'Fin',
  'Greg',
  'Morgan',
  'Ross',
  'Custom',
] as const

export const MATERIAL_UNITS = ['Number', 'Box', 'Length', 'Drum', 'Pallet'] as const
export const MATERIAL_LENGTH_UNITS = ['M', 'MM'] as const
export const MATERIAL_STATUSES = ['draft', 'sentForQuote', 'ordered'] as const
export const MATERIAL_REQUEST_TYPES = ['Quote', 'Order'] as const

export const SITE_AUDIT_TYPES = ['General', 'Variations', 'Snags'] as const
export const DEADLINE_STATUSES = ['notStarted', 'inProgress', 'blocked', 'complete'] as const

export const STAFF_TRADE_TYPES = [
  'Electrician',
  'Plumber',
  'AC Engineer',
  'Ventilation',
  'Gas Engineer',
  'Carpenter',
  'Roofer',
  'Bricklayer',
  'Groundworker',
  'Finance',
  'Contract Manager',
  'Project Manager',
  'Site Manager',
  'Supervisor',
  'Installer',
  'Commissioning Engineer',
  'Programmer',
  'Scaffolder',
  'Brick & Block',
  'Dryliner',
  'Painter & Decorator',
  'Demolition Operative',
  'Steel Fixer',
  'Plant Operator',
  'Other',
] as const

const BOOKING_STATUS_ALIASES: Record<string, BookingStatusRaw> = {
  confirmed: 'Confirmed',
  tentative: 'Tentative',
  pending: 'Tentative',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  completed: 'Completed',
}

export function normalizeBookingStatus(raw: unknown): BookingStatusRaw | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if ((BOOKING_STATUSES as readonly string[]).includes(trimmed)) {
    return trimmed as BookingStatusRaw
  }
  return BOOKING_STATUS_ALIASES[trimmed.toLowerCase()] ?? null
}

export function isActiveBookingStatus(raw: unknown): boolean {
  const status = normalizeBookingStatus(raw)
  return status === 'Confirmed' || status === 'Tentative'
}

export function normalizeTimeSlot(raw: unknown): TimeSlotRaw | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if ((TIME_SLOTS as readonly string[]).includes(trimmed)) return trimmed as TimeSlotRaw
  if (trimmed === 'FULL_DAY') return 'FULL DAY'
  if (trimmed === 'CUSTOM') return 'CUSTOM_HOURS'
  return null
}

export function normalizeManagerTimeSlot(raw: unknown): ManagerTimeSlotRaw | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if ((MANAGER_TIME_SLOTS as readonly string[]).includes(trimmed)) {
    return trimmed as ManagerTimeSlotRaw
  }
  if (trimmed === 'FULL DAY') return 'FULL_DAY'
  return null
}

export function normalizeEmploymentType(raw: unknown): EmploymentTypeRaw {
  if (raw === 'paye') return 'paye'
  if (raw === 'self_employed' || raw === 'selfEmployed') return 'self_employed'
  return 'self_employed'
}

export function normalizeUserRole(raw: unknown): UserRoleRaw {
  if (typeof raw === 'string' && (USER_ROLES as readonly string[]).includes(raw)) {
    return raw as UserRoleRaw
  }
  return 'viewer'
}

export function normalizeMaterialRequestType(raw: unknown): 'Quote' | 'Order' | null {
  if (raw === 'Quote' || raw === 'Order') return raw
  if (raw === 'quote') return 'Quote'
  if (raw === 'order') return 'Order'
  return null
}

export function isSmallWorksJobType(jobType: string): boolean {
  return jobType === 'Small Works' || jobType === 'smallWork'
}

/**
 * iOS parity source: FirebaseBackend.swift save/load (hand-written dictionaries)
 * Spec: docs/ios-parity/01-data-model.md
 *
 * Parse returns null when the Swift parser would skip the record.
 * Serialize matches iOS keys, types, empty-value style, and enum raw values.
 */

import { Timestamp, deleteField } from 'firebase/firestore'
import type {
  Booking,
  Client,
  HolidayBooking,
  Manager,
  Operative,
  Project,
  ProjectTask,
  User,
  UserPermissions,
} from '@/types'
import { UserRole } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  HOLIDAY_STATUSES,
  HOLIDAY_TIME_SLOTS,
  normalizeBookingStatus,
  normalizeEmploymentType,
  normalizeManagerTimeSlot,
  normalizeTimeSlot,
  normalizeUserRole,
  type BookingStatusRaw,
  type TimeSlotRaw,
} from './enums'
import {
  IosWriteValidationError,
  asBool,
  asDate,
  asNumber,
  asOptionalString,
  asString,
  asStringArray,
  asTimestamp,
  issuesFromZod,
} from './firestoreCodec'
import {
  bookingWriteSchema,
  clientWriteSchema,
  holidayWriteSchema,
  managerSiteBookingWriteSchema,
  managerWriteSchema,
  notificationWriteSchema,
  operativeWriteSchema,
  projectWriteSchema,
  taskWriteSchema,
  userWriteSchema,
} from './schemas'
import { newUppercaseUuid } from './uuid'

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[]; skipped: true }

function fail<T>(errors: string[]): ParseResult<T> {
  return { ok: false, errors, skipped: true }
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value }
}

export function defaultUserPermissions(operativeMode = false): UserPermissions {
  if (operativeMode) {
    return {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: true,
      smallWorks: true,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    }
  }
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: true,
    projects: false,
    smallWorks: false,
    operativeMode: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
  }
}

function readFlag(data: Record<string, unknown>, key: string): boolean | undefined {
  if (data[key] === true) return true
  if (data[key] === false) return false
  const nested = data.permissions
  if (nested && typeof nested === 'object') {
    const map = nested as Record<string, unknown>
    if (map[key] === true) return true
    if (map[key] === false) return false
  }
  return undefined
}

/** Mirrors FirebaseBackend.parseAppUserDocument ~L3349. */
export function parseAppUserDocument(userId: string, data: Record<string, unknown>): ParseResult<User> {
  const email = asString(data.email)
  const organizationId = asString(data.organizationId)
  if (!email || !organizationId) {
    return fail(['email and organizationId are required'])
  }

  const operativeMode = readFlag(data, 'operativeMode') === true
  const permissions: UserPermissions = {
    adminAccess: operativeMode ? false : readFlag(data, 'adminAccess') === true,
    manager: operativeMode ? false : readFlag(data, 'manager') === true,
    operatives: operativeMode ? false : readFlag(data, 'operatives') === true,
    skills: false,
    qualifications: operativeMode ? false : readFlag(data, 'qualifications') === true,
    materials: operativeMode
      ? readFlag(data, 'materials') === true
      : readFlag(data, 'materials') !== false,
    projects: operativeMode ? true : readFlag(data, 'projects') === true,
    smallWorks: operativeMode ? true : readFlag(data, 'smallWorks') === true,
    operativeMode,
    annualLeaveSelfBook: readFlag(data, 'annualLeaveSelfBook') === true,
    weeklyReports: readFlag(data, 'weeklyReports') === true,
    dailyOverview: readFlag(data, 'dailyOverview') !== false,
    subContractors: readFlag(data, 'subContractors') === true,
    siteAudit: readFlag(data, 'siteAudit') !== false,
    wholesalersOrderHistory: readFlag(data, 'wholesalersOrderHistory') !== false,
  }

  const rawIsSuperAdmin = data.isSuperAdmin === true
  const isSuperAdmin = operativeMode ? false : rawIsSuperAdmin
  const role = operativeMode ? UserRole.OPERATIVE : (normalizeUserRole(data.role) as UserRole)

  const assignedManagerUserIds = asStringArray(data.assignedManagerUserIds)
  const legacyManager = asOptionalString(data.assignedManagerUserId)
  const managerIds =
    assignedManagerUserIds.length > 0 ? assignedManagerUserIds : legacyManager ? [legacyManager] : []

  let dayRate = asNumber(data.dayRate)
  let hourlyRate = asNumber(data.hourlyRate)
  if (dayRate != null && dayRate > 0 && hourlyRate != null && hourlyRate > 0) {
    hourlyRate = undefined
  }

  return ok({
    id: userId,
    email,
    firstName: asString(data.firstName),
    surname: asString(data.surname),
    organizationId,
    role,
    isActive: asBool(data.isActive, true),
    passwordSet: asBool(data.passwordSet, false),
    isSuperAdmin,
    mobileNumber: asOptionalString(data.mobileNumber),
    permissions,
    assignedManagerUserIds: managerIds.length ? managerIds : undefined,
    assignedManagerUserId: managerIds[0],
    dayRate: dayRate && dayRate > 0 ? dayRate : undefined,
    hourlyRate: hourlyRate && hourlyRate > 0 ? hourlyRate : undefined,
    tradeTypePreset: asOptionalString(data.tradeTypePreset),
    tradeTypeCustom: asOptionalString(data.tradeTypeCustom),
    employmentType: normalizeEmploymentType(data.employmentType),
    employmentTypeTransitionFrom: asOptionalString(data.employmentTypeTransitionFrom),
    employmentTypeEffectiveAt: asDate(data.employmentTypeEffectiveAt),
    lastSeenAt: asDate(data.lastSeenAt),
    profilePhotoURL: asOptionalString(data.profilePhotoURL),
    annualLeaveEnabled: asBool(data.annualLeaveEnabled, true),
    annualLeaveDaysPerYear:
      asNumber(data.annualLeaveDaysPerYear) ?? undefined,
    annualLeaveYearStartMonth:
      typeof data.annualLeaveYearStartMonth === 'number'
        ? Math.trunc(data.annualLeaveYearStartMonth)
        : undefined,
    annualLeaveYearEndMonth:
      typeof data.annualLeaveYearEndMonth === 'number'
        ? Math.trunc(data.annualLeaveYearEndMonth)
        : undefined,
    annualLeaveCarriesOver: data.annualLeaveCarriesOver === true,
    timesheetsEnabled: data.timesheetsEnabled === true,
    vatNumber: asOptionalString(data.vatNumber),
    utrNumber: asOptionalString(data.utrNumber),
    policyAccepted: data.policyAccepted === true,
    policyAcceptedAt: asDate(data.policyAcceptedAt),
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
  })
}

function permissionFlags(permissions: UserPermissions, operativeMode: boolean): Record<string, boolean> {
  return {
    adminAccess: operativeMode ? false : permissions.adminAccess,
    manager: operativeMode ? false : permissions.manager,
    operatives: operativeMode ? false : permissions.operatives,
    skills: false,
    qualifications: operativeMode ? false : permissions.qualifications,
    materials: operativeMode ? permissions.materials : true,
    projects: permissions.projects,
    smallWorks: permissions.smallWorks,
    operativeMode,
    annualLeaveSelfBook: permissions.annualLeaveSelfBook === true,
    weeklyReports: permissions.weeklyReports === true,
    dailyOverview: permissions.dailyOverview !== false,
    subContractors: permissions.subContractors,
    siteAudit: permissions.siteAudit,
    wholesalersOrderHistory: permissions.wholesalersOrderHistory !== false,
  }
}

/** Mirrors FirebaseBackend.saveUser ~L4005. Flat flags; no nested permissions map. */
export function serializeUser(user: User): Record<string, unknown> {
  const operativeMode = user.permissions.operativeMode === true
  const flags = permissionFlags(user.permissions, operativeMode)
  const role = operativeMode
    ? 'operative'
    : user.permissions.adminAccess
      ? 'admin'
      : user.permissions.manager
        ? 'manager'
        : user.role

  const payload: Record<string, unknown> = {
    email: user.email.toLowerCase().trim(),
    organizationId: user.organizationId,
    role,
    firstName: user.firstName.trim(),
    surname: user.surname.trim(),
    isActive: user.isActive,
    passwordSet: user.passwordSet,
    isSuperAdmin: operativeMode ? false : user.isSuperAdmin,
    policyAccepted: user.policyAccepted,
    employmentType: normalizeEmploymentType(user.employmentType),
    updatedAt: Timestamp.now(),
    annualLeaveEnabled: user.annualLeaveEnabled !== false,
    annualLeaveCarriesOver: user.annualLeaveCarriesOver === true,
    ...flags,
  }

  if (user.createdAt) payload.createdAt = asTimestamp(user.createdAt)
  const mobile = user.mobileNumber?.trim()
  payload.mobileNumber = mobile ? mobile : deleteField()

  if (operativeMode || user.permissions.manager) {
    const ids = (user.assignedManagerUserIds ?? []).map((id) => id.trim()).filter(Boolean)
    if (ids.length === 0 && user.assignedManagerUserId?.trim()) ids.push(user.assignedManagerUserId.trim())
    if (ids.length === 0) {
      payload.assignedManagerUserId = deleteField()
      payload.assignedManagerUserIds = deleteField()
    } else {
      payload.assignedManagerUserIds = ids
      payload.assignedManagerUserId = ids[0]
    }
    if (user.dayRate != null && user.dayRate > 0) {
      payload.dayRate = user.dayRate
      payload.hourlyRate = deleteField()
    } else if (user.hourlyRate != null && user.hourlyRate > 0) {
      payload.hourlyRate = user.hourlyRate
      payload.dayRate = deleteField()
    }
    payload.tradeTypePreset = user.tradeTypePreset?.trim() || deleteField()
    payload.tradeTypeCustom = user.tradeTypeCustom?.trim() || deleteField()
    payload.timesheetsEnabled = user.timesheetsEnabled === true
    payload.vatNumber = user.vatNumber?.trim() || deleteField()
    payload.utrNumber = user.utrNumber?.trim() || deleteField()
  }

  if (user.annualLeaveDaysPerYear != null) payload.annualLeaveDaysPerYear = user.annualLeaveDaysPerYear
  if (user.annualLeaveYearStartMonth != null) {
    payload.annualLeaveYearStartMonth = Math.trunc(user.annualLeaveYearStartMonth)
  }
  if (user.annualLeaveYearEndMonth != null) {
    payload.annualLeaveYearEndMonth = Math.trunc(user.annualLeaveYearEndMonth)
  }
  if (user.employmentTypeTransitionFrom) {
    payload.employmentTypeTransitionFrom = user.employmentTypeTransitionFrom
  }
  if (user.employmentTypeEffectiveAt) {
    payload.employmentTypeEffectiveAt = asTimestamp(user.employmentTypeEffectiveAt)
  }
  if (user.policyAcceptedAt) payload.policyAcceptedAt = asTimestamp(user.policyAcceptedAt)
  if (user.profilePhotoURL?.trim()) payload.profilePhotoURL = user.profilePhotoURL.trim()

  const checked = userWriteSchema.safeParse({
    email: payload.email,
    organizationId: payload.organizationId,
    role: payload.role,
    firstName: payload.firstName,
    surname: payload.surname,
    isActive: payload.isActive,
    passwordSet: payload.passwordSet,
    isSuperAdmin: payload.isSuperAdmin,
    policyAccepted: payload.policyAccepted,
    employmentType: payload.employmentType,
    ...flags,
  })
  if (!checked.success) {
    throw new IosWriteValidationError('Invalid user write', issuesFromZod(checked.error))
  }
  return payload
}

/** iOS bookingFromFirestoreDocument ~L5235 — skip if required fields fail. */
export function parseBooking(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<Booking> {
  const operativeId = asString(data.operativeId) || asString(data.operativeID)
  const projectId = asString(data.projectId) || asString(data.projectID)
  const date = asDate(data.date)
  const timeSlot = normalizeTimeSlot(data.timeSlot) || (asString(data.timeSlot) ? null : 'FULL DAY')
  const bookedBy = asString(data.bookedBy)
  const status = normalizeBookingStatus(data.status)
  if (!operativeId || !projectId || !date || !timeSlot || !status) {
    return fail([
      !operativeId ? 'operativeId missing/invalid' : '',
      !projectId ? 'projectId missing/invalid' : '',
      !date ? 'date missing/invalid Timestamp' : '',
      !timeSlot ? `timeSlot invalid (${String(data.timeSlot)})` : '',
      !status ? `status invalid (${String(data.status)})` : '',
    ].filter(Boolean))
  }
  return ok({
    id: docId,
    operativeId,
    projectId,
    date,
    timeSlot: timeSlot as TimeSlotRaw,
    bookedBy,
    notes: asString(data.notes),
    status: status as BookingStatusRaw,
    workStartTime: asOptionalString(data.workStartTime),
    workEndTime: asOptionalString(data.workEndTime),
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
    organizationId,
  })
}

/** iOS saveBooking ~L5169, merge, uppercase UUID doc id + denormalised id. */
export function serializeBooking(booking: Booking): Record<string, unknown> {
  const status = normalizeBookingStatus(booking.status)
  const timeSlot = normalizeTimeSlot(booking.timeSlot)
  const id = booking.id?.trim() || newUppercaseUuid()
  const parsed = bookingWriteSchema.safeParse({
    id,
    operativeId: booking.operativeId,
    projectId: booking.projectId,
    date: booking.date instanceof Date ? booking.date : new Date(booking.date),
    timeSlot,
    bookedBy: booking.bookedBy,
    notes: booking.notes ?? '',
    status,
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
    isBreakRemoved: false,
    createdAt: booking.createdAt instanceof Date ? booking.createdAt : new Date(),
    updatedAt: new Date(),
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid booking write (iOS would skip this record)', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  const payload: Record<string, unknown> = {
    id: v.id,
    operativeId: v.operativeId,
    projectId: v.projectId,
    date: asTimestamp(v.date),
    timeSlot: v.timeSlot,
    bookedBy: v.bookedBy,
    notes: v.notes,
    status: v.status,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
    isBreakRemoved: v.isBreakRemoved,
  }
  payload.workStartTime = v.workStartTime?.trim() ? v.workStartTime : deleteField()
  payload.workEndTime = v.workEndTime?.trim() ? v.workEndTime : deleteField()
  payload.otMultiplierOverride = v.otMultiplierOverride ?? deleteField()
  payload.bookingGroupId = v.bookingGroupId?.trim() ? v.bookingGroupId : deleteField()
  return payload
}

export function parseManagerSiteBooking(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<ManagerSiteBooking> {
  const userId = asString(data.userId)
  const date = asDate(data.date)
  const timeSlot = normalizeManagerTimeSlot(data.timeSlot)
  if (!userId || !date || !timeSlot) {
    return fail(['userId, date Timestamp and manager timeSlot are required'])
  }
  const locationTypeRaw = asString(data.locationType, 'project')
  const locationType =
    locationTypeRaw === 'project' ||
    locationTypeRaw === 'small_work' ||
    locationTypeRaw === 'office' ||
    locationTypeRaw === 'working_from_home' ||
    locationTypeRaw === 'site_survey' ||
    locationTypeRaw === 'custom'
      ? locationTypeRaw
      : 'project'
  return ok({
    id: docId,
    userId,
    date,
    timeSlot,
    locationType,
    locationId: asOptionalString(data.locationId),
    customLocationName: asOptionalString(data.customLocationName),
    workStartTime: asOptionalString(data.workStartTime),
    workEndTime: asOptionalString(data.workEndTime),
    isBreakRemoved: data.isBreakRemoved === true,
    bookingGroupId: asOptionalString(data.bookingGroupId),
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
    organizationId,
  })
}

export function serializeManagerSiteBooking(
  booking: ManagerSiteBooking & { organizationId: string }
): Record<string, unknown> {
  const timeSlot = normalizeManagerTimeSlot(booking.timeSlot)
  const parsed = managerSiteBookingWriteSchema.safeParse({
    id: booking.id || newUppercaseUuid(),
    userId: booking.userId,
    date: booking.date,
    organizationId: booking.organizationId,
    timeSlot,
    locationType: booking.locationType,
    locationId: booking.locationId,
    customLocationName: booking.customLocationName,
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
    isBreakRemoved: booking.isBreakRemoved === true,
    bookingGroupId: booking.bookingGroupId,
    createdAt: booking.createdAt,
    updatedAt: new Date(),
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid manager site booking write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  const payload: Record<string, unknown> = {
    id: v.id,
    userId: v.userId,
    date: asTimestamp(v.date),
    organizationId: v.organizationId,
    timeSlot: v.timeSlot,
    locationType: v.locationType,
    isBreakRemoved: v.isBreakRemoved,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
  }
  payload.locationId = v.locationId?.trim() ? v.locationId : deleteField()
  payload.customLocationName = v.customLocationName?.trim() ? v.customLocationName : deleteField()
  payload.workStartTime = v.workStartTime?.trim() ? v.workStartTime : deleteField()
  payload.workEndTime = v.workEndTime?.trim() ? v.workEndTime : deleteField()
  payload.bookingGroupId = v.bookingGroupId?.trim() ? v.bookingGroupId : deleteField()
  return payload
}

export function parseProject(
  docId: string,
  data: Record<string, unknown>,
  organizationId: string
): ParseResult<Project> {
  const siteName = asString(data.siteName)
  if (!siteName) return fail(['siteName missing'])
  const clientRaw = (data.client && typeof data.client === 'object' ? data.client : {}) as Record<string, unknown>
  const managerIds = asStringArray(data.managerIds)
  const managerId = asOptionalString(data.managerId) || managerIds[0]
  return ok({
    id: docId,
    jobNumber: asString(data.jobNumber),
    siteName,
    addressLine1: asString(data.addressLine1),
    addressLine2: asOptionalString(data.addressLine2),
    townCity: asString(data.townCity),
    postcode: asString(data.postcode),
    client: {
      id: asString(clientRaw.id),
      name: asString(clientRaw.name),
      email: asOptionalString(clientRaw.email),
      phone: asOptionalString(clientRaw.phone),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    startDate: asDate(data.startDate) || new Date(),
    endDate: asDate(data.endDate) || new Date(),
    jobType: asString(data.jobType, 'CAT A'),
    customJobType: asOptionalString(data.customJobType),
    manager: { name: asString(data.manager, 'Custom'), email: '' },
    managerId,
    managerIds: managerIds.length ? managerIds : managerId ? [managerId] : [],
    isLive: asBool(data.isLive, true),
    description: asOptionalString(data.description),
    siteAddress: asOptionalString(data.siteAddress),
    latitude: asNumber(data.latitude),
    longitude: asNumber(data.longitude),
    usesMapPinForLocation: data.usesMapPinForLocation === true,
    hiddenManagerUserIds: asStringArray(data.hiddenManagerUserIds),
    hiddenOperativeUserIds: asStringArray(data.hiddenOperativeUserIds),
    organizationId,
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
  })
}

export function serializeProject(input: {
  id: string
  organizationId: string
  jobNumber: string
  siteName: string
  addressLine1: string
  addressLine2?: string
  townCity: string
  postcode: string
  client: Client
  startDate: Date
  endDate: Date
  jobType: string
  customJobType?: string
  managerId?: string
  managerIds?: string[]
  isLive: boolean
  description?: string
  latitude?: number
  longitude?: number
  usesMapPinForLocation?: boolean
  hiddenManagerUserIds?: string[]
  hiddenOperativeUserIds?: string[]
  createdAt?: Date
  updatedAt?: Date
}): Record<string, unknown> {
  const siteAddress = [input.addressLine1, input.addressLine2, input.townCity, input.postcode]
    .filter(Boolean)
    .join(', ')
  const parsed = projectWriteSchema.safeParse({
    id: input.id,
    jobNumber: input.jobNumber.trim(),
    siteName: input.siteName.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || '',
    townCity: input.townCity.trim(),
    postcode: input.postcode.trim(),
    siteAddress,
    client: {
      id: input.client.id,
      name: input.client.name,
      email: input.client.email || '',
      phone: input.client.phone || '',
    },
    startDate: input.startDate,
    endDate: input.endDate,
    jobType: input.jobType,
    customJobType: input.customJobType?.trim() || undefined,
    manager: 'Custom',
    managerId: input.managerId,
    managerIds: input.managerIds,
    isLive: input.isLive,
    description: input.description?.trim() || '',
    hiddenManagerUserIds: input.hiddenManagerUserIds ?? [],
    hiddenOperativeUserIds: input.hiddenOperativeUserIds ?? [],
    usesMapPinForLocation: input.usesMapPinForLocation === true,
    latitude: input.latitude,
    longitude: input.longitude,
    organizationId: input.organizationId,
    createdAt: input.createdAt || new Date(),
    updatedAt: input.updatedAt || new Date(),
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid project write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  const payload: Record<string, unknown> = {
    jobNumber: v.jobNumber,
    siteName: v.siteName,
    addressLine1: v.addressLine1,
    addressLine2: v.addressLine2,
    townCity: v.townCity,
    postcode: v.postcode,
    siteAddress: v.siteAddress,
    client: v.client,
    startDate: asTimestamp(v.startDate),
    endDate: asTimestamp(v.endDate),
    jobType: v.jobType,
    manager: 'Custom',
    isLive: v.isLive,
    description: v.description,
    organizationId: v.organizationId,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
    usesMapPinForLocation: v.usesMapPinForLocation,
    hiddenManagerUserIds: v.hiddenManagerUserIds,
    hiddenOperativeUserIds: v.hiddenOperativeUserIds,
  }
  if (v.customJobType) payload.customJobType = v.customJobType
  if (v.managerId) payload.managerId = v.managerId
  if (v.managerIds && v.managerIds.length > 0) {
    payload.managerIds = v.managerIds
    if (!v.managerId) payload.managerId = v.managerIds[0]
  }
  if (v.latitude != null) payload.latitude = v.latitude
  if (v.longitude != null) payload.longitude = v.longitude
  return payload
}

export function serializeTask(task: ProjectTask): Record<string, unknown> {
  const parsed = taskWriteSchema.safeParse({
    projectId: task.projectId,
    title: task.title,
    details: task.details ?? '',
    createdBy: task.createdBy,
    assignedOperativeId: task.assignedOperativeId,
    assignedManagerId: task.assignedManagerId,
    dueDate: task.dueDate || new Date(),
    priority: task.priority,
    status: task.status,
    organizationId: task.organizationId,
    createdAt: task.createdAt,
    updatedAt: new Date(),
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid task write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  const payload: Record<string, unknown> = {
    projectId: v.projectId,
    title: v.title,
    details: v.details,
    createdBy: v.createdBy,
    dueDate: asTimestamp(v.dueDate),
    priority: v.priority,
    status: v.status,
    organizationId: v.organizationId,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
  }
  payload.assignedOperativeId = v.assignedOperativeId?.trim() ? v.assignedOperativeId : deleteField()
  payload.assignedManagerId = v.assignedManagerId?.trim() ? v.assignedManagerId : deleteField()
  return payload
}

export function parseHoliday(
  docId: string,
  data: Record<string, unknown>,
  organizationId: string
): ParseResult<HolidayBooking> {
  const startDate = asDate(data.startDate)
  const endDate = asDate(data.endDate)
  const statusRaw = asString(data.status)
  const slotRaw = asString(data.timeSlot, 'FULL DAY')
  if (!startDate || !endDate) return fail(['startDate and endDate Timestamps required'])
  if (!(HOLIDAY_STATUSES as readonly string[]).includes(statusRaw)) {
    return fail([`holiday status invalid (${statusRaw})`])
  }
  const timeSlot = (HOLIDAY_TIME_SLOTS as readonly string[]).includes(slotRaw) ? slotRaw : 'FULL DAY'
  return ok({
    id: docId,
    organizationId,
    userId: asOptionalString(data.userId),
    operativeId: asOptionalString(data.operativeId),
    startDate,
    endDate,
    status: statusRaw as HolidayBooking['status'],
    timeSlot: timeSlot as HolidayBooking['timeSlot'],
    approvedByUserId: asOptionalString(data.approvedByUserId),
    approvedAt: asDate(data.approvedAt),
    cancellationRequestedAt: asDate(data.cancellationRequestedAt),
    cancellationRequestedByUserId: asOptionalString(data.cancellationRequestedByUserId),
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
  })
}

export function serializeHoliday(booking: HolidayBooking): Record<string, unknown> {
  const parsed = holidayWriteSchema.safeParse({
    id: booking.id || newUppercaseUuid(),
    organizationId: booking.organizationId,
    userId: booking.userId,
    operativeId: booking.operativeId,
    startDate: booking.startDate,
    endDate: booking.endDate,
    status: booking.status,
    timeSlot: booking.timeSlot,
    createdAt: booking.createdAt,
    updatedAt: new Date(),
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid holiday write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  const payload: Record<string, unknown> = {
    id: v.id,
    organizationId: v.organizationId,
    startDate: asTimestamp(v.startDate),
    endDate: asTimestamp(v.endDate),
    status: v.status,
    timeSlot: v.timeSlot,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
  }
  payload.userId = v.userId?.trim() ? v.userId : deleteField()
  payload.operativeId = v.operativeId?.trim() ? v.operativeId : deleteField()
  return payload
}

export function parseClient(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<Client> {
  const name = asString(data.name)
  if (!name) return fail(['name required'])
  const idString = asString(data.id, docId)
  return ok({
    id: idString || docId,
    name,
    contactPerson: asOptionalString(data.contactPerson),
    email: asOptionalString(data.email),
    phone: asOptionalString(data.phone),
    address: asOptionalString(data.address),
    organizationId,
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
  })
}

/** Mirrors FirebaseBackend.saveClient ~L1724. Empty strings, not omitted keys. */
export function serializeClient(client: Client): Record<string, unknown> {
  const parsed = clientWriteSchema.safeParse({
    id: client.id || newUppercaseUuid(),
    name: client.name.trim(),
    contactPerson: client.contactPerson ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    organizationId: client.organizationId || '',
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid client write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  return {
    id: v.id,
    name: v.name,
    contactPerson: v.contactPerson,
    email: v.email,
    phone: v.phone,
    address: v.address,
    organizationId: v.organizationId,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
  }
}

/** Mirrors FirebaseBackend.saveNotification ~L4580. */
export function serializeNotification(row: {
  organizationId: string
  type: string
  title: string
  message: string
  userId?: string | null
  relatedId?: string | null
  isRead?: boolean
  createdAt?: Date
  requiresPermission?: string | null
  deepLinkUserId?: string | null
  deepLinkWeekStart?: Date | null
}): Record<string, unknown> {
  const parsed = notificationWriteSchema.safeParse({
    organizationId: row.organizationId,
    type: row.type,
    title: row.title,
    message: row.message,
    userId: row.userId ?? null,
    relatedId: row.relatedId ?? null,
    isRead: row.isRead === true,
    createdAt: row.createdAt || new Date(),
    requiresPermission: row.requiresPermission ?? null,
    deepLinkUserId: row.deepLinkUserId ?? null,
    deepLinkWeekStart: row.deepLinkWeekStart ?? null,
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid notification write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  return {
    organizationId: v.organizationId,
    type: v.type,
    title: v.title,
    message: v.message,
    userId: v.userId,
    relatedId: v.relatedId,
    isRead: v.isRead,
    createdAt: asTimestamp(v.createdAt),
    requiresPermission: v.requiresPermission,
    deepLinkUserId: v.deepLinkUserId,
    deepLinkWeekStart: v.deepLinkWeekStart ? asTimestamp(v.deepLinkWeekStart as Date) : null,
  }
}

export function parseOperative(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<Operative> {
  const firstName = asString(data.firstName)
  const lastName = asString(data.lastName)
  if (!firstName && !lastName) return fail(['firstName or lastName required'])
  return ok({
    id: docId,
    firstName,
    lastName,
    email: asString(data.email),
    phone: asOptionalString(data.phone),
    startDate: asDate(data.startDate) || new Date(),
    hourlyRate: asNumber(data.hourlyRate) ?? 0,
    dayRate: asNumber(data.dayRate) ?? asNumber(data.hourlyRate) ?? 0,
    skills: Array.isArray(data.skills) ? (data.skills as Operative['skills']) : [],
    qualifications: Array.isArray(data.qualifications)
      ? (data.qualifications as Operative['qualifications'])
      : [],
    isActive: asBool(data.isActive, true),
    tradeTypePreset: asOptionalString(data.tradeTypePreset),
    tradeTypeCustom: asOptionalString(data.tradeTypeCustom),
    notes: asOptionalString(data.notes),
    organizationId,
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
  })
}

/** iOS OperativeStore.save — organizations/{orgId}/operatives/{uuidString} */
export function serializeOperative(
  operative: Operative & { organizationId: string }
): Record<string, unknown> {
  const id = operative.id?.trim() || newUppercaseUuid()
  const firstName = operative.firstName.trim()
  const lastName = operative.lastName.trim()
  const parsed = operativeWriteSchema.safeParse({
    id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: operative.email.trim(),
    phone: operative.phone?.trim() || '',
    startDate: operative.startDate instanceof Date ? operative.startDate : new Date(operative.startDate),
    skills: operative.skills || [],
    qualifications: operative.qualifications || [],
    isActive: operative.isActive !== false,
    hourlyRate: operative.hourlyRate || 0,
    dayRate: operative.dayRate ?? operative.hourlyRate ?? 0,
    currencySymbol: '£',
    notes: operative.notes?.trim() || '',
    tradeTypePreset: operative.tradeTypePreset?.trim() || '',
    tradeTypeCustom: operative.tradeTypeCustom?.trim() || '',
    organizationId: operative.organizationId,
    createdAt: operative.createdAt instanceof Date ? operative.createdAt : new Date(),
    updatedAt: new Date(),
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid operative write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  return {
    id: v.id,
    firstName: v.firstName,
    lastName: v.lastName,
    name: v.name,
    email: v.email,
    phone: v.phone,
    startDate: asTimestamp(v.startDate),
    skills: v.skills,
    qualifications: v.qualifications,
    isActive: v.isActive,
    hourlyRate: v.hourlyRate,
    currencySymbol: v.currencySymbol,
    notes: v.notes,
    dayRate: v.dayRate,
    tradeTypePreset: v.tradeTypePreset,
    tradeTypeCustom: v.tradeTypeCustom,
    organizationId: v.organizationId,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
  }
}

export function parseManager(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<Manager> {
  const firstName = asString(data.firstName)
  const lastName = asString(data.lastName)
  const email = asString(data.email)
  if (!firstName || !email) return fail(['firstName and email required'])
  const mobile = asOptionalString(data.mobileNumber) || asOptionalString(data.mobile) || asOptionalString(data.phone)
  return ok({
    id: docId,
    firstName,
    lastName,
    email,
    phone: asOptionalString(data.phone) || mobile,
    mobile,
    department: asOptionalString(data.department),
    isActive: asBool(data.isActive, true),
    notes: asOptionalString(data.notes),
    tradeTypePreset: asOptionalString(data.tradeTypePreset),
    tradeTypeCustom: asOptionalString(data.tradeTypeCustom),
    organizationId,
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
  })
}

/** iOS CreateManagerView — organizations/{orgId}/managers/{uuidString} */
export function serializeManager(manager: Manager & { organizationId: string }): Record<string, unknown> {
  const id = manager.id?.trim() || newUppercaseUuid()
  const parsed = managerWriteSchema.safeParse({
    id,
    firstName: manager.firstName.trim(),
    lastName: manager.lastName.trim(),
    email: manager.email.trim(),
    mobileNumber: manager.mobile?.trim() || manager.phone?.trim() || '',
    department: manager.department?.trim() || '',
    isActive: manager.isActive !== false,
    notes: manager.notes?.trim() || '',
    tradeTypePreset: manager.tradeTypePreset?.trim() || '',
    tradeTypeCustom: manager.tradeTypeCustom?.trim() || '',
    organizationId: manager.organizationId,
    createdAt: manager.createdAt instanceof Date ? manager.createdAt : new Date(),
    updatedAt: new Date(),
  })
  if (!parsed.success) {
    throw new IosWriteValidationError('Invalid manager write', issuesFromZod(parsed.error))
  }
  const v = parsed.data
  return {
    id: v.id,
    firstName: v.firstName,
    lastName: v.lastName,
    email: v.email,
    mobileNumber: v.mobileNumber,
    department: v.department,
    isActive: v.isActive,
    notes: v.notes,
    tradeTypePreset: v.tradeTypePreset,
    tradeTypeCustom: v.tradeTypeCustom,
    organizationId: v.organizationId,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
  }
}

export interface AppInboxNotification {
  id: string
  organizationId: string
  type: string
  title: string
  message: string
  userId?: string
  relatedId?: string
  isRead: boolean
  createdAt: Date
  requiresPermission?: string
  deepLinkUserId?: string
  deepLinkWeekStart?: Date
}

export function parseNotification(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<AppInboxNotification> {
  const type = asString(data.type)
  const title = asString(data.title)
  const message = asString(data.message)
  if (!type) return fail(['type required'])
  const orgId = asString(data.organizationId, organizationId || '')
  if (!orgId) return fail(['organizationId required'])
  const checked = notificationWriteSchema.safeParse({
    organizationId: orgId,
    type,
    title,
    message,
    userId: asOptionalString(data.userId) ?? null,
    relatedId: asOptionalString(data.relatedId) ?? null,
    isRead: data.isRead === true,
    createdAt: asDate(data.createdAt) || new Date(),
    requiresPermission: asOptionalString(data.requiresPermission) ?? null,
    deepLinkUserId: asOptionalString(data.deepLinkUserId) ?? null,
    deepLinkWeekStart: asDate(data.deepLinkWeekStart) ?? null,
  })
  if (!checked.success) {
    return fail(issuesFromZod(checked.error))
  }
  const v = checked.data
  return ok({
    id: docId,
    organizationId: v.organizationId,
    type: v.type,
    title: v.title,
    message: v.message,
    userId: v.userId || undefined,
    relatedId: v.relatedId || undefined,
    isRead: v.isRead,
    createdAt: v.createdAt,
    requiresPermission: v.requiresPermission || undefined,
    deepLinkUserId: v.deepLinkUserId || undefined,
    deepLinkWeekStart: v.deepLinkWeekStart instanceof Date ? v.deepLinkWeekStart : undefined,
  })
}

export function parseTask(
  docId: string,
  data: Record<string, unknown>,
  organizationId: string
): ParseResult<ProjectTask> {
  const title = asString(data.title)
  const projectId = asString(data.projectId)
  if (!title || !projectId) return fail(['title and projectId required'])
  const priorityRaw = asString(data.priority, 'Normal')
  const statusRaw = asString(data.status, 'To Do')
  return ok({
    id: docId,
    organizationId,
    projectId,
    title,
    details: asString(data.details),
    createdBy: asString(data.createdBy),
    status: (['To Do', 'In Progress', 'Completed'] as const).includes(statusRaw as 'To Do')
      ? (statusRaw as ProjectTask['status'])
      : 'To Do',
    priority: (['Low', 'Normal', 'High', 'Urgent'] as const).includes(priorityRaw as 'Low')
      ? (priorityRaw as ProjectTask['priority'])
      : 'Normal',
    assignedOperativeId: asOptionalString(data.assignedOperativeId),
    assignedManagerId: asOptionalString(data.assignedManagerId),
    dueDate: asDate(data.dueDate),
    completedBy: asOptionalString(data.completedBy),
    completedAt: asDate(data.completedAt),
    completionNotes: asOptionalString(data.completionNotes),
    attachedImageURLs: asStringArray(data.attachedImageURLs),
    createdAt: asDate(data.createdAt) || new Date(),
    updatedAt: asDate(data.updatedAt) || new Date(),
  })
}

export function logSkippedDocument(collection: string, docId: string, errors: string[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[ios-parity] skipped ${collection}/${docId}:`, errors.join('; '))
  }
}

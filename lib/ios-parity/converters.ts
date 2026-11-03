/**
 * iOS parity source: FirebaseBackend.swift save/load (hand-written dictionaries)
 * Spec: docs/ios-parity/01-data-model.md
 *
 * Parse returns null when the Swift parser would skip the record.
 * Serialize matches iOS keys, types, empty-value style, and enum raw values.
 */

import { Timestamp, deleteField } from 'firebase/firestore'
import { isAnonymisedDeletedProfile } from '@/lib/canonical/userRosterSegment'
import { assignedQualificationWriteFields } from '@/lib/canonical/operativeQualifications'
import { currencySymbol, DEFAULT_CURRENCY_CODE } from '@/lib/canonical/money'
import { bookingJobCollectionFields, bookingWriteFields, parseBookingDocument, parseManagerSiteBookingDocument } from '@/lib/canonical/bookings'
import { parseHolidayDocument } from '@/lib/canonical/holidayDocument'
import { parseJobDocument } from '@/lib/canonical/workDocumentReaders'
import { parseNotificationDocument } from '@/lib/canonical/recordsDocuments'
import {
  parseClientDocument,
  parseManagerDocument,
  parseOperativeDocument,
  parseUserDocument,
} from '@/lib/canonical/peopleDocuments'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { dateFromDayKeyInZone } from '@/lib/orgTime/zoneTime'
import { exclusiveRateDocumentFields, operativeRosterRateFields } from '@/lib/timesheets/payBasis'
import { applyExclusiveRateFields } from '@/lib/firebase/userPayload'
import type {
  Booking,
  Client,
  HolidayBooking,
  Manager,
  Operative,
  Project,
  ProjectTask,
  Qualification,
  Skill,
  User,
  UserPermissions,
} from '@/types'
import { UserRole } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  normalizeBookingStatus,
  normalizeEmploymentType,
  normalizeManagerTimeSlot,
  normalizeTimeSlot,
  type BookingStatusRaw,
  type TimeSlotRaw,
} from './enums'
import {
  IosWriteValidationError,
  asBool,
  asDate,
  asNumber,
  asClockHhMm,
  asOptionalString,
  asString,
  asStringArray,
  asTimestamp,
  issuesFromZod,
  omitUndefinedDeep,
} from './firestoreCodec'
import {
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
      developerAccess: false,
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
    developerAccess: false,
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

function msDate(ms: number | null | undefined): Date | undefined {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms) : undefined
}

/**
 * `users/{uid}` through the rulebook reader `parseUserDocument` (rulebook 1.6.0, §1 "Document readers").
 * Web still requires an organisation and an email (or an anonymised deleted profile) to list a document.
 * The leave fields keep what is stored; a missing value takes the organisation `annualLeaveDefaults`
 * downstream (`annualLeaveBalance`), the same value the reader gives iOS.
 */
export function parseAppUserDocument(userId: string, data: Record<string, unknown>): ParseResult<User> {
  const email = asString(data.email)
  const organizationId = asString(data.organizationId)
  if (!organizationId) {
    return fail(['email and organizationId are required'])
  }
  if (!email && !isAnonymisedDeletedProfile(data)) {
    return fail(['email and organizationId are required'])
  }
  const doc = parseUserDocument(userId, data)
  if (!doc) return fail(['document id required'])

  const permissions: UserPermissions = {
    ...doc.permissions,
    developerAccess: doc.operativeMode ? false : readFlag(data, 'developerAccess') === true,
  }
  const managerIds = doc.assignedManagerUserIds

  return ok({
    id: doc.id,
    email,
    firstName: doc.firstName,
    surname: doc.surname,
    organizationId,
    role: doc.role as UserRole,
    isActive: doc.isActive,
    passwordSet: doc.passwordSet,
    status: doc.status ?? undefined,
    isSuperAdmin: doc.isSuperAdmin,
    mobileNumber: doc.mobileNumber ?? undefined,
    permissions,
    assignedManagerUserIds: managerIds.length ? managerIds : undefined,
    assignedManagerUserId: managerIds[0],
    hasNoLineManager: doc.hasNoLineManager,
    formerUserIds: doc.formerUserIds.length > 0 ? doc.formerUserIds : undefined,
    payBasis: doc.payBasis ?? undefined,
    dayRate: doc.dayRate ?? undefined,
    hourlyRate: doc.hourlyRate ?? undefined,
    tradeTypePreset: doc.tradeTypePreset ?? undefined,
    tradeTypeCustom: doc.tradeTypeCustom ?? undefined,
    employmentType: doc.employmentType,
    employmentTypeTransitionFrom: doc.employmentTypeTransitionFrom ?? undefined,
    employmentTypeEffectiveAt: msDate(doc.employmentTypeEffectiveAtMs),
    lastSeenAt: msDate(doc.lastSeenAtMs),
    profilePhotoURL: doc.profilePhotoURL ?? undefined,
    annualLeaveEnabled: doc.annualLeaveEnabled,
    annualLeaveDaysPerYear: doc.annualLeaveStored.daysPerYear ?? undefined,
    annualLeaveYearStartMonth: doc.annualLeaveStored.startMonth ?? undefined,
    annualLeaveYearEndMonth: doc.annualLeaveStored.endMonth ?? undefined,
    annualLeaveCarriesOver: doc.annualLeaveStored.carriesOver === true,
    employmentStartDate: doc.employmentStartDayKey ?? undefined,
    annualLeaveYearAllowance: doc.annualLeaveYearAllowance ?? undefined,
    annualLeaveYearAllowanceKey: doc.annualLeaveYearAllowanceKey ?? undefined,
    timesheetsEnabled: doc.timesheetsEnabled,
    vatNumber: asOptionalString(data.vatNumber),
    utrNumber: asOptionalString(data.utrNumber),
    policyAccepted: doc.policyAccepted,
    policyAcceptedAt: msDate(doc.policyAcceptedAtMs),
    legalPackVersion: doc.legalPackVersion ?? undefined,
    accountConfirmed: data.accountConfirmed !== false,
    accountConfirmToken: asOptionalString(data.accountConfirmToken),
    createdAt: msDate(doc.createdAtMs) || new Date(),
    updatedAt: msDate(doc.updatedAtMs) || new Date(),
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
    developerAccess: operativeMode ? false : permissions.developerAccess === true,
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
    payload.tradeTypePreset = user.tradeTypePreset?.trim() || deleteField()
    payload.tradeTypeCustom = user.tradeTypeCustom?.trim() || deleteField()
    payload.timesheetsEnabled = user.timesheetsEnabled === true
  }

  applyExclusiveRateFields(payload, user)

  if (user.annualLeaveDaysPerYear != null) payload.annualLeaveDaysPerYear = user.annualLeaveDaysPerYear
  if (user.annualLeaveYearStartMonth != null) {
    payload.annualLeaveYearStartMonth = Math.trunc(user.annualLeaveYearStartMonth)
  }
  if (user.annualLeaveYearEndMonth != null) {
    payload.annualLeaveYearEndMonth = Math.trunc(user.annualLeaveYearEndMonth)
  }
  if (user.annualLeaveYearAllowance != null) {
    payload.annualLeaveYearAllowance = user.annualLeaveYearAllowance
  }
  if (user.annualLeaveYearAllowanceKey?.trim()) {
    payload.annualLeaveYearAllowanceKey = user.annualLeaveYearAllowanceKey.trim()
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
  // Rulebook reader shared with iOS (lib/canonical/bookings.ts).
  const result = parseBookingDocument(docId, data)
  if (!result.ok) return fail(result.errors)
  const row = result.booking
  return ok({
    id: row.id,
    operativeId: row.operativeId,
    projectId: row.projectId,
    date: new Date(row.dateMs),
    timeSlot: row.timeSlot,
    bookedBy: row.bookedBy,
    notes: row.notes,
    status: row.status,
    workStartTime: row.workStartTime,
    workEndTime: row.workEndTime,
    isBreakRemoved: row.isBreakRemoved,
    otMultiplierOverride: row.otMultiplierOverride,
    bookingGroupId: row.bookingGroupId,
    ...(row.jobCollection ? { jobCollection: row.jobCollection } : {}),
    createdAt: row.createdAtMs != null ? new Date(row.createdAtMs) : new Date(),
    updatedAt: row.updatedAtMs != null ? new Date(row.updatedAtMs) : new Date(),
    organizationId,
  })
}

/** iOS saveBooking ~L5169, merge, uppercase UUID doc id + denormalised id. Shape: bookingWriteFields. */
export function serializeBooking(booking: Booking): Record<string, unknown> {
  const date = booking.date instanceof Date ? booking.date : new Date(booking.date)
  const createdAt = booking.createdAt instanceof Date ? booking.createdAt : new Date()
  const written = bookingWriteFields({
    id: booking.id?.trim() || newUppercaseUuid(),
    operativeId: booking.operativeId,
    projectId: booking.projectId,
    dateMs: date.getTime(),
    timeSlot: String(booking.timeSlot ?? ''),
    status: String(booking.status ?? ''),
    bookedBy: booking.bookedBy,
    notes: booking.notes ?? '',
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
    isBreakRemoved: booking.isBreakRemoved === true,
    otMultiplierOverride: booking.otMultiplierOverride ?? undefined,
    bookingGroupId: booking.bookingGroupId ?? undefined,
    jobCollection: booking.jobCollection ?? undefined,
    createdAtMs: createdAt.getTime(),
    updatedAtMs: Date.now(),
  })
  if (!written.ok) {
    throw new IosWriteValidationError('Invalid booking write (iOS would skip this record)', written.errors)
  }
  const f = written.fields
  const payload: Record<string, unknown> = {
    ...f,
    date: asTimestamp(new Date(Number(f.date))),
    createdAt: asTimestamp(new Date(Number(f.createdAt))),
    updatedAt: asTimestamp(new Date(Number(f.updatedAt))),
  }
  if (!('workStartTime' in f)) payload.workStartTime = deleteField()
  if (!('workEndTime' in f)) payload.workEndTime = deleteField()
  if (!('otMultiplierOverride' in f)) {
    if (booking.otMultiplierOverride === null) payload.otMultiplierOverride = deleteField()
  }
  if (!('bookingGroupId' in f)) {
    if (booking.bookingGroupId === null || typeof booking.bookingGroupId === 'string') payload.bookingGroupId = deleteField()
  }
  return payload
}

export function parseManagerSiteBooking(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<ManagerSiteBooking> {
  // Rulebook reader shared with iOS (lib/canonical/bookings.ts).
  const result = parseManagerSiteBookingDocument(docId, data)
  if (!result.ok) return fail(result.errors)
  const row = result.booking
  return ok({
    id: docId,
    userId: row.userId,
    date: new Date(row.dateMs),
    timeSlot: row.timeSlot,
    locationType: row.locationType,
    locationId: row.locationId,
    customLocationName: row.customLocationName,
    workStartTime: row.workStartTime,
    workEndTime: row.workEndTime,
    isBreakRemoved: row.isBreakRemoved,
    bookingGroupId: row.bookingGroupId,
    ...(row.jobCollection ? { jobCollection: row.jobCollection } : {}),
    createdAt: row.createdAtMs != null ? new Date(row.createdAtMs) : new Date(),
    updatedAt: row.updatedAtMs != null ? new Date(row.updatedAtMs) : new Date(),
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
  // Rulebook 1.11.0 `bookingJobCollectionFields`: a job-linked booking carries its job's collection; none otherwise.
  const kind = bookingJobCollectionFields({ collection: 'managerSiteBookings', jobCollection: booking.jobCollection, locationType: v.locationType })
  payload.jobCollection = kind.jobCollection ?? deleteField()
  if (booking.bookingGroupId == null) {
    if (booking.bookingGroupId === null) payload.bookingGroupId = deleteField()
  } else if (booking.bookingGroupId.trim()) {
    payload.bookingGroupId = booking.bookingGroupId.trim()
  } else {
    payload.bookingGroupId = deleteField()
  }
  return payload
}

export function projectFromJobDocument(docId: string, data: Record<string, unknown>, organizationId: string): Project {
  const job = parseJobDocument(docId, data) ?? parseJobDocument(docId || 'unknown', {})!
  const fallback = new Date()
  return {
    id: docId,
    jobNumber: job.jobNumber,
    siteName: job.siteName,
    addressLine1: job.addressLine1,
    addressLine2: job.addressLine2 ?? undefined,
    townCity: job.townCity,
    postcode: job.postcode,
    client: {
      id: job.client.id,
      name: job.client.name,
      email: job.client.email ?? undefined,
      phone: job.client.phone ?? undefined,
      createdAt: fallback,
      updatedAt: fallback,
    },
    startDate: job.startMs != null ? new Date(job.startMs) : fallback,
    endDate: job.endMs != null ? new Date(job.endMs) : fallback,
    jobType: job.jobType || 'CAT A',
    customJobType: job.customJobType ?? undefined,
    manager: {
      name: job.managerName || 'Project Manager',
      email: '',
    },
    managerId: job.managerId ?? undefined,
    managerIds: job.managerIds,
    managerUserIds: job.managerUserIds,
    isLive: job.isLive,
    description: job.description ?? undefined,
    notes: job.notes ?? undefined,
    siteAddress: job.siteAddress || undefined,
    latitude: job.latitude ?? undefined,
    longitude: job.longitude ?? undefined,
    usesMapPinForLocation: job.usesMapPinForLocation,
    hiddenManagerUserIds: job.hiddenManagerUserIds,
    hiddenOperativeUserIds: job.hiddenOperativeUserIds,
    status: job.status ?? undefined,
    organizationId,
    createdAt: job.createdAtMs != null ? new Date(job.createdAtMs) : fallback,
    updatedAt: job.updatedAtMs != null ? new Date(job.updatedAtMs) : fallback,
  }
}

export function parseProject(
  docId: string,
  data: Record<string, unknown>,
  organizationId: string
): ParseResult<Project> {
  const job = parseJobDocument(docId, data)
  if (!job) return fail(['legacy placeholder or blank id'])
  if (!job.siteName) return fail(['siteName missing'])
  return ok(projectFromJobDocument(docId, data, organizationId))
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
  managerName?: string
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
    manager: input.managerName?.trim() || undefined,
    managerId: input.managerId,
    managerIds: input.managerIds,
    isLive: input.isLive,
    description: input.description?.trim() || '',
    hiddenManagerUserIds: input.hiddenManagerUserIds,
    hiddenOperativeUserIds: input.hiddenOperativeUserIds,
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
    isLive: v.isLive,
    description: v.description,
    organizationId: v.organizationId,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
    usesMapPinForLocation: v.usesMapPinForLocation,
  }
  const managerName = input.managerName?.trim()
  if (managerName && managerName.toLowerCase() !== 'custom') payload.manager = managerName
  if (input.hiddenManagerUserIds) payload.hiddenManagerUserIds = input.hiddenManagerUserIds
  if (input.hiddenOperativeUserIds) payload.hiddenOperativeUserIds = input.hiddenOperativeUserIds
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
  const operativeIds = task.assignedOperativeIds?.filter(Boolean) || []
  const managerIds = task.assignedManagerIds?.filter(Boolean) || []
  if (operativeIds.length) payload.assignedOperativeIds = operativeIds
  if (managerIds.length) payload.assignedManagerIds = managerIds
  return payload
}

/**
 * Data-health read of one `holidayBookings` document. It reads through the rulebook reader
 * `parseHolidayDocument` (rulebook §9) — the same keys, status words, ids and organisation-zone day keys
 * as the holiday store and iOS — and fails only when that reader cannot read the document.
 */
export function parseHoliday(
  docId: string,
  data: Record<string, unknown>,
  organizationId: string,
  timeZone?: string | null
): ParseResult<HolidayBooking> {
  const zone = organizationZoneOr(timeZone)
  const parsed = parseHolidayDocument(docId, data, zone)
  if (!parsed) return fail(['holiday has no readable start date'])
  return ok({
    id: parsed.id,
    organizationId: parsed.organizationId ?? organizationId,
    userId: parsed.userId ?? undefined,
    operativeId: parsed.operativeId ?? undefined,
    startDate: dateFromDayKeyInZone(parsed.startDayKey, zone),
    endDate: dateFromDayKeyInZone(parsed.endDayKey, zone),
    startDayKey: parsed.startDayKey,
    endDayKey: parsed.endDayKey,
    dayKeyTimeZone: zone,
    status: parsed.status,
    timeSlot: parsed.timeSlot,
    approvedByUserId: parsed.approvedByUserId ?? undefined,
    approvedAt: asDate(data.approvedAt),
    cancellationRequestedAt: asDate(data.cancellationRequestedAt),
    cancellationRequestedByUserId: parsed.cancellationRequestedByUserId ?? undefined,
    decisionNote: parsed.decisionNote ?? undefined,
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

/** `clients/{id}` through the rulebook reader `parseClientDocument` (id = document id, stored case). */
export function parseClient(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<Client> {
  const doc = parseClientDocument(docId, data)
  if (!doc) return fail(['name required'])
  return ok({
    id: doc.id,
    name: doc.name,
    contactPerson: doc.contactPerson ?? undefined,
    email: doc.email ?? undefined,
    phone: doc.phone ?? undefined,
    address: doc.address ?? undefined,
    organizationId,
    createdAt: msDate(doc.createdAtMs) || new Date(),
    updatedAt: msDate(doc.updatedAtMs) || new Date(),
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

/**
 * `operatives/{id}` through the rulebook reader `parseOperativeDocument` (id = document id, stored case;
 * `payBasis` honoured). Legacy placeholder rows are skipped, as on iOS.
 */
export function parseOperative(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<Operative> {
  const doc = parseOperativeDocument(docId, data, organizationZoneOr(null))
  if (!doc) return fail(['firstName or lastName required'])
  if (doc.isPlaceholder) return fail(['legacy placeholder row'])
  return ok({
    id: doc.id,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    phone: doc.phone ?? undefined,
    startDate: msDate(doc.startDateMs) || new Date(),
    payBasis: doc.payBasis ?? undefined,
    dayRate: doc.dayRate ?? undefined,
    hourlyRate: doc.hourlyRate ?? 0,
    skills: doc.skills,
    qualifications: doc.qualifications.map((row) => ({
      id: row.id,
      name: row.name,
      hasEndDate: row.hasEndDate,
      endDate: msDate(row.endDateMs),
      createdAt: msDate(row.createdAtMs) || new Date(),
      updatedAt: msDate(row.updatedAtMs) || msDate(row.createdAtMs) || new Date(),
    })),
    isActive: doc.isActive,
    tradeTypePreset: doc.tradeTypePreset ?? undefined,
    tradeTypeCustom: doc.tradeTypeCustom ?? undefined,
    notes: doc.notes ?? undefined,
    organizationId,
    createdAt: msDate(doc.createdAtMs) || new Date(),
    updatedAt: msDate(doc.updatedAtMs) || new Date(),
    qualificationExpiryDates: Object.fromEntries(
      Object.entries(doc.qualificationExpiryDates).map(([key, ms]) => [key, new Date(ms)])
    ),
    qualificationCertificateURLs: doc.qualificationCertificateURLs,
  })
}

function serializeAssignedQualification(row: Qualification): Record<string, unknown> | null {
  const write = assignedQualificationWriteFields({
    id: row.id,
    name: row.name,
    hasEndDate: row.hasEndDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    endDate: row.endDate,
  })
  if (!write) return null
  const payload: Record<string, unknown> = {
    id: write.id,
    name: write.name,
    hasEndDate: write.hasEndDate,
    createdAt: asTimestamp(new Date(write.createdAtIso)),
    updatedAt: asTimestamp(new Date(write.updatedAtIso)),
  }
  if (write.endDateIso) payload.endDate = asTimestamp(new Date(write.endDateIso))
  return payload
}

/**
 * iOS Operative.skills is Set<String>. saveOperative writes that array of catalogue ids.
 * loadOperatives casts `skills` with `as? [String]` and drops the whole list when a row is a map.
 */
export function operativeSkillToken(skill: Skill | string): string {
  if (typeof skill === 'string') return skill.trim()
  const id = String(skill.id || '').trim()
  if (id) return id
  return String(skill.name || '').trim()
}

function serializeStringMap(raw: Record<string, string> | undefined): Record<string, string> {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw || {})) {
    if (typeof value === 'string' && value) output[key] = value
  }
  return output
}

/**
 * iOS OperativeStore.save — organizations/{orgId}/operatives/{uuidString}
 * `options.currencyCode`: the organisation currency (`currentOrganizationCurrency()`), so the
 * stored `currencySymbol` follows the company rather than a hard-coded pound sign.
 */
export function serializeOperative(
  operative: Operative & { organizationId: string },
  options?: { currencyCode?: string | null }
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
    hourlyRate: operative.payBasis === 'hourly' ? operative.hourlyRate || 0 : operative.hourlyRate || 0,
    dayRate: operative.dayRate ?? 0,
    currencySymbol: currencySymbol(options?.currencyCode || DEFAULT_CURRENCY_CODE),
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
  return omitUndefinedDeep({
    id: v.id,
    firstName: v.firstName,
    lastName: v.lastName,
    name: v.name,
    email: v.email,
    phone: v.phone,
    startDate: asTimestamp(v.startDate),
    skills: (v.skills as (Skill | string)[]).map(operativeSkillToken).filter(Boolean),
    qualifications: (v.qualifications as Qualification[])
      .map(serializeAssignedQualification)
      .filter((row): row is Record<string, unknown> => row !== null),
    isActive: v.isActive,
    currencySymbol: v.currencySymbol,
    notes: v.notes,
    ...operativeRosterRateFields(operative),
    tradeTypePreset: v.tradeTypePreset,
    tradeTypeCustom: v.tradeTypeCustom,
    organizationId: v.organizationId,
    createdAt: asTimestamp(v.createdAt),
    updatedAt: asTimestamp(v.updatedAt),
    qualificationExpiryDates: Object.fromEntries(
      Object.entries(operative.qualificationExpiryDates || {}).flatMap(([key, value]) => {
        const date = value instanceof Date ? value : new Date(value)
        if (Number.isNaN(date.getTime())) return []
        return [[key, asTimestamp(date)] as const]
      })
    ),
    qualificationCertificateURLs: serializeStringMap(operative.qualificationCertificateURLs),
  })
}

/** `managers/{id}` through the rulebook reader `parseManagerDocument` (id = document id; pay basis honoured). */
export function parseManager(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<Manager> {
  const doc = parseManagerDocument(docId, data)
  if (!doc || !doc.firstName || !doc.email) return fail(['firstName and email required'])
  return ok({
    id: doc.id,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    phone: doc.phone ?? doc.mobile ?? undefined,
    mobile: doc.mobile ?? undefined,
    department: doc.department ?? undefined,
    isActive: doc.isActive,
    notes: doc.notes ?? undefined,
    tradeTypePreset: doc.tradeTypePreset ?? undefined,
    tradeTypeCustom: doc.tradeTypeCustom ?? undefined,
    payBasis: doc.payBasis ?? undefined,
    dayRate: doc.dayRate ?? undefined,
    hourlyRate: doc.hourlyRate ?? undefined,
    organizationId,
    createdAt: msDate(doc.createdAtMs) || new Date(),
    updatedAt: msDate(doc.updatedAtMs) || new Date(),
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
    ...exclusiveRateDocumentFields(manager),
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
  dayKey?: string
  catalogue?: 'projects' | 'smallWorks'
}

/**
 * An inbox row through the rulebook reader `parseNotificationDocument` (rulebook 1.8.0): the type is kept as stored
 * (an unknown type is not dropped), `relatedId` keeps any shape, and a missing title, message or read flag defaults.
 */
export function parseNotification(
  docId: string,
  data: Record<string, unknown>,
  organizationId?: string
): ParseResult<AppInboxNotification> {
  const parsed = parseNotificationDocument(docId, data, { organizationId: organizationId ?? null })
  if (!parsed) return fail(['type required'])
  const orgId = parsed.organizationId || organizationId || ''
  if (!orgId) return fail(['organizationId required'])
  return ok({
    id: parsed.id,
    organizationId: orgId,
    type: parsed.type,
    title: parsed.title,
    message: parsed.message,
    userId: parsed.userId ?? undefined,
    relatedId: parsed.relatedId ?? undefined,
    isRead: parsed.isRead,
    createdAt: parsed.createdAtMs != null ? new Date(parsed.createdAtMs) : new Date(0),
    requiresPermission: parsed.requiresPermission ?? undefined,
    deepLinkUserId: parsed.deepLinkUserId ?? undefined,
    deepLinkWeekStart: parsed.deepLinkWeekStartMs != null ? new Date(parsed.deepLinkWeekStartMs) : undefined,
    dayKey: parsed.dayKey ?? undefined,
    catalogue: parsed.catalogue ?? undefined,
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
    assignedOperativeIds: asStringArray(data.assignedOperativeIds),
    assignedManagerIds: asStringArray(data.assignedManagerIds),
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

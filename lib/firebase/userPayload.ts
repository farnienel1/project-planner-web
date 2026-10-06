import { Timestamp, deleteField } from 'firebase/firestore'
import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'
import { readStoredRates } from '@/lib/timesheets/payBasis'

export function permissionsToFirestoreMap(permissions: UserPermissions): Record<string, boolean> {
  return {
    adminAccess: permissions.adminAccess,
    manager: permissions.manager,
    operatives: permissions.operatives,
    skills: false,
    qualifications: permissions.qualifications,
    materials: permissions.materials,
    projects: permissions.projects,
    smallWorks: permissions.smallWorks,
    operativeMode: permissions.operativeMode,
    annualLeaveSelfBook: permissions.annualLeaveSelfBook === true,
    weeklyReports: permissions.weeklyReports === true,
    dailyOverview: permissions.dailyOverview !== false,
    subContractors: permissions.subContractors,
    siteAudit: permissions.siteAudit,
    wholesalersOrderHistory: permissions.wholesalersOrderHistory !== false,
  }
}

export function normalizeLineManagerIds(ids?: string[], legacyId?: string): string[] {
  const fromArray = (ids ?? []).map((id) => id.trim()).filter(Boolean)
  if (fromArray.length > 0) return fromArray
  const single = legacyId?.trim()
  return single ? [single] : []
}

/** One basis only. The unused amount is deleted. payBasis is omitted when no rate is set. */
export function applyExclusiveRateFields(
  payload: Record<string, unknown>,
  input: { payBasis?: unknown; dayRate?: unknown; hourlyRate?: unknown }
): void {
  const stored = readStoredRates(input)
  if (stored.payBasis == null || (stored.dayRate == null && stored.hourlyRate == null)) {
    payload.payBasis = deleteField()
    payload.dayRate = deleteField()
    payload.hourlyRate = deleteField()
    return
  }
  if (stored.payBasis === 'hourly') {
    payload.payBasis = 'hourly'
    payload.hourlyRate = stored.hourlyRate ?? 0
    payload.dayRate = deleteField()
    return
  }
  payload.payBasis = 'day'
  payload.dayRate = stored.dayRate ?? 0
  payload.hourlyRate = deleteField()
}

export function applyLineManagerFields(
  payload: Record<string, unknown>,
  ids?: string[],
  legacyId?: string
): void {
  const list = normalizeLineManagerIds(ids, legacyId)
  if (list.length === 0) {
    payload.assignedManagerUserId = deleteField()
    payload.assignedManagerUserIds = deleteField()
    return
  }
  payload.assignedManagerUserIds = list
  payload.assignedManagerUserId = list[0]
}

/** Mirrors iOS FirebaseBackend.saveUser flattened user document shape. */
export function buildSaveUserPayload(user: User): Record<string, unknown> {
  const permissions = permissionsToFirestoreMap(user.permissions)
  const isSuperAdminToSave = user.permissions.operativeMode ? false : user.isSuperAdmin
  const firstName = user.firstName.trim()
  const surname = user.surname.trim()
  const displayName = `${firstName} ${surname}`.trim()

  const payload: Record<string, unknown> = {
    email: user.email.toLowerCase().trim(),
    role: user.role,
    firstName,
    surname,
    lastName: surname,
    name: displayName,
    displayName,
    isActive: user.isActive,
    passwordSet: user.passwordSet,
    isSuperAdmin: isSuperAdminToSave,
    policyAccepted: user.policyAccepted,
    employmentType: user.employmentType || 'self_employed',
    updatedAt: Timestamp.now(),
    permissions,
    ...permissions,
    adminAccess: user.permissions.operativeMode ? false : user.permissions.adminAccess,
    manager: user.permissions.operativeMode ? false : user.permissions.manager,
    operatives: user.permissions.operativeMode ? false : user.permissions.operatives,
    skills: false,
    qualifications: user.permissions.operativeMode ? false : user.permissions.qualifications,
    materials: user.permissions.operativeMode ? user.permissions.materials : true,
    siteAudit: user.permissions.operativeMode ? user.permissions.siteAudit : true,
    projects: user.permissions.projects,
    smallWorks: user.permissions.smallWorks,
    operativeMode: user.permissions.operativeMode,
    annualLeaveEnabled: user.annualLeaveEnabled !== false,
    annualLeaveCarriesOver: user.annualLeaveCarriesOver === true,
  }

  if (user.createdAt) payload.createdAt = Timestamp.fromDate(user.createdAt)

  const mobile = user.mobileNumber?.trim()
  payload.mobileNumber = mobile ? mobile : deleteField()

  if (user.permissions.operativeMode || user.permissions.manager) {
    applyLineManagerFields(
      payload,
      user.assignedManagerUserIds,
      user.assignedManagerUserId
    )

    const preset = user.tradeTypePreset?.trim()
    payload.tradeTypePreset = preset ? preset : deleteField()
    const custom = user.tradeTypeCustom?.trim()
    payload.tradeTypeCustom = custom ? custom : deleteField()
  }

  if (user.annualLeaveDaysPerYear != null) payload.annualLeaveDaysPerYear = user.annualLeaveDaysPerYear
  if (user.annualLeaveYearStartMonth != null) payload.annualLeaveYearStartMonth = user.annualLeaveYearStartMonth
  if (user.annualLeaveYearEndMonth != null) payload.annualLeaveYearEndMonth = user.annualLeaveYearEndMonth

  if (user.permissions.operativeMode || user.permissions.manager) {
    payload.timesheetsEnabled = user.timesheetsEnabled === true
    const vat = user.vatNumber?.trim()
    payload.vatNumber = vat ? vat : deleteField()
    const utr = user.utrNumber?.trim()
    payload.utrNumber = utr ? utr : deleteField()
  }

  if (user.employmentTypeTransitionFrom) {
    payload.employmentTypeTransitionFrom = user.employmentTypeTransitionFrom
  }
  if (user.employmentTypeEffectiveAt) {
    payload.employmentTypeEffectiveAt = Timestamp.fromDate(user.employmentTypeEffectiveAt)
  }
  if (user.policyAcceptedAt) payload.policyAcceptedAt = Timestamp.fromDate(user.policyAcceptedAt)
  if (user.profilePhotoURL?.trim()) payload.profilePhotoURL = user.profilePhotoURL.trim()

  applyExclusiveRateFields(payload, user)
  return payload
}

export function buildInvitedUserPayload(params: {
  userId: string
  email: string
  organizationId: string
  firstName: string
  surname: string
  permissions: UserPermissions
  mobileNumber?: string
  assignedManagerUserId?: string
  assignedManagerUserIds?: string[]
  dayRate?: number
  hourlyRate?: number
  payBasis?: 'day' | 'hourly'
  tradeTypePreset?: string
  tradeTypeCustom?: string
  employmentType?: 'paye' | 'self_employed' | 'selfEmployed'
  timesheetsEnabled?: boolean
  vatNumber?: string
  utrNumber?: string
  annualLeaveEnabled?: boolean
  annualLeaveDaysPerYear?: number
  annualLeaveYearStartMonth?: number
  annualLeaveYearEndMonth?: number
}): Record<string, unknown> {
  const { permissions } = params
  let role: UserRole = UserRole.BASIC
  if (permissions.adminAccess) role = UserRole.ADMIN
  else if (permissions.manager) role = UserRole.MANAGER
  else if (permissions.operativeMode) role = UserRole.OPERATIVE

  const payload: Record<string, unknown> = {
    email: params.email.toLowerCase().trim(),
    organizationId: params.organizationId,
    role: role,
    firstName: params.firstName.trim(),
    surname: params.surname.trim(),
    isActive: true,
    passwordSet: false,
    isSuperAdmin: false,
    policyAccepted: false,
    employmentType: params.employmentType === 'paye' ? 'paye' : 'self_employed',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    permissions: permissionsToFirestoreMap(permissions),
    ...permissionsToFirestoreMap(permissions),
  }

  if (params.mobileNumber?.trim()) payload.mobileNumber = params.mobileNumber.trim()
  if (permissions.operativeMode || permissions.manager) {
    applyLineManagerFields(payload, params.assignedManagerUserIds, params.assignedManagerUserId)
  }
  if (params.payBasis === 'hourly' || params.payBasis === 'day' || params.dayRate != null || params.hourlyRate != null) {
    const basis = params.payBasis === 'hourly' ? 'hourly' : params.hourlyRate != null && params.dayRate == null ? 'hourly' : 'day'
    const amount = basis === 'hourly' ? params.hourlyRate ?? params.dayRate : params.dayRate ?? params.hourlyRate
    if (amount != null) {
      if (basis === 'hourly') {
        payload.payBasis = 'hourly'
        payload.hourlyRate = amount
      } else {
        payload.payBasis = 'day'
        payload.dayRate = amount
      }
    }
  }
  if (params.tradeTypePreset?.trim()) payload.tradeTypePreset = params.tradeTypePreset.trim()
  if (params.tradeTypeCustom?.trim()) payload.tradeTypeCustom = params.tradeTypeCustom.trim()
  if (params.permissions.manager || params.permissions.operativeMode) {
    payload.timesheetsEnabled = params.timesheetsEnabled === true
  }

  if (params.vatNumber?.trim()) payload.vatNumber = params.vatNumber.trim()
  if (params.utrNumber?.trim()) payload.utrNumber = params.utrNumber.trim()

  if (params.annualLeaveEnabled != null) {
    payload.annualLeaveEnabled = params.annualLeaveEnabled !== false
  }
  if (params.annualLeaveDaysPerYear != null) {
    payload.annualLeaveDaysPerYear = params.annualLeaveDaysPerYear
  }
  if (params.annualLeaveYearStartMonth != null) {
    payload.annualLeaveYearStartMonth = params.annualLeaveYearStartMonth
  }
  if (params.annualLeaveYearEndMonth != null) {
    payload.annualLeaveYearEndMonth = params.annualLeaveYearEndMonth
  }

  return payload
}

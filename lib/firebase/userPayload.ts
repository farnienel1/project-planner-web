import { Timestamp, deleteField } from 'firebase/firestore'
import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'

export function permissionsToFirestoreMap(permissions: UserPermissions): Record<string, boolean> {
  return {
    adminAccess: permissions.adminAccess,
    manager: permissions.manager,
    operatives: permissions.operatives,
    skills: permissions.skills,
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

function resolveRole(user: User): UserRole {
  if (user.permissions.operativeMode) return UserRole.OPERATIVE
  if (user.permissions.adminAccess) return UserRole.ADMIN
  if (user.permissions.manager) return UserRole.MANAGER
  return user.role
}

/** Mirrors iOS FirebaseBackend.saveUser flattened user document shape. */
export function buildSaveUserPayload(user: User): Record<string, unknown> {
  const permissions = permissionsToFirestoreMap(user.permissions)
  const isSuperAdminToSave = user.permissions.operativeMode ? false : user.isSuperAdmin

  const payload: Record<string, unknown> = {
    email: user.email.toLowerCase().trim(),
    organizationId: user.organizationId,
    role: resolveRole(user),
    firstName: user.firstName.trim(),
    surname: user.surname.trim(),
    isActive: user.isActive,
    passwordSet: user.passwordSet,
    isSuperAdmin: isSuperAdminToSave,
    policyAccepted: user.policyAccepted,
    employmentType: user.employmentType || 'selfEmployed',
    updatedAt: Timestamp.now(),
    permissions,
    ...permissions,
    adminAccess: user.permissions.operativeMode ? false : user.permissions.adminAccess,
    manager: user.permissions.operativeMode ? false : user.permissions.manager,
    operatives: user.permissions.operativeMode ? false : user.permissions.operatives,
    skills: user.permissions.operativeMode ? false : user.permissions.skills,
    qualifications: user.permissions.operativeMode ? false : user.permissions.qualifications,
    materials: user.permissions.operativeMode ? user.permissions.materials : true,
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
    const managerId = user.assignedManagerUserId?.trim()
    payload.assignedManagerUserId = managerId ? managerId : deleteField()

    const dayRate = user.dayRate
    const hourlyRate = user.hourlyRate
    if (dayRate != null && dayRate > 0) {
      payload.dayRate = dayRate
      payload.hourlyRate = deleteField()
    } else if (hourlyRate != null && hourlyRate > 0) {
      payload.hourlyRate = hourlyRate
      payload.dayRate = deleteField()
    }

    const preset = user.tradeTypePreset?.trim()
    payload.tradeTypePreset = preset ? preset : deleteField()
    const custom = user.tradeTypeCustom?.trim()
    payload.tradeTypeCustom = custom ? custom : deleteField()
  }

  if (user.annualLeaveDaysPerYear != null) payload.annualLeaveDaysPerYear = user.annualLeaveDaysPerYear
  if (user.annualLeaveYearStartMonth != null) payload.annualLeaveYearStartMonth = user.annualLeaveYearStartMonth
  if (user.annualLeaveYearEndMonth != null) payload.annualLeaveYearEndMonth = user.annualLeaveYearEndMonth

  if (user.employmentTypeTransitionFrom) {
    payload.employmentTypeTransitionFrom = user.employmentTypeTransitionFrom
  }
  if (user.employmentTypeEffectiveAt) {
    payload.employmentTypeEffectiveAt = Timestamp.fromDate(user.employmentTypeEffectiveAt)
  }
  if (user.policyAcceptedAt) payload.policyAcceptedAt = Timestamp.fromDate(user.policyAcceptedAt)
  if (user.profilePhotoURL?.trim()) payload.profilePhotoURL = user.profilePhotoURL.trim()

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
  dayRate?: number
  tradeTypePreset?: string
  tradeTypeCustom?: string
  employmentType?: 'paye' | 'selfEmployed'
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
    employmentType: params.employmentType || 'selfEmployed',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    permissions: permissionsToFirestoreMap(permissions),
    ...permissionsToFirestoreMap(permissions),
  }

  if (params.mobileNumber?.trim()) payload.mobileNumber = params.mobileNumber.trim()
  if ((permissions.operativeMode || permissions.manager) && params.assignedManagerUserId) {
    payload.assignedManagerUserId = params.assignedManagerUserId
  }
  if ((permissions.operativeMode || permissions.manager) && params.dayRate != null) {
    payload.dayRate = params.dayRate
  }
  if (params.tradeTypePreset?.trim()) payload.tradeTypePreset = params.tradeTypePreset.trim()
  if (params.tradeTypeCustom?.trim()) payload.tradeTypeCustom = params.tradeTypeCustom.trim()

  return payload
}

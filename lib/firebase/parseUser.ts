import type { User } from '@/types'
import { UserRole } from '@/types'
import { parseUserPermissions } from '@/lib/navigation/menuPermissions'
import { parseFirestoreDate, parseOptionalString, parseString } from '@/lib/firebase/firestoreUtils'

export function parseOrgUser(docId: string, data: Record<string, unknown>): User | null {
  const email = parseString(data.email)
  const organizationId = parseString(data.organizationId)
  if (!email || !organizationId) return null
  const isSuperAdmin = data.isSuperAdmin === true

  return {
    id: docId,
    email,
    firstName: parseString(data.firstName),
    surname: parseString(data.surname),
    organizationId,
    role: (parseString(data.role) as UserRole) || UserRole.BASIC,
    isActive: data.isActive !== false,
    passwordSet: data.passwordSet !== false,
    isSuperAdmin,
    mobileNumber: parseOptionalString(data.mobileNumber),
    permissions: parseUserPermissions(data, isSuperAdmin),
    assignedManagerUserId: parseOptionalString(data.assignedManagerUserId),
    dayRate: typeof data.dayRate === 'number' ? data.dayRate : undefined,
    hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : undefined,
    tradeTypePreset: parseOptionalString(data.tradeTypePreset),
    tradeTypeCustom: parseOptionalString(data.tradeTypeCustom),
    employmentType: parseOptionalString(data.employmentType) || 'selfEmployed',
    employmentTypeTransitionFrom: parseOptionalString(data.employmentTypeTransitionFrom),
    employmentTypeEffectiveAt: parseFirestoreDate(data.employmentTypeEffectiveAt),
    lastSeenAt: parseFirestoreDate(data.lastSeenAt),
    profilePhotoURL: parseOptionalString(data.profilePhotoURL),
    annualLeaveEnabled: data.annualLeaveEnabled !== false,
    annualLeaveDaysPerYear:
      typeof data.annualLeaveDaysPerYear === 'number' ? data.annualLeaveDaysPerYear : undefined,
    annualLeaveYearStartMonth:
      typeof data.annualLeaveYearStartMonth === 'number' ? data.annualLeaveYearStartMonth : undefined,
    annualLeaveYearEndMonth:
      typeof data.annualLeaveYearEndMonth === 'number' ? data.annualLeaveYearEndMonth : undefined,
    annualLeaveCarriesOver: data.annualLeaveCarriesOver === true,
    timesheetsEnabled: data.timesheetsEnabled === true,
    vatNumber: parseOptionalString(data.vatNumber),
    utrNumber: parseOptionalString(data.utrNumber),
    policyAccepted: data.policyAccepted === true,
    policyAcceptedAt: parseFirestoreDate(data.policyAcceptedAt),
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    updatedAt: parseFirestoreDate(data.updatedAt) || new Date(),
  }
}

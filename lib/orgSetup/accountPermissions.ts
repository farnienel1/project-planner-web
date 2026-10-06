import type { UserPermissions } from '@/types'
import { normalizeEmploymentType } from '@/lib/ios-parity/enums'

/** Operatives, and self-employed managers and administrators, get timesheets. PAYE managers and administrators do not. */
export function timesheetsEnabledForAccount(
  accountType: 'operative' | 'manager' | 'admin',
  employmentType: string | null | undefined
): boolean {
  if (accountType === 'operative') return true
  return normalizeEmploymentType(employmentType) !== 'paye'
}

export function defaultPermissionsBase(): UserPermissions {
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: false,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    siteAudit: true,
    subContractors: false,
    wholesalersOrderHistory: true,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
  }
}

export function permissionsForManagerInvite(): UserPermissions {
  return {
    adminAccess: false,
    manager: true,
    operatives: false,
    skills: false,
    qualifications: true,
    materials: true,
    projects: false,
    smallWorks: false,
    operativeMode: false,
    siteAudit: true,
    subContractors: false,
    wholesalersOrderHistory: true,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
  }
}

export function permissionsForOperativeInvite(): UserPermissions {
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
    siteAudit: true,
    subContractors: false,
    wholesalersOrderHistory: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: false,
  }
}

/** All manager permission flags enabled — used when inviting administrators. */
export function permissionsForAdminInvite(): UserPermissions {
  return {
    adminAccess: true,
    manager: true,
    operatives: true,
    skills: false,
    qualifications: true,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    siteAudit: true,
    subContractors: true,
    wholesalersOrderHistory: true,
    annualLeaveSelfBook: false,
    weeklyReports: true,
    dailyOverview: true,
  }
}

export function permissionsForAccountType(
  accountType: 'operative' | 'manager' | 'admin'
): UserPermissions {
  if (accountType === 'admin') {
    return permissionsForAdminInvite()
  }

  if (accountType === 'manager') {
    return permissionsForManagerInvite()
  }

  return permissionsForOperativeInvite()
}

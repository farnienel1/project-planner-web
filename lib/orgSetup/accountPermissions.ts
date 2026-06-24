import type { UserPermissions } from '@/types'

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
    qualifications: false,
    materials: false,
    projects: false,
    smallWorks: false,
    operativeMode: false,
    siteAudit: false,
    subContractors: false,
    wholesalersOrderHistory: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: false,
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
    projects: false,
    smallWorks: false,
    operativeMode: true,
    siteAudit: false,
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
    skills: true,
    qualifications: true,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    siteAudit: true,
    subContractors: true,
    wholesalersOrderHistory: true,
    annualLeaveSelfBook: true,
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

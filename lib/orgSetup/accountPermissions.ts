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

export function permissionsForAccountType(
  accountType: 'operative' | 'manager' | 'admin'
): UserPermissions {
  const base = defaultPermissionsBase()

  if (accountType === 'admin') {
    return {
      ...base,
      adminAccess: true,
      manager: true,
      operatives: true,
      skills: true,
      qualifications: true,
      subContractors: true,
    }
  }

  if (accountType === 'manager') {
    return {
      ...base,
      manager: true,
      operatives: true,
      skills: true,
      qualifications: true,
      subContractors: true,
    }
  }

  return { ...base, operativeMode: true, materials: true, siteAudit: true }
}

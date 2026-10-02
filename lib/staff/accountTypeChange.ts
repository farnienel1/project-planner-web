import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'

function permissionsForAccountType(accountType: 'operative' | 'manager' | 'admin'): UserPermissions {
  const base: UserPermissions = {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: true,
    projects: false,
    smallWorks: false,
    operativeMode: false,
    siteAudit: true,
    subContractors: false,
    wholesalersOrderHistory: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: false,
  }

  if (accountType === 'admin') {
    return {
      ...base,
      adminAccess: true,
      manager: true,
      operatives: true,
      qualifications: true,
      subContractors: true,
    }
  }

  if (accountType === 'manager') {
    return {
      ...base,
      manager: true,
      operatives: true,
      qualifications: true,
      subContractors: true,
    }
  }

  return { ...base, operativeMode: true, materials: true, siteAudit: true, manager: false, adminAccess: false }
}

/** Change user type sets the role. It does not turn Projects, Small Works, Weekly Report, or Daily Overview on. */
export function applyAccountTypeChange(user: User, accountType: 'operative' | 'manager' | 'admin'): User {
  const permissions = permissionsForAccountType(accountType)
  if (accountType !== 'operative') {
    permissions.projects = user.permissions.projects
    permissions.smallWorks = user.permissions.smallWorks
    permissions.weeklyReports = user.permissions.weeklyReports
    permissions.dailyOverview = user.permissions.dailyOverview
  }
  const role =
    accountType === 'admin' ? UserRole.ADMIN : accountType === 'manager' ? UserRole.MANAGER : UserRole.OPERATIVE
  return {
    ...user,
    role,
    permissions,
    isSuperAdmin: accountType === 'admin' ? user.isSuperAdmin : false,
  }
}

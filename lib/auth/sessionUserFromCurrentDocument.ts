import type { User } from '@/types'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'

function organizationIdsMatch(lhs?: string | null, rhs?: string | null): boolean {
  const left = String(lhs || '').trim().toLowerCase()
  const right = String(rhs || '').trim().toLowerCase()
  return left.length > 0 && left === right
}

/** Fields that change what this signed-in session can open. */
function accessSignature(user: User): string {
  const permissions = user.permissions
  return JSON.stringify({
    role: user.role,
    isActive: user.isActive !== false,
    isSuperAdmin: user.isSuperAdmin === true,
    annualLeaveEnabled: user.annualLeaveEnabled !== false,
    timesheetsEnabled: user.timesheetsEnabled === true,
    adminAccess: permissions.adminAccess === true,
    manager: permissions.manager === true,
    operatives: permissions.operatives === true,
    qualifications: permissions.qualifications === true,
    materials: permissions.materials === true,
    projects: permissions.projects === true,
    smallWorks: permissions.smallWorks === true,
    operativeMode: permissions.operativeMode === true,
    annualLeaveSelfBook: permissions.annualLeaveSelfBook === true,
    weeklyReports: permissions.weeklyReports === true,
    dailyOverview: permissions.dailyOverview !== false,
    subContractors: permissions.subContractors === true,
    siteAudit: permissions.siteAudit !== false,
    wholesalersOrderHistory: permissions.wholesalersOrderHistory !== false,
    developerAccess: permissions.developerAccess === true,
  })
}

/**
 * iOS UserStore.startCurrentUserListener applies the shared user document
 * while this browser is in that document's company. A snapshot from another
 * company, or an older write than the profile already in memory, is ignored.
 * Returns null when the session should stay as it is.
 */
export function sessionUserFromCurrentDocument(
  current: User,
  data: Record<string, unknown>
): User | null {
  const parsed = parseAppUserDocument(current.id, data)
  if (!parsed.ok) return null
  if (!organizationIdsMatch(parsed.value.organizationId, current.organizationId)) return null
  const snapUpdated = parsed.value.updatedAt?.getTime() ?? 0
  const memoryUpdated = current.updatedAt?.getTime() ?? 0
  if (snapUpdated + 500 < memoryUpdated) return null
  const next: User = {
    ...current,
    role: parsed.value.role,
    isActive: parsed.value.isActive,
    isSuperAdmin: parsed.value.isSuperAdmin,
    permissions: parsed.value.permissions,
    annualLeaveEnabled: parsed.value.annualLeaveEnabled,
    timesheetsEnabled: parsed.value.timesheetsEnabled,
    updatedAt: parsed.value.updatedAt || current.updatedAt,
  }
  if (accessSignature(current) === accessSignature(next)) return null
  return next
}

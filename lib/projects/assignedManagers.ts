import { classifyStoredManager, managerIdsMatch } from '@/lib/projects/projectManagerChoices'

export type AssignedManagerProject = {
  managerId?: string | null
  managerIds?: readonly string[] | null
  manager?: { name?: string | null; email?: string | null } | null
}

export type AssignedManagerRosterRow = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  isActive?: boolean
  organizationId?: string | null
}

export type AssignedManagerAccount = {
  id: string
  firstName?: string | null
  surname?: string | null
  email?: string | null
  isActive?: boolean
  passwordSet?: boolean
  status?: string | null
  organizationId?: string | null
  isSuperAdmin?: boolean
  role?: string | null
  permissions?: {
    manager?: boolean
    adminAccess?: boolean
    operativeMode?: boolean
  } | null
}

function clean(value: string | null | undefined): string {
  return String(value || '').trim()
}

const PLACEHOLDER_NAMES = new Set(['custom', 'project manager', 'n/a', 'na', 'none', 'other'])

function isPlaceholder(name: string): boolean {
  return PLACEHOLDER_NAMES.has(name.trim().toLowerCase())
}

/**
 * Every manager stored on the job, in assignment order.
 * The legacy `manager.name` field only keeps the first person, and it is often
 * the placeholder "Custom" when the roster ids are the real assignment.
 */
export function assignedManagerNames(
  project: AssignedManagerProject,
  roster: readonly AssignedManagerRosterRow[],
  accounts: readonly AssignedManagerAccount[] = [],
  organizationId?: string
): string[] {
  const ids: string[] = []
  for (const id of project.managerIds || []) {
    const value = clean(id)
    if (value && !ids.some((existing) => managerIdsMatch(existing, value))) ids.push(value)
  }
  const primary = clean(project.managerId)
  if (primary && !ids.some((existing) => managerIdsMatch(existing, primary))) ids.unshift(primary)

  const names: string[] = []
  const seen = new Set<string>()
  const push = (name: string) => {
    const value = clean(name)
    const key = value.toLowerCase()
    if (!value || isPlaceholder(value) || seen.has(key)) return
    seen.add(key)
    names.push(value)
  }

  let hidIneligible = false
  for (const id of ids) {
    const classified = classifyStoredManager(id, roster, accounts, organizationId)
    if (classified.kind === 'ineligible') {
      hidIneligible = true
      continue
    }
    if (classified.kind === 'eligible') push(classified.name)
  }

  if (names.length === 0 && !hidIneligible) push(project.manager?.name || '')
  return names
}

export function assignedManagerLabel(
  project: AssignedManagerProject,
  roster: readonly AssignedManagerRosterRow[],
  accounts: readonly AssignedManagerAccount[] = [],
  organizationId?: string
): string {
  const names = assignedManagerNames(project, roster, accounts, organizationId)
  return names.length > 0 ? names.join(', ') : '—'
}

import { managerIdsMatch, projectManagerAssignments, stableManagerDocumentId } from '@/lib/projects/projectManagerChoices'

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
  if (accounts.length === 0) {
    // The users roster has not loaded: name the catalogue rows as stored (nothing can be judged yet).
    for (const id of ids) {
      const row = roster.find((entry) => managerIdsMatch(entry.id, id) || managerIdsMatch(stableManagerDocumentId(entry.id), id))
      if (row) push(`${clean(row.firstName)} ${clean(row.lastName)}`.trim() || clean(row.email))
    }
  } else {
    // Rulebook 1.30.3 `jobManagerAssignments`: only current managers are named; a former one (operative now,
    // inactive, invite not accepted, deleted) is never shown as the job's manager.
    for (const assignment of projectManagerAssignments({ managerIds: ids }, roster, accounts, organizationId)) {
      if (assignment.state === 'former' && assignment.reason === 'no_account') {
        // A catalogue row whose users document is not on this (possibly partial) roster: named as stored.
        push(assignment.name)
        continue
      }
      if (assignment.state === 'former') {
        hidIneligible = true
        continue
      }
      if (assignment.state === 'current') push(assignment.candidate?.name || assignment.name)
    }
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

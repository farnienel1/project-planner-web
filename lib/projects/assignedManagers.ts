import { idsMatch } from '@/lib/subcontractors/bookingPeople'

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
}

export type AssignedManagerAccount = {
  id: string
  firstName?: string | null
  surname?: string | null
  email?: string | null
}

function clean(value: string | null | undefined): string {
  return String(value || '').trim()
}

function personName(row: AssignedManagerRosterRow): string {
  return `${clean(row.firstName)} ${clean(row.lastName)}`.trim() || clean(row.email)
}

function accountName(row: AssignedManagerAccount): string {
  return `${clean(row.firstName)} ${clean(row.surname)}`.trim() || clean(row.email)
}

const PLACEHOLDER_NAMES = new Set(['custom', 'project manager', 'n/a', 'na', 'none', 'other'])

function isPlaceholder(name: string): boolean {
  return PLACEHOLDER_NAMES.has(name.trim().toLowerCase())
}

function bareId(id: string): string {
  return id.toLowerCase().startsWith('user:') ? id.slice('user:'.length) : id
}

function sameId(left: string, right: string): boolean {
  return idsMatch(left, right) || idsMatch(bareId(left), bareId(right))
}

/**
 * Every manager stored on the job, in assignment order.
 * The legacy `manager.name` field only keeps the first person, and it is often
 * the placeholder "Custom" when the roster ids are the real assignment.
 */
export function assignedManagerNames(
  project: AssignedManagerProject,
  roster: readonly AssignedManagerRosterRow[],
  accounts: readonly AssignedManagerAccount[] = []
): string[] {
  const ids: string[] = []
  for (const id of project.managerIds || []) {
    const value = clean(id)
    if (value && !ids.some((existing) => sameId(existing, value))) ids.push(value)
  }
  const primary = clean(project.managerId)
  if (primary && !ids.some((existing) => sameId(existing, primary))) ids.unshift(primary)

  const names: string[] = []
  const seen = new Set<string>()
  const push = (name: string) => {
    const value = clean(name)
    const key = value.toLowerCase()
    if (!value || isPlaceholder(value) || seen.has(key)) return
    seen.add(key)
    names.push(value)
  }

  for (const id of ids) {
    const bare = bareId(id)
    const rosterMatch = roster.find((row) => sameId(row.id, id) || sameId(row.id, bare))
    if (rosterMatch) {
      push(personName(rosterMatch))
      continue
    }
    const account = accounts.find((row) => sameId(row.id, id) || sameId(row.id, bare))
    if (!account) continue
    const email = clean(account.email).toLowerCase()
    const rosterByEmail = email
      ? roster.find((row) => clean(row.email).toLowerCase() === email)
      : undefined
    push(rosterByEmail ? personName(rosterByEmail) : accountName(account))
  }

  if (names.length === 0) push(project.manager?.name || '')
  return names
}

export function assignedManagerLabel(
  project: AssignedManagerProject,
  roster: readonly AssignedManagerRosterRow[],
  accounts: readonly AssignedManagerAccount[] = []
): string {
  const names = assignedManagerNames(project, roster, accounts)
  return names.length > 0 ? names.join(', ') : '—'
}

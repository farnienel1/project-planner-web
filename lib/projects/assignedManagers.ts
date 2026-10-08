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

function clean(value: string | null | undefined): string {
  return String(value || '').trim()
}

function personName(row: AssignedManagerRosterRow): string {
  return `${clean(row.firstName)} ${clean(row.lastName)}`.trim() || clean(row.email)
}

/**
 * Every manager stored on the job, in assignment order.
 * The legacy `manager.name` field only keeps the first person, and it is often
 * the placeholder "Custom" when the roster ids are the real assignment.
 */
export function assignedManagerNames(
  project: AssignedManagerProject,
  roster: readonly AssignedManagerRosterRow[]
): string[] {
  const ids: string[] = []
  for (const id of project.managerIds || []) {
    const value = clean(id)
    if (value && !ids.includes(value)) ids.push(value)
  }
  const primary = clean(project.managerId)
  if (primary && !ids.includes(primary)) ids.unshift(primary)

  const names: string[] = []
  const seen = new Set<string>()
  const push = (name: string) => {
    const value = clean(name)
    const key = value.toLowerCase()
    if (!value || key === 'custom' || seen.has(key)) return
    seen.add(key)
    names.push(value)
  }

  for (const id of ids) {
    const bare = id.startsWith('user:') ? id.slice('user:'.length) : id
    const match = roster.find((row) => row.id === id || row.id === bare)
    if (match) push(personName(match))
  }

  if (names.length === 0) push(project.manager?.name || '')
  return names
}

export function assignedManagerLabel(project: AssignedManagerProject, roster: readonly AssignedManagerRosterRow[]): string {
  const names = assignedManagerNames(project, roster)
  return names.length > 0 ? names.join(', ') : '—'
}

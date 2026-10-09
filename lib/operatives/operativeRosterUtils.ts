import type { Operative, User } from '@/types'
import { getOperativeModeUsers } from '@/lib/staff/userRosterUtils'

export { getOperativeModeUsers }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Legacy roster rows created during org setup — same rules as iOS OperativeStore.allOperatives. */
export function isPlaceholderOperative(operative: Operative): boolean {
  const name = `${operative.firstName} ${operative.lastName}`.trim().toLowerCase()
  const email = operative.email.toLowerCase()
  return name.includes('placeholder') || email.includes('placeholder') || name.includes('initial')
}

export function filterRealOperatives(operatives: Operative[]): Operative[] {
  return operatives.filter((operative) => !isPlaceholderOperative(operative))
}

function profileWeight(operative: Operative): number {
  const quals = operative.qualifications?.length ?? 0
  const certs = Object.keys(operative.qualificationCertificateURLs || {}).length
  const expiries = Object.keys(operative.qualificationExpiryDates || {}).length
  return quals + certs + expiries
}

/**
 * Same email can exist on more than one operative document. Keep the active row
 * that actually holds qualifications and certificates. A newer empty duplicate
 * must not hide those files. This choice is display-only.
 */
function choosePreferredOperative(a: Operative, b: Operative): Operative {
  if (a.isActive !== b.isActive) return a.isActive ? a : b
  const aWeight = profileWeight(a)
  const bWeight = profileWeight(b)
  if (aWeight !== bWeight) return aWeight > bWeight ? a : b
  const aTime = a.updatedAt?.getTime?.() ?? 0
  const bTime = b.updatedAt?.getTime?.() ?? 0
  return aTime >= bTime ? a : b
}

/** Collapse duplicate roster rows that share the same email. */
export function dedupeOperativesByEmail(operatives: Operative[]): Operative[] {
  const byEmail = new Map<string, Operative>()

  for (const operative of filterRealOperatives(operatives)) {
    const email = normalizeEmail(operative.email)
    if (!email) continue
    const existing = byEmail.get(email)
    byEmail.set(email, existing ? choosePreferredOperative(existing, operative) : operative)
  }

  return Array.from(byEmail.values())
}

/** The user account that owns this roster operative (same email). */
export function findUserForOperative(operative: Operative | undefined, users: User[]): User | undefined {
  if (!operative) return undefined
  const email = normalizeEmail(operative.email)
  if (!email) return undefined
  return (
    users.find((user) => normalizeEmail(user.email) === email && user.permissions.operativeMode) ||
    users.find((user) => normalizeEmail(user.email) === email)
  )
}

/** Full Edit User for a roster operative — same page as Manage Operatives. */
export function editUserHrefForOperative(
  operativeId: string,
  operatives: Operative[],
  users: User[]
): string {
  const operative =
    operatives.find((row) => row.id === operativeId) ||
    operatives.find((row) => row.id.toLowerCase() === operativeId.toLowerCase())
  const user = findUserForOperative(operative, users)
  if (user) return `/dashboard/users/${user.id}/edit?from=operatives`
  return `/dashboard/operatives/${operativeId}/edit`
}

export function findOperativeForUser(user: User, operatives: Operative[]): Operative | undefined {
  const email = normalizeEmail(user.email)
  return dedupeOperativesByEmail(operatives).find(
    (operative) => normalizeEmail(operative.email) === email
  )
}

/** Every operative document for this email. Bookings can sit on a duplicate row. */
export function operativeIdsForEmail(operatives: Operative[], email: string | null | undefined): string[] {
  const key = normalizeEmail(email || '')
  if (!key) return []
  const ids: string[] = []
  for (const operative of filterRealOperatives(operatives)) {
    if (!operative.id || normalizeEmail(operative.email) !== key) continue
    if (!ids.includes(operative.id)) ids.push(operative.id)
  }
  return ids
}

/**
 * iOS ScheduleOperativeView.selectableOperatives — active roster operatives, excluding placeholders.
 */
export function getActiveOperativesForScheduling(operatives: Operative[]): Operative[] {
  const realOperatives = dedupeOperativesByEmail(operatives)
  const active = realOperatives.filter((operative) => operative.isActive !== false)
  return active.length > 0 ? active : realOperatives
}

export function countActiveOperativeUsers(users: User[]): number {
  return getOperativeModeUsers(users).filter((user) => user.passwordSet && user.isActive).length
}

export function getLinkedOperatives(operatives: Operative[], users: User[]): Operative[] {
  return getOperativeModeUsers(users)
    .map((user) => findOperativeForUser(user, operatives))
    .filter((operative): operative is Operative => operative !== undefined)
}

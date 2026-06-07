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

function choosePreferredOperative(a: Operative, b: Operative): Operative {
  if (a.isActive !== b.isActive) return a.isActive ? a : b
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

export function findOperativeForUser(user: User, operatives: Operative[]): Operative | undefined {
  const email = normalizeEmail(user.email)
  return dedupeOperativesByEmail(operatives).find(
    (operative) => normalizeEmail(operative.email) === email
  )
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

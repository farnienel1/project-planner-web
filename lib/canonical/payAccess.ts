/**
 * Who may change a person's pay: `dayRate`, `hourlyRate`, `payBasis`, line manager and employment
 * type on `users/{uid}`, its `organizations/{orgId}/operativeProfiles/{uid}` mirror, and
 * `organizations/{orgId}/operativeDayRateHistory` rows.
 *
 * Rule (both apps, enforced by firestore.rules `canChangePayOf` / `managerMayManageOperative`):
 *   - A person never changes their own pay, on any of those paths.
 *   - An admin of the company (and the platform owner) may. An admin's own document keeps the
 *     existing self-repair exemption on `users/{uid}`, so an admin may set their own rate too.
 *   - A manager with Operatives access (not in operative mode) may change an operative's pay in
 *     the same company, never another manager's or admin's.
 *   - Anyone else's write to those documents must leave the pay fields as they are (a resend of
 *     the same values is not a change).
 *
 * Plain flags only; each app resolves them from its own user store.
 */

export type PayAccessWriter = {
  userId: string | null | undefined
  isPlatformOwner?: boolean | null
  /** Admin access or the admin role (super admin included), not in operative mode. */
  isAdmin?: boolean | null
  isManager?: boolean | null
  /** The Operatives permission (Manage Users for operatives). */
  hasOperativesAccess?: boolean | null
  isOperativeMode?: boolean | null
}

export type PayAccessSubject = {
  userId: string | null | undefined
  /** Operative mode or the operative role. */
  isOperative?: boolean | null
}

function id(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function canChangePersonPay(writer: PayAccessWriter, subject: PayAccessSubject): boolean {
  const writerId = id(writer.userId)
  if (!writerId) return false
  if (writer.isPlatformOwner === true || writer.isAdmin === true) return true
  if (writerId === id(subject.userId)) return false
  return (
    writer.isManager === true &&
    writer.hasOperativesAccess === true &&
    writer.isOperativeMode !== true &&
    subject.isOperative === true
  )
}

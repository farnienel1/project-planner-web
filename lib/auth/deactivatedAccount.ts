/**
 * Deactivated login gate. Shared by the web app and the iOS prompt.
 *
 * Firestore:
 * - users/{uid}.isActive — false means the organisation they last signed into has deactivated them.
 * - users/{uid}/orgMemberships/{orgId}.accountActive — false means that organisation deactivated them.
 *   Missing accountActive means active, so older memberships keep working.
 *
 * Switching organisation copies that membership's accountActive onto users/{uid}.isActive.
 */

export const DEACTIVATED_ACCOUNT_MESSAGE =
  'Your account has been deactivated, please contact your organisation'

export const SWITCH_ORGANISATION_LABEL = 'Switch organisation'

export type DeactivatedOrgChoice = {
  organizationId: string
  organizationName: string
}

export function otherOrganisations<T extends DeactivatedOrgChoice>(
  memberships: T[],
  activeOrganizationId: string
): T[] {
  const active = activeOrganizationId.trim()
  const seen = new Set<string>()
  const rows: T[] = []
  for (const membership of memberships) {
    const id = membership.organizationId.trim()
    if (!id || id === active || seen.has(id)) continue
    seen.add(id)
    rows.push(membership)
  }
  return rows
}

/** Missing flag stays active. Only an explicit false deactivates that organisation. */
export function membershipAccountIsActive(value: unknown): boolean {
  return value !== false
}

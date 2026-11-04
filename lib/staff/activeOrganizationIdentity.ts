/**
 * The open organisation's id and creator (rulebook §8, §16; 1.28.0), for the rulebook people helpers
 * (`rulebookPerson`) that decide who is this organisation's Super Admin (`isOrganizationSuperAdmin`) without being
 * handed the organisation. Set from the auth store's organisation and the live organisation listener. No Firebase
 * import, so pure modules and tests can use it; tests set it directly.
 */

export type ActiveOrganizationIdentity = { organizationId: string; creatorUserId: string | null }

let active: ActiveOrganizationIdentity | null = null

export function setActiveOrganizationIdentity(
  input: { organizationId?: string | null; creatorUserId?: string | null } | null | undefined
): void {
  const organizationId = typeof input?.organizationId === 'string' ? input.organizationId.trim() : ''
  if (!organizationId) {
    active = null
    return
  }
  const creator = typeof input?.creatorUserId === 'string' ? input.creatorUserId.trim() : ''
  active = { organizationId, creatorUserId: creator || null }
}

export function activeOrganizationIdentity(): ActiveOrganizationIdentity | null {
  return active
}

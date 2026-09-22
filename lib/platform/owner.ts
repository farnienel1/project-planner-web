/** The only person who may use the owner / developer console. */
export const PLATFORM_OWNER_EMAIL = 'info@projectplanner.us'

/** Sentinel org id written on a standalone owner profile that is not a customer tenant. */
export const PLATFORM_OWNER_SENTINEL_ORG = 'platform-owner'

export function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase()
}

export function isPlatformOwnerEmail(email?: string | null): boolean {
  return normalizeEmail(email) === PLATFORM_OWNER_EMAIL
}

export function isPlatformOwnerSentinelOrg(organizationId?: string | null): boolean {
  return (organizationId || '') === PLATFORM_OWNER_SENTINEL_ORG
}

export function hasCustomerOrganisation(organizationId?: string | null): boolean {
  const id = (organizationId || '').trim()
  return id.length > 0 && !isPlatformOwnerSentinelOrg(id)
}

export function isPlatformOwnerSession(email?: string | null, organizationId?: string | null): boolean {
  return isPlatformOwnerEmail(email) || isPlatformOwnerSentinelOrg(organizationId)
}

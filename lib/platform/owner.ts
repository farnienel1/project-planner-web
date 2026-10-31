import { isPlatformOwnerEmail as canonicalIsPlatformOwnerEmail } from '@/lib/canonical/passwordPolicy'

/** The only person who may use the owner / developer console (rulebook `PLATFORM_OWNER_EMAIL`). */
export { PLATFORM_OWNER_EMAIL } from '@/lib/canonical/passwordPolicy'

/** Sentinel org id written on a standalone owner profile that is not a customer tenant. */
export const PLATFORM_OWNER_SENTINEL_ORG = 'platform-owner'

export function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase()
}

/** The rulebook's `isPlatformOwnerEmail` (ignores case and surrounding spaces). */
export function isPlatformOwnerEmail(email?: string | null): boolean {
  return canonicalIsPlatformOwnerEmail(email)
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

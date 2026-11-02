/**
 * The open organisation's business zone (rulebook §1, `organizationTimeZone(countryCode)`), for helpers that are
 * called without one. Set by the live organisation listener (`lib/stores/organizationDocumentStore.ts`); London
 * until the organisation document has loaded. No Firebase import, so pure modules and tests can use it.
 */
import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'

let activeZone = LONDON_TIME_ZONE

export function setActiveOrganizationTimeZone(timeZone: string | null | undefined): void {
  const zone = typeof timeZone === 'string' ? timeZone.trim() : ''
  activeZone = zone || LONDON_TIME_ZONE
}

/** `timeZone` when given, else the open organisation's zone. */
export function organizationZoneOr(timeZone?: string | null): string {
  const zone = typeof timeZone === 'string' ? timeZone.trim() : ''
  return zone || activeZone
}

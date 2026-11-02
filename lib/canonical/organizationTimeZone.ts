/**
 * The organisation's business time zone.
 *
 * One zone per organisation, taken from `organizations/{orgId}.countryCode` (GB → Europe/London,
 * unknown or missing → Europe/London). Every day key, warning window, payment run, timesheet day,
 * cut-off clock and effective date uses this zone on every platform — never the device or browser zone.
 */
import { ianaTimeZoneForCountry } from '../orgTime/orgTimeZone'

export function organizationTimeZone(countryCode?: string | null): string {
  return ianaTimeZoneForCountry(countryCode)
}

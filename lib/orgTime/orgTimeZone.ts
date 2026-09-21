/**
 * Organisation origin-country → IANA zone.
 * Phone/browser location is ignored. A GB org always uses Europe/London even
 * if the user is a calendar day ahead abroad. iOS still uses Calendar.current
 * (device zone) until that app is updated to match.
 */
import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'

const COUNTRY_TIME_ZONES: Record<string, string> = {
  GB: 'Europe/London',
  UK: 'Europe/London',
  IE: 'Europe/Dublin',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  IT: 'Europe/Rome',
  PL: 'Europe/Warsaw',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen',
  FI: 'Europe/Helsinki',
  CH: 'Europe/Zurich',
  AT: 'Europe/Vienna',
  US: 'America/New_York',
  CA: 'America/Toronto',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  AE: 'Asia/Dubai',
  IN: 'Asia/Kolkata',
  SG: 'Asia/Singapore',
  ZA: 'Africa/Johannesburg',
  HK: 'Asia/Hong_Kong',
}

export function ianaTimeZoneForCountry(countryCode?: string | null): string {
  const code = (countryCode || 'GB').trim().toUpperCase()
  return COUNTRY_TIME_ZONES[code] || LONDON_TIME_ZONE
}

export { LONDON_TIME_ZONE }

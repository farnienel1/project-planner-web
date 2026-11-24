import type { Project } from '@/types'
import { formatPostcodeForDisplay, tidyUkPostcodesInText } from '@/lib/maps/ukPostcode'

const UNMAPPABLE = ['site location not available', 'n/a', 'tbc', 'tba']

/** iOS schedule booking card: client, then the site line, with no dangling separator. */
export function scheduleBookingClientLine(
  project: Parameters<typeof formatSiteAddress>[0] & { client?: { name?: string } | null }
): string {
  const client = project.client?.name?.trim() || ''
  const address = formatSiteAddress(project)
  return [client, address].filter(Boolean).join(' · ')
}

export function formatSiteAddress(
  project: Partial<
    Pick<
      Project,
      'addressLine1' | 'addressLine2' | 'townCity' | 'postcode' | 'latitude' | 'longitude' | 'usesMapPinForLocation'
    >
  > & { siteAddress?: string }
): string {
  // Display only: a UK postcode reads "SW1X 9HR" (an x look-alike such as "×" read as x); stored data is never rewritten.
  const structured = [project.addressLine1, project.addressLine2, project.townCity, formatPostcodeForDisplay(project.postcode)]
    .map((part) => (part || '').trim())
    .filter(Boolean)

  const legacyRaw = project.siteAddress?.trim()
  const legacy = legacyRaw ? tidyUkPostcodesInText(legacyRaw) : legacyRaw

  if (structured.length > 0) {
    const structuredAddress = structured.join(', ')
    // Prefer stored siteAddress when structured fields are incomplete but Firestore has a fuller string.
    if (legacy && legacy.length > structuredAddress.length + 8) {
      return legacy
    }
    return structuredAddress
  }

  if (legacy) return legacy

  if (project.usesMapPinForLocation && project.latitude != null && project.longitude != null) {
    return `${project.latitude}, ${project.longitude}`
  }

  return ''
}

export function isMappableSiteAddress(address: string): boolean {
  const trimmed = address.trim()
  if (trimmed.length < 4) return false
  const lower = trimmed.toLowerCase()
  return !UNMAPPABLE.some((phrase) => lower === phrase || lower.includes(phrase))
}

export function googleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function googleMapsCoordinateUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

export function resolveStoredCoordinates(
  project: Pick<Project, 'latitude' | 'longitude'>
): { latitude: number; longitude: number } | null {
  const { latitude, longitude } = project
  if (latitude == null || longitude == null) return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude, longitude }
}

export function openMapsForProject(project: Parameters<typeof formatSiteAddress>[0]): string | null {
  if (project.usesMapPinForLocation !== false) {
    const coords = resolveStoredCoordinates(project)
    if (coords) return googleMapsCoordinateUrl(coords.latitude, coords.longitude)
  }
  const address = formatSiteAddress(project)
  if (!isMappableSiteAddress(address)) return null
  return googleMapsSearchUrl(address)
}

/**
 * Town and postcode under a job in Book labour (iOS `projectLocalitySubtitle`). Display only: a UK postcode reads
 * "SW1X 9HR" (an x look-alike read as x); stored text is never rewritten. Falls back to the stored address, tidied.
 */
export function projectLocalityText(
  project: Partial<Pick<Project, 'townCity' | 'postcode' | 'addressLine1'>> & { siteAddress?: string }
): string {
  const line = [project.townCity?.trim(), formatPostcodeForDisplay(project.postcode)].filter(Boolean).join(' ')
  if (line) return line
  const fallback = project.siteAddress?.trim() || project.addressLine1?.trim()
  return fallback ? tidyUkPostcodesInText(fallback) : ' '
}

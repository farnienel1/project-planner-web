import type { Project } from '@/types'

const UNMAPPABLE = ['site location not available', 'n/a', 'tbc', 'tba']

export function formatSiteAddress(
  project: Partial<
    Pick<
      Project,
      'addressLine1' | 'addressLine2' | 'townCity' | 'postcode' | 'latitude' | 'longitude' | 'usesMapPinForLocation'
    >
  > & { siteAddress?: string }
): string {
  const structured = [project.addressLine1, project.addressLine2, project.townCity, project.postcode]
    .map((part) => (part || '').trim())
    .filter(Boolean)

  const legacy = project.siteAddress?.trim()

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
  const coords = resolveStoredCoordinates(project)
  if (coords) return googleMapsCoordinateUrl(coords.latitude, coords.longitude)
  const address = formatSiteAddress(project)
  if (!isMappableSiteAddress(address)) return null
  return googleMapsSearchUrl(address)
}

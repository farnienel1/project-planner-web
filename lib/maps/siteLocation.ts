/**
 * iOS parity source: Views/ProjectDetailView.swift siteLocationSection ~L1745–2264
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */

import {
  formatSiteAddress,
  googleMapsCoordinateUrl,
  googleMapsSearchUrl,
  isMappableSiteAddress,
  openMapsForProject,
  resolveStoredCoordinates,
} from '@/lib/maps/siteAddress'
import type { Project } from '@/types'

type LocationFields = Partial<
  Pick<
    Project,
    | 'addressLine1'
    | 'addressLine2'
    | 'townCity'
    | 'postcode'
    | 'latitude'
    | 'longitude'
    | 'usesMapPinForLocation'
    | 'siteName'
  >
> & { siteAddress?: string }

export function hasValidAddress(project: LocationFields): boolean {
  const address = formatSiteAddress(project)
  return isMappableSiteAddress(address)
}

export function hasValidSiteLocation(project: LocationFields): boolean {
  return hasValidAddress(project) || mapCoordinateForProject(project) != null
}

/** Stored pin only while the job is still in map-pin mode. An address save clears the flag so the map geocodes the text. */
export function mapCoordinateForProject(
  project: LocationFields
): { latitude: number; longitude: number } | null {
  if (project.usesMapPinForLocation === false) return null
  return resolveStoredCoordinates(project)
}

export function locationDisplayText(project: LocationFields): string {
  if (hasValidAddress(project)) return formatSiteAddress(project)
  const coords = mapCoordinateForProject(project)
  if (coords) return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
  return ''
}

export function googleMapsUrlForProject(project: LocationFields): string | null {
  const coords = mapCoordinateForProject(project)
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`
  }
  return openMapsForProject(project)
}

export function appleMapsUrlForProject(project: LocationFields): string | null {
  const coords = mapCoordinateForProject(project)
  if (coords) {
    const query = encodeURIComponent(project.siteName?.trim() || `${coords.latitude},${coords.longitude}`)
    return `https://maps.apple.com/?ll=${coords.latitude},${coords.longitude}&q=${query}`
  }
  const address = formatSiteAddress(project)
  if (!isMappableSiteAddress(address)) return null
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`
}

export function materialStatusLabel(status: string): string {
  const raw = status.trim()
  if (!raw || raw.toLowerCase() === 'draft') return 'Draft'
  if (raw === 'sentForQuote' || raw.toLowerCase() === 'sent for quote') return 'Sent for quote'
  if (raw.toLowerCase() === 'ordered' || raw === 'order') return 'Ordered'
  if (raw.toLowerCase() === 'quote') return 'Sent for quote'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function materialSendRequestType(kind: 'quote' | 'order' | 'Quote' | 'Order'): 'Quote' | 'Order' {
  return kind === 'order' || kind === 'Order' ? 'Order' : 'Quote'
}

export { googleMapsCoordinateUrl, googleMapsSearchUrl }

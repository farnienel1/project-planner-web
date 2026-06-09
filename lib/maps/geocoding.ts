import { formatSiteAddress, isMappableSiteAddress } from '@/lib/maps/siteAddress'
import { buildGeocodeCandidates } from '@/lib/maps/geocodingCandidates'
import { geocodeWithGoogleClient, reverseGeocodeWithGoogleClient } from '@/lib/maps/googleGeocoderClient'
import { getClientGoogleMapsApiKey } from '@/lib/maps/googleMapsKey'

const CACHE_KEY = 'pp.geocode.cache.v3'
const MIN_INTERVAL_MS = 100

export type GeoPoint = { latitude: number; longitude: number }

export type ReverseGeocodeResult = {
  displayName: string
  addressLine1: string
  addressLine2?: string
  townCity: string
  postcode: string
}

let lastRequestAt = 0
let queue: Promise<void> = Promise.resolve()

function readCache(): Record<string, GeoPoint> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, GeoPoint>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, GeoPoint>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore quota errors.
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase()
}

function scheduleGeocode<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt))
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt = Date.now()
    return task()
  })
  queue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function fetchCoordinateFromApi(query: string): Promise<GeoPoint | null> {
  try {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
    if (!response.ok) return null
    const data = (await response.json()) as { latitude?: number; longitude?: number }
    if (data.latitude == null || data.longitude == null) return null
    if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return null
    return { latitude: data.latitude, longitude: data.longitude }
  } catch {
    return null
  }
}

async function fetchSiteCoordinateFromApi(input: {
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  postcode?: string
  siteName?: string
  siteAddress?: string
}): Promise<GeoPoint | null> {
  try {
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: input }),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { latitude?: number; longitude?: number }
    if (data.latitude == null || data.longitude == null) return null
    if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return null
    return { latitude: data.latitude, longitude: data.longitude }
  } catch {
    return null
  }
}

async function geocodeWithClientFallback(input: {
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  postcode?: string
  siteName?: string
  siteAddress?: string
}): Promise<GeoPoint | null> {
  if (!getClientGoogleMapsApiKey()) return null

  const candidates = buildGeocodeCandidates(input)
  for (const candidate of candidates) {
    const coords = await geocodeWithGoogleClient(candidate)
    if (coords) return coords
  }

  return null
}

async function resolveSiteCoordinateInternal(input: {
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  postcode?: string
  siteName?: string
  siteAddress?: string
}): Promise<GeoPoint | null> {
  const fromApi = await fetchSiteCoordinateFromApi(input)
  if (fromApi) return fromApi
  return geocodeWithClientFallback(input)
}

async function resolveQueryCoordinateInternal(query: string): Promise<GeoPoint | null> {
  const fromApi = await fetchCoordinateFromApi(query)
  if (fromApi) return fromApi
  return geocodeWithGoogleClient(query)
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const trimmed = address.trim()
  if (!trimmed) return null

  const key = normalizeAddress(trimmed)
  const cache = readCache()
  if (cache[key]) return cache[key]

  const coords = await scheduleGeocode(() => resolveQueryCoordinateInternal(trimmed))
  if (!coords) return null

  cache[key] = coords
  writeCache(cache)
  return coords
}

export async function geocodeSiteProject(input: {
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  postcode?: string
  siteName?: string
  siteAddress?: string
}): Promise<GeoPoint | null> {
  const full = formatSiteAddress(input)
  if (!isMappableSiteAddress(full) && !isMappableSiteAddress(input.siteAddress || '')) {
    return null
  }

  const cache = readCache()
  const cacheKey = normalizeAddress(full || input.siteAddress || '')
  if (cacheKey && cache[cacheKey]) return cache[cacheKey]

  const coords = await scheduleGeocode(() => resolveSiteCoordinateInternal(input))
  if (!coords) return null

  if (cacheKey) {
    cache[cacheKey] = coords
    writeCache(cache)
  }

  return coords
}

export async function resolveSiteCoordinate(
  input: {
    addressLine1?: string
    addressLine2?: string
    townCity?: string
    postcode?: string
    siteName?: string
    siteAddress?: string
  },
  stored?: GeoPoint | null
): Promise<GeoPoint | null> {
  if (stored) return stored
  return geocodeSiteProject(input)
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
    })

    const response = await scheduleGeocode(() => fetch(`/api/geocode?${params.toString()}`))
    if (response.ok) {
      return (await response.json()) as ReverseGeocodeResult
    }
  } catch {
    // Fall through to client Google geocoder.
  }

  return reverseGeocodeWithGoogleClient(latitude, longitude)
}

export function cacheGeocodeResult(address: string, point: GeoPoint): void {
  const key = normalizeAddress(address)
  if (!key) return
  const cache = readCache()
  cache[key] = point
  writeCache(cache)
}

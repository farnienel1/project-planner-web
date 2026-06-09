import { extractUkPostcode, normalizeUkPostcode } from '@/lib/maps/ukPostcode'
import { buildGeocodeCandidates } from '@/lib/maps/geocodingCandidates'
import { getServerGoogleMapsApiKey } from '@/lib/maps/googleMapsKey'

export type GeoPoint = { latitude: number; longitude: number }

export type ReverseGeocodeResult = {
  displayName: string
  addressLine1: string
  addressLine2?: string
  townCity: string
  postcode: string
}

const APP_USER_AGENT = 'ProjectPlannerWeb/1.0 (site-map geocoding)'

function hasGoogleMapsApiKey(): boolean {
  return Boolean(getServerGoogleMapsApiKey())
}

async function geocodeUkPostcode(postcode: string): Promise<GeoPoint | null> {
  const normalized = normalizeUkPostcode(postcode)
  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalized)}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) return null

  const data = (await response.json()) as {
    status?: number
    result?: { latitude?: number; longitude?: number }
  }

  const latitude = data.result?.latitude
  const longitude = data.result?.longitude
  if (latitude == null || longitude == null) return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude }
}

async function geocodeGoogle(query: string): Promise<GeoPoint | null> {
  const apiKey = getServerGoogleMapsApiKey()
  if (!apiKey) return null

  const params = new URLSearchParams({
    address: query,
    key: apiKey,
    region: 'gb',
    components: 'country:GB',
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
  if (!response.ok) return null

  const data = (await response.json()) as {
    status?: string
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
  }

  if (data.status !== 'OK') return null

  const location = data.results?.[0]?.geometry?.location
  if (location?.lat == null || location.lng == null) return null
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null

  return { latitude: location.lat, longitude: location.lng }
}

async function geocodePhoton(query: string): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    q: query,
    limit: '1',
    lang: 'en',
  })
  params.set('bbox', '-8.2,49.8,1.8,60.9')

  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) return null

  const data = (await response.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>
  }

  const coordinates = data.features?.[0]?.geometry?.coordinates
  if (!coordinates || coordinates.length < 2) return null

  const [longitude, latitude] = coordinates
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude }
}

async function geocodeNominatim(query: string): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '0',
    countrycodes: 'gb',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-GB',
      'User-Agent': APP_USER_AGENT,
    },
  })

  if (!response.ok) return null

  const results = (await response.json()) as Array<{ lat?: string; lon?: string }>
  const first = results[0]
  if (!first?.lat || !first?.lon) return null

  const latitude = Number(first.lat)
  const longitude = Number(first.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude }
}

export async function geocodeQuery(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  if (hasGoogleMapsApiKey()) {
    const fromGoogle = await geocodeGoogle(trimmed)
    if (fromGoogle) return fromGoogle
  }

  const postcode = extractUkPostcode(trimmed)
  if (postcode) {
    const fromPostcode = await geocodeUkPostcode(postcode)
    if (fromPostcode) return fromPostcode
  }

  const fromPhoton = await geocodePhoton(trimmed)
  if (fromPhoton) return fromPhoton

  return geocodeNominatim(trimmed)
}

export async function geocodeSiteInput(input: {
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  postcode?: string
  siteName?: string
  siteAddress?: string
}): Promise<GeoPoint | null> {
  const candidates = buildGeocodeCandidates(input)
  for (const candidate of candidates) {
    const coords = await geocodeQuery(candidate)
    if (coords) return coords
  }
  return null
}

async function reverseGeocodeGoogle(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  const apiKey = getServerGoogleMapsApiKey()
  if (!apiKey) return null

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: apiKey,
    result_type: 'street_address|route|premise|subpremise|postal_code',
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
  if (!response.ok) return null

  const data = (await response.json()) as {
    status?: string
    results?: Array<{
      formatted_address?: string
      address_components?: Array<{ long_name: string; types: string[] }>
    }>
  }

  if (data.status !== 'OK' || !data.results?.[0]) return null

  const result = data.results[0]
  const components = result.address_components || []

  const pick = (type: string) => components.find((part) => part.types.includes(type))?.long_name || ''
  const streetNumber = pick('street_number')
  const route = pick('route')
  const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim()

  return {
    displayName: result.formatted_address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    addressLine1,
    addressLine2: pick('sublocality') || undefined,
    townCity: pick('postal_town') || pick('locality') || pick('administrative_area_level_2'),
    postcode: pick('postal_code'),
  }
}

async function reverseGeocodePostcodesIo(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
  })

  const response = await fetch(`https://api.postcodes.io/postcodes?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) return null

  const data = (await response.json()) as {
    status?: number
    result?: Array<{
      postcode?: string
      admin_district?: string
      admin_ward?: string
      parish?: string
      region?: string
    }>
  }

  const first = data.result?.[0]
  if (!first) return null

  const postcode = first.postcode || ''
  const townCity = first.admin_district || first.admin_ward || first.parish || first.region || ''

  return {
    displayName: [townCity, postcode].filter(Boolean).join(', '),
    addressLine1: '',
    townCity,
    postcode,
  }
}

async function reverseGeocodeNominatim(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-GB',
      'User-Agent': APP_USER_AGENT,
    },
  })

  if (!response.ok) return null

  const data = (await response.json()) as {
    display_name?: string
    address?: Record<string, string>
  }

  const address = data.address || {}
  const house = address.house_number ? `${address.house_number} ` : ''
  const road = address.road || address.pedestrian || address.footway || ''
  const addressLine1 = `${house}${road}`.trim() || data.display_name?.split(',')[0]?.trim() || ''
  const townCity =
    address.city || address.town || address.village || address.suburb || address.county || ''
  const postcode = address.postcode || ''

  return {
    displayName: data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    addressLine1,
    addressLine2: address.neighbourhood || address.hamlet || undefined,
    townCity,
    postcode,
  }
}

export async function reverseGeocodeCoordinate(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  const google = await reverseGeocodeGoogle(latitude, longitude)
  if (google) return google

  const nominatim = await reverseGeocodeNominatim(latitude, longitude)
  const postcodesIo = await reverseGeocodePostcodesIo(latitude, longitude)

  if (nominatim && postcodesIo) {
    return {
      ...nominatim,
      postcode: nominatim.postcode || postcodesIo.postcode,
      townCity: nominatim.townCity || postcodesIo.townCity,
    }
  }

  return nominatim || postcodesIo
}

export { buildGeocodeCandidates }

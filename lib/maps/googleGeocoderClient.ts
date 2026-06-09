'use client'

import { getClientGoogleMapsApiKey } from '@/lib/maps/googleMapsKey'
import type { GeoPoint } from '@/lib/maps/geocoding'

type GoogleGeocoderResult = {
  formatted_address?: string
  address_components?: GoogleAddressComponent[]
  geometry?: {
    location?: {
      lat: () => number
      lng: () => number
    }
  }
}

type GoogleGeocoderRequest =
  | { address: string; region?: string }
  | { location: { lat: number; lng: number } }

type GoogleMapsGlobal = {
  maps: {
    Geocoder: new () => {
      geocode: (
        request: GoogleGeocoderRequest,
        callback: (results: GoogleGeocoderResult[] | null, status: string) => void
      ) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleMapsGlobal
  }
}

let loader: Promise<GoogleMapsGlobal> | null = null

function loadGoogleMaps(): Promise<GoogleMapsGlobal> {
  const apiKey = getClientGoogleMapsApiKey()
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is not configured'))
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google)
  }

  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
      script.async = true
      script.defer = true
      script.onload = () => {
        if (window.google?.maps) resolve(window.google)
        else reject(new Error('Google Maps failed to load'))
      }
      script.onerror = () => reject(new Error('Google Maps script failed to load'))
      document.head.appendChild(script)
    })
  }

  return loader
}

export async function geocodeWithGoogleClient(address: string): Promise<GeoPoint | null> {
  const trimmed = address.trim()
  if (!trimmed || !getClientGoogleMapsApiKey()) return null

  const googleMaps = await loadGoogleMaps()
  const geocoder = new googleMaps.maps.Geocoder()

  return new Promise((resolve) => {
    geocoder.geocode({ address: trimmed, region: 'GB' }, (results, status) => {
      if (status !== 'OK' || !results?.[0]?.geometry?.location) {
        resolve(null)
        return
      }

      const location = results[0].geometry.location
      const latitude = location.lat()
      const longitude = location.lng()
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        resolve(null)
        return
      }

      resolve({ latitude, longitude })
    })
  })
}

type GoogleAddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

export type GoogleReverseGeocodeResult = {
  displayName: string
  addressLine1: string
  addressLine2?: string
  townCity: string
  postcode: string
}

function pickAddressComponent(components: GoogleAddressComponent[], type: string): string {
  return components.find((component) => component.types.includes(type))?.long_name || ''
}

export async function reverseGeocodeWithGoogleClient(
  latitude: number,
  longitude: number
): Promise<GoogleReverseGeocodeResult | null> {
  if (!getClientGoogleMapsApiKey()) return null

  const googleMaps = await loadGoogleMaps()
  const geocoder = new googleMaps.maps.Geocoder()

  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) {
        resolve(null)
        return
      }

      const result = results[0]
      const components = (result.address_components || []) as GoogleAddressComponent[]
      const streetNumber = pickAddressComponent(components, 'street_number')
      const route = pickAddressComponent(components, 'route')
      const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim()
      const townCity =
        pickAddressComponent(components, 'postal_town') ||
        pickAddressComponent(components, 'locality') ||
        pickAddressComponent(components, 'postal_town') ||
        pickAddressComponent(components, 'administrative_area_level_2')
      const postcode = pickAddressComponent(components, 'postal_code')

      resolve({
        displayName: result.formatted_address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        addressLine1,
        addressLine2: pickAddressComponent(components, 'sublocality') || undefined,
        townCity,
        postcode,
      })
    })
  })
}

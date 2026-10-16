'use client'

import 'leaflet/dist/leaflet.css'

export type LeafletMap = {
  remove: () => void
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void
  setView: (center: [number, number], zoom: number, options?: Record<string, unknown>) => void
  flyTo: (center: [number, number], zoom: number, options?: Record<string, unknown>) => void
  on: (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void
  invalidateSize: () => void
}

export type LeafletMarker = {
  openPopup: () => void
  bindPopup: (html: string) => LeafletMarker
  on: (event: string, handler: () => void) => LeafletMarker
  setLatLng: (latlng: [number, number]) => LeafletMarker
  getLatLng?: () => { lat: number; lng: number }
  remove?: () => void
  addTo: (map: LeafletMap) => LeafletMarker
}

type LeafletApi = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void }
  marker: (
    latlng: [number, number],
    options?: Record<string, unknown>
  ) => LeafletMarker
  latLngBounds: (points: Array<[number, number]>) => { pad: (ratio: number) => unknown }
  divIcon: (options: Record<string, unknown>) => unknown
}

declare global {
  interface Window {
    L?: LeafletApi
  }
}

let leafletPromise: Promise<LeafletApi> | null = null

export function loadLeaflet(): Promise<LeafletApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet requires a browser environment'))
  }
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  leafletPromise = import('leaflet').then((mod) => {
    const L = (mod.default ?? mod) as unknown as LeafletApi
    window.L = L
    return L
  })

  return leafletPromise
}

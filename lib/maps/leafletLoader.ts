const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

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
}

declare global {
  interface Window {
    L?: {
      map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap
      tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void }
      marker: (
        latlng: [number, number],
        options?: Record<string, unknown>
      ) => {
        addTo: (map: LeafletMap) => LeafletMarker
        bindPopup: (html: string) => LeafletMarker
        on: (event: string, handler: () => void) => LeafletMarker
        setLatLng: (latlng: [number, number]) => LeafletMarker
      }
      latLngBounds: (points: Array<[number, number]>) => { pad: (ratio: number) => unknown }
      divIcon: (options: Record<string, unknown>) => unknown
    }
  }
}

let leafletPromise: Promise<NonNullable<Window['L']>> | null = null

export function loadLeaflet(): Promise<NonNullable<Window['L']>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet requires a browser environment'))
  }
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }

    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => (window.L ? resolve(window.L) : reject(new Error('Leaflet failed'))))
      existing.addEventListener('error', () => reject(new Error('Leaflet failed to load')))
      return
    }

    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.async = true
    script.onload = () => {
      if (window.L) resolve(window.L)
      else reject(new Error('Leaflet failed to initialize'))
    }
    script.onerror = () => reject(new Error('Leaflet failed to load'))
    document.body.appendChild(script)
  })

  return leafletPromise
}

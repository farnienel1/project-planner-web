'use client'

import { useEffect, useRef, useState } from 'react'
import { loadLeaflet, type LeafletMap, type LeafletMarker } from '@/lib/maps/leafletLoader'
import { mapDotIconOptions } from '@/lib/maps/mapPinIcon'
import { escapeHtml } from '@/lib/security/htmlEscape'
import { radiusBounds, SITE_MAP_DOT_COLORS, type LatLng } from '@/lib/maps/siteMapView'

export type SiteMapMarker = {
  id: string
  label: string
  jobNumber?: string
  latitude: number
  longitude: number
  bookingCount: number
  /** The collection decides it (`jobKind`): projects are blue dots, small works red dots (owner 24 Nov). */
  pinKind: 'project' | 'smallWork'
}

const DEFAULT_CENTRE: LatLng = { latitude: 51.5074, longitude: -0.1278 }

export function SiteMapBoard({
  markers,
  selectedMarkerId,
  onSelectMarker,
  officeCentre = null,
  compact = false,
}: {
  markers: SiteMapMarker[]
  selectedMarkerId?: string | null
  onSelectMarker?: (id: string) => void
  /** The organisation's office pin: the map opens on it, about 10 miles around (`radiusBounds`). */
  officeCentre?: LatLng | null
  /** The smaller Home card version. */
  compact?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Map<string, LeafletMarker>>(new Map())
  const officeFitDone = useRef(false)
  const onSelectRef = useRef(onSelectMarker)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const officeLat = officeCentre?.latitude ?? null
  const officeLng = officeCentre?.longitude ?? null

  useEffect(() => {
    onSelectRef.current = onSelectMarker
  }, [onSelectMarker])

  useEffect(() => {
    let cancelled = false

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return

        const map = L.map(containerRef.current, {
          zoomControl: true,
          // The Home card does not take the page's scroll wheel.
          scrollWheelZoom: !compact,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        map.setView([DEFAULT_CENTRE.latitude, DEFAULT_CENTRE.longitude], 11)
        mapRef.current = map
        setMapReady(true)
      })
      .catch((error: Error) => {
        if (!cancelled) setMapError(error.message)
      })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRefs.current.clear()
      officeFitDone.current = false
      setMapReady(false)
    }
  }, [compact])

  // A new office pin opens the map on it again.
  useEffect(() => {
    officeFitDone.current = false
  }, [officeLat, officeLng])

  useEffect(() => {
    const map = mapRef.current
    const L = window.L
    if (!map || !L || !mapReady) return

    markerRefs.current.forEach((marker) => marker.remove?.())
    markerRefs.current.clear()

    const points: Array<[number, number]> = []

    markers.forEach((entry) => {
      const selected = entry.id === selectedMarkerId
      const color = entry.pinKind === 'smallWork' ? SITE_MAP_DOT_COLORS.smallWork : SITE_MAP_DOT_COLORS.project
      const leafletMarker = L.marker([entry.latitude, entry.longitude], {
        icon: L.divIcon(mapDotIconOptions(color, selected)),
        zIndexOffset: selected ? 1000 : 0,
        title: entry.label,
        alt: `${entry.pinKind === 'smallWork' ? 'Small works' : 'Project'}: ${entry.label}`,
        keyboard: true,
      }).addTo(map)

      const jobLabel = entry.jobNumber ? `#${escapeHtml(String(entry.jobNumber))} · ` : ''
      leafletMarker.bindPopup(
        `<div style="min-width:150px;color:#0f1b2d">
          <strong style="font-size:14px">${escapeHtml(entry.label)}</strong><br/>
          <span style="font-size:12px;color:#334155">${jobLabel}${entry.bookingCount} booked</span>
        </div>`
      )
      leafletMarker.on('click', () => onSelectRef.current?.(entry.id))
      markerRefs.current.set(entry.id, leafletMarker)
      points.push([entry.latitude, entry.longitude])
    })

    if (selectedMarkerId) {
      const selected = markers.find((entry) => entry.id === selectedMarkerId)
      if (selected) {
        map.flyTo([selected.latitude, selected.longitude], compact ? 13 : 15, { duration: 0.8 })
        markerRefs.current.get(selectedMarkerId)?.openPopup()
        return
      }
    }

    // Owner 24 Nov: open on the office, about 10 miles around it; the view is left alone after that (a new day or
    // a new pin does not jump the map back). With no office pin saved, fit the jobs as before.
    if (officeLat != null && officeLng != null) {
      if (!officeFitDone.current) {
        map.fitBounds(radiusBounds({ latitude: officeLat, longitude: officeLng }))
        officeFitDone.current = true
      }
      return
    }

    if (points.length === 0) {
      map.setView([DEFAULT_CENTRE.latitude, DEFAULT_CENTRE.longitude], 11)
      return
    }
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds.pad(0.15), { maxZoom: 13 })
  }, [markers, selectedMarkerId, officeLat, officeLng, mapReady, compact])

  const height = compact ? 'h-[280px]' : 'h-[420px]'

  if (mapError) {
    return (
      <div className={`sitemap-fallback ${height}`}>
        Could not load the interactive map. Use the site list to open each location in Google Maps.
      </div>
    )
  }

  return <div ref={containerRef} className={`sitemap-canvas ${height} w-full`} />
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { loadLeaflet, type LeafletMap, type LeafletMarker } from '@/lib/maps/leafletLoader'
import { mapPinIconOptions } from '@/lib/maps/mapPinIcon'

export type SiteMapMarker = {
  id: string
  label: string
  jobNumber?: string
  latitude: number
  longitude: number
  bookingCount: number
  pinKind: 'project' | 'smallWork' | 'maintenance'
}

function markerColor(kind: SiteMapMarker['pinKind']): string {
  switch (kind) {
    case 'smallWork':
      return '#dc2626'
    case 'maintenance':
      return '#ea580c'
    default:
      return '#2563eb'
  }
}

export function SiteMapBoard({
  markers,
  selectedMarkerId,
  onSelectMarker,
  defaultCenter = { latitude: 51.5074, longitude: -0.1278 },
}: {
  markers: SiteMapMarker[]
  selectedMarkerId?: string | null
  onSelectMarker?: (id: string) => void
  defaultCenter?: { latitude: number; longitude: number }
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Map<string, LeafletMarker>>(new Map())
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return

        const map = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        map.setView([defaultCenter.latitude, defaultCenter.longitude], 11)
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
      setMapReady(false)
    }
  }, [defaultCenter.latitude, defaultCenter.longitude])

  useEffect(() => {
    const map = mapRef.current
    const L = window.L
    if (!map || !L || !mapReady) return

    markerRefs.current.forEach((marker) => marker.remove?.())
    markerRefs.current.clear()

    if (markers.length === 0) {
      map.setView([defaultCenter.latitude, defaultCenter.longitude], 11)
      return
    }

    const points: Array<[number, number]> = []

    markers.forEach((entry) => {
      const selected = entry.id === selectedMarkerId
      const color = markerColor(entry.pinKind)
      const leafletMarker = L.marker([entry.latitude, entry.longitude], {
        icon: L.divIcon(mapPinIconOptions(color, selected)),
        zIndexOffset: selected ? 1000 : 0,
      }).addTo(map)

      const jobLabel = entry.jobNumber ? `#${entry.jobNumber} · ` : ''
      leafletMarker.bindPopup(
        `<div style="min-width:160px">
          <strong style="font-size:14px">${entry.label}</strong><br/>
          <span style="font-size:12px;color:#475569">${jobLabel}${entry.bookingCount} booking${entry.bookingCount === 1 ? '' : 's'} today</span><br/>
          <span style="font-size:11px;color:#64748b">Tap card below for details</span>
        </div>`
      )
      leafletMarker.on('click', () => onSelectMarker?.(entry.id))
      markerRefs.current.set(entry.id, leafletMarker)
      points.push([entry.latitude, entry.longitude])
    })

    if (selectedMarkerId) {
      const selected = markers.find((entry) => entry.id === selectedMarkerId)
      if (selected) {
        map.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.8 })
        markerRefs.current.get(selectedMarkerId)?.openPopup()
        return
      }
    }

    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds.pad(0.15), { maxZoom: 13 })
  }, [markers, selectedMarkerId, defaultCenter.latitude, defaultCenter.longitude, onSelectMarker, mapReady])

  if (mapError) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-600">
        Could not load the interactive map. Use the site cards below to open each location in Google Maps.
      </div>
    )
  }

  return <div ref={containerRef} className="h-[420px] w-full rounded-2xl border border-slate-200 bg-slate-100 shadow-inner" />
}

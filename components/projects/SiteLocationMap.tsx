/**
 * iOS parity source: Views/ProjectDetailView.swift Map in siteLocationSection
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { useEffect, useRef } from 'react'
import { loadLeaflet, type LeafletMap } from '@/lib/maps/leafletLoader'
import { mapPinIconOptions } from '@/lib/maps/mapPinIcon'

export function SiteLocationMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number
  longitude: number
  label: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return
        mapRef.current?.remove()
        const map = L.map(containerRef.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          attributionControl: false,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)
        map.setView([latitude, longitude], 16)
        L.marker([latitude, longitude], { icon: L.divIcon(mapPinIconOptions('#185FA5')) })
          .addTo(map)
          .bindPopup(label)
        mapRef.current = map
        requestAnimationFrame(() => map.invalidateSize())
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [latitude, longitude, label])

  return <div ref={containerRef} className="h-[200px] w-full rounded-xl bg-slate-100" />
}

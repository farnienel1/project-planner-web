'use client'

import type { SiteMapMarker } from '@/components/site-map/SiteMapBoard'

/**
 * Keyboard and screen-reader way to the map's dots: one button per placed job, opening the same summary as clicking
 * its dot. Hidden until a button has focus, then shown so a keyboard user can see where they are.
 */
export function SiteMapJobButtons({
  markers,
  selectedId,
  onSelect,
}: {
  markers: SiteMapMarker[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (markers.length === 0) return null
  return (
    <nav aria-label="Jobs on the map" className="sr-only focus-within:not-sr-only sitemap-job-buttons">
      <ul>
        {markers.map((marker) => (
          <li key={marker.id}>
            <button type="button" aria-pressed={marker.id === selectedId} onClick={() => onSelect(marker.id)}>
              {marker.pinKind === 'smallWork' ? 'Small works' : 'Project'}: {marker.label}
              {marker.jobNumber && marker.jobNumber !== '—' ? ` (${marker.jobNumber})` : ''} · {marker.bookingCount} booked
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

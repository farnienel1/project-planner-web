'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { geocodeSiteProject } from '@/lib/maps/geocoding'
import {
  formatSiteAddress,
  isMappableSiteAddress,
  openMapsForProject,
  resolveStoredCoordinates,
} from '@/lib/maps/siteAddress'
import { SiteMapBoard, type SiteMapMarker } from '@/components/site-map/SiteMapBoard'
import { SetSitePinButton } from '@/components/site-map/SetSitePinButton'
import type { Project } from '@/types'

type SitePin = {
  id: string
  label: string
  jobNumber: string
  address: string
  latitude?: number
  longitude?: number
  bookingCount: number
  source: 'project' | 'smallWork'
  collection: 'projects' | 'smallWorks'
  project: Project
  pinKind: SiteMapMarker['pinKind']
  mapsUrl: string | null
  geocodeFailed: boolean
}

function pinKindForProject(project: Project): SiteMapMarker['pinKind'] {
  const jobType = (project.jobType || '').toLowerCase()
  if (jobType.includes('small work')) return 'smallWork'
  if (jobType.includes('maintenance')) return 'maintenance'
  return 'project'
}

export default function SiteMapPage() {
  const { organization } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings, loadBookings } = useBookingStore()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [coordinatesBySiteId, setCoordinatesBySiteId] = useState<
    Record<string, { latitude: number; longitude: number }>
  >({})
  const [geocoding, setGeocoding] = useState(false)
  const geocodedSiteIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
      loadBookings(organization.id)
    }
  }, [organization?.id, loadProjects, loadSmallWorks, loadBookings])

  const dateObj = useMemo(() => new Date(selectedDate), [selectedDate])

  const basePins = useMemo(() => {
    const allSites = mergeProjectsAndSmallWorks(projects, smallWorks).filter((site) => site.isLive)

    return allSites
      .map((site): Omit<SitePin, 'latitude' | 'longitude' | 'geocodeFailed'> & {
        latitude?: number
        longitude?: number
        geocodeFailed: boolean
      } => {
        const address = formatSiteAddress(site)
        const bookingCount = bookings.filter(
          (b) => b.projectId === site.id && isSameDay(new Date(b.date), dateObj)
        ).length
        const stored = resolveStoredCoordinates(site)
        const resolved = stored || coordinatesBySiteId[site.id]

        const source = /small works/i.test(site.jobType || '') ? 'smallWork' as const : 'project' as const

        return {
          id: site.id,
          label: site.siteName || 'Untitled site',
          jobNumber: site.jobNumber || '—',
          address,
          latitude: resolved?.latitude,
          longitude: resolved?.longitude,
          bookingCount,
          source,
          collection: source === 'smallWork' ? 'smallWorks' : 'projects',
          project: site,
          pinKind: pinKindForProject(site),
          mapsUrl: openMapsForProject(site),
          geocodeFailed: Boolean(isMappableSiteAddress(address) && !resolved),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [projects, smallWorks, bookings, dateObj, coordinatesBySiteId])

  useEffect(() => {
    let cancelled = false

    async function geocodeMissingSites() {
      const allSites = mergeProjectsAndSmallWorks(projects, smallWorks).filter((site) => site.isLive)
      const pending = allSites.filter((site) => {
        if (resolveStoredCoordinates(site)) return false
        if (geocodedSiteIds.current.has(site.id)) return false
        const address = formatSiteAddress(site)
        return isMappableSiteAddress(address)
      })

      if (pending.length === 0) {
        setGeocoding(false)
        return
      }

      setGeocoding(true)
      const next: Record<string, { latitude: number; longitude: number }> = {}

      for (const site of pending) {
        if (cancelled) return
        const coords = await geocodeSiteProject(site)
        if (coords) {
          geocodedSiteIds.current.add(site.id)
          next[site.id] = coords
        }
      }

      if (!cancelled && Object.keys(next).length > 0) {
        setCoordinatesBySiteId((current) => ({ ...current, ...next }))
      }
      if (!cancelled) setGeocoding(false)
    }

    if (organization?.id && (projects.length > 0 || smallWorks.length > 0)) {
      void geocodeMissingSites()
    }

    return () => {
      cancelled = true
    }
  }, [organization?.id, projects, smallWorks])

  const mapMarkers = useMemo(
    (): SiteMapMarker[] =>
      basePins
        .filter((pin) => pin.latitude != null && pin.longitude != null)
        .map((pin) => ({
          id: pin.id,
          label: pin.label,
          jobNumber: pin.jobNumber,
          latitude: pin.latitude!,
          longitude: pin.longitude!,
          bookingCount: pin.bookingCount,
          pinKind: pin.pinKind,
        })),
    [basePins]
  )

  const withCoords = basePins.filter((p) => p.latitude != null && p.longitude != null)
  const withBookings = basePins.filter((p) => p.bookingCount > 0)
  const withAddress = basePins.filter((p) => isMappableSiteAddress(p.address))

  const handleSelectMarker = useCallback((id: string) => {
    setSelectedPinId(id)
  }, [])

  if (!organization) return <LoadingSpinner />

  return (
    <div className="stack" data-hue="proj">
      <div className="phead" data-hue="proj">
        <div>
          <h1>Site map</h1>
          <div className="sub">Every job on one map, with who is on site today</div>
        </div>
        <div className="acts">
          <input
            type="date"
            value={selectedDate}
            aria-label="Selected day"
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setSelectedPinId(null)
            }}
            className="in"
            style={{ width: 170, height: 44 }}
          />
        </div>
      </div>
      {geocoding ? <p className="muted small">Locating sites on map…</p> : null}

      <div className="map card" style={{ minHeight: 420 }}>
        <SiteMapBoard
          markers={mapMarkers}
          selectedMarkerId={selectedPinId}
          onSelectMarker={handleSelectMarker}
        />
      </div>

      {withCoords.length === 0 && withAddress.length > 0 && (
        <div className="banner" data-hue="warn">
          {geocoding
            ? 'Finding map locations from site addresses…'
            : 'Some addresses could not be located automatically. You can still open them in Google Maps from the cards below.'}
        </div>
      )}

      {basePins.length === 0 ? (
        <EmptyState title="No sites found" description="Projects and small works from Firebase will appear here." />
      ) : (
        <div className="rows">
          {basePins.map((pin) => {
            const isSelected = selectedPinId === pin.id
            return (
              <div
                key={pin.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPinId(pin.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setSelectedPinId(pin.id)
                }}
                className={`ritem ${isSelected ? 'sel' : ''}`}
                data-hue={pin.source === 'smallWork' ? 'sw' : 'proj'}
              >
                <span className="ico-chip">{pin.source === 'smallWork' ? 'SW' : 'P'}</span>
                <span className="grow">
                  <span className="t">{pin.label}</span>
                  <span className="s">
                    {pin.jobNumber} · {pin.source === 'project' ? 'Project' : 'Small works'} · {pin.address || 'No address'}
                  </span>
                </span>
                <span className="pill">{pin.bookingCount} booked</span>
                <span
                  className="row"
                  style={{ gap: 8 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <SetSitePinButton
                    project={pin.project}
                    collection={pin.collection}
                    onUpdated={(updated) => {
                      setCoordinatesBySiteId((current) => ({
                        ...current,
                        [updated.id]: {
                          latitude: updated.latitude!,
                          longitude: updated.longitude!,
                        },
                      }))
                    }}
                  />
                  {pin.mapsUrl ? (
                    <a href={pin.mapsUrl} target="_blank" rel="noreferrer" className="btn xs">
                      Open map
                    </a>
                  ) : (
                    <span className="muted xs">No address</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

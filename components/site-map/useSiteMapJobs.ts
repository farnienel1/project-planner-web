'use client'

/**
 * The site map's jobs for one organisation day, shared by the Site map page and the Home card (owner 24 Nov).
 * Reads the stores the screen has loaded and never loads them itself. With `geocode` (the full Site map page) it looks up
 * job addresses with no stored pin, remembering misses per organisation for this tab (`sessionStorage`) so a revisit
 * never asks again; without it (the Home card) it never geocodes and shows only jobs with a stored pin.
 * Counts are rulebook 1.23.0 §21 `siteMapPins` (the day's bookings that occupy it, each person once).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { jobKind, siteMapPins } from '@/lib/canonical'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { geocodeSiteProject } from '@/lib/maps/geocoding'
import { formatSiteAddress, isMappableSiteAddress, openMapsForProject, resolveStoredCoordinates } from '@/lib/maps/siteAddress'
import type { SiteMapMarker } from '@/components/site-map/SiteMapBoard'
import type { Project } from '@/types'

export type SiteMapJob = {
  id: string
  label: string
  jobNumber: string
  address: string
  latitude?: number
  longitude?: number
  bookingCount: number
  peopleCount: number
  source: 'project' | 'smallWork'
  collection: 'projects' | 'smallWorks'
  project: Project
  mapsUrl: string | null
  geocodeFailed: boolean
}

/** This tab's remembered geocode misses for one organisation (site ids). */
export function siteMapGeocodeMissKey(organizationId: string): string {
  return `pp.siteMap.geocodeMisses:${organizationId}`
}

function readGeocodeMisses(organizationId: string): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(siteMapGeocodeMissKey(organizationId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeGeocodeMisses(organizationId: string, ids: Set<string>): void {
  try {
    window.sessionStorage.setItem(siteMapGeocodeMissKey(organizationId), JSON.stringify([...ids]))
  } catch {
    // storage blocked or full: misses are asked again next time
  }
}

export function useSiteMapJobs(input: {
  organizationId: string | null | undefined
  dayKey: string
  timeZone: string
  /** Look up addresses with no stored pin (the full map only; Home passes false). Default true. */
  geocode?: boolean
}) {
  const { organizationId, dayKey, timeZone, geocode = true } = input
  const { projects, smallWorks } = useProjectStore()
  const { bookings } = useBookingStore()
  const { managerSiteBookings } = useManagerScheduleStore()
  const { operatives } = useOperativeStore()
  const { users } = useOrgUserStore()
  const [coordinatesBySiteId, setCoordinatesBySiteId] = useState<Record<string, { latitude: number; longitude: number }>>({})
  const [geocoding, setGeocoding] = useState(false)
  const geocodedSiteIds = useRef<Set<string>>(new Set())

  const liveSites = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks).filter((site) => site.isLive),
    [projects, smallWorks]
  )

  const people = useMemo(
    () => [
      ...users.map((u) => ({ id: u.id, email: u.email, isActive: u.isActive, formerUserIds: u.formerUserIds })),
      ...operatives.map((o) => ({ id: o.id, email: o.email, isActive: o.isActive })),
    ],
    [users, operatives]
  )

  const jobs = useMemo((): SiteMapJob[] => {
    const counts = new Map(
      siteMapPins({
        jobs: liveSites.map((site) => ({ id: site.id, isLive: site.isLive })),
        bookings: bookings.map((booking) => ({
          projectId: booking.projectId,
          operativeId: booking.operativeId,
          date: booking.date,
          status: String(booking.status ?? ''),
        })),
        managerSiteBookings: managerSiteBookings.map((booking) => ({
          userId: booking.userId,
          locationId: booking.locationId ?? null,
          locationType: booking.locationType,
          date: booking.date,
        })),
        dayKey,
        timeZone,
        people,
      }).map((pin) => [pin.jobId, pin])
    )
    return liveSites
      .map((site): SiteMapJob => {
        const address = formatSiteAddress(site)
        const pin = counts.get(site.id)
        const resolved = resolveStoredCoordinates(site) || coordinatesBySiteId[site.id]
        // The collection decides the kind (`jobKind`, §17), never `jobType` text.
        const source = jobKind(site, site.collection) === 'smallWorks' ? ('smallWork' as const) : ('project' as const)
        return {
          id: site.id,
          label: site.siteName || 'Untitled site',
          jobNumber: site.jobNumber || '—',
          address,
          latitude: resolved?.latitude,
          longitude: resolved?.longitude,
          bookingCount: pin?.bookingCount ?? 0,
          peopleCount: pin?.peopleCount ?? 0,
          source,
          collection: source === 'smallWork' ? 'smallWorks' : 'projects',
          project: site,
          mapsUrl: openMapsForProject(site),
          geocodeFailed: Boolean(geocode && isMappableSiteAddress(address) && !resolved),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [liveSites, bookings, managerSiteBookings, dayKey, timeZone, people, coordinatesBySiteId, geocode])

  useEffect(() => {
    let cancelled = false
    async function geocodeMissingSites(orgId: string) {
      const misses = readGeocodeMisses(orgId)
      const pending = liveSites.filter((site) => {
        if (resolveStoredCoordinates(site)) return false
        if (geocodedSiteIds.current.has(site.id) || misses.has(site.id)) return false
        return isMappableSiteAddress(formatSiteAddress(site))
      })
      if (pending.length === 0) {
        setGeocoding(false)
        return
      }
      setGeocoding(true)
      const next: Record<string, { latitude: number; longitude: number }> = {}
      for (const site of pending) {
        if (cancelled) return
        const coords = await Promise.race([
          geocodeSiteProject(site),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
        ])
        // A miss or a hung lookup must not leave "Locating sites…" up on the next pass.
        geocodedSiteIds.current.add(site.id)
        if (coords) next[site.id] = coords
        else misses.add(site.id)
      }
      writeGeocodeMisses(orgId, misses)
      if (!cancelled && Object.keys(next).length > 0) setCoordinatesBySiteId((current) => ({ ...current, ...next }))
      if (!cancelled) setGeocoding(false)
    }
    // Home never geocodes; `geocoding` starts false and stays false there.
    if (!geocode) return
    if (organizationId && liveSites.length > 0) void geocodeMissingSites(organizationId)
    return () => {
      cancelled = true
    }
  }, [organizationId, liveSites, geocode])

  const markers = useMemo(
    (): SiteMapMarker[] =>
      jobs
        .filter((job) => job.latitude != null && job.longitude != null)
        .map((job) => ({
          id: job.id,
          label: job.label,
          jobNumber: job.jobNumber,
          latitude: job.latitude!,
          longitude: job.longitude!,
          bookingCount: job.bookingCount,
          pinKind: job.source,
        })),
    [jobs]
  )

  return { jobs, markers, geocoding, setCoordinatesBySiteId }
}

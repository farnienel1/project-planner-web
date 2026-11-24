'use client'

/**
 * The site map's jobs for one organisation day, shared by the Site map page and the Home card (owner 24 Nov).
 * Reads the stores the screen has loaded and never loads them itself, and never writes (rulebook §1). Which jobs are
 * shown is the rulebook job status on the day (`siteMapJobShown`: Active and Upcoming, Completed with the toggle,
 * never inactive); where each goes is `siteMapPlacement` (stored pin, "lat, lng" address text, else the UK postcode
 * looked up on postcodes.io and remembered in this browser). Jobs that cannot be placed are returned as `unplaced`.
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
import { formatSiteAddress, openMapsForProject } from '@/lib/maps/siteAddress'
import {
  lookupPostcodes,
  readCachedPostcodes,
  siteMapJobShown,
  siteMapPlacement,
  siteMapPlacementUnplaced,
  type LatLng,
  type SiteMapPlacement,
} from '@/lib/maps/siteMapPlacement'
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
  placement: SiteMapPlacement
}

export function useSiteMapJobs(input: {
  organizationId: string | null | undefined
  dayKey: string
  timeZone: string
  /** Completed jobs as well as Active and Upcoming (the map's toggle; off by default). */
  includeCompleted?: boolean
}) {
  const { organizationId, dayKey, timeZone, includeCompleted = false } = input
  const { projects, smallWorks } = useProjectStore()
  const { bookings } = useBookingStore()
  const { managerSiteBookings } = useManagerScheduleStore()
  const { operatives, managers } = useOperativeStore()
  const { users } = useOrgUserStore()
  const [postcodes, setPostcodes] = useState<Map<string, LatLng | null>>(() => readCachedPostcodes())
  /** Postcodes whose lookup failed in this visit (network): not placed for now, never remembered as unknown. */
  const [failedPostcodes, setFailedPostcodes] = useState<Set<string>>(() => new Set())
  const asked = useRef<Set<string>>(new Set())

  const shownSites = useMemo(
    () =>
      mergeProjectsAndSmallWorks(projects, smallWorks).filter((site) =>
        siteMapJobShown(site, { includeCompleted, dayKey, timeZone })
      ),
    [projects, smallWorks, includeCompleted, dayKey, timeZone]
  )

  const people = useMemo(
    () => [
      ...users.map((u) => ({ id: u.id, email: u.email, isActive: u.isActive, formerUserIds: u.formerUserIds })),
      ...operatives.map((o) => ({ id: o.id, email: o.email, isActive: o.isActive })),
      // `siteMapPins` folds users, `operatives` and `managers` rows into one person each (§21).
      ...managers.map((m) => ({ id: m.id, email: m.email, isActive: m.isActive })),
    ],
    [users, operatives, managers]
  )

  const jobs = useMemo((): SiteMapJob[] => {
    const counts = new Map(
      siteMapPins({
        jobs: shownSites.map((site) => ({ id: site.id, isLive: site.isLive })),
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
    return shownSites
      .map((site): SiteMapJob => {
        const pin = counts.get(site.id)
        let placement = siteMapPlacement(site, postcodes)
        if (placement.kind === 'pending' && failedPostcodes.has(placement.postcode)) {
          placement = { kind: 'postcodeNotFound', postcode: placement.postcode }
        }
        const coordinates = 'coordinates' in placement ? placement.coordinates : null
        // The collection decides the kind (`jobKind`, §17), never `jobType` text.
        const source = jobKind(site, site.collection) === 'smallWorks' ? ('smallWork' as const) : ('project' as const)
        return {
          id: site.id,
          label: site.siteName || 'Untitled site',
          jobNumber: site.jobNumber || '—',
          address: formatSiteAddress(site),
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          bookingCount: pin?.bookingCount ?? 0,
          peopleCount: pin?.peopleCount ?? 0,
          source,
          collection: source === 'smallWork' ? 'smallWorks' : 'projects',
          project: site,
          mapsUrl: openMapsForProject(site),
          placement,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [shownSites, bookings, managerSiteBookings, dayKey, timeZone, people, postcodes, failedPostcodes])

  // One key per set of postcodes still to look up, so the lookup runs once per change, not per render.
  const pendingKey = useMemo(
    () =>
      [...new Set(jobs.flatMap((job) => (job.placement.kind === 'pending' ? [job.placement.postcode] : [])))]
        .sort()
        .join('|'),
    [jobs]
  )

  // Only the postcodes are sent (postcodes.io, no key); answers are remembered in this browser, nothing is written.
  useEffect(() => {
    if (!organizationId || !pendingKey) return
    const askedSet = asked.current
    const toAsk = pendingKey.split('|').filter((postcode) => !askedSet.has(postcode))
    if (toAsk.length === 0) return
    let cancelled = false
    for (const postcode of toAsk) askedSet.add(postcode)
    lookupPostcodes(toAsk)
      .then((found) => {
        if (cancelled) return
        setPostcodes((current) => {
          const next = new Map(current)
          for (const [key, value] of found) next.set(key, value)
          return next
        })
      })
      .catch(() => {
        if (cancelled) return
        setFailedPostcodes((current) => new Set([...current, ...toAsk]))
      })
    return () => {
      cancelled = true
      // A lookup cut short by a change is asked again.
      for (const postcode of toAsk) askedSet.delete(postcode)
    }
  }, [organizationId, pendingKey])

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

  const unplaced = useMemo(() => jobs.filter((job) => siteMapPlacementUnplaced(job.placement)), [jobs])
  return { jobs, markers, unplaced, locating: pendingKey !== '' }
}

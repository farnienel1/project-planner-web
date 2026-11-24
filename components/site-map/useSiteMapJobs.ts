'use client'

/**
 * The site map's jobs for one organisation day, shared by the Site map page and the Home card (owner 24 Nov).
 * Reads the stores the screen has loaded and never loads them itself, and never writes (rulebook §1). Which jobs are
 * shown is the rulebook job status on the day (`siteMapJobShown`: Active and Upcoming, Completed with the toggle,
 * never inactive); where each goes is `siteMapPlacement` (stored pin, "lat, lng" address text, else the UK postcode
 * looked up on postcodes.io and remembered in this browser). Jobs that cannot be placed are returned as `unplaced`.
 * Counts are rulebook 1.23.0 §21 `siteMapPins` (the day's bookings that occupy it, each person once).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /** Postcodes whose lookup could not be reached in this visit: `lookupFailed`, asked again on `online` / focus. */
  const [failedPostcodes, setFailedPostcodes] = useState<Set<string>>(() => new Set())
  /** Postcodes asked in this organisation (one request each; never cancelled by a re-render). */
  const asked = useRef<Set<string>>(new Set())
  /** Bumped on an organisation change and on unmount: answers of an older generation are dropped. */
  const generation = useRef(0)

  // A new organisation starts its own lookups; answers for the previous one are not applied.
  useEffect(() => {
    generation.current += 1
    asked.current = new Set()
    const mine = generation.current
    return () => {
      if (generation.current === mine) generation.current += 1
    }
  }, [organizationId])

  /** Asks again the postcode lookups that could not be reached (Retry, back online, back on the tab). */
  const retryLookups = useCallback(
    () =>
      setFailedPostcodes((current) => {
        if (current.size === 0) return current
        for (const postcode of current) asked.current.delete(postcode)
        return new Set()
      }),
    []
  )

  // Back online, or back on the tab: the lookups that could not be reached are asked again.
  useEffect(() => {
    const retry = retryLookups
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('focus', retry)
    }
  }, [retryLookups])

  const currentSites = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks).filter((site) => site.isLive !== false),
    [projects, smallWorks]
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

  const counts = useMemo(
    () =>
      new Map(
        siteMapPins({
          jobs: currentSites.map((site) => ({ id: site.id, isLive: site.isLive })),
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
      ),
    [currentSites, bookings, managerSiteBookings, dayKey, timeZone, people]
  )

  const jobs = useMemo((): SiteMapJob[] => {
    return currentSites
      .flatMap((site): SiteMapJob[] => {
        const pin = counts.get(site.id)
        const bookedThatDay = (pin?.bookingCount ?? 0) > 0 || (pin?.peopleCount ?? 0) > 0
        if (!siteMapJobShown(site, { includeCompleted, dayKey, timeZone, bookedThatDay })) return []
        const placement = siteMapPlacement(site, postcodes, failedPostcodes)
        const coordinates = 'coordinates' in placement ? placement.coordinates : null
        // The collection decides the kind (`jobKind`, §17), never `jobType` text.
        const source = jobKind(site, site.collection) === 'smallWorks' ? ('smallWork' as const) : ('project' as const)
        return [
          {
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
          },
        ]
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [currentSites, counts, includeCompleted, dayKey, timeZone, postcodes, failedPostcodes])

  // One key per set of postcodes still to look up, so the lookup runs once per change, not per render.
  const pendingKey = useMemo(
    () =>
      [...new Set(jobs.flatMap((job) => (job.placement.kind === 'pending' ? [job.placement.postcode] : [])))]
        .sort()
        .join('|'),
    [jobs]
  )

  // Only the postcodes are sent (postcodes.io, no key); each batch's answers are applied and remembered in this
  // browser as they arrive; nothing is written to Firestore. An answer is never cancelled by a later change; it is
  // dropped only after unmount or an organisation change.
  useEffect(() => {
    if (!organizationId || !pendingKey) return
    const toAsk = pendingKey.split('|').filter((postcode) => !asked.current.has(postcode))
    if (toAsk.length === 0) return
    for (const postcode of toAsk) asked.current.add(postcode)
    const mine = generation.current
    void lookupPostcodes(toAsk, {
      onBatch: (found) => {
        if (generation.current !== mine) return
        setPostcodes((current) => {
          const next = new Map(current)
          for (const [key, value] of found) next.set(key, value)
          return next
        })
      },
    }).then(({ failed }) => {
      if (generation.current !== mine || failed.length === 0) return
      setFailedPostcodes((current) => new Set([...current, ...failed]))
    })
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
  const lookupFailedCount = useMemo(() => unplaced.filter((job) => job.placement.kind === 'lookupFailed').length, [unplaced])

  return {
    jobs,
    markers,
    unplaced,
    lookupFailedCount,
    retryLookups,
    locating: Boolean(organizationId) && pendingKey !== '',
  }
}

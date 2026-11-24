'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewSiteMap } from '@/lib/navigation/menuPermissions'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useBookingHistoryFrom } from '@/lib/stores/useBookingHistory'
import { useOrganizationDayKey } from '@/lib/warnings/useOrganizationDayKey'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'
import { watchSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
import { useDailyOverviewModel } from '@/lib/daily-overview/useDailyOverviewModel'
import { officeCentreFromOrganization, siteMapJobSummary } from '@/lib/maps/siteMapView'
import { siteMapUnplacedReason } from '@/lib/maps/siteMapPlacement'
import { userCanEditJob } from '@/lib/access/bookingAccess'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { SiteMapBoard } from '@/components/site-map/SiteMapBoard'
import { SetSitePinButton } from '@/components/site-map/SetSitePinButton'
import { SiteMapJobSummaryCard } from '@/components/site-map/SiteMapJobSummaryCard'
import { SiteMapCompletedToggle, SiteMapLegend } from '@/components/site-map/SiteMapLegend'
import { useSiteMapJobs } from '@/components/site-map/useSiteMapJobs'

export default function SiteMapPage() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { loadProjects, loadSmallWorks } = useProjectStore()
  const { loadBookings } = useBookingStore()
  const { loadManagerSiteBookings } = useManagerScheduleStore()
  const { loadOperatives, loadManagers } = useOperativeStore()
  const { loadUsers } = useOrgUserStore()
  const { loadBookings: loadHolidays } = useHolidayStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const liveOrganization = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const todayKey = useOrganizationDayKey(timeZone)
  const today = useMemo(() => new Date(), [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps -- new instant per organisation day
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [subcontractorBookings, setSubcontractorBookings] = useState<SubcontractorBookingRow[]>([])
  const day = useMemo(() => dateFromDayKey(selectedDate, timeZone), [selectedDate, timeZone])
  const allowed = Boolean(user && canViewSiteMap(user))
  // Today moves on at the organisation's midnight (and once the organisation zone is known): a viewer on the old
  // today follows to the new one; a viewer on another day stays there (as Daily Overview).
  const lastTodayKey = useRef(todayKey)
  useEffect(() => {
    const previous = lastTodayKey.current
    lastTodayKey.current = todayKey
    if (previous === todayKey) return
    setSelectedDate((current) => (current === previous ? todayKey : current))
  }, [todayKey])

  useEffect(() => {
    if (user && !canViewSiteMap(user)) router.replace('/dashboard')
  }, [user, router])

  useEffect(() => {
    if (!organization?.id || !allowed) return
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadManagers(organization.id)
    loadUsers(organization.id)
    loadHolidays(organization.id)
    loadSubcontractors(organization.id)
  }, [
    organization?.id,
    allowed,
    loadProjects,
    loadSmallWorks,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadManagers,
    loadUsers,
    loadHolidays,
    loadSubcontractors,
  ])

  // Rulebook 1.9.0 §1: subcontractor bookings are live while the screen showing them is open (Daily Overview's model).
  useEffect(() => {
    if (!organization?.id || !allowed) return
    setSubcontractorBookings([])
    return watchSubcontractorBookings(organization.id, setSubcontractorBookings, () => setSubcontractorBookings([]))
  }, [organization?.id, allowed])

  // A past day reaches before the launch booking download.
  useBookingHistoryFrom(organization?.id, day)

  const { jobs, markers, unplaced, locating } = useSiteMapJobs({
    organizationId: organization?.id,
    dayKey: selectedDate,
    timeZone,
    includeCompleted,
  })

  // The figures under the map are the Daily Overview model of the day shown (owner 24 Nov): hours, overtime and leave.
  const { model, settingsLoaded } = useDailyOverviewModel({
    day,
    today,
    timeZone,
    subcontractorBookings,
    subcontractors,
    enabled: allowed,
  })

  // Home's "See which on the full map" opens #unplaced: the section appears once the lookups finish, so scroll then.
  const scrolledToUnplaced = useRef(false)
  useEffect(() => {
    if (scrolledToUnplaced.current || locating || unplaced.length === 0) return
    if (typeof window === 'undefined' || window.location.hash !== '#unplaced') return
    scrolledToUnplaced.current = true
    document.getElementById('unplaced')?.scrollIntoView({ block: 'start' })
  }, [locating, unplaced.length])

  const officeCentre = useMemo(
    () =>
      liveOrganization.organizationId === organization?.id ? officeCentreFromOrganization(liveOrganization.data) : null,
    [liveOrganization.organizationId, liveOrganization.data, organization?.id]
  )

  const selectedJob = jobs.find((job) => job.id === selectedPinId) ?? null
  const summary = useMemo(
    () => (selectedJob ? siteMapJobSummary({ jobId: selectedJob.id, peopleOnSite: selectedJob.peopleCount, model }) : null),
    [selectedJob, model]
  )

  const handleSelectMarker = useCallback((id: string) => {
    setSelectedPinId(id)
  }, [])

  if (!user || !allowed) return null
  if (!organization) return <LoadingSpinner />

  return (
    <div className="stack" data-hue="proj">
      <div className="phead" data-hue="proj">
        <div>
          <h1>Site map</h1>
          <div className="sub">Every job on one map, with who is on site</div>
        </div>
        <div className="acts">
          <input
            type="date"
            value={selectedDate}
            aria-label="Selected day"
            onChange={(e) => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return
              setSelectedDate(e.target.value)
            }}
            className="in"
            style={{ width: 170, height: 44 }}
          />
        </div>
      </div>
      <div className="sitemap-bar">
        <SiteMapLegend />
        <SiteMapCompletedToggle checked={includeCompleted} onChange={setIncludeCompleted} />
      </div>
      {locating ? <p className="muted small">Locating sites on map…</p> : null}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <SiteMapBoard
          markers={markers}
          selectedMarkerId={selectedPinId}
          onSelectMarker={handleSelectMarker}
          officeCentre={officeCentre}
        />
      </div>

      <SiteMapJobSummaryCard
        job={selectedJob}
        summary={summary}
        dayLabel={model?.dayLabel ?? selectedDate}
        dayKey={selectedDate}
        loading={!settingsLoaded || !model}
        onClose={() => setSelectedPinId(null)}
      />

      {!locating && unplaced.length > 0 ? (
        <section className="card sitemap-unplaced" id="unplaced" aria-labelledby="site-map-unplaced-title">
          <h2 id="site-map-unplaced-title">Jobs without an address</h2>
          <p className="muted small">
            {unplaced.length === 1
              ? 'This job could not be placed on the map from its address.'
              : `These ${unplaced.length} jobs could not be placed on the map from their addresses.`}{' '}
            Set the pin by hand and it is saved to the job.
          </p>
          <div className="rows">
            {unplaced.map((job) => (
              <div key={job.id} className="ritem" data-hue={job.source === 'smallWork' ? 'sw' : 'proj'}>
                <span className="ico-chip">{job.source === 'smallWork' ? 'SW' : 'P'}</span>
                <span className="grow">
                  <span className="t">{job.label}</span>
                  <span className="s">
                    {job.jobNumber} · {job.source === 'project' ? 'Project' : 'Small works'} ·{' '}
                    {job.address || 'No address'} · {siteMapUnplacedReason(job.placement)}
                  </span>
                </span>
                {userCanEditJob(user, job.project, job.collection) ? (
                  <SetSitePinButton project={job.project} collection={job.collection} />
                ) : (
                  <span className="muted xs">Ask an admin to set the pin</span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

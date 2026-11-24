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
import { isMappableSiteAddress } from '@/lib/maps/siteAddress'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { SiteMapBoard } from '@/components/site-map/SiteMapBoard'
import { SetSitePinButton } from '@/components/site-map/SetSitePinButton'
import { SiteMapJobSummaryCard } from '@/components/site-map/SiteMapJobSummaryCard'
import { SiteMapLegend } from '@/components/site-map/SiteMapLegend'
import { useSiteMapJobs } from '@/components/site-map/useSiteMapJobs'

export default function SiteMapPage() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { loadProjects, loadSmallWorks } = useProjectStore()
  const { loadBookings } = useBookingStore()
  const { loadManagerSiteBookings } = useManagerScheduleStore()
  const { loadOperatives } = useOperativeStore()
  const { loadUsers } = useOrgUserStore()
  const { loadBookings: loadHolidays } = useHolidayStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const liveOrganization = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const todayKey = useOrganizationDayKey(timeZone)
  const today = useMemo(() => new Date(), [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps -- new instant per organisation day
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
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

  const { jobs, markers, geocoding, setCoordinatesBySiteId } = useSiteMapJobs({
    organizationId: organization?.id,
    dayKey: selectedDate,
    timeZone,
  })

  // The figures under the map are the Daily Overview model of the day shown (owner 24 Nov): hours, overtime and leave.
  const { model, settingsLoaded, companyLeave } = useDailyOverviewModel({
    day,
    today,
    timeZone,
    subcontractorBookings,
    subcontractors,
    enabled: allowed,
  })

  const officeCentre = useMemo(
    () =>
      liveOrganization.organizationId === organization?.id ? officeCentreFromOrganization(liveOrganization.data) : null,
    [liveOrganization.organizationId, liveOrganization.data, organization?.id]
  )

  const selectedJob = jobs.find((job) => job.id === selectedPinId) ?? null
  const summary = useMemo(
    () => (selectedJob ? siteMapJobSummary({ jobId: selectedJob.id, peopleOnSite: selectedJob.peopleCount, model, companyLeave }) : null),
    [selectedJob, model, companyLeave]
  )

  const withCoords = jobs.filter((p) => p.latitude != null && p.longitude != null)
  const withAddress = jobs.filter((p) => isMappableSiteAddress(p.address))

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
      {geocoding ? <p className="muted small">Locating sites on map…</p> : null}

      <SiteMapLegend />
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

      {withCoords.length === 0 && withAddress.length > 0 && (
        <div className="banner" data-hue="warn">
          {geocoding
            ? 'Finding map locations from site addresses…'
            : 'Some addresses could not be located automatically. You can still open them in Google Maps from the cards below.'}
        </div>
      )}

      {jobs.length === 0 ? (
        <EmptyState title="No sites found" description="Projects and small works from Firebase will appear here." />
      ) : (
        <div className="rows">
          {jobs.map((pin) => {
            const isSelected = selectedPinId === pin.id
            return (
              <div
                key={pin.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
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
                <span className="row" style={{ gap: 8 }} onClick={(event) => event.stopPropagation()}>
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

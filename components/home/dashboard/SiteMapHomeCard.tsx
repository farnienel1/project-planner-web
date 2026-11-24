'use client'

/**
 * Home: a small site map for admins (owner 24 Nov, "a really basic interactive map … not too much detail"). The same
 * map as the Site map page, on today, with the same summary under it when a dot is clicked. Lazy-loaded by Home so
 * the map code and its tiles never slow Home's first paint. Reads only the stores and the Daily Overview model Home
 * has already loaded and loads no store itself. Jobs are placed as on the full map (`useSiteMapJobs`: a stored pin, else
 * "lat, lng" address text, else the UK postcode on postcodes.io, remembered in this browser); the jobs that still cannot
 * be placed are counted and linked to the full map's "Jobs without an address".
 */

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import type { DailyOverviewModel } from '@/lib/daily-overview/buildDailyOverview'
import { officeCentreFromOrganization, siteMapJobSummary } from '@/lib/maps/siteMapView'
import type { SiteMapLeaveSummary } from '@/lib/canonical'
import { siteMapUnplacedText } from '@/lib/maps/siteMapPlacement'
import { SiteMapBoard } from '@/components/site-map/SiteMapBoard'
import { SiteMapJobSummaryCard } from '@/components/site-map/SiteMapJobSummaryCard'
import { SiteMapCompletedToggle, SiteMapLegend } from '@/components/site-map/SiteMapLegend'
import { SiteMapJobButtons } from '@/components/site-map/SiteMapJobButtons'
import { useSiteMapJobs } from '@/components/site-map/useSiteMapJobs'

export default function SiteMapHomeCard({
  model,
  companyLeave,
  dayKey,
  timeZone,
}: {
  /** Home's own Daily Overview model for today (null while it loads). */
  model: DailyOverviewModel | null
  /** Rulebook 1.82.0 §21: the whole company's leave today (`useDailyOverviewModel().companyLeave`). */
  companyLeave: SiteMapLeaveSummary | null
  dayKey: string
  timeZone: string
}) {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const liveOrganization = useOrganizationDocument()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const { jobs, markers, unplaced, lookupFailedCount, locating } = useSiteMapJobs({
    organizationId,
    dayKey,
    timeZone,
    includeCompleted,
  })
  const unplacedText = locating ? null : siteMapUnplacedText(unplaced.length - lookupFailedCount, lookupFailedCount)
  const officeCentre = useMemo(
    () => (liveOrganization.organizationId === organizationId ? officeCentreFromOrganization(liveOrganization.data) : null),
    [liveOrganization.organizationId, liveOrganization.data, organizationId]
  )
  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null
  const summary = useMemo(
    () => (selectedJob ? siteMapJobSummary({ jobId: selectedJob.id, peopleOnSite: selectedJob.peopleCount, model, companyLeave }) : null),
    [selectedJob, model, companyLeave]
  )
  const select = useCallback((id: string) => setSelectedId(id), [])

  return (
    <section className="dash-card" aria-labelledby="home-site-map-title">
      <div className="dash-ch wrap">
        <h2 id="home-site-map-title">Site map</h2>
        <SiteMapLegend />
        <Link href="/dashboard/site-map" className="dash-link">
          Open full map
        </Link>
      </div>
      <div style={{ margin: '0 0 8px' }}>
        <SiteMapCompletedToggle checked={includeCompleted} onChange={setIncludeCompleted} />
      </div>
      {unplacedText ? (
        <p className="dash-muted" style={{ margin: '0 0 8px' }}>
          {unplacedText}{' '}
          <Link href="/dashboard/site-map#unplaced" className="dash-link">
            See which on the full map
          </Link>
        </p>
      ) : null}
      <SiteMapBoard markers={markers} selectedMarkerId={selectedId} onSelectMarker={select} officeCentre={officeCentre} compact />
      <SiteMapJobButtons markers={markers} selectedId={selectedId} onSelect={select} />
      {!locating && jobs.length === 0 ? (
        <p className="dash-muted" style={{ margin: '8px 0 0' }}>
          {includeCompleted ? 'No jobs on this day.' : 'No active or upcoming jobs on this day.'}
        </p>
      ) : null}
      <div style={{ marginTop: 10 }}>
        <SiteMapJobSummaryCard
          job={selectedJob}
          summary={summary}
          dayLabel="Today"
          dayKey={dayKey}
          loading={!model}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </section>
  )
}

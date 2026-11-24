'use client'

/**
 * Home: a small site map for admins (owner 24 Nov, "a really basic interactive map … not too much detail"). The same
 * map as the Site map page, on today, with the same summary under it when a dot is clicked. Lazy-loaded by Home so
 * the map code and its tiles never slow Home's first paint. Reads only the stores and the Daily Overview model Home
 * has already loaded; it loads nothing itself and never looks up addresses (only jobs with a stored pin are shown; the
 * full map finds the rest).
 */

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import type { DailyOverviewModel } from '@/lib/daily-overview/buildDailyOverview'
import { officeCentreFromOrganization, siteMapJobSummary } from '@/lib/maps/siteMapView'
import { SiteMapBoard } from '@/components/site-map/SiteMapBoard'
import { SiteMapJobSummaryCard } from '@/components/site-map/SiteMapJobSummaryCard'
import { SiteMapLegend } from '@/components/site-map/SiteMapLegend'
import { useSiteMapJobs } from '@/components/site-map/useSiteMapJobs'

export default function SiteMapHomeCard({
  model,
  dayKey,
  timeZone,
}: {
  /** Home's own Daily Overview model for today (null while it loads). */
  model: DailyOverviewModel | null
  dayKey: string
  timeZone: string
}) {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const liveOrganization = useOrganizationDocument()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { jobs, markers } = useSiteMapJobs({ organizationId, dayKey, timeZone, geocode: false })
  const unpinned = jobs.length - markers.length
  const officeCentre = useMemo(
    () => (liveOrganization.organizationId === organizationId ? officeCentreFromOrganization(liveOrganization.data) : null),
    [liveOrganization.organizationId, liveOrganization.data, organizationId]
  )
  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null
  const summary = useMemo(
    () => (selectedJob ? siteMapJobSummary({ jobId: selectedJob.id, peopleOnSite: selectedJob.peopleCount, model }) : null),
    [selectedJob, model]
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
      {unpinned > 0 ? (
        <p className="dash-muted" style={{ margin: '0 0 8px' }}>
          {unpinned === 1 ? '1 job has' : `${unpinned} jobs have`} no map pin yet.{' '}
          <Link href="/dashboard/site-map" className="dash-link">
            Find them on the full map
          </Link>
        </p>
      ) : null}
      <SiteMapBoard markers={markers} selectedMarkerId={selectedId} onSelectMarker={select} officeCentre={officeCentre} compact />
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

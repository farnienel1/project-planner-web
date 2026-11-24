'use client'

import Link from 'next/link'
import { overviewFormatHours } from '@/lib/daily-overview/buildDailyOverview'
import type { SiteMapJobSummary } from '@/lib/maps/siteMapView'
import type { SiteMapJob } from '@/components/site-map/useSiteMapJobs'

/**
 * The card under the site map for the job whose dot was picked (owner 24 Nov): people on site, hours on site,
 * overtime and annual leave on the day shown. Figures come from `siteMapJobSummary` (rulebook outputs only).
 */
export function SiteMapJobSummaryCard({
  job,
  summary,
  dayLabel,
  dayKey,
  loading,
  onClose,
}: {
  job: SiteMapJob | null
  summary: SiteMapJobSummary | null
  dayLabel: string
  dayKey: string
  loading: boolean
  onClose?: () => void
}) {
  if (!job) {
    return <p className="sitemap-hint">Click a dot to see who is on that site.</p>
  }
  const overtime =
    summary && summary.overtimeClockHours > 0
      ? `${overviewFormatHours(summary.overtimeClockHours)}h${summary.overtimeMultiplier ? ` × ${summary.overtimeMultiplier}` : ''}`
      : '0h'
  const figure = (value: string) => (loading || !summary ? '…' : value)
  return (
    <section className="sitemap-summary" aria-live="polite" aria-labelledby="sitemap-summary-title">
      <div className="sitemap-summary-head">
        <span className="sitemap-dot" data-kind={job.source} aria-hidden="true" />
        <div className="sitemap-summary-name">
          <h3 id="sitemap-summary-title">{job.label}</h3>
          <p>
            {job.jobNumber} · {job.source === 'smallWork' ? 'Small works' : 'Project'} · {dayLabel}
          </p>
        </div>
        {onClose ? (
          <button type="button" className="sitemap-close" onClick={onClose} aria-label="Close site summary">
            ×
          </button>
        ) : null}
      </div>
      <dl className="sitemap-figures">
        <div>
          <dt>People on site</dt>
          <dd>{figure(String(summary?.peopleOnSite ?? 0))}</dd>
        </div>
        <div>
          <dt>Hours on site</dt>
          <dd>{figure(`${overviewFormatHours(summary?.hoursOnSite ?? 0)}h`)}</dd>
        </div>
        <div>
          <dt>Overtime</dt>
          <dd>{figure(overtime)}</dd>
        </div>
        <div>
          <dt>On annual leave</dt>
          <dd>{figure(String(summary?.onAnnualLeave ?? 0))}</dd>
        </div>
      </dl>
      <p className="sitemap-note">
        Annual leave is the whole team that day.{' '}
        <Link href={`/dashboard/daily-overview?date=${dayKey}`}>Open Daily overview</Link>
      </p>
    </section>
  )
}

/**
 * Project / small-works card. Visuals match the v2 prototype pcard.
 */

'use client'

import Link from 'next/link'
import type { Project } from '@/types'
import { formatSiteAddress } from '@/lib/maps/siteAddress'
import {
  daysLeftCaption,
  deriveWorkStatus,
  timelineProgressPercent,
  workStatusLabel,
} from '@/lib/projects/workStatus'
import { hueForJobType } from '@/lib/ui/sectionHue'
import { ProgressRing } from '@/components/ui/media'
import { StatusPill } from '@/components/ui/controls'

function formatRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`
}

function jobTypeLabel(project: Project): string {
  const custom = project.customJobType?.trim()
  if (custom) return custom
  return project.jobType || ''
}

export function WorkCard({
  project,
  href,
  compact = false,
  managerName,
}: {
  project: Project
  href: string
  compact?: boolean
  managerName?: string
}) {
  const status = deriveWorkStatus(project)
  const pct = timelineProgressPercent(project.startDate, project.endDate, status)
  const address = formatSiteAddress(project) || '—'
  const manager = managerName || project.manager?.name || '—'
  const type = jobTypeLabel(project)
  const hue = href.includes('small-works') ? 'sw' : hueForJobType(type)
  const days = daysLeftCaption(project.endDate, status)

  if (compact) {
    return (
      <Link href={href} className="ritem" data-hue={hue}>
        <span className="ico-chip sm">{project.jobNumber.slice(0, 2)}</span>
        <span className="grow">
          <span className="t">{project.jobNumber}</span>
          <span className="s">{project.siteName}</span>
        </span>
        <StatusPill status={workStatusLabel(status)} />
      </Link>
    )
  }

  return (
    <Link href={href} className="pcard" data-hue={hue}>
      <div className="top">
        <div className="min-w-0 flex-1">
          <p className="job">{project.jobNumber}</p>
          <h3>{project.siteName}</h3>
          {type ? <p className="text-[13px] text-[var(--ink2)]">{type}</p> : null}
        </div>
        <ProgressRing value={pct} hue={hue} />
      </div>
      <div className="body">
        <div className="meta">
          <div>
            <span>Client</span>
            {project.client?.name || '—'}
          </div>
          <div>
            <span>Programme</span>
            {formatRange(project.startDate, project.endDate)}
          </div>
          <div>
            <span>Site</span>
            {address}
          </div>
          <div>
            <span>Status</span>
            <StatusPill status={workStatusLabel(status)} />
          </div>
        </div>
        <div className="foot">
          <span className="muted small grow">{manager}</span>
          <span className="pill" data-hue={hue}>
            {days}
          </span>
        </div>
      </div>
    </Link>
  )
}

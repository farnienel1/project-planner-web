/**
 * iOS parity source: Views/ProjectsView.swift ProjectDetailRowView
 * Spec: docs/ios-parity/sections/12-projects.md
 */

'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  MapPinIcon,
  UserIcon,
  CalendarDaysIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import type { Project } from '@/types'
import { formatSiteAddress } from '@/lib/maps/siteAddress'
import {
  deriveWorkStatus,
  timelineProgressPercent,
  type WorkStatus,
} from '@/lib/projects/workStatus'

function formatRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`
}

function statusStyles(status: WorkStatus) {
  switch (status) {
    case 'active':
      return { pill: 'bg-[#E1F5EE] text-[#0F6E56]', dot: 'bg-[#0F6E56]' }
    case 'upcoming':
      return { pill: 'bg-[#FFF6E1] text-[#854F0B]', dot: 'bg-[#854F0B]' }
    default:
      return { pill: 'bg-[#F2F3F5] text-[#6B7280]', dot: 'bg-[#6B7280]' }
  }
}

function jobTypeLabel(project: Project): string {
  const custom = project.customJobType?.trim()
  if (custom) return custom.toUpperCase()
  return (project.jobType || '').toUpperCase()
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
  const styles = statusStyles(status)
  const pct = timelineProgressPercent(project.startDate, project.endDate, status)
  const address = formatSiteAddress(project) || '—'
  const manager = managerName || project.manager?.name || '—'

  if (compact) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-ios-border bg-ios-card p-3.5 transition hover:border-ios-search-border hover:shadow-sm"
      >
        <p className="text-[16px] font-medium text-ios-ink">{project.jobNumber}</p>
        <p className="mt-0.5 text-[13px] font-medium text-ios-ink">{project.siteName}</p>
        <p className="mt-1 line-clamp-3 text-[11px] text-ios-muted">{address}</p>
      </Link>
    )
  }

  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-ios-border bg-ios-card p-3.5 transition hover:border-ios-search-border hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-medium tracking-tight text-ios-ink">{project.jobNumber}</p>
            {jobTypeLabel(project) ? (
              <span className="rounded bg-[#EEEDFE] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-[#3C3489]">
                {jobTypeLabel(project)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[13px] font-medium text-ios-ink">{project.siteName}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${styles.pill}`}>
          {status === 'completed' ? (
            <CheckIcon className="h-2.5 w-2.5" />
          ) : (
            <span className={`h-[5px] w-[5px] rounded-full ${styles.dot}`} />
          )}
          {label}
        </span>
      </div>

      <div className="mt-2.5 space-y-1.5">
        <MetaRow icon={<BuildingOffice2Icon className="h-3.5 w-3.5" />} text={project.client?.name || '—'} />
        <MetaRow icon={<MapPinIcon className="h-3.5 w-3.5" />} text={address} />
        <MetaRow icon={<UserIcon className="h-3.5 w-3.5" />} text={manager} />
        <MetaRow icon={<CalendarDaysIcon className="h-3.5 w-3.5" />} text={formatRange(project.startDate, project.endDate)} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-ios-muted">Progress</span>
          <span className={`text-[11px] font-medium ${status === 'completed' ? 'text-ios-muted' : 'text-ios-ink'}`}>
            {pct}%
          </span>
        </div>
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-ios-border">
          <div
            className={`h-full rounded-full ${
              status === 'completed' ? 'bg-[#C5C9D2]' : 'bg-gradient-to-r from-[#185FA5] to-[#378ADD]'
            }`}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

function MetaRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[#C4C9D1]">{icon}</span>
      <p className="text-[11px] leading-snug text-ios-muted">{text}</p>
    </div>
  )
}

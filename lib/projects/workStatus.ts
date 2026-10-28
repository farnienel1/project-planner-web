import type { Project } from '@/types'
import { workDocuments, workStatusOn } from '@/lib/canonical'
import { dayKeyInZone, LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import { calendarDayOffset, programmeProgressPercent } from '@/lib/projects/programmeDates'

export type WorkStatus = 'active' | 'upcoming' | 'completed' | 'inactive'

function validDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/** The rulebook's `workStatusOn` for today in the organisation zone — past end date is completed, not overdue. */
export function deriveWorkStatus(
  project: Pick<Project, 'isLive' | 'startDate' | 'endDate'>,
  now = new Date(),
  timeZone = LONDON_TIME_ZONE
): WorkStatus {
  return workStatusOn(
    {
      isLive: project.isLive,
      startDayKey: validDate(project.startDate) ? dayKeyInZone(project.startDate, timeZone) : null,
      endDayKey: validDate(project.endDate) ? dayKeyInZone(project.endDate, timeZone) : null,
    },
    dayKeyInZone(now, timeZone)
  )
}

export function workStatusLabel(status: WorkStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'upcoming':
      return 'Upcoming'
    case 'completed':
      return 'Completed'
    case 'inactive':
      return 'Inactive'
  }
}

/** Timeline progress 0–100. Completed / past end date always returns 100. Uses organisation calendar days. */
export function timelineProgressPercent(
  startDate: Date,
  endDate: Date,
  status?: WorkStatus,
  now = new Date(),
  timeZone = LONDON_TIME_ZONE
): number {
  if (status === 'completed' || status === 'inactive') return 100
  return programmeProgressPercent(startDate, endDate, now, timeZone)
}

export function daysLeftCaption(
  endDate: Date,
  status: WorkStatus,
  now = new Date(),
  timeZone = LONDON_TIME_ZONE
): string {
  if (status === 'completed') return 'Completed'
  if (status === 'inactive') return 'Inactive'
  const days = calendarDayOffset(endDate, now, timeZone)
  if (days < 0) return 'Completed'
  if (days === 0) return 'Ends today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

export function dedupeWorksById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

/**
 * Every project and small works document once: the rulebook's `workDocuments`. Two documents with the
 * same job number (two "C646"s) both stay, because bookings point at either.
 */
export function mergeProjectsAndSmallWorks(projects: Project[], smallWorks: Project[]): Project[] {
  return workDocuments(projects, smallWorks)
}

/** ProjectsView.swift ~L216 — job number, site name, address, client name. */
export function searchWorks<T extends Project>(projects: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return projects
  return projects.filter((p) => {
    const address = [p.addressLine1, p.addressLine2, p.townCity, p.postcode, p.siteAddress]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return (
      (p.jobNumber || '').toLowerCase().includes(q) ||
      (p.siteName || '').toLowerCase().includes(q) ||
      address.includes(q) ||
      (p.client?.name || '').toLowerCase().includes(q)
    )
  })
}

export function filterWorksByTab(projects: Project[], tab: 'all' | 'active' | 'upcoming' | 'completed'): Project[] {
  if (tab === 'all') return projects
  if (tab === 'completed') {
    return projects.filter((p) => {
      const status = deriveWorkStatus(p)
      return status === 'completed' || status === 'inactive'
    })
  }
  return projects.filter((p) => deriveWorkStatus(p) === tab)
}

export function countWorksByTab(projects: Project[]) {
  return {
    all: projects.length,
    active: projects.filter((p) => deriveWorkStatus(p) === 'active').length,
    upcoming: projects.filter((p) => deriveWorkStatus(p) === 'upcoming').length,
    completed: projects.filter((p) => deriveWorkStatus(p) === 'completed' || deriveWorkStatus(p) === 'inactive').length,
  }
}

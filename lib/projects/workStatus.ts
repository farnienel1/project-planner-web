import type { Project } from '@/types'
import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import { calendarDayOffset, programmeProgressPercent } from '@/lib/projects/programmeDates'

export type WorkStatus = 'active' | 'upcoming' | 'completed' | 'inactive'

/** Mirrors iOS `Project.status` — past end date is completed, not overdue. */
export function deriveWorkStatus(
  project: Pick<Project, 'isLive' | 'startDate' | 'endDate'>,
  now = new Date(),
  timeZone = LONDON_TIME_ZONE
): WorkStatus {
  if (!project.isLive) return 'inactive'
  const startOffset = calendarDayOffset(project.startDate, now, timeZone)
  const endOffset = calendarDayOffset(project.endDate, now, timeZone)
  if (startOffset > 0) return 'upcoming'
  if (endOffset < 0) return 'completed'
  return 'active'
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

function isSmallWorksJob(project: Project): boolean {
  return /small works/i.test(project.jobType || '')
}

/**
 * Merge projects + small works for map/audit pickers without duplicate pins.
 * Dedupes by id, then by job number (keeps small-works row or newer updatedAt).
 */
export function mergeProjectsAndSmallWorks(projects: Project[], smallWorks: Project[]): Project[] {
  const byId = dedupeWorksById([...projects, ...smallWorks])
  const byJob = new Map<string, Project>()

  for (const project of byId) {
    const key = project.jobNumber?.trim().toLowerCase() || project.id
    const existing = byJob.get(key)
    if (!existing) {
      byJob.set(key, project)
      continue
    }
    const projectIsSmall = isSmallWorksJob(project)
    const existingIsSmall = isSmallWorksJob(existing)
    if (projectIsSmall && !existingIsSmall) {
      byJob.set(key, project)
    } else if (!projectIsSmall && existingIsSmall) {
      continue
    } else if (new Date(project.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byJob.set(key, project)
    }
  }

  return Array.from(byJob.values())
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

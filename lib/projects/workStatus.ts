import { differenceInDays } from 'date-fns'
import type { Project } from '@/types'

export type WorkStatus = 'active' | 'upcoming' | 'completed' | 'inactive'

/** Mirrors iOS `Project.status` — past end date is completed, not overdue. */
export function deriveWorkStatus(project: Pick<Project, 'isLive' | 'startDate' | 'endDate'>): WorkStatus {
  if (!project.isLive) return 'inactive'
  const now = new Date()
  const start = new Date(project.startDate)
  const end = new Date(project.endDate)
  if (now < start) return 'upcoming'
  if (now > end) return 'completed'
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

/** Timeline progress 0–100. Completed / past end date always returns 100. */
export function timelineProgressPercent(
  startDate: Date,
  endDate: Date,
  status?: WorkStatus
): number {
  if (status === 'completed' || status === 'inactive') return 100
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const now = Date.now()
  if (end <= start) return 0
  if (now >= end) return 100
  return Math.round(Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)))
}

export function daysLeftCaption(endDate: Date, status: WorkStatus): string {
  if (status === 'completed') return 'Completed'
  if (status === 'inactive') return 'Inactive'
  const days = Math.max(0, differenceInDays(new Date(endDate), new Date()))
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

/**
 * iOS parity source: Core/WorkAccess.swift visibleWorks
 * Spec: docs/ios-parity/01-data-model.md §9, Blueprint §1.5
 */

import type { Booking, Manager, Operative, Project, ProjectTask, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  bookableJobs,
  operativeJobIds,
  visibleJobs,
  workDocuments,
  worksListMembership,
  type WorksListContext,
} from '@/lib/canonical'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
import type { WorkCatalogueKind } from '@/lib/permissions'
import { normalizeBookingStatus } from '@/lib/ios-parity/enums'

export type JobCatalogue = WorkCatalogueKind

function normalizedEmail(value?: string | null): string {
  return value?.toLowerCase().trim() ?? ''
}

export function operativeMatching(
  email: string | undefined,
  operatives: Operative[],
  name?: { firstName?: string; surname?: string }
): Operative | undefined {
  const needle = normalizedEmail(email)
  if (needle) {
    const byEmail = operatives.find((op) => normalizedEmail(op.email) === needle)
    if (byEmail) return byEmail
  }
  const first = name?.firstName?.trim().toLowerCase()
  const last = name?.surname?.trim().toLowerCase()
  if (!first || !last) return undefined
  return operatives.find(
    (op) => op.firstName.trim().toLowerCase() === first && op.lastName.trim().toLowerCase() === last
  )
}

export function managerMatching(email: string | undefined, managers: Manager[]): Manager | undefined {
  const needle = normalizedEmail(email)
  if (!needle) return undefined
  return managers.find((m) => normalizedEmail(m.email) === needle)
}

function allAssignedOperativeIds(task: ProjectTask): string[] {
  const ids = new Set<string>()
  if (task.assignedOperativeId) ids.add(task.assignedOperativeId)
  for (const id of task.assignedOperativeIds || []) {
    if (id) ids.add(id)
  }
  return [...ids]
}

function allAssignedManagerIdsOnTask(task: ProjectTask): string[] {
  const ids = new Set<string>()
  if (task.assignedManagerId) ids.add(task.assignedManagerId)
  return [...ids]
}

export function isTaskAssignedToUser(params: {
  task: ProjectTask
  userEmail?: string | null
  operatives: Operative[]
  managers: Manager[]
  isOperativeMode: boolean
}): boolean {
  const raw = normalizedEmail(params.userEmail)
  if (!raw) return false
  if (params.isOperativeMode) {
    const ids = params.operatives.filter((o) => normalizedEmail(o.email) === raw).map((o) => o.id)
    const assigned = allAssignedOperativeIds(params.task)
    return ids.some((id) => assigned.includes(id))
  }
  const mgr = params.managers.find((m) => normalizedEmail(m.email) === raw)
  if (mgr && allAssignedManagerIdsOnTask(params.task).includes(mgr.id)) return true
  const op = params.operatives.find((o) => normalizedEmail(o.email) === raw)
  if (op && allAssignedOperativeIds(params.task).includes(op.id)) return true
  return false
}

export type WorkAccessParams = {
  projects: Project[]
  catalogue?: JobCatalogue
  user: User | null
  operatives: Operative[]
  managers?: Manager[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  tasks?: ProjectTask[]
  deadlineAssignedProjectIds?: Set<string>
}

/** The web stores as the rulebook's `WorksListContext` (plain rows only). */
export function worksListContext(params: Omit<WorkAccessParams, 'projects' | 'catalogue' | 'user'>): WorksListContext {
  return {
    managers: (params.managers ?? []).map((row) => ({ id: row.id, email: row.email ?? null })),
    operatives: params.operatives.map((row) => ({ id: row.id, email: row.email ?? null })),
    bookings: params.bookings.map((booking) => ({
      projectId: booking.projectId,
      operativeId: booking.operativeId ?? null,
      status: normalizeBookingStatus(booking.status) ?? booking.status,
    })),
    managerSiteBookings: params.managerBookings.map((booking) => ({
      userId: booking.userId,
      locationType: booking.locationType,
      locationId: booking.locationId ?? null,
    })),
    tasks: (params.tasks ?? []).map((task) => ({
      projectId: task.projectId,
      assignedOperativeId: task.assignedOperativeId ?? null,
      assignedOperativeIds: task.assignedOperativeIds ?? [],
      assignedManagerId: task.assignedManagerId ?? null,
      assignedManagerIds: task.assignedManagerIds ?? [],
    })),
    deadlineJobIds: params.deadlineAssignedProjectIds ? [...params.deadlineAssignedProjectIds] : [],
  }
}

function catalogueJobs(projects: Project[], catalogue: JobCatalogue): Project[] {
  if (catalogue === 'all') return workDocuments(projects)
  return worksListMembership(projects, catalogue)
}

/**
 * The jobs the signed-in user sees in a job list: the rulebook's `worksListMembership` (every document of the
 * catalogue, live or not) then `visibleJobs` (§17, §21). No screen filters list membership itself.
 */
export function visibleWorks(params: WorkAccessParams): Project[] {
  const viewer = jobAccessViewer(params.user)
  return visibleJobs(catalogueJobs(params.projects, params.catalogue ?? 'all'), viewer, worksListContext(params))
}

/**
 * The jobs the signed-in user may book a person onto (rulebook 1.21.0 `bookableJobs`): visible, not inactive, live
 * on every day in `dayKeys` (organisation zone; null when no day is chosen yet) and writable (`canWriteBooking`).
 */
export function bookableWorks(
  params: WorkAccessParams & {
    dayKeys: ReadonlyArray<string> | null
    timeZone: string
    bookingCollection?: 'bookings' | 'managerSiteBookings' | 'subcontractorBookings'
  }
): Project[] {
  const viewer = jobAccessViewer(params.user)
  return bookableJobs(
    catalogueJobs(params.projects, params.catalogue ?? 'all'),
    viewer,
    { ...worksListContext(params), bookingCollection: params.bookingCollection ?? 'bookings' },
    params.dayKeys,
    params.timeZone
  )
}

/** Job ids an operative's job documents are read by (`operativeJobIds`: bookings, tasks, deadlines). */
export function operativeJobDocumentIds(
  user: User | null,
  params: Omit<WorkAccessParams, 'projects' | 'catalogue' | 'user'>
): string[] {
  return operativeJobIds(jobAccessViewer(user), worksListContext(params))
}

export function liveUserIdsOnJob(params: {
  projectId: string
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  tasks: ProjectTask[]
  operatives: Operative[]
  users: User[]
}): Set<string> {
  const ids = new Set<string>()
  for (const b of params.managerBookings) {
    if (
      (b.locationType === 'project' || b.locationType === 'small_work') &&
      b.locationId === params.projectId
    ) {
      ids.add(b.userId)
    }
  }
  for (const b of params.bookings) {
    if (b.projectId !== params.projectId) continue
    if (normalizeBookingStatus(b.status) === 'Cancelled') continue
    const op = params.operatives.find((o) => o.id === b.operativeId)
    if (!op) continue
    const user = params.users.find((u) => normalizedEmail(u.email) === normalizedEmail(op.email))
    if (user) ids.add(user.id)
  }
  for (const task of params.tasks) {
    if (task.projectId !== params.projectId) continue
    if (task.assignedManagerId) ids.add(task.assignedManagerId)
  }
  return ids
}

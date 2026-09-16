/**
 * iOS parity source: Core/WorkAccess.swift visibleWorks
 * Spec: docs/ios-parity/01-data-model.md §9, Blueprint §1.5
 */

import type { Booking, Manager, Operative, Project, ProjectTask, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { isOperativeMode, canManageWorkCatalogue, hasAdminAccess, type WorkCatalogueKind } from '@/lib/permissions'
import { isSmallWorksJobType, normalizeBookingStatus } from '@/lib/ios-parity/enums'

export type JobCatalogue = WorkCatalogueKind

function normalizedEmail(value?: string | null): string {
  return value?.toLowerCase().trim() ?? ''
}

function catalogueIncludes(project: Project, catalogue: JobCatalogue): boolean {
  const small = isSmallWorksJobType(project.jobType)
  if (catalogue === 'projects') return !small
  if (catalogue === 'smallWorks') return small
  return true
}

function isExcludedFromManagerVisibilityHiding(user: User): boolean {
  if (isOperativeMode(user)) return false
  return user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin'
}

export function operativeMatching(email: string | undefined, operatives: Operative[]): Operative | undefined {
  const needle = normalizedEmail(email)
  if (!needle) return undefined
  return operatives.find((op) => normalizedEmail(op.email) === needle)
}

export function managerMatching(email: string | undefined, managers: Manager[]): Manager | undefined {
  const needle = normalizedEmail(email)
  if (!needle) return undefined
  return managers.find((m) => normalizedEmail(m.email) === needle)
}

function allAssignedOperativeIds(task: ProjectTask): string[] {
  const ids = new Set<string>()
  if (task.assignedOperativeId) ids.add(task.assignedOperativeId)
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
    const op = params.operatives.find((o) => normalizedEmail(o.email) === raw)
    if (!op) return false
    return allAssignedOperativeIds(params.task).includes(op.id)
  }
  const mgr = params.managers.find((m) => normalizedEmail(m.email) === raw)
  if (mgr && allAssignedManagerIdsOnTask(params.task).includes(mgr.id)) return true
  const op = params.operatives.find((o) => normalizedEmail(o.email) === raw)
  if (op && allAssignedOperativeIds(params.task).includes(op.id)) return true
  return false
}

export function taskAssignedProjectIds(params: {
  currentUser: User | null
  tasks: ProjectTask[]
  operatives: Operative[]
  managers: Manager[]
}): Set<string> {
  const { currentUser, tasks, operatives, managers } = params
  if (!currentUser) return new Set()
  const ids = new Set<string>()
  for (const task of tasks) {
    const asOp = isTaskAssignedToUser({
      task,
      userEmail: currentUser.email,
      operatives,
      managers,
      isOperativeMode: true,
    })
    const asStaff = isTaskAssignedToUser({
      task,
      userEmail: currentUser.email,
      operatives,
      managers,
      isOperativeMode: false,
    })
    if (asOp || asStaff) ids.add(task.projectId)
  }
  return ids
}

export function operativeVisibleProjectIds(params: {
  currentUser: User | null
  operative: Operative | undefined
  operatives: Operative[]
  managers: Manager[]
  bookings: Booking[]
  tasks: ProjectTask[]
  deadlineAssignedProjectIds?: Set<string>
}): Set<string> {
  const ids = new Set<string>()
  if (params.operative) {
    for (const booking of params.bookings) {
      if (
        booking.operativeId === params.operative.id &&
        normalizeBookingStatus(booking.status) !== 'Cancelled'
      ) {
        ids.add(booking.projectId)
      }
    }
  }
  for (const id of taskAssignedProjectIds({
    currentUser: params.currentUser,
    tasks: params.tasks,
    operatives: params.operatives,
    managers: params.managers,
  })) {
    ids.add(id)
  }
  if (params.deadlineAssignedProjectIds) {
    for (const id of params.deadlineAssignedProjectIds) ids.add(id)
  }
  return ids
}

function assignedManagerIds(project: Project): string[] {
  if (project.managerIds && project.managerIds.length > 0) return project.managerIds
  return project.managerId ? [project.managerId] : []
}

export function isAssignedOrBookedOnto(params: {
  project: Project
  user: User
  operatives: Operative[]
  managers: Manager[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
}): boolean {
  const email = normalizedEmail(params.user.email)
  const manager = params.managers.find((m) => normalizedEmail(m.email) === email)
  if (manager && assignedManagerIds(params.project).includes(manager.id)) return true

  if (
    params.managerBookings.some(
      (booking) =>
        booking.userId === params.user.id &&
        (booking.locationType === 'project' || booking.locationType === 'small_work') &&
        booking.locationId === params.project.id
    )
  ) {
    return true
  }

  const operative = operativeMatching(params.user.email, params.operatives)
  if (
    operative &&
    params.bookings.some(
      (b) =>
        b.operativeId === operative.id &&
        b.projectId === params.project.id &&
        normalizeBookingStatus(b.status) !== 'Cancelled'
    )
  ) {
    return true
  }
  return false
}

export function visibleWorks(params: {
  projects: Project[]
  catalogue?: JobCatalogue
  user: User | null
  operatives: Operative[]
  managers?: Manager[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  tasks?: ProjectTask[]
  deadlineAssignedProjectIds?: Set<string>
}): Project[] {
  const catalogue = params.catalogue ?? 'all'
  const scoped = params.projects.filter((p) => catalogueIncludes(p, catalogue))
  const user = params.user
  const managers = params.managers ?? []
  const tasks = params.tasks ?? []

  if (!user) return []

  if (isOperativeMode(user)) {
    const assignedIds = operativeVisibleProjectIds({
      currentUser: user,
      operative: operativeMatching(user.email, params.operatives),
      operatives: params.operatives,
      managers,
      bookings: params.bookings,
      tasks,
      deadlineAssignedProjectIds: params.deadlineAssignedProjectIds,
    })
    return scoped.filter((project) => {
      const hid = project.hiddenOperativeUserIds ?? []
      return assignedIds.has(project.id) && !hid.includes(user.id)
    })
  }

  if (isExcludedFromManagerVisibilityHiding(user) || hasAdminAccess(user)) {
    return scoped
  }

  const notHidden = scoped.filter((project) => !(project.hiddenManagerUserIds ?? []).includes(user.id))
  return notHidden.filter((project) => {
    const jobCatalogue: JobCatalogue = isSmallWorksJobType(project.jobType) ? 'smallWorks' : 'projects'
    if (canManageWorkCatalogue(user, jobCatalogue)) return true
    return isAssignedOrBookedOnto({
      project,
      user,
      operatives: params.operatives,
      managers,
      bookings: params.bookings,
      managerBookings: params.managerBookings,
    })
  })
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

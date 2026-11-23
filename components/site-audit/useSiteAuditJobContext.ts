'use client'

import { useEffect, useMemo, useState } from 'react'
import { seesEveryJob, type JobAccessViewer, type WorksListContext } from '@/lib/canonical'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
import { worksListContext } from '@/lib/access/workAccess'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useDeadlineStore } from '@/lib/stores/deadlineStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useTaskStore } from '@/lib/stores/taskStore'

export type SiteAuditJobContext = {
  viewer: JobAccessViewer | null
  context: WorksListContext | null
  /** Everything `visibleJobs` reads for this viewer has loaded (always true for admins and managers). */
  contextLoaded: boolean
  contextFailed: boolean
}

/**
 * What a New site audit page needs to ask `visibleJobs` (rulebook §21) which jobs the person may start an audit on
 * (owner decision 23 Nov). Admins, super admins and managers see every job (`seesEveryJob`), so nothing extra is
 * loaded for them. For anyone else it loads, as the Projects list does, their bookings (whole archive), tasks,
 * deadline assignments and the operatives / managers rows, and reports `contextLoaded` only once the bookings listener
 * has a server answer and the other reads have finished — so the page never shows "No jobs" too early.
 */
export function useSiteAuditJobContext(): SiteAuditJobContext {
  const { organization, user } = useAuthStore()
  const orgId = organization?.id ?? ''
  const viewer = useMemo(() => jobAccessViewer(user), [user])
  const everyJob = Boolean(viewer?.role && seesEveryJob(viewer.role))
  const operativeMode = viewer?.role?.isOperativeMode === true

  const { tasks, loadTasks } = useTaskStore()
  const tasksLoadedOrgId = useTaskStore((state) => state.tasksLoadedOrgId)
  const { bookings, loadBookings } = useBookingStore()
  const bookingCoverage = useBookingStore((state) => state.coverage)
  const bookingError = useBookingStore((state) => state.error)
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const managerCoverage = useManagerScheduleStore((state) => state.coverage)
  const managerError = useManagerScheduleStore((state) => state.error)
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const operativesLoadedOrgId = useOperativeStore((state) => state.operativesLoadedOrgId)
  const assignedProjectIds = useDeadlineStore((state) => state.assignedProjectIds)
  const loadAssignedProjectIds = useDeadlineStore((state) => state.loadAssignedProjectIds)
  const [readsDone, setReadsDone] = useState<string | null>(null)

  useEffect(() => {
    if (everyJob || !orgId || !user?.id) return
    let cancelled = false
    const key = `${orgId}|${user.id}`
    void loadBookings(orgId, { fullHistory: true })
    // An account with no staff role also sees jobs through its manager schedule bookings (§21); operatives never.
    if (!operativeMode) void loadManagerSiteBookings(orgId, { fullHistory: true })
    void Promise.allSettled([
      loadTasks(orgId),
      loadOperatives(orgId),
      loadManagers(orgId),
      loadAssignedProjectIds(orgId, user.id),
    ]).then(() => {
      if (!cancelled) setReadsDone(key)
    })
    return () => {
      cancelled = true
    }
  }, [everyJob, operativeMode, orgId, user?.id, loadBookings, loadManagerSiteBookings, loadTasks, loadOperatives, loadManagers, loadAssignedProjectIds])

  const context = useMemo(
    () =>
      everyJob
        ? null
        : worksListContext({
            operatives,
            managers,
            bookings,
            managerBookings: operativeMode ? [] : managerSiteBookings,
            tasks,
            deadlineAssignedProjectIds: new Set(assignedProjectIds),
          }),
    [everyJob, operativeMode, operatives, managers, bookings, managerSiteBookings, tasks, assignedProjectIds]
  )

  if (everyJob) return { viewer, context: null, contextLoaded: true, contextFailed: false }
  const readsFinished = Boolean(orgId && user?.id && readsDone === `${orgId}|${user.id}`)
  const bookingsLoaded = bookingCoverage?.organizationId === orgId && bookingCoverage.fullHistory === true
  const managerBookingsLoaded =
    operativeMode || (managerCoverage?.organizationId === orgId && managerCoverage.fullHistory === true)
  const contextFailed =
    (readsFinished && (tasksLoadedOrgId !== orgId || operativesLoadedOrgId !== orgId)) ||
    (!bookingsLoaded && Boolean(bookingError)) ||
    (!managerBookingsLoaded && Boolean(managerError))
  return {
    viewer,
    context,
    contextLoaded: readsFinished && bookingsLoaded && managerBookingsLoaded && !contextFailed,
    contextFailed,
  }
}

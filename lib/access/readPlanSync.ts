/**
 * Rulebook 1.10.0 §17: keeps the read plans' inputs current. A manager who reads only their jobs' bookings
 * re-plans the booking listeners when their job list changes (added to or removed from a job); an operative
 * re-plans their job documents when their own bookings change. Loaded lazily by the stores so they never import
 * each other. Admins and managers with a job toggle read whole collections and never re-plan here.
 */
import { ownBookingIdsFor, setBookingPlanInputs, webJobAccessViewer } from '@/lib/access/readPlan'
import { bookingJobId, readsEveryBooking, seesEveryJob } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { bookingsOrganizationId, useBookingStore } from '@/lib/stores/bookingStore'
import { managerSiteBookingsOrganizationId, useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { loadedJobIds, replanJobs, setJobPlanDocumentIds } from '@/lib/stores/projectStore'

let started = false

function replanBookings(): void {
  const viewer = webJobAccessViewer(useAuthStore.getState().user)
  if (!viewer || readsEveryBooking(viewer)) return
  // 1.11.0: a kind the manager has the toggle for is read by `jobCollection`; only the other kind's jobs (their
  // managed jobs) get per-job booking queries.
  const untoggled = (['projects', 'smallWorks'] as const).filter((kind) => !seesEveryJob(viewer.role, kind, viewer.toggles ?? null))
  const changed = setBookingPlanInputs(loadedJobIds(untoggled), ownBookingIdsFor(useAuthStore.getState().user, useOperativeStore.getState().operatives))
  if (!changed) return
  const bookingsOrg = bookingsOrganizationId()
  if (bookingsOrg) void useBookingStore.getState().loadBookings(bookingsOrg).catch(() => undefined)
  const managerOrg = managerSiteBookingsOrganizationId()
  if (managerOrg) void useManagerScheduleStore.getState().loadManagerSiteBookings(managerOrg).catch(() => undefined)
}

function replanOperativeJobs(): void {
  const user = useAuthStore.getState().user
  const viewer = webJobAccessViewer(user)
  if (!viewer || viewer.role.isAdmin || viewer.role.isSuperAdmin || (viewer.role.isManager && !viewer.role.isOperativeMode)) return
  const ids = [
    ...useBookingStore.getState().bookings.map((booking) => booking.projectId),
    ...useManagerScheduleStore.getState().managerSiteBookings
      .map((booking) => bookingJobId({ collection: 'managerSiteBookings', ...booking }))
      .filter((id): id is string => Boolean(id)),
  ]
  if (setJobPlanDocumentIds(ids)) replanJobs()
}

function start(): void {
  if (started) return
  started = true
  useBookingStore.subscribe((state, previous) => {
    if (state.bookings !== previous.bookings) replanOperativeJobs()
  })
  useManagerScheduleStore.subscribe((state, previous) => {
    if (state.managerSiteBookings !== previous.managerSiteBookings) replanOperativeJobs()
  })
  useOperativeStore.subscribe((state, previous) => {
    if (state.operatives !== previous.operatives) replanBookings()
  })
  useAuthStore.subscribe((state, previous) => {
    if (state.user !== previous.user) {
      replanBookings()
      replanOperativeJobs()
    }
  })
}

/** A job listener delivered: start the sync and re-plan the booking listeners when the job list changed. */
export function jobsChanged(): void {
  start()
  replanBookings()
  replanOperativeJobs()
}

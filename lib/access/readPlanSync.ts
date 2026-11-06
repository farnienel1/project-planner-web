/**
 * Rulebook 1.10.0 §17: keeps the read plans' inputs current. An operative re-plans their own booking listeners when
 * their operatives rows change and their job documents when their own bookings change. Loaded lazily by the stores so
 * they never import each other. 1.33.0: admins and every manager read whole collections and never re-plan here.
 */
import { ownBookingIdsFor, setBookingPlanInputs, webJobAccessViewer } from '@/lib/access/readPlan'
import { onSecuritySwitchChange } from '@/lib/access/securitySwitches'
import { bookingJobId, readsEveryBooking } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { bookingsOrganizationId, useBookingStore } from '@/lib/stores/bookingStore'
import { managerSiteBookingsOrganizationId, useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { replanJobs, setJobPlanDocumentIds } from '@/lib/stores/projectStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useDeadlineStore } from '@/lib/stores/deadlineStore'
import { operativeJobDocumentIds } from '@/lib/access/workAccess'

let started = false

function replanBookings(): void {
  const viewer = webJobAccessViewer(useAuthStore.getState().user)
  if (!viewer || readsEveryBooking(viewer)) return
  // 1.33.0: only an operative gets here; their plan is their own labour bookings (no per-job queries).
  const changed = setBookingPlanInputs([], ownBookingIdsFor(useAuthStore.getState().user, useOperativeStore.getState().operatives))
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
  // Rulebook 1.21.0 §21 (`operativeJobIds`): the jobs of their own bookings, tasks and deadlines (web read only
  // bookings before 1.21.0, so a job reached only through a task never loaded), plus job-linked manager site bookings.
  const ids = [
    ...useBookingStore.getState().bookings.map((booking) => booking.projectId),
    ...operativeJobDocumentIds(user, {
      operatives: useOperativeStore.getState().operatives,
      managers: useOperativeStore.getState().managers,
      bookings: [],
      managerBookings: [],
      tasks: useTaskStore.getState().tasks,
      deadlineAssignedProjectIds: new Set(useDeadlineStore.getState().assignedProjectIds),
    }),
    ...useManagerScheduleStore.getState().managerSiteBookings
      .map((booking) => bookingJobId({ collection: 'managerSiteBookings', ...booking }))
      .filter((id): id is string => Boolean(id)),
  ]
  if (setJobPlanDocumentIds(ids)) replanJobs()
}

/**
 * Rulebook 1.26.0: the owner switched `enforcedReads` on or off for the open organisation. Every job and booking
 * listener re-plans at once — whole collections when off, the §17 queries when on — so an open tab keeps working
 * through the flip instead of holding a listener the rules now refuse.
 */
function replanEverything(): void {
  replanJobs()
  const viewer = webJobAccessViewer(useAuthStore.getState().user)
  if (viewer && !readsEveryBooking(viewer)) {
    setBookingPlanInputs([], ownBookingIdsFor(useAuthStore.getState().user, useOperativeStore.getState().operatives))
  }
  const bookingsOrg = bookingsOrganizationId()
  if (bookingsOrg) void useBookingStore.getState().loadBookings(bookingsOrg).catch(() => undefined)
  const managerOrg = managerSiteBookingsOrganizationId()
  if (managerOrg) void useManagerScheduleStore.getState().loadManagerSiteBookings(managerOrg).catch(() => undefined)
}

/**
 * Rulebook 1.26.0: `privatePay` changed for the open organisation. The roster and the operatives rows are read again,
 * laid over with pay profiles only while it is on (`refreshPayProfiles`, `overlayRosterPay`).
 */
async function rereadPay(): Promise<void> {
  const [{ refreshPayProfiles }, { useOrgUserStore }, { unsubscribeOrgCollection }] = await Promise.all([
    import('@/lib/pay/payProfileOverlay'),
    import('@/lib/stores/siteAuditStore'),
    import('@/lib/firebase/subscribeOrgCollection'),
  ])
  const organizationId = useOrgUserStore.getState().rosterLoadedOrgId
  if (!organizationId) return
  await refreshPayProfiles(organizationId, useAuthStore.getState().user as never, useOrgUserStore.getState().users as never)
  await useOrgUserStore.getState().loadUsers(organizationId, { force: true })
  unsubscribeOrgCollection('operativeStore:operatives')
  await useOperativeStore.getState().loadOperatives(organizationId, { force: true })
}

let switchWatch = false
/** Start following the `enforcedReads` switch (idempotent; the stores call it when they first plan). */
export function followSecuritySwitches(): void {
  if (switchWatch) return
  switchWatch = true
  onSecuritySwitchChange((name) => {
    if (name === 'enforcedReads') replanEverything()
    if (name === 'privatePay') void rereadPay()
  })
}

function start(): void {
  if (started) return
  started = true
  followSecuritySwitches()
  useBookingStore.subscribe((state, previous) => {
    if (state.bookings !== previous.bookings) replanOperativeJobs()
  })
  useManagerScheduleStore.subscribe((state, previous) => {
    if (state.managerSiteBookings !== previous.managerSiteBookings) replanOperativeJobs()
  })
  useOperativeStore.subscribe((state, previous) => {
    if (state.operatives !== previous.operatives) {
      replanBookings()
      replanOperativeJobs()
    }
  })
  useTaskStore.subscribe((state, previous) => {
    if (state.tasks !== previous.tasks) replanOperativeJobs()
  })
  useDeadlineStore.subscribe((state, previous) => {
    if (state.assignedProjectIds !== previous.assignedProjectIds) replanOperativeJobs()
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

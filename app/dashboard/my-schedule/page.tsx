'use client'

import { useEffect, useMemo, Suspense, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { userBookingRemoveAction, userCanWriteBooking } from '@/lib/access/bookingAccess'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName, samePersonIds } from '@/lib/staff/userRosterUtils'
import { useProjectStore } from '@/lib/stores/projectStore'
import { bookingIdsForAccount } from '@/lib/canonical'
import {
  findOperativeForUser,
  getActiveOperativesForScheduling,
  operativeIdsForEmail,
} from '@/lib/operatives/operativeRosterUtils'
import { canSelfBookMySchedule, isOperativeMode } from '@/lib/navigation/menuPermissions'
import { canBookWork, canViewWarnings, hasAdminAccess } from '@/lib/permissions'
import { useMyScheduleClashMarkers } from '@/lib/schedule/myScheduleClashMarkers'
import { managerSiteBookingDisplayTitle, managerSiteBookingToScheduleBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { normalizeBookingStatus } from '@/lib/ios-parity/enums'
import type { AssignedScheduleBooking } from '@/components/schedule/MyScheduleSelfBookingScreen'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import {
  DEFAULT_PAYROLL_POLICY,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
  type OrgWarningDetectionSettings,
} from '@/lib/settings/organizationSettings'
import { webJobAccessViewer } from '@/lib/access/readPlan'
import { enforcedReadsFor } from '@/lib/access/securitySwitches'
import { MyScheduleSelfBookingScreen } from '@/components/schedule/MyScheduleSelfBookingScreen'
import { MyScheduleReadOnlyScreen } from '@/components/schedule/MyScheduleReadOnlyScreen'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import type { Booking } from '@/types'
import { bookingRowText } from '@/lib/scheduling/bookingRowHours'

function MySchedulePageContent() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading, updateBooking, deleteBooking } = useBookingStore()
  const {
    managerSiteBookings,
    loadManagerSiteBookings,
    loading: managerBookingsLoading,
  } = useManagerScheduleStore()
  const { operatives, loadOperatives, managers } = useOperativeStore()
  const { users, userIdAliases, loadUsers } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const [payrollPolicy, setPayrollPolicy] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  // 1.39.0 §10: the warning settings and payment runs, for the clash marker's Warnings period (`clashScanDays`).
  const [warningSettings, setWarningSettings] = useState<{
    warningDetection: OrgWarningDetectionSettings
    invoicing: OrgInvoicingSettings
  } | null>(null)

  const selfBooking = canSelfBookMySchedule(user)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayrollPolicy(details.payrollTimePolicy)
        if (details) setWarningSettings({ warningDetection: details.warningDetection, invoicing: details.invoicing })
      })
      .catch(() => {})
  }, [organization?.id])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!organization?.id) return
    loadManagerSiteBookings(organization.id)
    loadBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
  }, [
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadUsers,
    loadProjects,
    loadSmallWorks,
  ])

  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])

  const linkedOperative = useMemo(
    () => (user ? findOperativeForUser(user, rosterOperatives) : undefined),
    [user, rosterOperatives]
  )

  const operativesById = useMemo(() => {
    const map = new Map<string, string>()
    operatives.forEach((o) => {
      map.set(o.id, `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email || o.id)
    })
    return map
  }, [operatives])

  const projectsById = useMemo(() => {
    const map = new Map<string, string>()
    ;[...projects, ...smallWorks].forEach((p) => {
      map.set(p.id, p.siteName || p.jobNumber || p.id)
    })
    return map
  }, [projects, smallWorks])

  // Every id this person's bookings may carry: catalogue rows on the email, the users id and former invite ids
  // (`bookingIdsForAccount`), so a re-added person sees days booked under any of them.
  const linkedOperativeIds = useMemo(
    () =>
      user
        ? Array.from(
            new Set([
              ...operativeIdsForEmail(operatives, user.email),
              // 1.9.0: `aliasIds` — the same-email accounts the roster folds into this person (sameEmailUserIds).
              ...bookingIdsForAccount(
                {
                  id: user.id,
                  email: user.email,
                  formerIds: user.formerUserIds ?? [],
                  aliasIds: Array.from(samePersonIds(user.id, users, userIdAliases)),
                },
                operatives
              ),
            ])
          )
        : [],
    [user, operatives, users, userIdAliases]
  )

  const personalBookings = useMemo(() => {
    const merged: Booking[] = []
    const ids = new Set(linkedOperativeIds.map((id) => id.toLowerCase()))

    if (ids.size > 0) {
      merged.push(...bookings.filter((b) => ids.has(String(b.operativeId || '').toLowerCase())))
    }

    if (user?.id) {
      const mineIds = samePersonIds(user.id, users, userIdAliases)
      const mine = managerSiteBookings.filter((b) => mineIds.has(b.userId))
      merged.push(
        ...mine.map((b) => managerSiteBookingToScheduleBooking(b, projectsById, organization?.id))
      )
    }

    return merged.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [bookings, linkedOperativeIds, managerSiteBookings, projectsById, organization?.id, user?.id, users, userIdAliases])

  // Rulebook 1.39.0 §10: the clash marker on the viewer's own bookings (`myScheduleClashMarkers`), computed from the
  // same labour and manager site bookings this page shows, exactly as Warnings groups them.
  const ownLabourBookings = useMemo(() => {
    const ids = new Set(linkedOperativeIds.map((id) => id.toLowerCase()))
    return ids.size > 0 ? bookings.filter((b) => ids.has(String(b.operativeId || '').toLowerCase())) : []
  }, [bookings, linkedOperativeIds])
  const ownManagerBookings = useMemo(() => {
    if (!user?.id) return []
    const mineIds = samePersonIds(user.id, users, userIdAliases)
    return managerSiteBookings.filter((b) => mineIds.has(b.userId))
  }, [managerSiteBookings, user?.id, users, userIdAliases])
  const viewerIdsForClash = useMemo(
    () => (user?.id ? Array.from(new Set([...linkedOperativeIds, ...samePersonIds(user.id, users, userIdAliases)])) : []),
    [user?.id, linkedOperativeIds, users, userIdAliases]
  )
  const clashPlaceLabel = useCallback((jobId: string | null | undefined) => projectsById.get(String(jobId || '')) || 'Booking', [projectsById])
  const clashManagerPlaceLabel = useCallback(
    (booking: (typeof managerSiteBookings)[number]) => managerSiteBookingDisplayTitle(booking, projectsById) || 'Booking',
    [projectsById]
  )
  const clashViewer = useMemo(() => (user ? webJobAccessViewer(user) : null), [user])
  const clashProjects = useMemo(() => [...projects, ...smallWorks], [projects, smallWorks])
  const clashMarkers = useMyScheduleClashMarkers({
    organizationId: organization?.id,
    labourBookings: ownLabourBookings,
    managerBookings: ownManagerBookings,
    users,
    operatives,
    userIdAliases,
    payrollPolicy,
    canOpenWarnings: Boolean(user && canViewWarnings(user)),
    viewer: clashViewer,
    projects: clashProjects,
    managers,
    enforcedReads: enforcedReadsFor(organization?.id),
    warningDetection: warningSettings?.warningDetection ?? null,
    invoicing: warningSettings?.invoicing ?? null,
    viewerIds: viewerIdsForClash,
    viewerEmail: user?.email ?? null,
    placeLabel: clashPlaceLabel,
    managerPlaceLabel: clashManagerPlaceLabel,
  })

  const peopleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of users) {
      const name = rosterDisplayName(row)
      if (name) map.set(row.id, name)
    }
    for (const [alias, kept] of Object.entries(userIdAliases)) {
      const name = map.get(kept)
      if (name) map.set(alias, name)
    }
    return map
  }, [users, userIdAliases])

  const canEditBookings = Boolean(user && !isOperativeMode(user))
  const scheduleLoading = bookingsLoading || managerBookingsLoading

  const handleSaveBooking = useCallback(
    async (bookingId: string, updates: Partial<Booking>) => {
      await updateBooking(bookingId, updates)
    },
    [updateBooking]
  )

  const handleDeleteBooking = useCallback(
    async (bookingId: string) => {
      if (!organization?.id) return
      await deleteBooking(bookingId, organization.id)
    },
    [deleteBooking, organization?.id]
  )

  if (loading || !user || !organization?.id) return null

  // Rulebook 1.10.0 (§2, §16): edit per booking — admins any, managers on jobs they manage, operatives never
  // (`canWriteBooking`); the remove button is `bookingRemoveAction` (1.33.0: delete or nothing, never cancel).
  const jobsById = new Map([...projects, ...smallWorks].map((job) => [job.id.toLowerCase(), job]))
  const bookingRef = (booking: Booking) => ({ collection: 'bookings' as const, projectId: booking.projectId })
  const canWriteBookingFor = (booking: Booking) =>
    userCanWriteBooking(user, bookingRef(booking), jobsById.get(String(booking.projectId || '').toLowerCase()), managers)
  const canDeleteBookingFor = (booking: Booking) =>
    userBookingRemoveAction(user, bookingRef(booking), jobsById.get(String(booking.projectId || '').toLowerCase()), managers) === 'delete'
  const canDeleteLabourBooking = !isOperativeMode(user)

  const displayName =
    (linkedOperative && operativesById.get(linkedOperative.id)) ||
    user.firstName ||
    'You'

  if (isOperativeMode(user) && !linkedOperative) {
    return (
      <div className="empty card pad px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Your account is not linked to an operative profile yet. Ask your line manager to link your email to an
          operative.
        </p>
      </div>
    )
  }

  const assignedBookings: AssignedScheduleBooking[] = linkedOperativeIds.flatMap((operativeId) =>
    bookings
      .filter((booking) => {
        if (String(booking.operativeId || '').toLowerCase() !== operativeId.toLowerCase()) return false
        const status = normalizeBookingStatus(booking.status)
        return status !== 'Cancelled' && status !== 'Completed'
      })
      .map((booking) => {
        const project = [...projects, ...smallWorks].find((row) => row.id === booking.projectId)
        const title = project
          ? `${project.jobNumber ?? ''} ${project.siteName ?? ''}`.trim() || project.siteName || 'Scheduled work'
          : 'Scheduled work'
        // Rulebook 1.20.2: the times and the pay rule's hours for that day ("Custom 07:30–14:00 · 8h").
        const detail = bookingRowText(booking, booking.date, payrollPolicy)
        return { id: booking.id, date: booking.date, title, detail }
      })
  )

  if (selfBooking) {
    return (
      <MyScheduleSelfBookingScreen
        userId={user.id}
        organizationId={organization.id}
        organizationName={organization.name || 'your organisation'}
        payrollPolicy={payrollPolicy}
        assignedBookings={assignedBookings}
        canEditBookings={canBookWork(user)}
        clashMarkers={clashMarkers}
      />
    )
  }

  return (
    <MyScheduleReadOnlyScreen
      organizationName={organization.name || 'your organisation'}
      organizationId={organization.id}
      bookings={personalBookings}
      operativesById={operativesById}
      peopleById={peopleById}
      projectsById={projectsById}
      loading={scheduleLoading}
      focusOperativeId={linkedOperative?.id ?? null}
      focusOperativeName={displayName}
      canEditBookings={canEditBookings}
      onSaveBooking={handleSaveBooking}
      onDeleteBooking={canDeleteLabourBooking ? handleDeleteBooking : undefined}
      canWriteBookingFor={canWriteBookingFor}
      canDeleteBookingFor={canDeleteBookingFor}
      payrollPolicy={payrollPolicy}
      clashMarkers={clashMarkers}
    />
  )
}

export default function MySchedulePage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading My Schedule…" />}>
      <MySchedulePageContent />
    </Suspense>
  )
}

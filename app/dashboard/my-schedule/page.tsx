'use client'

import { useEffect, useMemo, Suspense, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { findOperativeForUser, getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { canSelfBookMySchedule, isOperativeMode } from '@/lib/navigation/menuPermissions'
import { managerSiteBookingToScheduleBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { MyScheduleSelfBookingScreen } from '@/components/schedule/MyScheduleSelfBookingScreen'
import { MyScheduleReadOnlyScreen } from '@/components/schedule/MyScheduleReadOnlyScreen'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import type { Booking } from '@/types'

function MySchedulePageContent() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading, updateBooking, deleteBooking } = useBookingStore()
  const {
    managerSiteBookings,
    loadManagerSiteBookings,
    loading: managerBookingsLoading,
  } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const [payrollPolicy, setPayrollPolicy] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)

  const selfBooking = canSelfBookMySchedule(user)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayrollPolicy(details.payrollTimePolicy)
      })
      .catch(() => {})
  }, [organization?.id])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!organization?.id) return
    loadManagerSiteBookings(organization.id)
    if (!selfBooking) {
      loadBookings(organization.id)
      loadOperatives(organization.id)
    }
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
  }, [
    organization?.id,
    selfBooking,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
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
    rosterOperatives.forEach((o) => {
      map.set(o.id, `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email || o.id)
    })
    return map
  }, [rosterOperatives])

  const projectsById = useMemo(() => {
    const map = new Map<string, string>()
    ;[...projects, ...smallWorks].forEach((p) => {
      map.set(p.id, p.siteName || p.jobNumber || p.id)
    })
    return map
  }, [projects, smallWorks])

  const personalBookings = useMemo(() => {
    const merged: Booking[] = []

    if (linkedOperative) {
      merged.push(...bookings.filter((b) => b.operativeId === linkedOperative.id))
    }

    if (user?.id) {
      const mine = managerSiteBookings.filter((b) => b.userId === user.id)
      merged.push(
        ...mine.map((b) => managerSiteBookingToScheduleBooking(b, projectsById, organization?.id))
      )
    }

    return merged.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [bookings, linkedOperative, managerSiteBookings, projectsById, organization?.id, user?.id])

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

  const displayName =
    (linkedOperative && operativesById.get(linkedOperative.id)) ||
    user.firstName ||
    'You'

  if (isOperativeMode(user) && !linkedOperative) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Your account is not linked to an operative profile yet. Ask your line manager to link your email to an
          operative.
        </p>
      </div>
    )
  }

  if (selfBooking) {
    return (
      <MyScheduleSelfBookingScreen
        userId={user.id}
        organizationId={organization.id}
        organizationName={organization.name || 'your organisation'}
        payrollPolicy={payrollPolicy}
      />
    )
  }

  return (
    <MyScheduleReadOnlyScreen
      organizationName={organization.name || 'your organisation'}
      organizationId={organization.id}
      bookings={personalBookings}
      operativesById={operativesById}
      projectsById={projectsById}
      loading={scheduleLoading}
      focusOperativeId={linkedOperative?.id ?? null}
      focusOperativeName={displayName}
      canEditBookings={canEditBookings}
      onSaveBooking={handleSaveBooking}
      onDeleteBooking={handleDeleteBooking}
      payrollPolicy={payrollPolicy}
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

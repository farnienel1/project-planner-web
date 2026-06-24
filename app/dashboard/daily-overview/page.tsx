'use client'

import { useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { parseScheduleSearchParams } from '@/lib/navigation/scheduleNavigation'
import { canViewDailyOverview, isOperativeMode } from '@/lib/navigation/menuPermissions'
import {
  buildOrgScheduleBookings,
  buildPeopleNameMap,
} from '@/lib/scheduling/scheduleBookingMerge'
import { ScheduleScreen } from '@/components/schedule/ScheduleScreen'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import type { Booking } from '@/types'

function DailyOverviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, organization, loading } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading, updateBooking, deleteBooking } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()

  const focus = useMemo(() => parseScheduleSearchParams(searchParams), [searchParams])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && user && !canViewDailyOverview(user)) {
      router.replace('/dashboard/my-schedule')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (organization?.id) {
      loadBookings(organization.id)
      loadManagerSiteBookings(organization.id)
      loadOperatives(organization.id)
      loadUsers(organization.id)
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
    }
  }, [
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadUsers,
    loadProjects,
    loadSmallWorks,
  ])

  const projectsById = useMemo(() => {
    const map = new Map<string, string>()
    ;[...projects, ...smallWorks].forEach((p) => {
      map.set(p.id, p.siteName || p.jobNumber || p.id)
    })
    return map
  }, [projects, smallWorks])

  const operativesById = useMemo(() => {
    const map = new Map<string, string>()
    operatives.forEach((o) => {
      map.set(o.id, `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email || o.id)
    })
    return map
  }, [operatives])

  const peopleById = useMemo(() => buildPeopleNameMap(operatives, users), [operatives, users])

  const allBookings = useMemo(
    () =>
      buildOrgScheduleBookings(bookings, managerSiteBookings, projectsById, organization?.id),
    [bookings, managerSiteBookings, projectsById, organization?.id]
  )

  const focusOperativeName = focus.operativeId ? operativesById.get(focus.operativeId) ?? null : null
  const canEditBookings = Boolean(user && !isOperativeMode(user))

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

  if (loading || !user) return null

  return (
    <ScheduleScreen
      variant="overview"
      organizationName={organization?.name || 'your organisation'}
      organizationId={organization?.id}
      bookings={allBookings}
      operativesById={operativesById}
      peopleById={peopleById}
      projectsById={projectsById}
      loading={bookingsLoading || managerLoading}
      focusDate={focus.date}
      focusOperativeId={focus.operativeId}
      focusOperativeName={focusOperativeName}
      highlightBookingId={focus.bookingId}
      canEditBookings={canEditBookings}
      onSaveBooking={handleSaveBooking}
      onDeleteBooking={handleDeleteBooking}
    />
  )
}

export default function DailyOverviewPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading daily overview…" />}>
      <DailyOverviewPageContent />
    </Suspense>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import {
  acceptBookingClash,
  isClashAccepted,
  loadAcceptedBookingClashes,
  type AcceptedBookingClash,
} from '@/lib/warnings/acceptedClashStorage'
import { loadOrganizationDetails, type OrganizationDetails } from '@/lib/settings/organizationSettings'
import { loadNotificationPreferences, type NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { generateOrgWarnings } from '@/lib/warnings/generateOrgWarnings'
import { WarningsScreen } from '@/components/warnings/WarningsScreen'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'

export default function WarningsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { bookings, loadBookings, deleteBooking, loading: bookingsLoading } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords } =
    useMaterialProjectStore()
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings } = useHolidayStore()
  const [acceptedClashes, setAcceptedClashes] = useState<AcceptedBookingClash[]>([])
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
      loadOperatives(organization.id)
      loadUsers(organization.id)
      loadBookings(organization.id)
      loadManagerSiteBookings(organization.id)
      loadAllMaterials(organization.id)
      loadSendRecords(organization.id)
      loadHolidayBookings(organization.id)
      loadAcceptedBookingClashes(organization.id).then(setAcceptedClashes).catch(() => setAcceptedClashes([]))
      loadOrganizationDetails(organization.id).then(setOrgDetails).catch(() => setOrgDetails(null))
    }
  }, [
    organization?.id,
    loadProjects,
    loadSmallWorks,
    loadOperatives,
    loadUsers,
    loadBookings,
    loadManagerSiteBookings,
    loadAllMaterials,
    loadSendRecords,
    loadHolidayBookings,
  ])

  useEffect(() => {
    if (!user?.id) return
    loadNotificationPreferences(user.id).then(setNotificationPreferences).catch(() => setNotificationPreferences(null))
  }, [user?.id])

  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])
  const smallWorkIds = useMemo(() => new Set(smallWorks.map((w) => w.id)), [smallWorks])

  const mergedWorks = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks),
    [projects, smallWorks]
  )

  const generated = useMemo(
    () =>
      generateOrgWarnings({
        bookings,
        managerSiteBookings,
        operatives,
        users,
        projects: mergedWorks,
        holidays: holidayBookings,
        materials,
        sendRecords,
        orgDetails,
        notificationPreferences,
      }),
    [
      bookings,
      managerSiteBookings,
      operatives,
      users,
      mergedWorks,
      holidayBookings,
      materials,
      sendRecords,
      orgDetails,
      notificationPreferences,
    ]
  )

  const clashWarnings = useMemo(
    () => generated.clashWarnings.filter((w) => !isClashAccepted(w.bookingAId, w.bookingBId, acceptedClashes)),
    [generated.clashWarnings, acceptedClashes]
  )

  const handleAcceptClash = useCallback(
    async (clash: OperativeBookingClashWarning) => {
      if (!organization?.id || !user?.id) return
      await acceptBookingClash(organization.id, clash.bookingAId, clash.bookingBId, user.id)
      const updated = await loadAcceptedBookingClashes(organization.id)
      setAcceptedClashes(updated)
    },
    [organization?.id, user?.id]
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
    <WarningsScreen
      organizationName={organization?.name || 'your organisation'}
      clashWarnings={clashWarnings}
      managerClashWarnings={generated.managerClashWarnings}
      unbookedWarnings={generated.unbookedWarnings}
      materialWarnings={generated.materialWarnings}
      qualificationWarnings={generated.qualificationWarnings}
      unverifiedWarnings={generated.unverifiedWarnings}
      loading={
        (bookingsLoading && bookings.length === 0) ||
        (managerLoading && managerSiteBookings.length === 0)
      }
      user={user}
      operatives={rosterOperatives}
      smallWorkIds={smallWorkIds}
      onAcceptClash={handleAcceptClash}
      onDeleteBooking={handleDeleteBooking}
    />
  )
}

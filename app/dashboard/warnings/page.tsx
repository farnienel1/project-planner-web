'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { computeMissedMaterialOrderWarnings } from '@/lib/warnings/materialOrderWarnings'
import {
  computeUnbookedLabourWarnings,
  filterWarningsByLookahead,
} from '@/lib/warnings/unbookedLabourWarnings'
import {
  acceptBookingClash,
  isClashAccepted,
  loadAcceptedBookingClashes,
  type AcceptedBookingClash,
} from '@/lib/warnings/acceptedClashStorage'
import {
  DEFAULT_WARNING_DETECTION,
  loadOrganizationDetails,
  type OrganizationDetails,
} from '@/lib/settings/organizationSettings'
import { WarningsScreen } from '@/components/warnings/WarningsScreen'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'

export default function WarningsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { bookings, loadBookings, deleteBooking, loading: bookingsLoading } = useBookingStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords, loading: materialsLoading } =
    useMaterialProjectStore()
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings } = useHolidayStore()
  const [acceptedClashes, setAcceptedClashes] = useState<AcceptedBookingClash[]>([])
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)

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
    loadAllMaterials,
    loadSendRecords,
    loadHolidayBookings,
  ])

  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])
  const smallWorkIds = useMemo(() => new Set(smallWorks.map((w) => w.id)), [smallWorks])
  const warningDetection = orgDetails?.warningDetection ?? DEFAULT_WARNING_DETECTION
  const invoicing = orgDetails?.invoicing

  const mergedWorks = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks),
    [projects, smallWorks]
  )

  const clashWarnings = useMemo(() => {
    if (!warningDetection.detectClashes) return []
    const all = computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks)
    const filtered = all.filter(
      (w) => !isClashAccepted(w.bookingAId, w.bookingBId, acceptedClashes)
    )
    return filterWarningsByLookahead(filtered, warningDetection, invoicing)
  }, [bookings, rosterOperatives, mergedWorks, acceptedClashes, warningDetection, invoicing])

  const unbookedWarnings = useMemo(
    () =>
      computeUnbookedLabourWarnings({
        bookings,
        operatives,
        users,
        holidays: holidayBookings,
        warningDetection,
        invoicing,
      }),
    [bookings, operatives, users, holidayBookings, warningDetection, invoicing]
  )

  const materialWarnings = useMemo(
    () => computeMissedMaterialOrderWarnings(materials, sendRecords, mergedWorks),
    [materials, sendRecords, mergedWorks]
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
      unbookedWarnings={unbookedWarnings}
      materialWarnings={materialWarnings}
      loading={bookingsLoading || materialsLoading}
      user={user}
      operatives={rosterOperatives}
      smallWorkIds={smallWorkIds}
      onAcceptClash={handleAcceptClash}
      onDeleteBooking={handleDeleteBooking}
    />
  )
}

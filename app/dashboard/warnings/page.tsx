'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { computeMissedMaterialOrderWarnings } from '@/lib/warnings/materialOrderWarnings'
import {
  acceptBookingClash,
  isClashAccepted,
  loadAcceptedBookingClashes,
  type AcceptedBookingClash,
} from '@/lib/warnings/acceptedClashStorage'
import { WarningsScreen } from '@/components/warnings/WarningsScreen'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'

export default function WarningsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { bookings, loadBookings, deleteBooking, loading: bookingsLoading } = useBookingStore()
  const { materials, sendRecords, loadAllMaterials, loadSendRecords, loading: materialsLoading } =
    useMaterialProjectStore()
  const [acceptedClashes, setAcceptedClashes] = useState<AcceptedBookingClash[]>([])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
      loadOperatives(organization.id)
      loadBookings(organization.id)
      loadAllMaterials(organization.id)
      loadSendRecords(organization.id)
      loadAcceptedBookingClashes(organization.id).then(setAcceptedClashes).catch(() => setAcceptedClashes([]))
    }
  }, [
    organization?.id,
    loadProjects,
    loadSmallWorks,
    loadOperatives,
    loadBookings,
    loadAllMaterials,
    loadSendRecords,
  ])

  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])
  const smallWorkIds = useMemo(() => new Set(smallWorks.map((w) => w.id)), [smallWorks])

  const mergedWorks = useMemo(
    () => mergeProjectsAndSmallWorks(projects, smallWorks),
    [projects, smallWorks]
  )

  const clashWarnings = useMemo(() => {
    const all = computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks)
    return all.filter(
      (w) => !isClashAccepted(w.bookingAId, w.bookingBId, acceptedClashes)
    )
  }, [bookings, rosterOperatives, mergedWorks, acceptedClashes])

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

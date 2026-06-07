'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { OperativeAnnualLeaveManagement } from '@/components/annual-leave/OperativeAnnualLeaveManagement'

export default function OperativeAnnualLeavePage() {
  const { organization } = useAuthStore()
  const { loading: bookingsLoading, loadBookings } = useHolidayStore()
  const { loading: operativesLoading, loadOperatives } = useOperativeStore()
  const { loading: usersLoading, loadUsers } = useOrgUserStore()

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
  }, [organization, loadBookings, loadOperatives, loadUsers])

  if (bookingsLoading || operativesLoading || usersLoading) return <LoadingSpinner />

  return <OperativeAnnualLeaveManagement />
}

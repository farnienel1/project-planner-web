'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { AnnualLeaveScreen } from '@/components/annual-leave/AnnualLeaveScreen'

export default function AnnualLeavePage() {
  const { organization } = useAuthStore()
  const { loading, loadBookings } = useHolidayStore()

  useEffect(() => {
    if (organization?.id) loadBookings(organization.id)
  }, [organization, loadBookings])

  if (loading) return <LoadingSpinner />

  return <AnnualLeaveScreen />
}

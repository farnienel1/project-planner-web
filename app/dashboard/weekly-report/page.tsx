'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { canViewWeeklyReports } from '@/lib/navigation/menuPermissions'
import {
  loadOrganizationDetails,
  type OrganizationDetails,
} from '@/lib/settings/organizationSettings'
import { WeeklyReportScreen } from '@/components/weekly-report/WeeklyReportScreen'
import { PageHeader } from '@/components/dashboard/PageShell'

export default function WeeklyReportPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings } = useHolidayStore()
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && user && !canViewWeeklyReports(user)) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadHolidayBookings(organization.id)
    loadOrganizationDetails(organization.id).then(setOrgDetails).catch(() => setOrgDetails(null))
  }, [
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadUsers,
    loadProjects,
    loadSmallWorks,
    loadHolidayBookings,
  ])

  if (loading || !user) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly report"
        description="Choose an invoicing period, week, or custom date range — then generate a printable report."
        meta={orgDetails?.invoicing ? 'Period options follow your organisation payment run settings.' : undefined}
      />
      <WeeklyReportScreen
        organizationName={organization?.name || orgDetails?.name || 'Organisation'}
        companyLogoURL={orgDetails?.companyLogoURL}
        bookings={bookings}
        managerSiteBookings={managerSiteBookings}
        operatives={operatives}
        users={users}
        projects={projects}
        smallWorks={smallWorks}
        holidays={holidayBookings}
        orgDetails={orgDetails}
        loading={bookingsLoading || managerLoading}
      />
    </div>
  )
}

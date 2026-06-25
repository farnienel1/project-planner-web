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
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { canViewWeeklyReports } from '@/lib/navigation/menuPermissions'
import {
  loadOrganizationDetails,
  type OrganizationDetails,
} from '@/lib/settings/organizationSettings'
import { loadSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
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
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)
  const [subcontractorBookings, setSubcontractorBookings] = useState<SubcontractorBookingRow[]>([])
  const [subsLoading, setSubsLoading] = useState(false)

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
    loadSubcontractors(organization.id)
    loadOrganizationDetails(organization.id).then(setOrgDetails).catch(() => setOrgDetails(null))
    setSubsLoading(true)
    loadSubcontractorBookings(organization.id)
      .then(setSubcontractorBookings)
      .catch(() => setSubcontractorBookings([]))
      .finally(() => setSubsLoading(false))
  }, [
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadUsers,
    loadProjects,
    loadSmallWorks,
    loadHolidayBookings,
    loadSubcontractors,
  ])

  if (loading || !user) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly report"
        description="Matches the iOS weekly report PDF — project breakdown, leave, manager schedule, and pay summary."
      />
      <WeeklyReportScreen
        organizationName={organization?.name || orgDetails?.name || 'Organisation'}
        companyLogoURL={orgDetails?.companyLogoURL}
        bookings={bookings}
        managerSiteBookings={managerSiteBookings}
        subcontractorBookings={subcontractorBookings}
        subcontractors={subcontractors}
        operatives={operatives}
        users={users}
        projects={projects}
        smallWorks={smallWorks}
        holidays={holidayBookings}
        orgDetails={orgDetails}
        loading={bookingsLoading || managerLoading || subsLoading}
      />
    </div>
  )
}

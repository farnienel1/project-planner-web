'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { PageHeader } from '@/components/dashboard/PageShell'
import { TimesheetsScreen } from '@/components/timesheets/TimesheetsScreen'
import {
  DEFAULT_PAYROLL_POLICY,
  loadOrganizationDetails,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'

export default function TimesheetsPage() {
  const { organization } = useAuthStore()
  const { bookings, loading: bookingsLoading, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [payrollPolicy, setPayrollPolicy] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayrollPolicy(details.payrollTimePolicy)
      })
      .catch(() => {})
  }, [organization?.id, loadBookings, loadManagerSiteBookings, loadOperatives, loadUsers])

  const weekStartDate = useMemo(() => startOfWeek(new Date(weekStart), { weekStartsOn: 1 }), [weekStart])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        description="Weekly hours, sign-off, manager approval, and invoice generation — aligned with iOS InvoicingView."
      />
      <TimesheetsScreen
        bookings={bookings}
        managerSiteBookings={managerSiteBookings}
        operatives={operatives}
        users={users}
        weekStart={weekStartDate}
        payrollPolicy={payrollPolicy}
        loading={bookingsLoading || managerLoading}
        onWeekStartChange={setWeekStart}
      />
    </div>
  )
}

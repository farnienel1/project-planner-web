/**
 * iOS parity source: Views/InvoicingView.swift (hub), Core/TimesheetPayrollPolicy.swift
 * Spec: docs/ios-parity/sections/17-timesheets.md
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClockIcon, DocumentTextIcon, UserGroupIcon } from '@heroicons/react/24/solid'
import { parseISO, startOfWeek } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  canAccessMyTimesheets,
  canAccessOperativeTimesheets,
  canAccessTimesheetsSurface,
  hasAdminAccess,
  shouldShowTimesheetsDisabledMessage,
} from '@/lib/permissions'
import {
  DEFAULT_INVOICING,
  DEFAULT_PAYROLL_POLICY,
  loadOrganizationDetails,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import { currentPaymentRunCopy } from '@/lib/timesheets/paymentRunCopy'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { TimesheetsScreen } from '@/components/timesheets/TimesheetsScreen'
import { formatReportPeriodLabel } from '@/lib/weekly-report/invoicingPeriodUtils'

const PAYE_DISABLED_BODY =
  'My Timesheets is for self-employed pay. PAYE accounts keep the current pay run until it is paid, then schedule hours no longer fill the next timesheet. Switch the person back to self-employed if they need timesheets again.'

export function TimesheetsHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const surface = searchParams.get('surface')
  const weekParam = searchParams.get('week')
  const { user, organization } = useAuthStore()
  const { bookings, loading: bookingsLoading, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const [invoicing, setInvoicing] = useState<OrgInvoicingSettings>(DEFAULT_INVOICING)
  const [payrollPolicy, setPayrollPolicy] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)

  const showMine = canAccessMyTimesheets(user)
  const showTeam = canAccessOperativeTimesheets(user)
  const showDisabled = shouldShowTimesheetsDisabledMessage(user)
  const canOpen = canAccessTimesheetsSurface(user)

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayrollPolicy(details.payrollTimePolicy)
        if (details?.invoicing) setInvoicing(details.invoicing)
      })
      .catch(() => {})
  }, [organization?.id, loadBookings, loadManagerSiteBookings, loadOperatives, loadUsers])

  const period = useMemo(() => computeInvoicingPeriod(new Date(), invoicing), [invoicing])
  const runCopy = currentPaymentRunCopy(invoicing)
  const weekStart = useMemo(() => {
    if (!weekParam) return period.start
    const parsed = parseISO(weekParam)
    if (Number.isNaN(parsed.getTime())) return period.start
    return startOfWeek(parsed, { weekStartsOn: 1 })
  }, [weekParam, period.start])

  if (!user) return null
  if (!canOpen) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-[22px] font-semibold">Timesheets unavailable</p>
        <p className="mt-2 text-[15px] text-ios-muted">No timesheet section is available for this account.</p>
      </div>
    )
  }

  if (surface === 'mine' || surface === 'team') {
    return (
      <div className="space-y-5 pb-10">
        <button type="button" onClick={() => router.push('/dashboard/timesheets')} className="text-[15px] font-medium text-[#185FA5]">
          Timesheets
        </button>
        <h1 className="text-[28px] font-semibold tracking-tight">
          {surface === 'team'
            ? hasAdminAccess(user)
              ? 'User Timesheets'
              : 'Operative Timesheets'
            : 'My Timesheets'}
        </h1>
        <p className="text-sm text-ios-muted">
          Current pay run period · {formatReportPeriodLabel(period.start, period.end)}
        </p>
        <TimesheetsScreen
          bookings={bookings}
          managerSiteBookings={managerSiteBookings}
          operatives={operatives}
          users={users}
          weekStart={weekStart}
          payrollPolicy={payrollPolicy}
          loading={bookingsLoading || managerLoading}
          onWeekStartChange={(value) => {
            router.replace(`/dashboard/timesheets?surface=${surface}&week=${value}`)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-[28px] font-semibold tracking-tight">Timesheets</h1>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#185FA5] to-[#0F4C81] p-6 text-white shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-white/80">Current payment run</p>
        <p className="mt-2 text-[22px] font-semibold">{runCopy.periodLine}</p>
        <p className="mt-1 text-[15px] text-white/90">{runCopy.paidLine}</p>
        {runCopy.note ? <p className="mt-3 line-clamp-3 text-[13px] text-white/80">{runCopy.note}</p> : null}
        <p className="mt-3 text-[13px] text-white/70">{formatReportPeriodLabel(period.start, period.end)}</p>
      </div>

      {showDisabled && !showMine && !showTeam ? (
        <DisabledCard />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {showMine ? (
            <Tile
              icon={<ClockIcon className="h-6 w-6" />}
              title="My Timesheets"
              detail={
                showTeam
                  ? 'Your own hours, expenses and price work'
                  : 'Current pay run, pending sign-off, and past timesheets.'
              }
              onClick={() => router.push('/dashboard/timesheets?surface=mine')}
            />
          ) : null}
          {showTeam ? (
            <Tile
              icon={<UserGroupIcon className="h-6 w-6" />}
              title={hasAdminAccess(user) ? 'User Timesheets' : 'Operative Timesheets'}
              detail={
                hasAdminAccess(user)
                  ? 'Review, sign off and export company timesheets'
                  : "Review, sign off and export your team's sheets"
              }
              onClick={() => router.push('/dashboard/timesheets?surface=team')}
            />
          ) : null}
          {showDisabled && showTeam ? <DisabledCard /> : null}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push('/dashboard/timesheets?surface=mine')}
        className="flex w-full items-start gap-3 rounded-2xl bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
      >
        <DocumentTextIcon className="mt-0.5 h-5 w-5 text-[#185FA5]" />
        <div>
          <p className="font-semibold">Previous Timesheets</p>
          <p className="mt-1 text-[13px] text-ios-muted">View previous payment runs and statuses.</p>
        </div>
      </button>
    </div>
  )
}

function Tile({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-4 rounded-2xl bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)] hover:ring-2 hover:ring-[#185FA5]/20"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F1FB] text-[#185FA5]">{icon}</div>
      <div>
        <p className="text-[17px] font-semibold">{title}</p>
        <p className="mt-1 text-[14px] text-ios-muted">{detail}</p>
      </div>
    </button>
  )
}

function DisabledCard() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-[17px] font-semibold">Timesheets follow employment type</p>
      <p className="mt-2 text-[15px] leading-relaxed text-ios-muted">{PAYE_DISABLED_BODY}</p>
    </div>
  )
}

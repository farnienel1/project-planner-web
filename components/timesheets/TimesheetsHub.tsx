/**
 * iOS parity source: Views/InvoicingView.swift (hub + MyTimesheetsHubView), Core/TimesheetPayrollPolicy.swift
 * Spec: docs/ios-parity/sections/17-timesheets.md
 */
'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDaysIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/solid'
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
import { currentPaymentRunCopy, formatPaymentPeriodLine, listPreviousPayPeriods, periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { TimesheetsScreen, type TeamTimesheetTab } from '@/components/timesheets/TimesheetsScreen'
import { dayKey, dateFromDayKey } from '@/lib/ios-parity/londonTime'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'

const PAYE_DISABLED_BODY =
  'My Timesheets is for self-employed pay. PAYE accounts keep the current pay run until it is paid, then schedule hours no longer fill the next timesheet. Switch the person back to self-employed if they need timesheets again.'

const TEAM_TABS: Array<{ id: TeamTimesheetTab; label: string; help: string }> = [
  {
    id: 'awaiting',
    label: 'Awaiting sign-off',
    help: 'Submitted sheets, and people already booked in this pay run, until you approve them.',
  },
  {
    id: 'signed',
    label: 'Signed off',
    help: 'Approved and ready. Generate an invoice to move them to Exported.',
  },
  {
    id: 'exported',
    label: 'Exported',
    help: 'Exported timesheets stay here after you generate an invoice.',
  },
]

export function TimesheetsHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const surface = searchParams.get('surface')
  const periodParam = searchParams.get('period')
  const userParam = searchParams.get('user')
  const tabParam = (searchParams.get('tab') as TeamTimesheetTab | null) || 'awaiting'
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

  const runCopy = useMemo(() => currentPaymentRunCopy(invoicing, new Date()), [invoicing])
  const currentPeriod = useMemo(() => computeInvoicingPeriod(new Date(), invoicing), [invoicing])
  const pastPeriods = useMemo(() => listPreviousPayPeriods(invoicing, new Date(), 24), [invoicing])
  const selectedPeriod = useMemo(() => {
    if (!periodParam) return currentPeriod
    try {
      return computeInvoicingPeriod(dateFromDayKey(periodParam), invoicing)
    } catch {
      return currentPeriod
    }
  }, [periodParam, invoicing, currentPeriod])

  if (!user) return null
  if (!canOpen) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-[22px] font-semibold">Timesheets unavailable</p>
        <p className="mt-2 text-[15px] text-ios-muted">No timesheet section is available for this account.</p>
      </div>
    )
  }

  const screenProps = {
    bookings,
    managerSiteBookings,
    operatives,
    users,
    periodStart: selectedPeriod.start,
    periodEnd: selectedPeriod.end,
    payrollPolicy,
    loading: bookingsLoading || managerLoading,
  }

  if (surface === 'mine') {
    return (
      <div className="space-y-5 pb-10">
        <TimesheetsBackLink />
        <h1 className="text-[28px] font-semibold tracking-tight">My Timesheets</h1>
        {periodParam ? (
          <TimesheetsScreen {...screenProps} scope="mine" />
        ) : (
          <div className="space-y-4">
            <HubCard
              icon={<CalendarDaysIcon className="h-6 w-6" />}
              title="Current pay run period"
              subtitle={runCopy.periodLine}
              detail="Review bookings, add extras, and sign your timesheet."
              tint="text-[#185FA5] bg-[#E6F1FB]"
              onClick={() => router.push(`/dashboard/timesheets?surface=mine&period=${periodStartKey(currentPeriod.start)}`)}
            />
            {pastPeriods.length > 0 ? (
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.4px] text-ios-muted">Past timesheets</p>
                {pastPeriods.map((period) => (
                  <HubCard
                    key={dayKey(period.start)}
                    icon={<ClockIcon className="h-6 w-6" />}
                    title={formatPaymentPeriodLine(period.start, period.end)}
                    subtitle="Previous period"
                    detail="View breakdown, signatures, and generate invoice again."
                    tint="text-slate-500 bg-slate-100"
                    onClick={() =>
                      router.push(`/dashboard/timesheets?surface=mine&period=${periodStartKey(period.start)}`)
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  if (surface === 'team') {
    const tab = TEAM_TABS.some((item) => item.id === tabParam) ? tabParam : 'awaiting'
    return (
      <div className="space-y-5 pb-10">
        <TimesheetsBackLink />
        <h1 className="text-[28px] font-semibold tracking-tight">
          {hasAdminAccess(user) ? 'User Timesheets' : 'Operative Timesheets'}
        </h1>
        <p className="text-sm text-ios-muted">Current pay run period · {runCopy.periodLine}</p>
        {userParam ? (
          <TimesheetsScreen {...screenProps} scope="detail" selectedUserId={userParam} />
        ) : (
          <>
            <div className="inline-flex rounded-xl bg-[#E5E5EA] p-1">
              {TEAM_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.replace(`/dashboard/timesheets?surface=team&tab=${item.id}`)}
                  className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold ${
                    tab === item.id ? 'bg-white text-ios-ink shadow-sm' : 'text-ios-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[13px] text-ios-muted">{TEAM_TABS.find((item) => item.id === tab)?.help}</p>
            <TimesheetsScreen {...screenProps} scope="team" teamTab={tab} />
          </>
        )}
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
              onClick={() => router.push('/dashboard/timesheets?surface=team&tab=awaiting')}
            />
          ) : null}
          {showDisabled && showTeam ? <DisabledCard /> : null}
        </div>
      )}
    </div>
  )
}

function TimesheetsBackLink() {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push('/dashboard/timesheets')} className="text-[15px] font-medium text-[#185FA5]">
      Timesheets
    </button>
  )
}

function HubCard({
  icon,
  title,
  subtitle,
  detail,
  tint,
  onClick,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  detail: string
  tint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[17px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[14px] font-semibold text-[#185FA5]">{subtitle}</p>
        <p className="mt-1 text-[13px] text-ios-muted">{detail}</p>
      </div>
    </button>
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

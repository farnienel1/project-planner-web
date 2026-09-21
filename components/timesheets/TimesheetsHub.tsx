/**
 * iOS parity source: Views/InvoicingView.swift (hub + MyTimesheetsHubView + OperativeTimesheetsView)
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
import { useProjectStore } from '@/lib/stores/projectStore'
import {
  canAccessOperativeTimesheets,
  canAccessTimesheetsSurface,
  hasAdminAccess,
  shouldShowTimesheetsDisabledMessage,
} from '@/lib/permissions'
import {
  DEFAULT_INVOICING,
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  loadOrganizationDetails,
  type MyScheduleOptions,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import {
  currentPaymentRunCopy,
  formatPaymentPeriodLine,
  listPreviousPayPeriods,
  periodStartKey,
} from '@/lib/timesheets/paymentRunCopy'
import { TimesheetsScreen, type TeamTimesheetTab } from '@/components/timesheets/TimesheetsScreen'
import { TimesheetPeriodPage } from '@/components/timesheets/TimesheetPeriodPage'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { loadTimesheetDrafts, loadTimesheetDraftsForStarts, listTimesheetStates } from '@/lib/timesheets/timesheetStorage'
import { emptyTimesheetDraft, type TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  awaitingManagerSignOff,
  isTimesheetFullyApproved,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import { canAccessMyTimesheetsWithPolicy, shouldAppearInOperativeTimesheetRoster } from '@/lib/timesheets/timesheetPayrollPolicy'
import { teamTimesheetUsers } from '@/lib/timesheets/timesheetWeekUtils'
import {
  emptyDayRateHistory,
  loadOperativeDayRateHistory,
  type OperativeDayRateHistoryCollection,
} from '@/lib/timesheets/dayRateHistoryStorage'
import type { User } from '@/types'

const PAYE_DISABLED_BODY =
  'My Timesheets is for self-employed pay. PAYE accounts keep the current pay run until it is paid, then schedule hours no longer fill the next timesheet. Switch the person back to self-employed if they need timesheets again.'

const TEAM_TABS: Array<{ id: TeamTimesheetTab; label: string; help: string }> = [
  {
    id: 'awaiting',
    label: 'Awaiting sign-off',
    help: 'Operative signed — yellow pending clock until you counter-sign.',
  },
  {
    id: 'signed',
    label: 'Signed off',
    help: 'Counter-signed and ready. Email and export sends timesheets to your email for filing.',
  },
  {
    id: 'exported',
    label: 'Exported',
    help: 'Exported timesheets stay here for years and remain openable.',
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
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers, loading: usersLoading } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const [invoicing, setInvoicing] = useState<OrgInvoicingSettings>(DEFAULT_INVOICING)
  const [payrollPolicy, setPayrollPolicy] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const [payrollPolicyPrior, setPayrollPolicyPrior] = useState<OrgPayrollTimePolicy | null>(null)
  const [payrollPolicyEffectiveFrom, setPayrollPolicyEffectiveFrom] = useState<string | null>(null)
  const [scheduleOptions, setScheduleOptions] = useState<MyScheduleOptions>(DEFAULT_MY_SCHEDULE)
  const [timeZone, setTimeZone] = useState(ianaTimeZoneForCountry('GB'))
  const [history, setHistory] = useState<OperativeDayRateHistoryCollection>(emptyDayRateHistory())

  const showMine = user ? canAccessMyTimesheetsWithPolicy(user, invoicing, new Date(), timeZone) : false
  const showTeam = canAccessOperativeTimesheets(user, usersLoading, users)
  const showDisabled = shouldShowTimesheetsDisabledMessage(user, showMine)
  const canOpen = canAccessTimesheetsSurface(user, usersLoading, users)

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayrollPolicy(details.payrollTimePolicy)
        setPayrollPolicyPrior(details?.payrollTimePolicyPrior ?? null)
        setPayrollPolicyEffectiveFrom(details?.payrollTimePolicyEffectiveFrom ?? null)
        if (details?.invoicing) setInvoicing(details.invoicing)
        if (details?.myScheduleOptions) setScheduleOptions(details.myScheduleOptions)
        setTimeZone(ianaTimeZoneForCountry(details?.countryCode))
      })
      .catch(() => {})
    loadOperativeDayRateHistory(organization.id)
      .then(setHistory)
      .catch(() => {})
  }, [organization?.id, loadBookings, loadManagerSiteBookings, loadOperatives, loadUsers, loadProjects, loadSmallWorks])

  const runCopy = useMemo(() => currentPaymentRunCopy(invoicing, new Date(), timeZone), [invoicing, timeZone])
  const currentPeriod = useMemo(
    () => computeInvoicingPeriod(new Date(), invoicing, timeZone),
    [invoicing, timeZone]
  )
  const pastPeriods = useMemo(
    () => listPreviousPayPeriods(invoicing, new Date(), 120, timeZone),
    [invoicing, timeZone]
  )
  const selectedPeriod = useMemo(() => {
    if (!periodParam) return currentPeriod
    try {
      return computeInvoicingPeriod(dateFromDayKey(periodParam, timeZone), invoicing, timeZone)
    } catch {
      return currentPeriod
    }
  }, [periodParam, invoicing, currentPeriod, timeZone])

  if (!user) return null
  if (!canOpen) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-[22px] font-semibold">Timesheets unavailable</p>
        <p className="mt-2 text-[15px] text-ios-muted">No timesheet section is available for this account.</p>
      </div>
    )
  }

  const periodPageProps = {
    periodStart: selectedPeriod.start,
    periodEnd: selectedPeriod.end,
    invoicing,
    payrollPolicy,
    payrollPolicyPrior,
    payrollPolicyEffectiveFrom,
    bookings,
    managerSiteBookings,
    operatives,
    projects,
    smallWorks,
    timeZone,
    history,
    scheduleOptions,
  }

  if (surface === 'mine') {
    const subject = users.find((row) => row.id === user.id) || user
    return (
      <div className="space-y-5 pb-10">
        <TimesheetsNavBar
          href={periodParam ? '/dashboard/timesheets?surface=mine' : '/dashboard/timesheets'}
          title={periodParam ? 'Timesheet' : 'My Timesheets'}
        />
        {periodParam ? (
          <TimesheetPeriodPage {...periodPageProps} subjectUser={subject} mode="mine" />
        ) : (
          <MineTimesheetsList
            organizationId={organization?.id}
            subject={subject}
            currentPeriod={currentPeriod}
            pastPeriods={pastPeriods}
            invoicing={invoicing}
            runCopyPeriodLine={runCopy.periodLine}
            timeZone={timeZone}
          />
        )}
      </div>
    )
  }

  if (surface === 'team') {
    const tab = TEAM_TABS.some((item) => item.id === tabParam) ? tabParam : 'awaiting'
    const selectedUser = userParam ? users.find((row) => row.id === userParam) : undefined
    return (
      <div className="space-y-5 pb-10">
        <TimesheetsNavBar
          href={
            userParam
              ? `/dashboard/timesheets?surface=team&tab=${tab}`
              : '/dashboard/timesheets'
          }
          title={selectedUser ? 'Review Timesheet' : hasAdminAccess(user) ? 'User Timesheets' : 'Operative Timesheets'}
        />
        {selectedUser ? (
          <TimesheetPeriodPage {...periodPageProps} subjectUser={selectedUser} mode="review" />
        ) : (
          <>
            <p className="text-sm text-ios-muted">Current pay run period · {runCopy.periodLine}</p>
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
            <TimesheetsScreen
              bookings={bookings}
              managerSiteBookings={managerSiteBookings}
              operatives={operatives}
              users={users}
              projects={projects}
              smallWorks={smallWorks}
              periodStart={currentPeriod.start}
              periodEnd={currentPeriod.end}
              payrollPolicy={payrollPolicy}
              payrollPolicyPrior={payrollPolicyPrior}
              payrollPolicyEffectiveFrom={payrollPolicyEffectiveFrom}
              invoicing={invoicing}
              loading={usersLoading && users.length === 0}
              teamTab={tab}
              timeZone={timeZone}
              history={history}
              scheduleOptions={scheduleOptions}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="stack" data-hue="ts">
      <div className="phead" data-hue="ts">
        <div className="badge-ico">
          <ClockIcon className="h-6 w-6" />
        </div>
        <div>
          <h1>Timesheets</h1>
          <div className="sub">Sign your hours and sign off your team</div>
        </div>
      </div>

      <section className="hero" data-hue="ts">
        <div className="relative z-[1]">
          <p className="eb">Current payment run</p>
          <div className="big">{runCopy.periodLine}</div>
          <p className="mt-1.5 opacity-85">{runCopy.paidLine}</p>
          {runCopy.note ? <p className="mt-3 max-w-2xl text-[13px] opacity-80">{runCopy.note}</p> : null}
        </div>
      </section>

      {showDisabled && !showMine && !showTeam ? (
        <DisabledCard />
      ) : (
        <div className="space-y-4">
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
            {showTeam && user ? (
              <ManagerTimesheetsTile
                user={user}
                users={users}
                organizationId={organization?.id}
                periodStart={currentPeriod.start}
                periodEnd={currentPeriod.end}
                invoicing={invoicing}
                timeZone={timeZone}
                onClick={() => router.push('/dashboard/timesheets?surface=team&tab=awaiting')}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function pastSubtitle(draft: TimesheetDraft | undefined, user: User): string {
  if (!draft) return 'Previous period'
  if (draft.exportedAt) return 'Exported'
  if (isTimesheetFullyApproved(draft, user)) return 'Signed off'
  if (awaitingManagerSignOff(draft, user)) return 'Timesheet pending manager signature'
  if (draft.operativeSignedAt) return 'Partially signed'
  return 'Saved draft'
}

function MineTimesheetsList({
  organizationId,
  subject,
  currentPeriod,
  pastPeriods,
  invoicing,
  runCopyPeriodLine,
  timeZone,
}: {
  organizationId?: string
  subject: User
  currentPeriod: { start: Date; end: Date }
  pastPeriods: Array<{ start: Date; end: Date }>
  invoicing: OrgInvoicingSettings
  runCopyPeriodLine: string
  timeZone: string
}) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Map<string, TimesheetDraft>>(new Map())
  const [discoveredPast, setDiscoveredPast] = useState<Array<{ start: Date; end: Date }>>(pastPeriods)

  useEffect(() => {
    setDiscoveredPast(pastPeriods)
  }, [pastPeriods])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    const currentKey = periodStartKey(currentPeriod.start, timeZone)
    listTimesheetStates(organizationId, subject.id, 400).then(async (rows) => {
      if (cancelled) return
      const byKey = new Map<string, { start: Date; end: Date }>()
      for (const period of pastPeriods) {
        byKey.set(periodStartKey(period.start, timeZone), period)
      }
      for (const row of rows) {
        const period = computeInvoicingPeriod(row.weekStart, invoicing, timeZone)
        const key = periodStartKey(period.start, timeZone)
        if (key === currentKey) continue
        if (!byKey.has(key)) byKey.set(key, period)
      }
      const merged = Array.from(byKey.values()).sort((a, b) => b.start.getTime() - a.start.getTime())
      setDiscoveredPast(merged)
      const next = new Map<string, TimesheetDraft>()
      next.set(currentKey, emptyTimesheetDraft())
      for (const period of merged) next.set(periodStartKey(period.start, timeZone), emptyTimesheetDraft())
      if (rows.length === 0) {
        const loaded = await loadTimesheetDraftsForStarts(
          organizationId,
          subject.id,
          [currentPeriod.start, ...merged.slice(0, 24).map((period) => period.start)],
          timeZone
        )
        if (cancelled) return
        for (const [key, draft] of loaded) next.set(key, draft)
        setDrafts(next)
        return
      }
      for (const row of rows) {
        const period = computeInvoicingPeriod(row.weekStart, invoicing, timeZone)
        const key = periodStartKey(period.start, timeZone)
        if (!next.has(key)) continue
        next.set(key, row.draft)
      }
      setDrafts(next)
    })
    return () => {
      cancelled = true
    }
  }, [organizationId, subject.id, currentPeriod, pastPeriods, invoicing, timeZone])

  const pending = [currentPeriod, ...discoveredPast].filter((period) => {
    const draft = drafts.get(periodStartKey(period.start, timeZone))
    return draft ? awaitingManagerSignOff(draft, subject) : false
  })
  const pendingKeys = new Set(pending.map((period) => periodStartKey(period.start, timeZone)))
  const pastVisible = discoveredPast.filter((period) => !pendingKeys.has(periodStartKey(period.start, timeZone)))

  return (
    <div className="space-y-4">
      <HubCard
        icon={<CalendarDaysIcon className="h-6 w-6" />}
        title="Current pay run period"
        subtitle={runCopyPeriodLine}
        detail="Review bookings, add extras, and sign your timesheet."
        tint="text-[#185FA5] bg-[#E6F1FB]"
        onClick={() =>
          router.push(`/dashboard/timesheets?surface=mine&period=${periodStartKey(currentPeriod.start, timeZone)}`)
        }
      />
      {pending.length > 0 ? (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-bold uppercase tracking-[0.4px] text-ios-muted">Pending timesheets</p>
          {pending.map((period) => (
            <HubCard
              key={`pending-${periodStartKey(period.start, timeZone)}`}
              icon={<ClockIcon className="h-6 w-6" />}
              title={formatPaymentPeriodLine(period.start, period.end, timeZone)}
              subtitle="Timesheet pending manager signature"
              detail="You signed — waiting for your line manager to counter-sign."
              tint="text-amber-600 bg-amber-50"
              onClick={() =>
                router.push(`/dashboard/timesheets?surface=mine&period=${periodStartKey(period.start, timeZone)}`)
              }
            />
          ))}
        </div>
      ) : null}
      {pastVisible.length > 0 ? (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-bold uppercase tracking-[0.4px] text-ios-muted">Past timesheets</p>
          {pastVisible.map((period) => {
            const draft = drafts.get(periodStartKey(period.start, timeZone))
            return (
              <HubCard
                key={periodStartKey(period.start, timeZone)}
                icon={<ClockIcon className="h-6 w-6" />}
                title={formatPaymentPeriodLine(period.start, period.end, timeZone)}
                subtitle={pastSubtitle(draft, subject)}
                detail="View breakdown, signatures, and generate invoice again."
                tint="text-slate-500 bg-slate-100"
                onClick={() =>
                  router.push(`/dashboard/timesheets?surface=mine&period=${periodStartKey(period.start, timeZone)}`)
                }
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function TimesheetsNavBar({ href, title }: { href: string; title: string }) {
  const router = useRouter()
  return (
    <div className="relative flex min-h-[28px] items-center justify-center">
      <button
        type="button"
        onClick={() => router.push(href)}
        className="btn sm ghost"
      >
        <span aria-hidden className="text-[22px] leading-none">
          ‹
        </span>
        Back
      </button>
      <h1 className="px-16 text-center text-[17px] font-semibold">{title}</h1>
    </div>
  )
}

function HubCard({
  icon,
  title,
  subtitle,
  detail,
  tint: _tint,
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
      className="ritem"
    >
      <span className="ico-chip" data-hue="ts">{icon}</span>
      <div className="min-w-0">
        <p className="text-[17px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[14px] font-semibold text-[#185FA5]">{subtitle}</p>
        <p className="mt-1 text-[13px] text-ios-muted">{detail}</p>
      </div>
    </button>
  )
}

function ManagerTimesheetsTile({
  user,
  users,
  organizationId,
  periodStart,
  periodEnd,
  invoicing,
  timeZone,
  onClick,
}: {
  user: User
  users: User[]
  organizationId?: string
  periodStart: Date
  periodEnd: Date
  invoicing: OrgInvoicingSettings
  timeZone: string
  onClick: () => void
}) {
  const [stats, setStats] = useState({ awaiting: 0, signed: 0, exported: 0 })
  const roster = useMemo(
    () =>
      teamTimesheetUsers(user, users).filter((member) =>
        shouldAppearInOperativeTimesheetRoster(member, periodStart, periodEnd, invoicing, new Date(), timeZone)
      ),
    [user, users, periodStart, periodEnd, invoicing, timeZone]
  )

  useEffect(() => {
    if (!organizationId || roster.length === 0) {
      setStats({ awaiting: 0, signed: 0, exported: 0 })
      return
    }
    let cancelled = false
    loadTimesheetDrafts(
      organizationId,
      roster.map((member) => member.id),
      periodStart,
      timeZone
    ).then((drafts) => {
      if (cancelled) return
      let awaiting = 0
      let signed = 0
      let exported = 0
      for (const member of roster) {
        const draft = drafts.get(member.id) || emptyTimesheetDraft()
        if (draft.exportedAt) exported += 1
        else if (isTimesheetFullyApproved(draft, member)) signed += 1
        else if (awaitingManagerSignOff(draft, member)) awaiting += 1
      }
      setStats({ awaiting, signed, exported })
    })
    return () => {
      cancelled = true
    }
  }, [organizationId, roster, periodStart, timeZone])

  return (
    <div className="space-y-3 md:col-span-1">
      <Tile
        icon={<UserGroupIcon className="h-6 w-6" />}
        title={hasAdminAccess(user) ? 'User Timesheets' : 'Operative Timesheets'}
        detail={
          hasAdminAccess(user)
            ? 'Review, sign off and export company timesheets'
            : "Review, sign off and export your team's sheets"
        }
        badge={stats.awaiting > 0 ? `${stats.awaiting} new` : undefined}
        onClick={onClick}
      />
      <div className="grid grid-cols-3 gap-2.5">
        <StatMiniCard value={String(stats.awaiting)} label="Awaiting sign-off" tone="text-amber-600 bg-amber-50" />
        <StatMiniCard value={String(stats.signed)} label="Signed off" tone="text-green-700 bg-green-50" />
        <StatMiniCard value={String(stats.exported)} label="Exported" tone="text-slate-600 bg-slate-100" />
      </div>
    </div>
  )
}

function StatMiniCard({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`card pad text-center`} data-hue={tone.includes('amber') ? 'warn' : tone.includes('green') ? 'green' : 'lib'}>
      <b className="block font-[family-name:var(--head)] text-[22px]">{value}</b>
      <span className="small muted">{label}</span>
    </div>
  )
}

function Tile({
  icon,
  title,
  detail,
  badge,
  onClick,
}: {
  icon: ReactNode
  title: string
  detail: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ritem"
      data-hue="ts"
    >
      <span className="ico-chip">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[17px] font-semibold">{title}</p>
          {badge ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{badge}</span>
          ) : null}
        </div>
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

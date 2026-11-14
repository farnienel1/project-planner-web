/**
 * iOS parity source: Views/InvoicingView.swift (hub + MyTimesheetsHubView + OperativeTimesheetsView)
 * Spec: docs/ios-parity/sections/17-timesheets.md
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDaysIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/solid'
import { withTimeoutFallback } from '@/lib/client/withTimeout'
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
  userTimesheetSubjectIds,
  exportedTimesheetSubjectIds,
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
  listSelectablePayPeriods,
  periodStartKey,
} from '@/lib/timesheets/paymentRunCopy'
import { TimesheetsScreen, type TeamTimesheetTab } from '@/components/timesheets/TimesheetsScreen'
import { TimesheetPeriodPage } from '@/components/timesheets/TimesheetPeriodPage'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { resolveTimesheetPeriod, timesheetPeriodFromInvoicing, type PayrollTimePolicyState } from '@/lib/canonical'
import { organizationTimeZone } from '@/lib/canonical'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import {
  loadExportedTimesheetHistory,
  loadTimesheetDrafts,
  loadTimesheetDraftsForStarts,
  listTimesheetStates,
} from '@/lib/timesheets/timesheetStorage'
import { timesheetReviewerHubStats } from '@/lib/timesheets/timesheetHubStats'
import { emptyTimesheetDraft, type TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  awaitingManagerSignOff,
  isTimesheetFullyApproved,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import { canAccessMyTimesheetsWithPolicy, shouldAppearInOperativeTimesheetRoster, timesheetDayKeysForPeriod } from '@/lib/timesheets/timesheetPayrollPolicy'
import { exportedTimesheetRosterGroups, timesheetRosterGroups } from '@/lib/timesheets/timesheetWeekUtils'
import {
  TIMESHEETS_HUB_PATH,
  legacyTimesheetRedirect,
  timesheetSurfaceFromPath,
  timesheetNestedParentHref,
  timesheetsMineHref,
  timesheetsTeamHref,
} from '@/lib/timesheets/timesheetRoutes'
import {
  emptyDayRateHistory,
  loadOperativeDayRateHistoryOrNull,
  type OperativeDayRateHistoryCollection,
} from '@/lib/timesheets/dayRateHistoryStorage'
import {
  timesheetInputsStatus,
  type TimesheetInputLoad,
  type TimesheetInputsState,
} from '@/lib/timesheets/timesheetInputs'
import type { User } from '@/types'
import { OVERTIME_HUB_LABEL, overtimeHubAccess } from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { OVERTIME_PATH } from '@/components/overtime/OvertimeScreen'
import {
  ActionCard,
  Card,
  Chip,
  DataTable,
  EmptyState,
  IconTile,
  Note,
  PageBand,
  PageShell,
  SegmentedTabs,
  StatRow,
} from '@/components/ui/page'

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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pathSurface = timesheetSurfaceFromPath(pathname)
  const surface = pathSurface === 'hub' ? null : pathSurface
  const periodParam = searchParams.get('period')
  const periodEndParam = searchParams.get('periodEnd')
  const userParam = searchParams.get('user')
  const tabParam = (searchParams.get('tab') as TeamTimesheetTab | null) || 'awaiting'
  const { user, organization } = useAuthStore()
  const { bookings, loadBookings, coverage: bookingCoverage, error: bookingsError } = useBookingStore()
  const {
    managerSiteBookings,
    loadManagerSiteBookings,
    coverage: managerCoverage,
    error: managerBookingsError,
  } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers, loading: usersLoading } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const [invoicing, setInvoicing] = useState<OrgInvoicingSettings>(DEFAULT_INVOICING)
  const [payrollPolicy, setPayrollPolicy] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const [payrollPolicyPrior, setPayrollPolicyPrior] = useState<OrgPayrollTimePolicy | null>(null)
  const [payrollPolicyEffectiveFrom, setPayrollPolicyEffectiveFrom] = useState<string | null>(null)
  // Rulebook 1.19.0: the whole working-hours state (history + pending change), so every day of a pay run is priced
  // under the rules in effect on it — including a change scheduled to start inside the run.
  const [payrollPolicyState, setPayrollPolicyState] = useState<PayrollTimePolicyState | null>(null)
  const [scheduleOptions, setScheduleOptions] = useState<MyScheduleOptions>(DEFAULT_MY_SCHEDULE)
  const [timeZone, setTimeZone] = useState(organizationTimeZone('GB'))
  const [history, setHistory] = useState<OperativeDayRateHistoryCollection>(emptyDayRateHistory())
  // Pay inputs: never price from the defaults or an empty history after a failed or unfinished load.
  const [detailsLoad, setDetailsLoad] = useState<TimesheetInputLoad>('loading')
  const [historyLoad, setHistoryLoad] = useState<TimesheetInputLoad>('loading')
  const [inputsAttempt, setInputsAttempt] = useState(0)

  const showMine = user ? canAccessMyTimesheetsWithPolicy(user, invoicing, new Date(), timeZone) : false
  const showTeam = canAccessOperativeTimesheets(user, usersLoading, users)
  const showDisabled = shouldShowTimesheetsDisabledMessage(user, showMine)
  // Rulebook 1.29.0 §25: "Overtime, Expenses & Price Work" — PAYE people (My…), admins and line managers (Users'…).
  const overtimeAccess = user
    ? overtimeHubAccess({ viewer: rulebookPerson(users.find((row) => row.id === user.id) || user, users), roster: rulebookRoster(users) })
    : { showButton: false, mine: false, users: false }
  const canOpen = canAccessTimesheetsSurface(user, usersLoading, users) || overtimeAccess.showButton

  useEffect(() => {
    if (pathSurface !== 'hub') return
    const next = legacyTimesheetRedirect(searchParams.get('surface'), searchParams.toString())
    if (next) router.replace(next)
  }, [pathSurface, searchParams, router])

  useEffect(() => {
    if (surface !== 'team' || !user) return
    if (usersLoading || users.length === 0) return
    if (!canAccessOperativeTimesheets(user, usersLoading, users)) router.replace(TIMESHEETS_HUB_PATH)
  }, [surface, user, users, usersLoading, router])

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    let settled = false
    loadUsers(organization.id)
    setDetailsLoad('loading')
    const detailsPromise = loadOrganizationDetails(organization.id)
    const applyDetails = (details: Awaited<ReturnType<typeof loadOrganizationDetails>>) => {
      if (cancelled) return
      if (!details) {
        setDetailsLoad('failed')
        return
      }
      settled = true
      if (details.payrollTimePolicy) setPayrollPolicy(details.payrollTimePolicy)
      setPayrollPolicyPrior(details.payrollTimePolicyPrior ?? null)
      setPayrollPolicyEffectiveFrom(details.payrollTimePolicyEffectiveFrom ?? null)
      setPayrollPolicyState(details.payrollTimePolicyState ?? null)
      if (details.invoicing) setInvoicing(details.invoicing)
      if (details.myScheduleOptions) setScheduleOptions(details.myScheduleOptions)
      setTimeZone(organizationTimeZone(details.countryCode))
      setDetailsLoad('loaded')
    }
    // A slow read shows the error with Retry after 8 s; the read keeps running and still applies when it lands.
    void withTimeoutFallback(detailsPromise, 8_000, null)
      .then((details) => {
        if (!cancelled && !settled && !details) setDetailsLoad('failed')
      })
      .catch(() => {})
    void detailsPromise
      .then((details) => applyDetails(details))
      .catch(() => {
        if (!cancelled) setDetailsLoad('failed')
      })
    return () => {
      cancelled = true
    }
  }, [organization?.id, loadUsers, inputsAttempt])

  const needsNestedCatalogue = surface === 'mine' || surface === 'team'

  useEffect(() => {
    if (!organization?.id || !needsNestedCatalogue) return
    let cancelled = false
    loadBookings(organization.id, { fullHistory: true })
    loadManagerSiteBookings(organization.id, { fullHistory: true })
    loadOperatives(organization.id)
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
    setHistoryLoad('loading')
    loadOperativeDayRateHistoryOrNull(organization.id)
      .then((rows) => {
        if (cancelled) return
        if (rows) {
          setHistory(rows)
          setHistoryLoad('loaded')
        } else {
          setHistoryLoad('failed')
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryLoad('failed')
      })
    return () => {
      cancelled = true
    }
  }, [
    organization?.id,
    needsNestedCatalogue,
    inputsAttempt,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadProjects,
    loadSmallWorks,
  ])

  const runCopy = useMemo(() => currentPaymentRunCopy(invoicing, new Date(), timeZone), [invoicing, timeZone])
  // The User timesheets tile's own counts (loaded by the tile as before), repeated display-only in the band.
  const [hubStats, setHubStats] = useState<{ awaiting: number; signed: number; exported: number } | null>(null)
  const currentPeriod = useMemo(
    () => computeInvoicingPeriod(new Date(), invoicing, timeZone),
    [invoicing, timeZone]
  )
  const pastPeriods = useMemo(
    () =>
      listSelectablePayPeriods(invoicing, new Date(), 120, timeZone).filter(
        (period) =>
          `${periodStartKey(period.start, timeZone)}|${dayKey(period.end, timeZone)}` !==
          `${periodStartKey(currentPeriod.start, timeZone)}|${dayKey(currentPeriod.end, timeZone)}`
      ),
    [invoicing, timeZone, currentPeriod]
  )
  const selectedPeriod = useMemo(() => {
    if (!periodParam) return currentPeriod
    if (periodEndParam) {
      return { start: dateFromDayKey(periodParam, timeZone), end: dateFromDayKey(periodEndParam, timeZone) }
    }
    const match = [currentPeriod, ...pastPeriods].find(
      (period) => periodStartKey(period.start, timeZone) === periodParam
    )
    if (match) return match
    try {
      return computeInvoicingPeriod(dateFromDayKey(periodParam, timeZone), invoicing, timeZone)
    } catch {
      return currentPeriod
    }
  }, [periodParam, periodEndParam, invoicing, currentPeriod, pastPeriods, timeZone])

  const legacyRedirect = pathSurface === 'hub' ? legacyTimesheetRedirect(searchParams.get('surface'), searchParams.toString()) : null

  if (!user) return null
  if (legacyRedirect) return <p className="muted">Opening timesheets…</p>
  if (!canOpen) {
    return (
      <PageShell>
        <Card>
          <EmptyState
            tile={<IconTile tone="slate" size="lg"><ClockIcon /></IconTile>}
            title="Timesheets unavailable"
            description="No timesheet section is available for this account."
          />
        </Card>
      </PageShell>
    )
  }

  const inputsStatus = timesheetInputsStatus({ details: detailsLoad, history: historyLoad })
  const payInputs: TimesheetInputsState = {
    ...inputsStatus,
    retry: () => setInputsAttempt((value) => value + 1),
  }

  // Rulebook 1.43.0 (`timesheetSnapshotReady`): the whole booking archive this screen asked for has arrived for the
  // open organisation (labour and manager site bookings) — never just the rows an earlier, narrower listener held.
  const coversArchive = (coverage: { organizationId: string; fullHistory: boolean } | null) =>
    Boolean(coverage && organization?.id && coverage.organizationId === organization.id && coverage.fullHistory)
  const bookingsLoaded = coversArchive(bookingCoverage) && coversArchive(managerCoverage)
  const bookingsFailed = !bookingsLoaded && Boolean(bookingsError || managerBookingsError)

  const periodPageProps = {
    payInputs,
    bookingsLoaded,
    bookingsFailed,
    periodStart: selectedPeriod.start,
    periodEnd: selectedPeriod.end,
    invoicing,
    payrollPolicy,
    payrollPolicyPrior,
    payrollPolicyEffectiveFrom,
    payrollPolicyState,
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
    // Rulebook 1.11.0 `showsMyTimesheets`: no My Timesheets for a PAYE person; only periods with a self-employed day.
    const minePastPeriods = pastPeriods.filter(
      (period) => timesheetDayKeysForPeriod(subject, period.start, period.end, timeZone).length > 0
    )
    if (!showMine && minePastPeriods.length === 0 && !periodParam) return null
    const mineBackHref = timesheetNestedParentHref({ surface: 'mine', hasDetail: Boolean(periodParam) })
    return (
      <PageShell className="pb-10">
        {periodParam ? (
          <TimesheetPeriodPage
            {...periodPageProps}
            subjectUser={subject}
            mode="mine"
            heading="Timesheet"
            back={{ label: 'My Timesheets', onClick: () => router.replace(mineBackHref) }}
          />
        ) : (
          <MineTimesheetsList
            organizationId={organization?.id}
            subject={subject}
            users={users}
            currentPeriod={currentPeriod}
            pastPeriods={minePastPeriods}
            invoicing={invoicing}
            runCopyPeriodLine={runCopy.periodLine}
            timeZone={timeZone}
          />
        )}
      </PageShell>
    )
  }

  if (surface === 'team') {
    if (user && !showTeam) return null
    const tab = TEAM_TABS.some((item) => item.id === tabParam) ? tabParam : 'awaiting'
    // Only someone on this viewer's User Timesheets (`userTimesheetSubjects`) opens from the link.
    // 1.31.0: on the Exported tab, the people of `exportedTimesheetHistorySubjects` (the viewer's own exported sheets
    // and inactive people in scope) open too — read-only for their own (`timesheetWriterIsReviewer` is false).
    const openable =
      tab === 'exported' ? exportedTimesheetSubjectIds(user, users) : userTimesheetSubjectIds(user, users)
    const selectedUser =
      userParam && openable.includes(userParam)
        ? users.find((row) => row.id === userParam) ?? (user && user.id === userParam ? user : undefined)
        : undefined
    const teamTitle = hasAdminAccess(user) ? 'User Timesheets' : 'Operative Timesheets'
    const teamBackHref = timesheetNestedParentHref({ surface: 'team', hasDetail: Boolean(userParam), tab })
    return (
      <PageShell className="pb-10">
        {selectedUser ? (
          <TimesheetPeriodPage
            {...periodPageProps}
            subjectUser={selectedUser}
            mode="review"
            heading="Review Timesheet"
            back={{ label: teamTitle, onClick: () => router.replace(teamBackHref) }}
          />
        ) : (
          <>
            {userParam ? (
              // A `?user=` this viewer cannot open: the page shows the list with the same back control as before.
              <PageBand
                back={{ label: teamTitle, onClick: () => router.replace(teamBackHref) }}
                eyebrow={`${teamTitle} · Current pay run period`}
                title={runCopy.periodLine}
              />
            ) : (
              <PageBand eyebrow={`${teamTitle} · Current pay run period`} title={runCopy.periodLine} />
            )}
            <SegmentedTabs
              ariaLabel={teamTitle}
              items={TEAM_TABS.map((item) => ({ id: item.id, label: item.label }))}
              value={tab}
              onChange={(id) => router.replace(timesheetsTeamHref({ tab: id }))}
            />
            <Note tone={tab === 'exported' ? 'info' : 'amber'} icon={<ClockIcon />}>
              {TEAM_TABS.find((item) => item.id === tab)?.help}
            </Note>
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
              payrollPolicyState={payrollPolicyState}
              invoicing={invoicing}
              loading={usersLoading && users.length === 0}
              teamTab={tab}
              timeZone={timeZone}
              history={history}
              scheduleOptions={scheduleOptions}
              payInputs={payInputs}
            />
          </>
        )}
      </PageShell>
    )
  }

  const hubStatItems = showTeam && hubStats
    ? [
        { value: hubStats.awaiting, label: 'Awaiting sign-off', tone: 'amber' as const },
        { value: hubStats.signed, label: 'Signed off' },
        { value: hubStats.exported, label: 'Exported' },
      ]
    : []

  return (
    <PageShell>
      <PageBand
        eyebrow="Timesheets · Current payment run"
        title={runCopy.periodLine}
        subtitle={`${runCopy.paidLine} · Sign your hours and sign off your team`}
      >
        <StatRow items={hubStatItems} />
        {runCopy.note ? <Note tone="dark">{runCopy.note}</Note> : null}
      </PageBand>

      {showDisabled && !showMine && !showTeam && !overtimeAccess.showButton ? (
        <DisabledCard />
      ) : (
        <div className="pu-gridAuto">
          {showMine ? (
            <ActionCard
              tile={<IconTile tone="blue"><ClockIcon /></IconTile>}
              title="My timesheets"
              description={
                showTeam
                  ? 'Your own hours, expenses and price work'
                  : 'Current pay run, pending sign-off, and past timesheets.'
              }
              onClick={() => router.push(timesheetsMineHref())}
            >
              <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip tone="blue">Current pay run</Chip>
                <Chip tone="slate">{runCopy.periodLine}</Chip>
              </span>
            </ActionCard>
          ) : null}
          {overtimeAccess.showButton ? (
            <ActionCard
              tile={<IconTile tone="amber"><CalendarDaysIcon /></IconTile>}
              title={OVERTIME_HUB_LABEL}
              description={
                overtimeAccess.mine && overtimeAccess.users
                  ? 'Your PAYE overtime, and your team’s'
                  : overtimeAccess.mine
                    ? 'Your PAYE overtime'
                    : 'Your team’s overtime, expenses and price work'
              }
              onClick={() => router.push(OVERTIME_PATH)}
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
              onStats={setHubStats}
              onClick={() => router.push(timesheetsTeamHref({ tab: 'awaiting' }))}
            />
          ) : null}
        </div>
      )}
    </PageShell>
  )
}

function pastSubtitle(draft: TimesheetDraft | undefined, user: User, users: ReadonlyArray<User>): string {
  if (!draft) return 'Previous period'
  if (draft.exportedAt) return 'Exported'
  if (isTimesheetFullyApproved(draft, user, users)) return 'Signed off'
  // Never for a self-signed admin (`timesheetSelfSigned`): their signature completes the sheet.
  if (awaitingManagerSignOff(draft, user, users)) return 'Timesheet pending manager signature'
  if (draft.operativeSignedAt) return 'Partially signed'
  return 'Saved draft'
}

function MineTimesheetsList({
  organizationId,
  subject,
  users,
  currentPeriod,
  pastPeriods,
  invoicing,
  runCopyPeriodLine,
  timeZone,
}: {
  organizationId?: string
  subject: User
  /** The organisation roster (`timesheetSelfSigned(user, roster)`). */
  users: ReadonlyArray<User>
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

  const periodKey = (period: { start: Date; end: Date }) =>
    `${periodStartKey(period.start, timeZone)}|${dayKey(period.end, timeZone)}`

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    const currentKey = periodKey(currentPeriod)
    listTimesheetStates(organizationId, subject.id, 400).then(async (rows) => {
      if (cancelled) return
      const byKey = new Map<string, { start: Date; end: Date }>()
      for (const period of pastPeriods) byKey.set(periodKey(period), period)
      const live = timesheetPeriodFromInvoicing({
        paymentRunMode: invoicing.paymentRunMode,
        ranges: invoicing.paymentRunDateRanges,
        recurringRunStartDay: invoicing.recurringRunStartDay,
        recurringRunEndDay: invoicing.recurringRunEndDay,
        referenceDayKey: dayKey(new Date(), timeZone),
        timeZone,
      })
      for (const row of rows) {
        const resolved = resolveTimesheetPeriod({
          storedStartDayKey: dayKey(row.weekStart, timeZone),
          storedEndDayKey: row.endDayKey,
          currentPeriod: live,
        })
        const period = {
          start: dateFromDayKey(resolved.startDayKey, timeZone),
          end: dateFromDayKey(resolved.endDayKey, timeZone),
        }
        const key = periodKey(period)
        if (key === currentKey) continue
        if (!byKey.has(key)) byKey.set(key, period)
      }
      const merged = Array.from(byKey.values()).sort((a, b) => b.start.getTime() - a.start.getTime())
      setDiscoveredPast(merged)
      const next = new Map<string, TimesheetDraft>()
      next.set(currentKey, emptyTimesheetDraft())
      for (const period of merged) next.set(periodKey(period), emptyTimesheetDraft())
      if (rows.length === 0) {
        const loaded = await loadTimesheetDraftsForStarts(
          organizationId,
          subject.id,
          [currentPeriod.start, ...merged.slice(0, 24).map((period) => period.start)],
          timeZone
        )
        if (cancelled) return
        for (const [startKey, draft] of loaded) {
          const match = [currentPeriod, ...merged].find((period) => periodStartKey(period.start, timeZone) === startKey)
          if (match) next.set(periodKey(match), draft)
        }
        setDrafts(next)
        return
      }
      for (const row of rows) {
        const resolved = resolveTimesheetPeriod({
          storedStartDayKey: dayKey(row.weekStart, timeZone),
          storedEndDayKey: row.endDayKey,
          currentPeriod: live,
        })
        const key = `${resolved.startDayKey}|${resolved.endDayKey}`
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
    const draft = drafts.get(periodKey(period))
    return draft ? awaitingManagerSignOff(draft, subject, users) : false
  })
  const pendingKeys = new Set(pending.map((period) => periodKey(period)))
  const pastVisible = discoveredPast.filter((period) => !pendingKeys.has(periodKey(period)))

  const openCurrent = () =>
    router.push(timesheetsMineHref(periodStartKey(currentPeriod.start, timeZone), dayKey(currentPeriod.end, timeZone)))
  const openPeriod = (period: { start: Date; end: Date }) =>
    router.push(timesheetsMineHref(periodStartKey(period.start, timeZone), dayKey(period.end, timeZone)))

  return (
    <>
      <PageBand title="My Timesheets" />
      <ActionCard
        tile={
          <IconTile tone="blue">
            <CalendarDaysIcon />
          </IconTile>
        }
        title="Current pay run period"
        description={runCopyPeriodLine}
        onClick={openCurrent}
      >
        <span className="pu-sub">Review bookings, add extras, and sign your timesheet.</span>
      </ActionCard>
      {pending.length > 0 ? (
        <Card title="Pending timesheets" subtitle="You signed — waiting for your line manager to counter-sign.">
          <DataTable
            columns={[
              { key: 'period', label: 'Pay run period' },
              { key: 'status', label: 'Status' },
            ]}
          >
            {pending.map((period) => (
              <tr key={`pending-${periodKey(period)}`} className="click" onClick={() => openPeriod(period)}>
                <td>
                  <PeriodButton label={formatPaymentPeriodLine(period.start, period.end, timeZone)} onClick={() => openPeriod(period)} />
                </td>
                <td>
                  <Chip tone="amber">Timesheet pending manager signature</Chip>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}
      {pastVisible.length > 0 ? (
        <Card title="Past timesheets" subtitle="View breakdown, signatures, and generate invoice again.">
          <DataTable
            columns={[
              { key: 'period', label: 'Pay run period' },
              { key: 'status', label: 'Status' },
            ]}
          >
            {pastVisible.map((period) => {
              const status = pastSubtitle(drafts.get(periodKey(period)), subject, users)
              return (
                <tr key={periodKey(period)} className="click" onClick={() => openPeriod(period)}>
                  <td>
                    <PeriodButton label={formatPaymentPeriodLine(period.start, period.end, timeZone)} onClick={() => openPeriod(period)} />
                  </td>
                  <td>
                    <Chip tone={pastStatusTone(status)}>{status}</Chip>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        </Card>
      ) : null}
    </>
  )
}

/** The period line as the row's keyboard control (the whole row opens it too, as the card did before). */
function PeriodButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="pu-link"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <b>{label}</b>
    </button>
  )
}

/** Chip colour for a status `pastSubtitle` already chose (display only). */
function pastStatusTone(status: string): 'green' | 'amber' | 'slate' {
  if (status === 'Signed off') return 'green'
  if (status === 'Exported' || status === 'Previous period') return 'slate'
  return 'amber'
}

function ManagerTimesheetsTile({
  user,
  users,
  organizationId,
  periodStart,
  periodEnd,
  invoicing,
  timeZone,
  onStats,
  onClick,
}: {
  user: User
  users: User[]
  organizationId?: string
  periodStart: Date
  periodEnd: Date
  invoicing: OrgInvoicingSettings
  timeZone: string
  /** Reports the counts this tile loads so the hub band can repeat them (display only). */
  onStats?: (stats: { awaiting: number; signed: number; exported: number } | null) => void
  onClick: () => void
}) {
  const [stats, setStats] = useState<{ awaiting: number; signed: number; exported: number } | null>(null)
  const reviewGroups = useMemo(() => timesheetRosterGroups(user, users), [user, users])
  const currentGroups = useMemo(
    () =>
      reviewGroups
        .map((group) =>
          group.filter((member) =>
            shouldAppearInOperativeTimesheetRoster(member, periodStart, periodEnd, invoicing, new Date(), timeZone)
          )
        )
        .filter((group) => group.length > 0),
    [reviewGroups, periodStart, periodEnd, invoicing, timeZone]
  )
  const currentRosterIds = useMemo(() => currentGroups.flat().map((member) => member.id), [currentGroups])
  // Rulebook 1.31.0: the Exported count is `exportedTimesheetHistorySubjects` (own sheets and inactive people in scope).
  const exportedRoster = useMemo(() => exportedTimesheetRosterGroups(user, users).flat(), [user, users])

  useEffect(() => {
    if (!organizationId || users.length === 0) {
      setStats(null)
      return
    }
    if (currentRosterIds.length === 0 && exportedRoster.length === 0) {
      setStats({ awaiting: 0, signed: 0, exported: 0 })
      return
    }
    let cancelled = false
    Promise.all([
      currentRosterIds.length > 0
        ? loadTimesheetDrafts(organizationId, currentRosterIds, periodStart, timeZone, periodEnd)
        : Promise.resolve(new Map<string, TimesheetDraft>()),
      exportedRoster.length > 0
        ? loadExportedTimesheetHistory({ organizationId, users: exportedRoster })
        : Promise.resolve([]),
    ])
      .then(([drafts, exportedRows]) => {
        if (cancelled) return
        setStats(
          timesheetReviewerHubStats({
            groups: currentGroups,
            currentPeriodDrafts: drafts,
            exportedHistoryCount: exportedRows.length,
            users,
          })
        )
      })
      .catch(() => {
        if (!cancelled) setStats({ awaiting: 0, signed: 0, exported: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, users.length, currentRosterIds, currentGroups, exportedRoster, periodStart, periodEnd, timeZone])

  useEffect(() => {
    onStats?.(stats)
  }, [stats, onStats])

  return (
    <ActionCard
      tile={<IconTile tone="purple"><UserGroupIcon /></IconTile>}
      title={hasAdminAccess(user) ? 'User timesheets' : 'Operative timesheets'}
      description={
        hasAdminAccess(user)
          ? 'Review, sign off and export company timesheets'
          : "Review, sign off and export your team's sheets"
      }
      onClick={onClick}
    >
      <span className="pu-mini">
        <span className="amber" style={{ display: 'flex', flexDirection: 'column' }}>
          <b>{stats?.awaiting ?? '–'}</b>
          <span>Awaiting sign-off</span>
        </span>
        <span className="green" style={{ display: 'flex', flexDirection: 'column' }}>
          <b>{stats?.signed ?? '–'}</b>
          <span>Signed off</span>
        </span>
        <span className="slate" style={{ display: 'flex', flexDirection: 'column' }}>
          <b>{stats?.exported ?? '–'}</b>
          <span>Exported</span>
        </span>
      </span>
    </ActionCard>
  )
}

function DisabledCard() {
  return (
    <Card title="Timesheets follow employment type">
      <div className="pu-card-b">
        <p className="pu-sub" style={{ fontSize: 13.5 }}>{PAYE_DISABLED_BODY}</p>
      </div>
    </Card>
  )
}

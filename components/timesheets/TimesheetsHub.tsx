/**
 * iOS parity source: Views/InvoicingView.swift (hub + MyTimesheetsHubView + OperativeTimesheetsView)
 * Spec: docs/ios-parity/sections/17-timesheets.md
 */
'use client'

import { bookingCoverageIsArchive } from '@/lib/firebase/orgCollectionMerge'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  isOperativeMode,
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
  organizationCreatedAt,
  payRunListStartDayKey,
  periodStartKey,
} from '@/lib/timesheets/paymentRunCopy'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { TimesheetsScreen, type TeamTimesheetTab } from '@/components/timesheets/TimesheetsScreen'
import { TimesheetPeriodPage } from '@/components/timesheets/TimesheetPeriodPage'
import { TimesheetScreenBoundary } from '@/components/timesheets/TimesheetScreenBoundary'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { resolveTimesheetPeriod, timesheetPeriodFromInvoicing, type PayrollTimePolicyState } from '@/lib/canonical'
import { organizationTimeZone } from '@/lib/canonical'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import {
  loadExportedTimesheetHistory,
  loadTimesheetDraftsForStarts,
  loadTimesheetQueueSheets,
  type TimesheetQueueStoredSheet,
  listPersonTimesheetStates,
  timesheetLookupPrivatePay,
  timesheetSourceDocumentId,
} from '@/lib/timesheets/timesheetStorage'
import { timesheetLookupPlan } from '@/lib/timesheets/personTimesheetDocs'
import { onPlatformConfigChange } from '@/lib/access/securitySwitches'
import { emptyTimesheetDraft, type TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  awaitingManagerSignOff,
  isTimesheetFullyApproved,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import { retryOwnPayRead, useOwnPayUser } from '@/lib/pay/useOwnPayUser'
import { withOwnPay } from '@/lib/pay/ownPayRecord'
import { retryPayProfiles, usePayProfilesStatus, usePayStatusOf } from '@/lib/pay/usePayProfilesStatus'
import type { PayProfilesStatus } from '@/lib/pay/payProfileOverlay'
import { OWN_PAY_FAILED_MESSAGE, OWN_PAY_LOADING_MESSAGE, PayStatusNotice } from '@/components/pay/PayStatusNotice'
import { canAccessMyTimesheetsWithPolicy, timesheetDayKeysForPeriod } from '@/lib/timesheets/timesheetPayrollPolicy'
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
  payProfilesInputLoad,
  timesheetInputsStatus,
  withBookingsGate,
  type TimesheetInputLoad,
  type TimesheetInputsState,
} from '@/lib/timesheets/timesheetInputs'
import type { User } from '@/types'
import { OVERTIME_HUB_LABEL, overtimeHubAccess } from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { OVERTIME_PATH } from '@/components/overtime/OvertimeScreen'
import { BookingsChangedWarning } from '@/components/timesheets/BookingsChangedWarning'
import { mineChangedKey, mineChangedShown, useMineChangedStore } from '@/lib/timesheets/mineChangedStore'
import { useSnapshotAutoRepair } from '@/lib/timesheets/useSnapshotAutoRepair'
import type { RepairSheet } from '@/lib/timesheets/snapshotAutoRepair'
import { revisionDueOf as revisionDueFor } from '@/lib/timesheets/mineChanged'
import {
  RECENT_PAY_RUN_COUNT,
  TIMESHEETS_LOAD_FAILED_MESSAGE,
  payRunKey,
  payRunsStartDayKey,
  recentPayRuns,
  timesheetMemberIds,
  userTimesheetQueueRows,
  type PayRun,
} from '@/lib/timesheets/timesheetQueue'
import { bookingCoverageCoversDay, periodBookingChanges, type BookingChangeCatalogue } from '@/lib/timesheets/timesheetBookingChanges'
import {
  SIGNED_TIMESHEET_CHANGED_STATUS,
  TIMESHEET_REVISION_DUE_MESSAGE,
  TIMESHEET_REVISION_DUE_STATUS,
  timesheetRevisionLabel,
} from '@/lib/canonical'
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

/** Review #325 item 7: how many pay runs (the current one included) the hub checks for changed signed sheets. */
const HUB_CHANGE_SCAN_RUNS = RECENT_PAY_RUN_COUNT

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
  const { users, loadUsers, loading: usersLoading, rosterServerOrgId } = useOrgUserStore()
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

  // Pay strip: the signed-in person's employment type comes from their pay profile while `privatePay` is on
  // (`useOwnPayUser`); the session user alone reads as self-employed once the strip has run. Off: unchanged.
  const ownPay = useOwnPayUser()
  const me = ownPay.status === 'ready' ? ownPay.user : null
  const payProfilesStatus = usePayProfilesStatus(organization?.id)
  const payStatusOf = usePayStatusOf(organization?.id)
  const showMine = me ? canAccessMyTimesheetsWithPolicy(me, invoicing, new Date(), timeZone) : false
  const showTeam = canAccessOperativeTimesheets(user, usersLoading, users)
  const showDisabled = me ? shouldShowTimesheetsDisabledMessage(me, showMine) : false
  // Rulebook 1.29.0 §25: "Overtime, Expenses & Price Work" — PAYE people (My…), admins and line managers (Users'…).
  const overtimeAccess = user
    ? overtimeHubAccess({
        viewer: rulebookPerson(withOwnPay(users.find((row) => row.id === user.id) || user, ownPay), users),
        roster: rulebookRoster(users),
      })
    : { showButton: false, mine: false, users: false }
  const canOpen = canAccessTimesheetsSurface(ownPay.user ?? user, usersLoading, users) || overtimeAccess.showButton

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

  // Rulebook 1.47.0 §8: the hub's "My timesheets" entry shows the yellow triangle when a signed sheet's bookings changed,
  // so the hub loads the bookings too when the person has My Timesheets.
  const needsNestedCatalogue = surface === 'mine' || surface === 'team' || (surface == null && (showMine || showTeam))
  // Review #325 item 7: on the hub itself only the last HUB_CHANGE_SCAN_RUNS pay runs are checked, so the bookings are
  // loaded from the earliest of their starts — never the whole archive.
  // 17 Nov follow-up: the same recent pay runs User Timesheets → Awaiting / Signed off list (`recentPayRuns`).
  const recentRuns = useMemo(() => recentPayRuns(invoicing, new Date(), timeZone, HUB_CHANGE_SCAN_RUNS), [invoicing, timeZone])
  const hubScanFromDayKey = useMemo(() => payRunsStartDayKey(recentRuns, timeZone), [recentRuns, timeZone])

  useEffect(() => {
    if (!organization?.id || !needsNestedCatalogue) return
    let cancelled = false
    const bookingWindow = surface == null ? { fromDayKey: hubScanFromDayKey } : { fullHistory: true }
    loadBookings(organization.id, bookingWindow)
    loadManagerSiteBookings(organization.id, bookingWindow)
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
    surface,
    hubScanFromDayKey,
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
  // Owner item 6 (17 Nov follow-up): past pay runs start at the organisation's creation day; My Timesheets still adds
  // every run with a stored sheet (`MineTimesheetsList`), so no sheet is hidden.
  const orgDocument = useOrganizationDocument()
  const listFromDayKey = useMemo(
    () => payRunListStartDayKey({ createdAt: organizationCreatedAt(orgDocument.data), timeZone }),
    [orgDocument.data, timeZone]
  )
  const pastPeriods = useMemo(
    () =>
      listSelectablePayPeriods(invoicing, new Date(), 120, timeZone, [], listFromDayKey).filter(
        (period) =>
          `${periodStartKey(period.start, timeZone)}|${dayKey(period.end, timeZone)}` !==
          `${periodStartKey(currentPeriod.start, timeZone)}|${dayKey(currentPeriod.end, timeZone)}`
      ),
    [invoicing, timeZone, currentPeriod, listFromDayKey]
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

  // Pay strip: signing, counter-signing, invoices and export also wait for the pay they are priced from (review #342
  // item 1: per person — one person's refused read never blocks anyone else's sheet):
  //   - My Timesheets: the signed-in person's own pay (`useOwnPayUser`); the roster only while it is still loading;
  //   - reviewing one person: that person's pay (`personPayStatus`);
  //   - the User Timesheets list and Export: the roster as a whole; a person whose read failed is marked and skipped.
  const payInputsFor = (payProfiles: TimesheetInputLoad): TimesheetInputsState => ({
    ...timesheetInputsStatus({ details: detailsLoad, history: historyLoad, payProfiles }),
    retry: () => {
      setInputsAttempt((value) => value + 1)
      retryPayProfiles(organization?.id, ownPay.status)
    },
  })
  const minePayInputs = payInputsFor(
    payProfilesInputLoad(payProfilesStatus === 'loading' ? 'loading' : 'ready', ownPay.status)
  )
  const teamPayInputs = payInputsFor(payProfilesInputLoad(payProfilesStatus, 'ready'))
  const payInputs = surface === 'mine' ? minePayInputs : teamPayInputs

  // Rulebook 1.43.0 (`timesheetSnapshotReady`): the whole booking archive this screen asked for has arrived for the
  // open organisation (labour and manager site bookings) — never just the rows an earlier, narrower listener held.
  // `coverage` is set only from a server answer of the query (every part of a plan), never cached or partial rows.
  const bookingsLoaded =
    bookingCoverageIsArchive(bookingCoverage, organization?.id) && bookingCoverageIsArchive(managerCoverage, organization?.id)
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

  // Rulebook 1.47.0 §8: what `signedTimesheetBookingChanges` needs to price a person's live lines for any period.
  const changeCatalogue: BookingChangeCatalogue = {
    users,
    // On the hub the bookings are loaded from `hubScanFromDayKey` only (review #325 item 7); a pay run is checked only
    // when that window holds it. Elsewhere the whole archive is loaded (`bookingsLoaded`).
    liveLoaded:
      surface == null
        ? bookingCoverageCoversDay(bookingCoverage, organization?.id, hubScanFromDayKey) &&
          bookingCoverageCoversDay(managerCoverage, organization?.id, hubScanFromDayKey)
        : bookingsLoaded && !bookingsFailed,
    coversPeriod: surface == null ? (period) => periodStartKey(period.start, timeZone) >= hubScanFromDayKey : undefined,
    bookings,
    managerSiteBookings,
    operatives,
    projects,
    smallWorks,
    payrollPolicy,
    payrollPolicyPrior,
    payrollPolicyEffectiveFrom,
    payrollPolicyState,
    timeZone,
    history,
    scheduleOptions,
  }

  if (surface === 'mine') {
    // Review #342 item 3: My Timesheets (which periods, which days) is decided from the person's own pay — never from
    // the stripped users document while that is loading or could not be read.
    if (ownPay.status !== 'ready') {
      return (
        <PageShell className="pb-10">
          <PageBand eyebrow="Timesheets" title="My Timesheets" />
          <PayStatusNotice
            status={ownPay.status}
            loadingMessage={OWN_PAY_LOADING_MESSAGE}
            failedMessage={OWN_PAY_FAILED_MESSAGE}
            onRetry={retryOwnPayRead}
          />
        </PageShell>
      )
    }
    const subject = withOwnPay(users.find((row) => row.id === user.id) || user, ownPay)
    // Rulebook 1.11.0 `showsMyTimesheets`: no My Timesheets for a PAYE person; only periods with a self-employed day.
    const minePastPeriods = pastPeriods.filter(
      (period) => timesheetDayKeysForPeriod(subject, period.start, period.end, timeZone).length > 0
    )
    if (!showMine && minePastPeriods.length === 0 && !periodParam) return null
    const mineBackHref = timesheetNestedParentHref({ surface: 'mine', hasDetail: Boolean(periodParam) })
    return (
      <PageShell className="pb-10">
        {periodParam ? (
          <TimesheetScreenBoundary resetKey={searchParams.toString()} backLabel="My Timesheets" onBack={() => router.replace(mineBackHref)}>
            <TimesheetPeriodPage
              {...periodPageProps}
              subjectUser={subject}
              mode="mine"
              heading="Timesheet"
              back={{ label: 'My Timesheets', onClick: () => router.replace(mineBackHref) }}
            />
          </TimesheetScreenBoundary>
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
            changeCatalogue={changeCatalogue}
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
          <TimesheetScreenBoundary resetKey={searchParams.toString()} backLabel={teamTitle} onBack={() => router.replace(teamBackHref)}>
            <TimesheetPeriodPage
              {...periodPageProps}
              // Review #342 item 1: the reviewed person's own pay decides; another person's refused read never does.
              payInputs={payInputsFor(
                payProfilesInputLoad(payStatusOf(selectedUser), 'ready')
              )}
              subjectUser={selectedUser}
              mode="review"
              heading="Review Timesheet"
              back={{ label: teamTitle, onClick: () => router.replace(teamBackHref) }}
            />
          </TimesheetScreenBoundary>
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
            <TimesheetScreenBoundary resetKey={searchParams.toString()}>
              <TimesheetsScreen
                bookings={bookings}
                managerSiteBookings={managerSiteBookings}
                operatives={operatives}
                users={users}
                projects={projects}
                smallWorks={smallWorks}
                periodStart={currentPeriod.start}
                periodEnd={currentPeriod.end}
                // 17 Nov follow-up: a signed sheet of an earlier pay run that was never exported stays listed.
                queuePeriods={recentRuns}
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
                // Rulebook 1.43.0 (review r318): export stamps and freezes the signed snapshot, so it waits for the
                // server-confirmed bookings as signing does (`withBookingsGate` → `timesheetSnapshotReady`).
                payInputs={withBookingsGate(payInputs, { bookingsLoaded, bookingsFailed })}
                // Review #342 item 1: people whose pay is not known (loading or failed) show no figures and are skipped by
                // Export and Download PDF.
                payStatusOf={payStatusOf}
              />
            </TimesheetScreenBoundary>
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
            <MineChangedIndicator organizationId={organization?.id} userId={user.id}>
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
            </MineChangedIndicator>
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
              runs={recentRuns}
              repairReady={teamPayInputs.ready && changeCatalogue.liveLoaded}
              payStatusOf={payStatusOf}
              invoicing={invoicing}
              timeZone={timeZone}
              changeCatalogue={changeCatalogue}
              rosterLoaded={
                !usersLoading && users.length > 0 && Boolean(organization?.id) && rosterServerOrgId === organization?.id
              }
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
  changeCatalogue,
}: {
  /** Rulebook 1.47.0 §8: the live bookings, to show a changed signed sheet's yellow triangle. */
  changeCatalogue: BookingChangeCatalogue
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
  // Guardrail 1: the person's past sheets under every id they go by (`personIdSet`: a former invite id, a second users
  // document on their email) and sheets stored without `userId` whose document id names them; the own id first.
  // Final review of #386: only the queries this viewer's rules allow (`timesheetLookupPlan`): an operative asks their own
  // id only; while `privatePay` is on so does everyone but an admin (as iOS).
  const subjectIsOperative = isOperativeMode(subject)
  const subjectIsAdmin = hasAdminAccess(subject)
  const subjectIds = useMemo(() => timesheetMemberIds(subject, users), [subject, users])
  const subjectIdsKey = subjectIds.join('|')
  // Re-check of #386: the switch as the lookups read it, followed live — when `platformConfig/app` arrives after the
  // first read (privatePay off), the list is planned again and widens.
  const [lookupPrivatePay, setLookupPrivatePay] = useState(() => timesheetLookupPrivatePay(organizationId ?? ''))
  useEffect(() => {
    const update = () => setLookupPrivatePay(timesheetLookupPrivatePay(organizationId ?? ''))
    update()
    return onPlatformConfigChange(update)
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    const currentKey = periodKey(currentPeriod)
    const plan = timesheetLookupPlan({
      ids: subjectIds,
      viewerIsOperative: subjectIsOperative,
      viewerIsAdmin: subjectIsAdmin,
      privatePay: lookupPrivatePay,
    })
    listPersonTimesheetStates(organizationId, plan.ids, 400, 'latest', plan.includeDocumentPrefix)
      .then(async (rows) => {
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
    // `subjectIds` is read through `subjectIdsKey` (a new roster array with the same ids does not reload).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, subject.id, subjectIdsKey, subjectIsOperative, subjectIsAdmin, lookupPrivatePay, currentPeriod, pastPeriods, invoicing, timeZone])

  // Rulebook 1.47.0 §8: a signed, unexported sheet whose bookings changed is back with the person.
  const changeOf = (period: { start: Date; end: Date }) =>
    periodBookingChanges(changeCatalogue, subject, drafts.get(periodKey(period)), period)
  const needsSigningAgain = (period: { start: Date; end: Date }) => changeOf(period)?.waitingFor === 'person'
  // Rulebook 1.55.0 §8: the listed (latest) version is exported and a booking changed — an update (revision) to sign.
  const revisionDue = (period: { start: Date; end: Date }) => revisionDueOf(drafts.get(periodKey(period)), changeOf(period))
  const currentChanged = needsSigningAgain(currentPeriod) || revisionDue(currentPeriod)
  const pending = [currentPeriod, ...discoveredPast].filter((period) => {
    const draft = drafts.get(periodKey(period))
    if (!draft) return false
    if (needsSigningAgain(period) || revisionDue(period)) return true
    const change = changeOf(period)
    return awaitingManagerSignOff(draft, subject, users) || change?.waitingFor === 'lineManager'
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
      <WithChangedTriangle show={currentChanged}>
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
      </WithChangedTriangle>
      {pending.length > 0 ? (
        <Card title="Pending timesheets" subtitle="You signed — waiting for your line manager to counter-sign, or bookings changed and it needs signing again.">
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
                  {revisionDue(period) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <BookingsChangedWarning message={TIMESHEET_REVISION_DUE_MESSAGE} />
                      <Chip tone="amber">{TIMESHEET_REVISION_DUE_STATUS}</Chip>
                    </span>
                  ) : needsSigningAgain(period) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <BookingsChangedWarning />
                      <Chip tone="amber">{SIGNED_TIMESHEET_CHANGED_STATUS}</Chip>
                      {revisionBadge(drafts.get(periodKey(period)))}
                    </span>
                  ) : (
                    <Chip tone="amber">Timesheet pending manager signature</Chip>
                  )}
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
                    <Chip tone={pastStatusTone(status)}>{status}</Chip> {revisionBadge(drafts.get(periodKey(period)))}
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

/** Rulebook 1.55.0 §8 (`timesheetRevisionDue`): the shared reading (`mineChanged.revisionDueOf`) for a listed draft. */
function revisionDueOf(
  draft: TimesheetDraft | undefined,
  change: { exported?: boolean | null; changed?: boolean | null } | null | undefined
): boolean {
  return revisionDueFor(draft, draft ? timesheetSourceDocumentId(draft) : null, change)
}

/** Rulebook 1.55.0: the "REV N" badge of a listed version (nothing for an original). */
function revisionBadge(draft: TimesheetDraft | undefined): ReactNode {
  const label = timesheetRevisionLabel(draft?.revision ?? 0)
  return label ? <Chip tone="slate">{label}</Chip> : null
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

/**
 * Rulebook 1.47.0 §8: the yellow triangle beside an entry card. The card itself is a button, so the triangle sits
 * beside it (never inside it) and opens its own popup.
 */
function WithChangedTriangle({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return <>{children}</>
  return (
    <div style={{ position: 'relative', display: 'grid' }}>
      {children}
      <span style={{ position: 'absolute', top: 10, right: 10 }}>
        <BookingsChangedWarning />
      </span>
    </div>
  )
}

/**
 * Rulebook 1.47.0 §8 / owner decision G (17 Nov follow-up): the hub's "My timesheets" entry with the yellow triangle when
 * any of the person's signed sheets needs them (bookings changed, or a revision due). It only reads the app shell's
 * answer (`useMineChangedMonitor` → `useMineChangedStore`) — one computation for the sidebar and the hub.
 */
function MineChangedIndicator({
  organizationId,
  userId,
  children,
}: {
  organizationId?: string
  userId: string
  children: ReactNode
}) {
  const show = useMineChangedStore((state) => mineChangedShown(state, mineChangedKey(organizationId, userId)))
  return <WithChangedTriangle show={show}>{children}</WithChangedTriangle>
}

function ManagerTimesheetsTile({
  user,
  users,
  organizationId,
  runs,
  repairReady,
  payStatusOf,
  invoicing,
  timeZone,
  changeCatalogue,
  rosterLoaded,
  onStats,
  onClick,
}: {
  /** Rulebook 1.47.0 §8: the live bookings, so a reopened sheet is counted where it now is. */
  changeCatalogue: BookingChangeCatalogue
  /** Review of #386 (S5): the organisation roster has loaded (admins' "Unknown person" rows wait for it). */
  rosterLoaded: boolean
  user: User
  users: User[]
  organizationId?: string
  /** 17 Nov follow-up: the recent pay runs the Awaiting / Signed off lists hold (newest first). */
  runs: ReadonlyArray<PayRun>
  /** Owner item 5: the window's bookings (server-confirmed) and the pay inputs have loaded. */
  repairReady: boolean
  /** Review of #368 (B2): each person's own pay status (the background repair rebuilds only `ready`). */
  payStatusOf: (member: User) => PayProfilesStatus
  invoicing: OrgInvoicingSettings
  timeZone: string
  /** Reports the counts this tile loads so the hub band can repeat them (display only). */
  onStats?: (stats: { awaiting: number; signed: number; exported: number } | null) => void
  onClick: () => void
}) {
  const [loaded, setLoaded] = useState<{ sheets: TimesheetQueueStoredSheet[]; exportedCount: number } | 'empty' | 'failed' | null>(null)
  const [repairs, setRepairs] = useState(0)
  // Final review of #381: a failed load is tried again when the browser comes back online or the window regains focus
  // (the tile is itself a button, so it cannot hold a Retry button).
  const [retries, setRetries] = useState(0)
  const reviewGroups = useMemo(() => timesheetRosterGroups(user, users), [user, users])
  const reviewIds = useMemo(() => reviewGroups.flat().flatMap((member) => timesheetMemberIds(member, users)), [reviewGroups, users])
  const runsKey = runs.map((run) => payRunKey(run, timeZone)).join(',')
  // Rulebook 1.31.0: the Exported count is `exportedTimesheetHistorySubjects` (own sheets and inactive people in scope).
  const exportedRoster = useMemo(() => exportedTimesheetRosterGroups(user, users).flat(), [user, users])

  // Review of #368: the queries reload only when the people they ask about change (their ids), never on every roster
  // snapshot; the rows are mapped onto the people from the current roster below.
  const queryKey = `${reviewIds.join(',')}#${exportedRoster.map((member) => member.id).join(',')}#${hasAdminAccess(user) ? 'admin' : ''}#${rosterLoaded ? 'roster' : ''}`
  const usersRef = useRef(users)
  usersRef.current = users
  const exportedRosterRef = useRef(exportedRoster)
  exportedRosterRef.current = exportedRoster
  useEffect(() => {
    const users = usersRef.current
    const exportedRoster = exportedRosterRef.current
    if (!organizationId || users.length === 0) {
      setLoaded(null)
      return
    }
    if (reviewIds.length === 0 && exportedRoster.length === 0 && !hasAdminAccess(user)) {
      setLoaded('empty')
      return
    }
    let cancelled = false
    // A new attempt clears a previous failure (shown as '–' while it loads); every other state stays until it answers.
    setLoaded((previous) => (previous === 'failed' ? null : previous))
    Promise.all([
      reviewIds.length > 0
        ? // Rulebook 1.66.0 §8 (owner decision 17 Nov): every stored sheet, however old — never only the recent runs.
          loadTimesheetQueueSheets({
            organizationId,
            userIds: reviewIds,
            timeZone,
            // Admins: the recent runs are also read by `weekStartKey`, so a sheet stored under another spelling of an id
            // (or with no `userId`) stays listed for them (guardrail 3).
            recentRunStartDayKeys: hasAdminAccess(user) ? runs.map((run) => periodStartKey(run.start, timeZone)) : undefined,
          })
        : Promise.resolve([] as TimesheetQueueStoredSheet[]),
      // 17 Nov follow-up: the same Exported list as User Timesheets → Exported (former ids matched; admins also count
      // a sheet whose person is nobody in the organisation).
      loadExportedTimesheetHistory({
        organizationId,
        users: exportedRoster,
        roster: users,
        includeUnresolved: hasAdminAccess(user),
        // Review of #386 (S5): "Unknown person" rows only once the roster has loaded.
        rosterLoaded,
        viewerIsOperative: isOperativeMode(user),
        viewerIsAdmin: hasAdminAccess(user),
      }),
    ])
      .then(([sheets, exportedRows]) => {
        if (cancelled) return
        setLoaded({ sheets, exportedCount: exportedRows.length })
      })
      .catch(() => {
        // Rulebook 1.66.0 §8: a failed load is shown (the message User Timesheets uses), never 0 / 0 / 0.
        if (!cancelled) setLoaded('failed')
      })
    return () => {
      cancelled = true
    }
    // `runs` is read through `runsKey`, the people through `queryKey` (ids), the roster through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, users.length === 0, queryKey, runsKey, timeZone, repairs, retries])

  useEffect(() => {
    if (loaded !== 'failed' || typeof window === 'undefined') return
    const retry = () => setRetries((value) => value + 1)
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('focus', retry)
    }
  }, [loaded])

  const catalogueRef = useRef(changeCatalogue)
  catalogueRef.current = changeCatalogue
  // Rulebook 1.66.0 §8: the same rows User Timesheets lists — every stored sheet however old (`userTimesheetQueue`), a
  // reopened sheet where `timesheetListBucket` now puts it (an old run whose bookings are not loaded: not changed).
  const queueRows = useMemo(() => {
    if (loaded == null || loaded === 'empty' || loaded === 'failed') return []
    return userTimesheetQueueRows({
      viewer: user,
      users,
      sheets: loaded.sheets,
      invoicing,
      timeZone,
      bookingChange: (member, draft, run) => periodBookingChanges(catalogueRef.current, member, draft, run),
    })
    // The catalogue is read through a ref; re-run when its bookings or load state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user, users, invoicing, timeZone, changeCatalogue.bookings, changeCatalogue.managerSiteBookings, changeCatalogue.liveLoaded])
  const stats = useMemo(() => {
    if (loaded == null || loaded === 'failed') return null
    if (loaded === 'empty') return { awaiting: 0, signed: 0, exported: 0 }
    return {
      awaiting: queueRows.filter((row) => row.bucket === 'awaiting').length,
      signed: queueRows.filter((row) => row.bucket === 'signed').length,
      exported: loaded.exportedCount,
    }
  }, [loaded, queueRows])

  // Owner item 5 (17 Nov follow-up): the hub repairs frozen-empty snapshots of the recent pay runs in the background
  // too (`useSnapshotAutoRepair`), once the bookings of the window and the pay inputs have loaded.
  const repairSheets = useMemo<RepairSheet[]>(() => {
    const recent = new Set(runs.map((run) => payRunKey(run, timeZone)))
    return queueRows
      .filter((row) => row.bucket !== 'exported' && recent.has(payRunKey(row.period, timeZone)))
      .map((row) => ({ member: row.member, period: row.period, draft: row.draft, documentId: timesheetSourceDocumentId(row.draft) }))
    // `runs` is read through `runsKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueRows, runsKey, timeZone])
  useSnapshotAutoRepair({
    organizationId,
    viewer: user,
    catalogue: changeCatalogue,
    sheets: repairSheets,
    ready: repairReady,
    payStatusOf,
    onRepaired: () => setRepairs((value) => value + 1),
  })

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
      {loaded === 'failed' ? (
        <p className="pu-err" role="alert" style={{ marginTop: 6 }}>
          {TIMESHEETS_LOAD_FAILED_MESSAGE}
        </p>
      ) : null}
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

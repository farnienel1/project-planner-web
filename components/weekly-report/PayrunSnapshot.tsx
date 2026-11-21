'use client'

/**
 * Rulebook 1.33.0 §7: Weekly report → Payrun Snapshot (admins only, `canOpenWeeklyReport`). A period picker (current
 * PAYE period, current payment run period, custom range) and one row per person with their Timesheet, Overtime,
 * Expenses and Price work state. Every row, label, colour and link target is `payrunSnapshotRows` /
 * `payrunSnapshotPeriods`; this component only draws them. Read-only, no export.
 */
import Link from 'next/link'
import { PAY_PROFILES_FAILED_MESSAGE, retryPayProfiles, usePayProfilesStatus, usePayStatusOf } from '@/lib/pay/usePayProfilesStatus'
import { reportGatePeople, reportPayGate } from '@/lib/pay/reportPayGate'
import { useEffect, useMemo, useState } from 'react'
import {
  PAYRUN_SNAPSHOT_COLUMNS,
  PAYRUN_SNAPSHOT_CUSTOM_INVALID_MESSAGE,
  PAYRUN_SNAPSHOT_EMPLOYMENT_NOTE,
  PAYRUN_SNAPSHOT_EMPTY_MESSAGE,
  PAYRUN_SNAPSHOT_LABEL,
  PAYRUN_SNAPSHOT_PERIOD_LABELS,
  payrunSnapshotCustomPeriod,
  payrunSnapshotPeriods,
  type PayrunSnapshotCell,
  type PayrunSnapshotPeriodKind,
  type PayrunSnapshotTone,
} from '@/lib/canonical'
import { dateFromDayKeyInZone, dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { periodBookingChanges, type BookingChangeCatalogue } from '@/lib/timesheets/timesheetBookingChanges'
import { DEFAULT_MY_SCHEDULE, DEFAULT_PAYROLL_POLICY, type MyScheduleOptions, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import type { PayrollTimePolicyState } from '@/lib/canonical'
import { overtimeBookingInputs } from '@/lib/overtime/overtimeData'
import { loadPayrunSnapshotInputs, payrunSnapshotHref, payrunSnapshotRowsFor } from '@/lib/weekly-report/payrunSnapshotData'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Booking, Operative, Project, User } from '@/types'

const TONE_HUE: Record<PayrunSnapshotTone, string | undefined> = {
  neutral: undefined,
  good: 'green',
  warn: 'warn',
  blocked: 'red',
}

function SnapshotCell({ cell }: { cell: PayrunSnapshotCell }) {
  const hue = TONE_HUE[cell.tone]
  const style = cell.tone === 'blocked' ? { background: 'var(--h)', color: '#fff', fontWeight: 600 } : hue ? { background: 'var(--ht)', color: 'var(--h)', fontWeight: 600 } : undefined
  const body = cell.link ? (
    <Link href={payrunSnapshotHref(cell.link)} style={{ color: 'inherit', textDecoration: 'underline' }}>
      {cell.label}
    </Link>
  ) : (
    cell.label
  )
  return (
    <td data-hue={hue} style={style}>
      {body}
    </td>
  )
}

export function PayrunSnapshot({
  organizationId,
  organization,
  users,
  timeZone,
  bookings,
  managerSiteBookings,
  projects,
  smallWorks,
  operatives,
  changeInputs,
}: {
  /**
   * Rulebook 1.47.0 (review #325 item 3): what a sheet's booking changes are read from — the organisation's working
   * hours, schedule options and rate history, and whether the loaded bookings hold a pay run from a day on. Missing =
   * the Timesheet cells are as before 1.47.0.
   */
  changeInputs?: {
    payrollPolicy?: OrgPayrollTimePolicy | null
    payrollPolicyState?: PayrollTimePolicyState | null
    scheduleOptions?: MyScheduleOptions | null
    history?: OperativeDayRateHistoryCollection | null
    coversFrom: (startDayKey: string) => boolean
  }
  organizationId: string
  /** The organisation document (PAYE payday history and invoicing settings). */
  organization: unknown
  users: User[]
  timeZone: string
  /** 1.33.0: every booking (the weekly report loads full history), for the overtime reports' out-of-date check. */
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  projects: Project[]
  smallWorks: Project[]
  operatives: Operative[]
}) {
  const todayKey = dayKeyInZone(new Date(), timeZone)
  const periods = useMemo(() => payrunSnapshotPeriods({ organization, todayKey, timeZone }), [organization, todayKey, timeZone])
  const [kind, setKind] = useState<PayrunSnapshotPeriodKind>(periods.paye ? 'paye' : periods.paymentRun ? 'paymentRun' : 'custom')
  const [customStart, setCustomStart] = useState(periods.paye?.start ?? todayKey)
  const [customEnd, setCustomEnd] = useState(periods.paye?.end ?? todayKey)
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadPayrunSnapshotInputs>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(null)
    setError(null)
    loadPayrunSnapshotInputs({ organizationId, users, timeZone })
      .then((result) => {
        if (!cancelled) setLoaded(result)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The snapshot could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, users, timeZone])

  const period = kind === 'paye' ? periods.paye : kind === 'paymentRun' ? periods.paymentRun : payrunSnapshotCustomPeriod(customStart, customEnd)
  const overtimeBookings = useMemo(
    () => overtimeBookingInputs({ bookings, managerSiteBookings, projects, smallWorks, timeZone }),
    [bookings, managerSiteBookings, projects, smallWorks, timeZone]
  )
  const operativeRows = useMemo(() => operatives.map((row) => ({ id: row.id, email: row.email ?? null })), [operatives])
  // Rulebook 1.47.0: each signed sheet's booking changes, from the same rule as User Timesheets (`periodBookingChanges`).
  const changeCatalogue: BookingChangeCatalogue | null = changeInputs
    ? {
        users,
        liveLoaded: true,
        coversPeriod: (p) => changeInputs.coversFrom(dayKeyInZone(p.start, timeZone)),
        bookings,
        managerSiteBookings,
        operatives,
        projects,
        smallWorks,
        payrollPolicy: changeInputs.payrollPolicy ?? DEFAULT_PAYROLL_POLICY,
        payrollPolicyState: changeInputs.payrollPolicyState ?? null,
        scheduleOptions: changeInputs.scheduleOptions ?? DEFAULT_MY_SCHEDULE,
        history: changeInputs.history ?? emptyDayRateHistory(),
        timeZone,
      }
    : null
  // Pay strip: each person's employment type is pay data — wait for the pay laid over the roster (privatePay on).
  // Final check #342 item 3: built only when every person in it has known pay — refused, naming who is still loading or
  // could not be read (`reportPayGate`), never priced from a stripped record.
  const payStatusOrg = usePayProfilesStatus(organizationId)
  const payStatusOf = usePayStatusOf(organizationId)
  // Review #342: the rows are chosen without pay (active people, plus anyone else with records in the period —
  // `payrunSnapshotRows`), so they are worked out once the organisation's pay status is ready, and only the people who
  // have a row are waited for. Someone with no row (offline, added since the last read) never blocks the Snapshot.
  const orgPayReady = payStatusOrg === 'ready'
  const candidateRows = useMemo(
    () =>
      orgPayReady && loaded && period
        ? payrunSnapshotRowsFor({
            loaded,
            users,
            organization,
            period,
            timeZone,
            bookings: overtimeBookings,
            operatives: operativeRows,
            bookingsChange: changeCatalogue
              ? (sheet) => {
                  const person = users.find((user) => user.id === sheet.userId)
                  if (!person || !sheet.draft) return null
                  return periodBookingChanges(changeCatalogue, person, sheet.draft, {
                    start: dateFromDayKeyInZone(sheet.startDayKey, timeZone),
                    end: dateFromDayKeyInZone(sheet.endDayKey, timeZone),
                  })
                }
              : undefined,
          })
        : [],
    [orgPayReady, loaded, period?.start, period?.end, users, organization, timeZone, overtimeBookings, operativeRows, bookings, managerSiteBookings, changeInputs] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const rowPeople = useMemo(() => reportGatePeople(users, candidateRows.map((row) => row.personId)), [candidateRows, users])
  const payGate = reportPayGate({
    organizationStatus: payStatusOrg,
    people: rowPeople,
    statusOf: payStatusOf,
    nameOf: (person) => `${person.firstName ?? ''} ${person.surname ?? ''}`.trim() || person.email || person.id,
  })
  const payStatus = payGate.status
  const payReady = payStatus === 'ready'
  const rows = payReady ? candidateRows : []

  const choice = (value: PayrunSnapshotPeriodKind, disabled: boolean, sub: string | null) => (
    <button key={value} type="button" className={kind === value ? 'on' : ''} disabled={disabled} title={sub ?? undefined} onClick={() => setKind(value)}>
      {PAYRUN_SNAPSHOT_PERIOD_LABELS[value]}
    </button>
  )

  return (
    <section className="card overflow-hidden" data-hue="rep">
      <div className="card-h">
        <h2 className="h2">{PAYRUN_SNAPSHOT_LABEL}</h2>
      </div>
      <div className="card-b stack" style={{ gap: 12 }}>
        <div className="seg">
          {choice('paye', !periods.paye, periods.payeMessage)}
          {choice('paymentRun', !periods.paymentRun, periods.paymentRunMessage)}
          {choice('custom', false, null)}
        </div>
        {kind === 'custom' ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[13px] font-medium">
              Start
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-1 block rounded-lg border border-(--line2) px-3 py-2 text-sm" />
            </label>
            <label className="text-[13px] font-medium">
              End
              <input type="date" min={customStart} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-1 block rounded-lg border border-(--line2) px-3 py-2 text-sm" />
            </label>
          </div>
        ) : null}
        <p className="muted small">
          {period ? period.label : kind === 'custom' ? PAYRUN_SNAPSHOT_CUSTOM_INVALID_MESSAGE : kind === 'paye' ? periods.payeMessage : periods.paymentRunMessage}
          {period ? ` · ${PAYRUN_SNAPSHOT_EMPLOYMENT_NOTE}` : ''}
        </p>
        {error ? <p className="banner" data-hue="red">{error}</p> : null}
        {(!loaded || payStatus === 'loading') && !error ? (
          <p className="muted small">
            {loaded && payGate.message ? payGate.message : 'Loading…'}{' '}
            {loaded && payGate.message ? (
              <button type="button" className="btn" onClick={() => retryPayProfiles(organizationId, 'ready')}>
                Retry
              </button>
            ) : null}
          </p>
        ) : null}
        {payStatus === 'failed' && !error ? (
          <p className="small" style={{ color: 'var(--red)' }}>
            {payGate.message ?? PAY_PROFILES_FAILED_MESSAGE}{' '}
            <button type="button" className="btn" onClick={() => retryPayProfiles(organizationId, 'ready')}>
              Retry
            </button>
          </p>
        ) : null}
        {payReady && loaded && period && rows.length === 0 ? <p className="muted small">{PAYRUN_SNAPSHOT_EMPTY_MESSAGE}</p> : null}
        {payReady && loaded && period && rows.length > 0 ? (
          <div className="tablewrap">
            <table className="t">
              <thead>
                <tr>
                  {PAYRUN_SNAPSHOT_COLUMNS.map((title) => (
                    <th key={title}>{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.personId}>
                    <td>
                      {row.name}
                      {!row.active ? <span className="muted small"> · not active</span> : null}
                    </td>
                    <td>{row.levelLabel}</td>
                    <td>
                      {row.employmentLabel}
                      {row.employmentNote ? <div className="muted small">{row.employmentNote}</div> : null}
                    </td>
                    <SnapshotCell cell={row.cells.timesheet} />
                    <SnapshotCell cell={row.cells.overtime} />
                    <SnapshotCell cell={row.cells.expenses} />
                    <SnapshotCell cell={row.cells.priceWork} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}

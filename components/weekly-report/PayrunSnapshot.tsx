'use client'

/**
 * Rulebook 1.33.0 §7: Weekly report → Payrun Snapshot (admins only, `canOpenWeeklyReport`). A period picker (current
 * PAYE period, current payment run period, custom range) and one row per person with their Timesheet, Overtime,
 * Expenses and Price work state. Every row, label, colour and link target is `payrunSnapshotRows` /
 * `payrunSnapshotPeriods`; this component only draws them. Read-only, no export.
 */
import Link from 'next/link'
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
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { loadPayrunSnapshotInputs, payrunSnapshotHref, payrunSnapshotRowsFor } from '@/lib/weekly-report/payrunSnapshotData'
import type { User } from '@/types'

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
}: {
  organizationId: string
  /** The organisation document (PAYE payday history and invoicing settings). */
  organization: unknown
  users: User[]
  timeZone: string
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
  const rows = useMemo(
    () => (loaded && period ? payrunSnapshotRowsFor({ loaded, users, organization, period, timeZone }) : []),
    [loaded, period?.start, period?.end, users, organization, timeZone] // eslint-disable-line react-hooks/exhaustive-deps
  )

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
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-1 block rounded-lg border border-[var(--line2)] px-3 py-2 text-sm" />
            </label>
            <label className="text-[13px] font-medium">
              End
              <input type="date" min={customStart} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-1 block rounded-lg border border-[var(--line2)] px-3 py-2 text-sm" />
            </label>
          </div>
        ) : null}
        <p className="muted small">
          {period ? period.label : kind === 'custom' ? PAYRUN_SNAPSHOT_CUSTOM_INVALID_MESSAGE : kind === 'paye' ? periods.payeMessage : periods.paymentRunMessage}
          {period ? ` · ${PAYRUN_SNAPSHOT_EMPLOYMENT_NOTE}` : ''}
        </p>
        {error ? <p className="banner" data-hue="red">{error}</p> : null}
        {!loaded && !error ? <p className="muted small">Loading…</p> : null}
        {loaded && period && rows.length === 0 ? <p className="muted small">{PAYRUN_SNAPSHOT_EMPTY_MESSAGE}</p> : null}
        {loaded && period && rows.length > 0 ? (
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

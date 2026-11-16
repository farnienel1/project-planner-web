'use client'

/**
 * Web Annual leave report (owner decision 16 Nov; parity with the iOS report opened from Manage Users → Edit user).
 *
 * One person's approved annual leave in one organisation leave year: the rulebook's `leaveReportRows` (rulebook 1.22.0
 * §9) over the leave records the page already loaded, the years from `leaveReportYears`, the region's bank holidays as
 * non-working days. The total equals `annualLeaveBalance.taken` for the same year. Nothing is written.
 *
 * Who may open it is decided by the page that shows the button: My leave (the person themself) and a person's page in
 * Annual leave → Team (the people `annualLeaveTeamPeople` lists for the viewer, gated by `canViewAnnualLeaveAdjustments`
 * when the person has an account).
 */

import { useEffect, useId, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  annualLeaveReport,
  annualLeaveReportDaysText,
  annualLeaveReportYears,
  annualLeaveReportYearTitle,
} from '@/lib/annualLeave/annualLeaveReport'
import { calendarDateOfKey } from '@/lib/orgTime/organizationWeek'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import type { HolidayBooking } from '@/types'
import { useOrgBankHolidays } from './useOrgBankHolidays'

export const ANNUAL_LEAVE_REPORT_TITLE = 'Annual leave report'

function dayText(key: string): string {
  // A day key is a calendar date in the organisation zone; print that date, never the browser's day.
  return format(calendarDateOfKey(key), 'd MMM yyyy')
}

export function AnnualLeaveReportButton(props: {
  personName: string
  personSubtitle?: string
  bookings: ReadonlyArray<HolidayBooking>
  personIds: ReadonlyArray<string>
  startMonth: number
  employmentStartDayKey?: string | null
  /** False until the organisation's leave-year settings have loaded (never a report on the default year first). */
  ready?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={props.ready === false}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700" aria-hidden="true">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
            </svg>
          </span>
          {ANNUAL_LEAVE_REPORT_TITLE}
        </span>
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open ? <AnnualLeaveReportDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function AnnualLeaveReportDialog({
  personName,
  personSubtitle,
  bookings,
  personIds,
  startMonth,
  employmentStartDayKey,
  onClose,
}: {
  personName: string
  personSubtitle?: string
  bookings: ReadonlyArray<HolidayBooking>
  personIds: ReadonlyArray<string>
  startMonth: number
  employmentStartDayKey?: string | null
  onClose: () => void
}) {
  const titleId = useId()
  const timeZone = organizationZoneOr(useOrganizationTimeZone())
  const todayDayKey = dayKeyInZone(new Date(), timeZone)
  const years = useMemo(
    () => annualLeaveReportYears({ bookings, employmentStartDayKey, todayDayKey, startMonth, timeZone }),
    [bookings, employmentStartDayKey, todayDayKey, startMonth, timeZone]
  )
  const [selectedStart, setSelectedStart] = useState<string | null>(null)
  const year = years.find((row) => row.startDayKey === selectedStart) ?? years[0] ?? null

  // The region's bank holidays for the year shown (a bank holiday inside a multi-day record is not a leave day).
  const bank = useOrgBankHolidays(
    calendarDateOfKey(year?.startDayKey ?? todayDayKey),
    calendarDateOfKey(year?.endDayKey ?? todayDayKey)
  )
  const bankDayKeys = useMemo(() => bank.holidays.map((holiday) => holiday.date), [bank.holidays])
  const report = useMemo(
    () =>
      year
        ? annualLeaveReport({ bookings, personIds, onDayKey: year.startDayKey, startMonth, timeZone, nonWorkingDayKeys: bankDayKeys })
        : null,
    [year, bookings, personIds, startMonth, timeZone, bankDayKeys]
  )
  const yearTitle = year ? annualLeaveReportYearTitle(year) : 'this year'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[var(--navy,#0f1f3d)] px-4 pb-4 pt-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{ANNUAL_LEAVE_REPORT_TITLE}</p>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-semibold text-white hover:bg-white/10">
              Done
            </button>
          </div>
          <h2 id={titleId} className="mt-1 text-lg font-bold text-white">
            {personName}
          </h2>
          {personSubtitle ? <p className="truncate text-sm text-white/70">{personSubtitle}</p> : null}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Leave year">
            {years.map((row) => {
              const selected = row.startDayKey === year?.startDayKey
              return (
                <button
                  key={row.startDayKey}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedStart(row.startDayKey)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold tabular-nums ${
                    selected ? 'bg-white text-slate-900' : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {annualLeaveReportYearTitle(row)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {!bank.loaded ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Summary</p>
                <div className="card pad flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-700" aria-hidden="true">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="4" />
                      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                    </svg>
                  </span>
                  <p className="text-base font-semibold tabular-nums text-slate-900">
                    {annualLeaveReportDaysText(report?.totalDays ?? 0)} approved in {yearTitle}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Approved annual leave</p>
                {!report || report.rows.length === 0 ? (
                  <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    No approved annual leave for {yearTitle}.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {report.rows.map((row) => (
                      <li key={row.id} className="card pad">
                        <p className="text-sm font-semibold text-slate-900">
                          {dayText(row.startDayKey)} – {dayText(row.endDayKey)}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                          {annualLeaveReportDaysText(row.days)}
                          {row.timeSlot && row.timeSlot !== 'FULL DAY' ? ` · ${row.timeSlot}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

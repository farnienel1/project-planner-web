/**
 * iOS parity source: Views/MyScheduleView.swift stripe rows + Total hours card.
 */

'use client'

import { estimatedWorkedHours, overviewFormatHours, parseMinutes } from '@/lib/daily-overview/buildDailyOverview'
import { bookingPayrollHours, formatOvertimeEquation } from '@/lib/scheduling/paidHours'
import { leaveRecordDayKeys, workedHoursSplit } from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'
import type { HolidayBooking } from '@/types'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { Booking } from '@/types'

const TRACK_START = 6 * 60
const TRACK_END = 18 * 60
const TRACK_SPAN = TRACK_END - TRACK_START

export function myScheduleStripeClass(type?: ManagerLocationType | string): string {
  switch (type) {
    case 'office':
      return 'bg-[var(--blue)]'
    case 'working_from_home':
      return 'bg-[#5349B7]'
    case 'site_survey':
      return 'bg-[#854F0B]'
    case 'project':
    case 'small_work':
      return 'bg-[#0F6E56]'
    case 'custom':
      return 'bg-[#8A94A6]'
    default:
      return 'bg-[#0F6E56]'
  }
}

function slotClockRange(
  timeSlot?: string,
  workStartTime?: string,
  workEndTime?: string,
  policy?: OrgPayrollTimePolicy
): { start: number; end: number; label: string } {
  const startMin = parseMinutes(workStartTime)
  const endMin = parseMinutes(workEndTime)
  const stdStart = parseMinutes(policy?.standardDayStart) ?? 7 * 60 + 30
  const stdEnd = parseMinutes(policy?.standardDayEnd) ?? 16 * 60
  const mid = Math.floor((stdStart + stdEnd) / 2)
  if (startMin != null && endMin != null && endMin > startMin) {
    return { start: startMin, end: endMin, label: `${workStartTime} – ${workEndTime}` }
  }
  const slot = String(timeSlot || '').toUpperCase().replace(/_/g, ' ')
  if (slot === 'AM' || slot.includes('MORNING')) {
    return { start: stdStart, end: mid, label: `${minsToClock(stdStart)} – ${minsToClock(mid)}` }
  }
  if (slot === 'PM' || slot.includes('AFTERNOON')) {
    return { start: mid, end: stdEnd, label: `${minsToClock(mid)} – ${minsToClock(stdEnd)}` }
  }
  return { start: stdStart, end: stdEnd, label: `${minsToClock(stdStart)} – ${minsToClock(stdEnd)}` }
}

function minsToClock(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function myScheduleClockSubtitle(
  input: { timeSlot?: string; workStartTime?: string; workEndTime?: string; isBreakRemoved?: boolean; date?: Date },
  policy?: OrgPayrollTimePolicy
): string {
  const range = slotClockRange(input.timeSlot, input.workStartTime, input.workEndTime, policy)
  const hours = estimatedWorkedHours({ ...input, policy })
  return `${range.label} · ${overviewFormatHours(hours)} hrs`
}

export function MyScheduleStripeRow({
  stripeClass,
  title,
  subtitle,
  otChip,
  onEdit,
  onDelete,
}: {
  stripeClass: string
  title: string
  subtitle: string
  otChip?: string | null
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="overflow-hidden rounded-[14px] bg-[var(--card)] shadow-[var(--sh)]">
      <div className="flex items-stretch">
        <div className={`w-1 shrink-0 ${stripeClass}`} />
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--ink)]">{title}</p>
              <p className="mt-0.5 text-[12px] font-medium text-[var(--ink3)]">{subtitle}</p>
            </div>
            {otChip ? (
              <span className="shrink-0 rounded-full bg-[#FAEED9] px-2 py-1 text-[10px] font-semibold text-[#854F0B]">
                {otChip}
              </span>
            ) : null}
          </div>
          {onEdit || onDelete ? (
            <div className="mt-2 flex items-center">
              {onEdit ? (
                <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-[var(--blue)]">
                  Edit
                </button>
              ) : null}
              <span className="flex-1" />
              {onDelete ? (
                <button type="button" onClick={onDelete} className="grid h-8 w-8 place-items-center text-[var(--ink3)]" aria-label="Delete booking">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5h6v2m-7 4v8m4-8v8m4-8v8M8 7l1 12h6l1-12" />
                  </svg>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function clampTrack(mins: number): number {
  return Math.max(TRACK_START, Math.min(TRACK_END, mins))
}

/**
 * iOS `annualLeaveDisplayLabel(on:)`: the person's leave on that day (not declined).
 * Pending leave says so. A multi-day record follows `leaveRecordDayKeys`.
 */
export function myScheduleAnnualLeaveLabel(
  holidays: ReadonlyArray<HolidayBooking>,
  day: Date,
  timeZone?: string
): string | null {
  const key = dayKey(day, timeZone)
  const match = holidays
    .filter((holiday) => holiday.status !== 'rejected')
    .filter((holiday) =>
      leaveRecordDayKeys(
        { startDayKey: dayKey(holiday.startDate, timeZone), endDayKey: dayKey(holiday.endDate, timeZone) },
        timeZone
      ).includes(key)
    )
    .sort((a, b) => (a.status === b.status ? a.startDate.getTime() - b.startDate.getTime() : a.status === 'approved' ? -1 : 1))[0]
  if (!match) return null
  const slot = match.timeSlot === 'AM' ? 'AM' : match.timeSlot === 'PM' ? 'PM' : 'Full Day'
  return match.status === 'pending' ? `Pending annual leave - ${slot}` : `Annual Leave - ${slot}`
}

export function MyScheduleTotalHoursCard({
  bookings,
  policy,
  annualLeaveLabel,
  date,
}: {
  bookings: Array<{ timeSlot?: string; workStartTime?: string; workEndTime?: string; isBreakRemoved?: boolean; otMultiplierOverride?: number | null }>
  policy: OrgPayrollTimePolicy
  annualLeaveLabel?: string | null
  /** The day shown, so weekend all-hours rules apply (`payrollHoursResult`). */
  date?: Date
}) {
  // Same figures as Daily Overview: `payrollHoursResult` → `workedHoursSplit` (never multiplied).
  const results = bookings.map((b) => bookingPayrollHours({ ...b, policy, date }))
  const worked = results.reduce((sum, r) => sum + r.workedHours, 0)
  const ot = results.reduce((sum, r) => sum + workedHoursSplit(r).outsideWorkedHours, 0)
  const otMultiplier =
    results.filter((r) => r.outsideHours > 0).reduce((max, r) => Math.max(max, r.outsideMultiplier), 0) ||
    policy.weekdayOutsideStandardMultiplier ||
    1.5
  const std = policy.standardPaidHours || 8
  const ticks = ['6:00', '9:00', '12:00', '15:00', '18:00']

  return (
    <div className="card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-[var(--ink)]">Total hours</p>
          <p className="text-[11px] text-[var(--ink3)]">
            Standard {policy.standardDayStart}–{policy.standardDayEnd} · {overviewFormatHours(std)} hrs
          </p>
        </div>
        {annualLeaveLabel ? (
          <span className="rounded-full bg-[#FAEED9] px-2 py-1 text-[10px] font-semibold text-[#9E3B12]">
            {annualLeaveLabel.startsWith('Pending') ? 'Pending leave' : 'Annual Leave'}
          </span>
        ) : (
          <div className="text-right">
            <p className="text-[18px] font-medium text-[var(--ink)]">{overviewFormatHours(worked)}</p>
            <p className="text-[10px] font-medium text-[var(--ink3)]">hrs worked</p>
            {ot > 0.05 ? (
              <p className="text-[10px] font-semibold text-[#854F0B]">
                OT {formatOvertimeEquation(ot, otMultiplier)}
              </p>
            ) : null}
          </div>
        )}
      </div>
      <div className="relative mt-3 h-7 overflow-hidden rounded-[10px] bg-[#F2F3F5]">
        {annualLeaveLabel ? (
          <div className="absolute inset-0 bg-gradient-to-r from-[#993556] to-[#C96B4A]" />
        ) : (
          bookings.map((b, index) => {
            const range = slotClockRange(b.timeSlot, b.workStartTime, b.workEndTime, policy)
            const left = ((clampTrack(range.start) - TRACK_START) / TRACK_SPAN) * 100
            const width = Math.max(4, ((clampTrack(range.end) - clampTrack(range.start)) / TRACK_SPAN) * 100)
            return (
              <div
                key={index}
                className="absolute inset-y-0 rounded-[10px] bg-gradient-to-r from-[#185FA5] to-[#378ADD]"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            )
          })
        )}
        {annualLeaveLabel ? (
          <p className="relative z-10 flex h-full items-center justify-center text-[11px] font-semibold text-white">
            {annualLeaveLabel}
          </p>
        ) : null}
      </div>
      <div className="mt-1.5 flex">
        {ticks.map((tick) => (
          <span key={tick} className="flex-1 text-center text-[9px] text-[var(--ink3)]">
            {tick}
          </span>
        ))}
      </div>
    </div>
  )
}

export function managerBookingToHoursInput(booking: ManagerSiteBooking | Booking) {
  return {
    timeSlot: booking.timeSlot,
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
  }
}

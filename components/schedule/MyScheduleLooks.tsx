/**
 * iOS parity source: Views/MyScheduleView.swift stripe rows + Total hours card.
 */

'use client'

import { estimatedPaidHours, overviewFormatHours, parseMinutes } from '@/lib/daily-overview/buildDailyOverview'
import { formatOvertimeEquation } from '@/lib/scheduling/paidHours'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { Booking } from '@/types'

const TRACK_START = 6 * 60
const TRACK_END = 18 * 60
const TRACK_SPAN = TRACK_END - TRACK_START

export function myScheduleStripeClass(type?: ManagerLocationType | string): string {
  switch (type) {
    case 'office':
      return 'bg-[#185FA5]'
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
  input: { timeSlot?: string; workStartTime?: string; workEndTime?: string },
  policy?: OrgPayrollTimePolicy
): string {
  const range = slotClockRange(input.timeSlot, input.workStartTime, input.workEndTime, policy)
  const hours = estimatedPaidHours(input)
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
    <div className="overflow-hidden rounded-xl border border-ios-border bg-white">
      <div className="flex items-stretch">
        <div className={`w-1 shrink-0 ${stripeClass}`} />
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ios-ink">{title}</p>
              <p className="mt-0.5 text-[12px] font-medium text-ios-muted">{subtitle}</p>
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
                <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-[#185FA5]">
                  Edit
                </button>
              ) : null}
              <span className="flex-1" />
              {onDelete ? (
                <button type="button" onClick={onDelete} className="grid h-8 w-8 place-items-center text-ios-muted" aria-label="Delete booking">
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

export function MyScheduleTotalHoursCard({
  bookings,
  policy,
  annualLeaveLabel,
}: {
  bookings: Array<{ timeSlot?: string; workStartTime?: string; workEndTime?: string }>
  policy: OrgPayrollTimePolicy
  annualLeaveLabel?: string | null
}) {
  const paid = bookings.reduce((sum, b) => sum + estimatedPaidHours(b), 0)
  const std = policy.standardPaidHours || 8
  const ot = Math.max(0, paid - std)
  const ticks = ['6:00', '9:00', '12:00', '15:00', '18:00']

  return (
    <div className="rounded-2xl border border-ios-border bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-ios-ink">Total hours</p>
          <p className="text-[11px] text-ios-muted">
            Standard {policy.standardDayStart}–{policy.standardDayEnd} · {overviewFormatHours(std)} hrs
          </p>
        </div>
        {annualLeaveLabel ? (
          <span className="rounded-full bg-[#FAEED9] px-2 py-1 text-[10px] font-semibold text-[#9E3B12]">Annual Leave</span>
        ) : (
          <div className="text-right">
            <p className="text-[18px] font-medium text-ios-ink">{overviewFormatHours(paid)}</p>
            <p className="text-[10px] font-medium text-ios-muted">hrs paid</p>
            {ot > 0.05 ? (
              <p className="text-[10px] font-semibold text-[#854F0B]">
                OT {formatOvertimeEquation(ot, policy.weekdayOutsideStandardMultiplier || 1.5)}
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
          <span key={tick} className="flex-1 text-center text-[9px] text-ios-muted">
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

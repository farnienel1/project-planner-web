'use client'

import { useMemo, useRef } from 'react'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { parseHhMm } from '@/lib/ios-parity/londonTime'
import { bookingPayrollHours, formatHoursLabel, hoursBreakdown } from '@/lib/scheduling/paidHours'
import {
  bookingDayKey,
  payrollDayWindowsForDate,
  policyForBookingDate,
  unpaidBreakAppliesOnDate,
  weekendBreakdownForDates,
  weekdayExplanationForDate,
} from '@/lib/scheduling/bookingSlotRules'
import { BookingDayBreakdownRows } from '@/components/scheduling/BookingDayBreakdownRows'
import { BookingHoursExplanationList } from '@/components/scheduling/BookingHoursExplanation'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]
const AXIS = [0, 6, 12, 18, 24]
const DAY_MINUTES = 24 * 60
const SNAP = 15

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parse(hhmm: string): { hour: number; minute: number } {
  const parts = hhmm.trim().split(':')
  const hour = Math.max(0, Math.min(23, Number(parts[0]) || 0))
  const rawMin = Number(parts[1]) || 0
  const minute = MINUTES.reduce((best, value) => (Math.abs(value - rawMin) < Math.abs(best - rawMin) ? value : best), 0)
  return { hour, minute }
}

function format(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

function minutesToValue(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES - SNAP, Math.round(minutes / SNAP) * SNAP))
  return format(Math.floor(clamped / 60), clamped % 60)
}

function fraction(minutes: number): number {
  return Math.max(0, Math.min(1, minutes / DAY_MINUTES))
}

export function HoursTimelinePicker({
  start,
  end,
  breakRemoved,
  policy = DEFAULT_PAYROLL_POLICY,
  date,
  dates,
  onStart,
  onEnd,
  onBreak,
  showBreak = true,
}: {
  start: string
  end: string
  breakRemoved: boolean
  policy?: OrgPayrollTimePolicy
  /** Booking day, so Saturday and Sunday use that day's rule. */
  date?: Date
  /** Rulebook 1.18.0: every day the one pair of times is booked on; a weekend selection shows per-day rows. */
  dates?: ReadonlyArray<Date>
  onStart: (value: string) => void
  onEnd: (value: string) => void
  onBreak: (value: boolean) => void
  showBreak?: boolean
}) {
  const startHm = parse(start)
  const endHm = parse(end)
  const startMin = startHm.hour * 60 + startHm.minute
  const endMin = endHm.hour * 60 + endHm.minute
  const valid = endMin > startMin
  const drag = useRef<'start' | 'end' | null>(null)

  // Rulebook 1.19.0: the booking day's own rules — the working hours in effect on it (history first) and, on a
  // Saturday or Sunday, that day's window or every-hour rate and lunch break. Nothing here is a second calculator: the
  // bands are the pay rule's segments (`payrollHoursResult`) and windows (`payrollDayWindows`).
  const day = date ?? dates?.[0]
  const dayPolicy = (day ? policyForBookingDate(day, policy) : null) ?? policy
  const dayKeyOfBooking = day ? bookingDayKey(day) : undefined
  const windows = day
    ? payrollDayWindowsForDate(day, policy)
    : {
        paidWindow: { start: parseHhMm(policy.standardDayStart) ?? 7 * 60 + 30, end: parseHhMm(policy.standardDayEnd) ?? 16 * 60 },
        unpaidBreak:
          policy.breakPaid !== true
            ? { start: parseHhMm(policy.breakWindowStart) ?? 12 * 60, end: parseHhMm(policy.breakWindowEnd) ?? 12 * 60 + 30 }
            : null,
        allHoursMultiplier: null,
      }
  // The "Unpaid break" toggle is offered when any booked day takes an unpaid break off (`unpaidBreakAppliesOnDay`).
  const bookedDays = dates && dates.length > 0 ? dates : day ? [day] : []
  const breakApplies =
    bookedDays.length > 0 ? bookedDays.some((entry) => unpaidBreakAppliesOnDate(entry, policy)) : policy.breakPaid !== true
  const standardStart = windows.paidWindow?.start ?? 0
  const standardEnd = windows.paidWindow?.end ?? 0
  const breakStart = windows.unpaidBreak?.start ?? null
  const breakEnd = windows.unpaidBreak?.end ?? null

  const segments = useMemo(() => {
    if (!valid) return []
    const paid = bookingPayrollHours({
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: start,
      workEndTime: end,
      isBreakRemoved: breakRemoved,
      policy: dayPolicy,
      dayKey: dayKeyOfBooking,
    })
    const out: { kind: 'standard' | 'overtime'; start: number; end: number }[] = []
    for (const row of paid.segments) {
      const lo = parseHhMm(row.clockStart ?? '')
      const hi = parseHhMm(row.clockEnd ?? '')
      if (lo == null || hi == null || hi <= lo) continue
      out.push({ kind: row.kind === 'standardWindow' ? 'standard' : 'overtime', start: lo, end: hi })
    }
    return out
  }, [valid, start, end, breakRemoved, dayPolicy, dayKeyOfBooking])

  const breakdown = hoursBreakdown({
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: start,
    workEndTime: end,
    isBreakRemoved: breakRemoved,
    policy: dayPolicy,
    dayKey: dayKeyOfBooking,
  })

  // Rulebook 1.18.0 (`weekendBookingBreakdown`): a weekend selection shows each day as pay prices it, not one summary.
  const dayRows = valid ? weekendBreakdownForDates(dates ?? (date ? [date] : []), start, end, breakRemoved, policy) : []
  // Rulebook 1.39.0 (`bookingHoursExplanation`): a weekday selection explains its hours the same way (working day,
  // unpaid break, hours at the overtime multiplier). Weekend rows carry their own explanation.
  const weekdayExplanations =
    valid && dayRows.length === 0
      ? (dates ?? (date ? [date] : [])).map((booked) => weekdayExplanationForDate(booked, start, end, breakRemoved, policy))
      : []

  function minutesFromClientX(clientX: number, rect: DOMRect): number {
    const raw = ((clientX - rect.left) / rect.width) * DAY_MINUTES
    return Math.max(0, Math.min(DAY_MINUTES - SNAP, Math.round(raw / SNAP) * SNAP))
  }

  function applyDrag(which: 'start' | 'end', minutes: number) {
    const value = minutesToValue(minutes)
    if (which === 'start') onStart(value)
    else onEnd(value)
  }

  function nearestHandle(minutes: number): 'start' | 'end' {
    const mid = (startMin + (valid ? endMin : startMin + 60)) / 2
    return minutes < mid ? 'start' : 'end'
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">Hours · 00:00 to 24:00</p>
        <div className="rounded-xl bg-[#F2F3F5] px-3 pb-2 pt-3">
          <div
            data-hours-track
            className="relative h-9 cursor-ew-resize touch-none overflow-visible"
            onPointerDown={(event) => {
              const track = event.currentTarget
              const rect = track.getBoundingClientRect()
              const minutes = minutesFromClientX(event.clientX, rect)
              const which = nearestHandle(minutes)
              drag.current = which
              applyDrag(which, minutes)
              track.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (!drag.current) return
              const rect = event.currentTarget.getBoundingClientRect()
              applyDrag(drag.current, minutesFromClientX(event.clientX, rect))
            }}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
          >
            <div className="absolute inset-x-0 top-1.5 h-7 overflow-hidden rounded-lg bg-[#E8EAEE]">
              <div
                className="absolute inset-y-0 rounded-md bg-white/50"
                style={{
                  left: `${fraction(standardStart) * 100}%`,
                  width: `${Math.max(0, fraction(standardEnd) - fraction(standardStart)) * 100}%`,
                }}
              />
              {AXIS.map((label) => (
                <div
                  key={`tick-${label}`}
                  className="absolute inset-y-0 w-px bg-black/[0.08]"
                  style={{ left: `${(label / 24) * 100}%` }}
                />
              ))}
              {segments.map((seg) => {
                const left = fraction(seg.start)
                const width = Math.max(0.01, fraction(seg.end) - left)
                const labelW = width * 100
                return (
                  <div
                    key={`${seg.kind}-${seg.start}`}
                    className="absolute inset-y-0 overflow-hidden rounded-lg"
                    style={{
                      left: `${left * 100}%`,
                      width: `${width * 100}%`,
                      background:
                        seg.kind === 'standard'
                          ? 'linear-gradient(90deg, #185FA5, #378ADD)'
                          : 'linear-gradient(90deg, #FAEEDA, #F2D6A2)',
                    }}
                  >
                    {seg.kind === 'overtime' && labelW > 8 ? (
                      <span className="pl-1.5 text-[9px] font-bold text-[#854F0B]">
                        {windows.allHoursMultiplier != null ? `×${windows.allHoursMultiplier}` : 'OT'}
                      </span>
                    ) : null}
                    {seg.kind === 'standard' && labelW > 16 ? (
                      <span className="pl-1.5 text-[10px] font-medium text-white">Standard</span>
                    ) : null}
                  </div>
                )
              })}
              {!breakRemoved &&
              valid &&
              breakStart != null &&
              breakEnd != null &&
              breakEnd > breakStart &&
              breakStart < endMin &&
              breakEnd > startMin ? (
                <div
                  className="absolute inset-y-1 rounded-sm bg-white/50"
                  style={{
                    left: `${fraction(Math.max(startMin, breakStart)) * 100}%`,
                    width: `${Math.max(0.4, fraction(Math.min(endMin, breakEnd)) - fraction(Math.max(startMin, breakStart))) * 100}%`,
                  }}
                />
              ) : null}
            </div>
            <Handle minutes={startMin} label={format(startHm.hour, startHm.minute)} side="start" />
            <Handle minutes={valid ? endMin : startMin + 60} label={format(endHm.hour, endHm.minute)} side="end" />
          </div>
          <div className="relative mt-3 h-3">
            {AXIS.map((label, index) => {
              const last = index === AXIS.length - 1
              const transform = index === 0 ? 'translateX(0)' : last ? 'translateX(-100%)' : 'translateX(-50%)'
              return (
                <span
                  key={label}
                  className="absolute top-0 text-[10px] font-medium tabular-nums text-[#6C6C72]"
                  style={{ left: `${(label / 24) * 100}%`, transform }}
                >
                  {pad(label)}:00
                </span>
              )
            })}
          </div>
        </div>
        {dayRows.length > 0 ? (
          <div className="mt-2">
            <BookingDayBreakdownRows rows={dayRows} />
          </div>
        ) : (
          <>
            <p className="mt-2 text-[12px] tabular-nums text-[var(--ink3)]">
              {valid
                ? `${format(startHm.hour, startHm.minute)}–${format(endHm.hour, endHm.minute)} · ${formatHoursLabel(breakdown.totalPaidHours)}h paid`
                : 'Finish must be after start'}
            </p>
            {breakdown.overtimeLine ? (
              <p className="mt-1 text-[12px] font-semibold text-[#854F0B]">{breakdown.overtimeLine}</p>
            ) : null}
            <BookingHoursExplanationList explanations={weekdayExplanations} className="mt-1.5" />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TimeColumn
          title="Start"
          hour={startHm.hour}
          minute={startHm.minute}
          onHour={(hour) => onStart(format(hour, startHm.minute))}
          onMinute={(minute) => onStart(format(startHm.hour, minute))}
        />
        <TimeColumn
          title="Finish"
          hour={endHm.hour}
          minute={endHm.minute}
          onHour={(hour) => onEnd(format(hour, endHm.minute))}
          onMinute={(minute) => onEnd(format(endHm.hour, minute))}
        />
      </div>
      {showBreak && breakApplies ? (
      <label className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 text-[13px] font-medium">
        Unpaid break included
        <input
          type="checkbox"
          checked={!breakRemoved}
          onChange={(e) => onBreak(!e.target.checked)}
        />
      </label>
      ) : null}
    </div>
  )
}

function Handle({
  minutes,
  label,
  side,
}: {
  minutes: number
  label: string
  side: 'start' | 'end'
}) {
  const left = fraction(minutes) * 100
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
      style={{ left: `${left}%` }}
    >
      <span className="mb-0.5 block text-center text-[9px] font-semibold tabular-nums text-[var(--blue)]">
        {label}
      </span>
      <span
        className={`mx-auto block h-3.5 w-3.5 rounded-full border-2 border-white shadow ${
          side === 'start' ? 'bg-[var(--blue)]' : 'bg-[#0F6E56]'
        }`}
      />
    </div>
  )
}

function TimeColumn({
  title,
  hour,
  minute,
  onHour,
  onMinute,
}: {
  title: string
  hour: number
  minute: number
  onHour: (value: number) => void
  onMinute: (value: number) => void
}) {
  return (
    <div className="rounded-[10px] bg-[var(--bg)] p-2.5">
      <p className="mb-1 text-[9px] uppercase tracking-[0.4px] text-[var(--ink3)]">{title}</p>
      <div className="flex items-center gap-1">
        <select
          value={hour}
          onChange={(e) => onHour(Number(e.target.value))}
          className="h-[100px] flex-1 appearance-none rounded-lg bg-white px-2 text-center text-[16px] font-medium tabular-nums outline-none"
          size={5}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {pad(h)}
            </option>
          ))}
        </select>
        <span className="text-[16px] font-medium">:</span>
        <select
          value={minute}
          onChange={(e) => onMinute(Number(e.target.value))}
          className="h-[100px] w-16 appearance-none rounded-lg bg-white px-1 text-center text-[16px] font-medium tabular-nums outline-none"
          size={4}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {pad(m)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

'use client'

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import type { AnnualLeaveDayKind } from '@/lib/annualLeave/dayStatus'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function AnnualLeaveLegend() {
  const items = [
    ['bg-emerald-500', 'Approved'],
    ['bg-emerald-300', 'Half day'],
    ['bg-amber-400', 'Pending'],
    ['bg-violet-400', 'Bank holiday'],
    ['bg-slate-300', 'Weekend'],
  ] as const
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--ink3)]">
      {items.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
          {label}
        </span>
      ))}
    </div>
  )
}

function dayStyles(
  kind: AnnualLeaveDayKind,
  opts: {
    inMonth: boolean
    isSelected: boolean
    isMultiSelected: boolean
    todayDay: boolean
    weekend: boolean
    bankHoliday: boolean
  }
): string {
  const { inMonth, isSelected, isMultiSelected, todayDay, weekend, bankHoliday } = opts
  let cls =
    'relative flex h-12 w-full flex-col items-center justify-center rounded-lg text-base font-medium transition-all '

  if (!inMonth) return cls + 'cursor-default text-slate-300'
  if (todayDay) cls += 'ring-2 ring-slate-900 ring-offset-1 '

  if (isSelected || isMultiSelected) {
    return cls + 'bg-blue-600 font-bold text-white shadow-sm'
  }

  if (bankHoliday) return cls + 'bg-violet-100 font-semibold text-violet-800'

  switch (kind) {
    case 'approvedFull':
      cls += 'bg-emerald-500 font-semibold text-white '
      break
    case 'approvedHalf':
      cls += 'bg-[linear-gradient(135deg,#10b981_50%,#a7f3d0_50%)] font-semibold text-slate-900 '
      break
    case 'pendingFull':
    case 'pendingHalf':
      cls += 'bg-amber-100 font-semibold text-amber-950 ring-2 ring-amber-400 ring-inset '
      break
    default:
      cls += weekend
        ? 'bg-slate-100 text-slate-400 '
        : 'cursor-pointer text-slate-700 hover:bg-slate-100 '
  }

  return cls
}

function spokenLabel(day: Date, kind: AnnualLeaveDayKind, holiday: string | null, selected: boolean): string {
  const when = format(day, 'd MMMM')
  if (holiday) return `${when}, ${holiday}, bank holiday, not bookable`
  if (selected) return `${when}, selected`
  if (kind === 'approvedFull') return `${when}, approved full day`
  if (kind === 'approvedHalf') return `${when}, approved half day`
  if (kind === 'pendingFull' || kind === 'pendingHalf') return `${when}, pending`
  return when
}

export function LeaveDayCalendar({
  month,
  onMonthChange,
  getDayKind,
  selectedDay,
  selectedDays,
  onDayClick,
  disableLocked = false,
  bankHolidayName,
  onBankHoliday,
  dayCaption,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  getDayKind: (day: Date) => AnnualLeaveDayKind
  selectedDay?: Date | null
  selectedDays?: Date[]
  onDayClick: (day: Date) => void
  disableLocked?: boolean
  bankHolidayName?: (day: Date) => string | null
  onBankHoliday?: (name: string, day: Date) => void
  dayCaption?: (day: Date) => string | null
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Previous month"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-base font-bold text-slate-900">{format(month, 'MMMM yyyy')}</p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Next month"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month)
          const kind = getDayKind(day)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const isMultiSelected = selectedDays?.some((d) => isSameDay(d, day)) ?? false
          const todayDay = isToday(day)
          const weekend = isWeekend(day)
          const holiday = inMonth ? bankHolidayName?.(day) || null : null
          const locked = disableLocked && (kind === 'approvedFull' || kind === 'pendingFull')
          const caption = inMonth ? dayCaption?.(day) : null
          const btnClass = dayStyles(kind, {
            inMonth,
            isSelected,
            isMultiSelected,
            todayDay,
            weekend,
            bankHoliday: Boolean(holiday),
          })

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!inMonth || locked}
              aria-label={inMonth ? spokenLabel(day, kind, holiday, isSelected || isMultiSelected) : undefined}
              onClick={() => {
                if (!inMonth) return
                if (holiday) {
                  onBankHoliday?.(holiday, day)
                  return
                }
                onDayClick(day)
              }}
              className={btnClass}
            >
              <span>{format(day, 'd')}</span>
              {holiday ? <span className="mt-0.5 h-1 w-1 rounded-full bg-violet-600" /> : null}
              {caption ? <span className="text-[9px] font-bold leading-none">{caption}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

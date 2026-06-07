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
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Approved full day
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-orange-500" />
        Approved half day
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Pending request
      </span>
    </div>
  )
}

function dayStyles(
  kind: AnnualLeaveDayKind,
  opts: { inMonth: boolean; isSelected: boolean; isMultiSelected: boolean; todayDay: boolean }
): string {
  const { inMonth, isSelected, isMultiSelected, todayDay } = opts
  let cls =
    'relative flex h-9 w-full items-center justify-center rounded-full text-sm font-medium transition-all '

  if (!inMonth) return cls + 'cursor-default text-slate-300'

  if (isSelected || isMultiSelected) {
    return cls + 'bg-blue-600 font-bold text-white shadow-sm'
  }

  switch (kind) {
    case 'approvedFull':
      cls += 'bg-emerald-500/55 font-semibold text-slate-900 '
      break
    case 'approvedHalf':
      cls += 'font-semibold text-slate-900 ring-2 ring-orange-500 ring-inset '
      break
    case 'pendingFull':
      cls += 'bg-red-500/85 font-semibold text-white ring-1 ring-red-400/35 '
      break
    case 'pendingHalf':
      cls += 'font-semibold text-slate-900 ring-2 ring-red-500 '
      break
    default:
      if (todayDay) cls += 'border-2 border-emerald-500 font-bold text-emerald-700 '
      else cls += 'cursor-pointer text-slate-700 hover:bg-slate-100 '
  }

  return cls
}

export function LeaveDayCalendar({
  month,
  onMonthChange,
  getDayKind,
  selectedDay,
  selectedDays,
  onDayClick,
  disableLocked = false,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  getDayKind: (day: Date) => AnnualLeaveDayKind
  selectedDay?: Date | null
  selectedDays?: Date[]
  onDayClick: (day: Date) => void
  disableLocked?: boolean
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
          const locked = disableLocked && (kind === 'approvedFull' || kind === 'pendingFull')

          let btnClass = dayStyles(kind, { inMonth, isSelected, isMultiSelected, todayDay })
          if (inMonth && kind === 'none' && weekend && !todayDay && !isMultiSelected && !isSelected) {
            btnClass += ' text-slate-400 hover:bg-slate-100'
          }

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!inMonth || locked}
              onClick={() => inMonth && onDayClick(day)}
              className={btnClass}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

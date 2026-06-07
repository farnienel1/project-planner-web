'use client'

import { addMonths, format, isToday } from 'date-fns'
import { calendarGridDays, isDateSelected, isInMonth, slotKey } from '@/lib/scheduling/scheduleUtils'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function ScheduleCalendar({
  month,
  onMonthChange,
  selectedDates,
  onToggleDate,
}: {
  month: Date
  onMonthChange: (month: Date) => void
  selectedDates: Date[]
  onToggleDate: (date: Date) => void
}) {
  const days = calendarGridDays(month)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-900">{format(month, 'MMMM yyyy')}</p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          ›
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const selected = isDateSelected(day, selectedDates)
          const inMonth = isInMonth(day, month)
          const today = isToday(day)
          return (
            <button
              key={slotKey(day)}
              type="button"
              onClick={() => onToggleDate(day)}
              className={`flex h-10 items-center justify-center rounded-full text-sm transition ${
                selected
                  ? 'bg-blue-600 font-semibold text-white'
                  : today
                    ? 'border border-blue-500 font-semibold text-blue-700'
                    : inMonth
                      ? 'text-slate-900 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
              }`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

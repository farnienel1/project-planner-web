'use client'

import { ScheduleCalendar } from '@/components/projects/scheduling/ScheduleCalendar'
import { ScheduleQuickSelect } from '@/components/projects/scheduling/ScheduleQuickSelect'
import { ScheduleSelectedDates } from '@/components/projects/scheduling/ScheduleSelectedDates'
import {
  setQuickSelectDates,
  sortedDateSlots,
  toggleSelectedDate,
  type ScheduleDateSlot,
} from '@/lib/scheduling/scheduleUtils'

export function ScheduleDatesStep({
  month,
  onMonthChange,
  quickDays,
  onQuickDaysChange,
  dateSlots,
  onDateSlotsChange,
  onSlotChange,
  onRemoveDate,
}: {
  month: Date
  onMonthChange: (date: Date) => void
  quickDays: number | null
  onQuickDaysChange: (days: number | null) => void
  dateSlots: Map<string, ScheduleDateSlot>
  onDateSlotsChange: (slots: Map<string, ScheduleDateSlot>) => void
  onSlotChange: (date: Date, patch: Partial<ScheduleDateSlot>) => void
  onRemoveDate: (date: Date) => void
}) {
  const slotsList = sortedDateSlots(dateSlots)
  const selectedDates = slotsList.map((s) => s.date)

  const handleQuickSelect = (days: number) => {
    onQuickDaysChange(days)
    onDateSlotsChange(setQuickSelectDates(days))
  }

  const handleToggleDate = (date: Date) => {
    onQuickDaysChange(null)
    onDateSlotsChange(toggleSelectedDate(date, dateSlots))
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Select dates · {selectedDates.length} selected
        </p>
        <ScheduleQuickSelect activeDays={quickDays} onSelect={handleQuickSelect} />
        <ScheduleCalendar
          month={month}
          onMonthChange={onMonthChange}
          selectedDates={selectedDates}
          onToggleDate={handleToggleDate}
        />
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time slots</p>
        <ScheduleSelectedDates
          slots={slotsList}
          onSlotChange={onSlotChange}
          onRemove={onRemoveDate}
          accent="blue"
        />
      </section>
    </div>
  )
}

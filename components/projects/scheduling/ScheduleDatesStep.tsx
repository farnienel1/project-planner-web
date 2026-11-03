'use client'

import { useState } from 'react'
import { ScheduleCalendar } from '@/components/projects/scheduling/ScheduleCalendar'
import { ScheduleQuickSelect } from '@/components/projects/scheduling/ScheduleQuickSelect'
import { ScheduleSelectedDates } from '@/components/projects/scheduling/ScheduleSelectedDates'
import { useScheduleDateRules } from '@/lib/scheduling/useOrganizationPayrollPolicy'
import {
  setQuickSelectWeekdays,
  toggleSelectedDateChecked,
  sortedDateSlots,
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
  const [mixError, setMixError] = useState<string | null>(null)
  const dateRules = useScheduleDateRules()
  const selectedDates = slotsList.map((s) => s.date)

  const handleQuickSelect = (days: number) => {
    onQuickDaysChange(days)
    // Rulebook 1.13.0 (Q2): quick select skips Saturday and Sunday (weekends are booked on their own).
    onDateSlotsChange(setQuickSelectWeekdays(days, dateRules.isWeekend))
  }

  const handleToggleDate = (date: Date) => {
    onQuickDaysChange(null)
    const { slots, error } = toggleSelectedDateChecked(date, dateSlots, dateRules)
    setMixError(error)
    onDateSlotsChange(slots)
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
        {mixError ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{mixError}</p> : null}
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

'use client'

import { formatScheduleDay, type ScheduleDateSlot, type ScheduleSlotChoice } from '@/lib/scheduling/scheduleUtils'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { customHoursPrefillForDate, slotOfferedOnDate, weekendNotesForDates } from '@/lib/scheduling/bookingSlotRules'
import { useOrganizationPayrollPolicy } from '@/lib/scheduling/useOrganizationPayrollPolicy'

const SLOT_OPTIONS: ScheduleSlotChoice[] = ['AM', 'PM', 'FULL DAY', 'CUSTOM']

export function ScheduleSelectedDates({
  slots,
  onSlotChange,
  onRemove,
  accent = 'blue',
}: {
  slots: ScheduleDateSlot[]
  onSlotChange: (date: Date, patch: Partial<ScheduleDateSlot>) => void
  onRemove: (date: Date) => void
  accent?: 'blue' | 'purple'
}) {
  const activeClass = accent === 'purple' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
  const policy = useOrganizationPayrollPolicy()

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Select dates on the calendar or use Today / 3 days / 5 days.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {slots.map((entry) => {
        // Rulebook 1.18.0 (`customHoursPrefillForDays` for this day): each date keeps its own pair; a weekday opens
        // custom hours with the standard day in effect on it, a weekend day with its window — never fixed times.
        const prefill = customHoursPrefillForDate(entry.date, policy)
        return (
          <div key={entry.date.toISOString()} className="card pad">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected date</p>
                <p className="text-sm font-semibold text-slate-900">{formatScheduleDay(entry.date)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(entry.date)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>

            {/* Rulebook 1.13.0 (Q2, `allowedTimeSlotsOnDay`): no AM / PM on Saturday or Sunday. */}
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
              {SLOT_OPTIONS.filter((slot) => slotOfferedOnDate(slot, entry.date, policy, entry.slot)).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() =>
                    onSlotChange(
                      entry.date,
                      slot === 'CUSTOM'
                        ? {
                            slot,
                            workStartTime: entry.workStartTime || prefill.start,
                            workEndTime: entry.workEndTime || prefill.end,
                          }
                        : { slot, workStartTime: undefined, workEndTime: undefined }
                    )
                  }
                  className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
                    entry.slot === slot ? activeClass : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {slot === 'CUSTOM' ? 'Custom' : slot}
                </button>
              ))}
            </div>

            {/* Rulebook 1.17.0 (`weekendBookingNotes`): each selected date row shows its own day's note. */}
            {weekendNotesForDates([entry.date], policy).map((note) => (
              <p key={note} className="mt-2 text-xs text-slate-500">
                {note}
              </p>
            ))}

            {entry.slot === 'CUSTOM' && (
              <div className="mt-3">
                <HoursTimelinePicker
                  start={entry.workStartTime || prefill.start}
                  end={entry.workEndTime || prefill.end}
                  breakRemoved={false}
                  policy={policy}
                  date={entry.date}
                  showBreak={false}
                  onStart={(value) => onSlotChange(entry.date, { workStartTime: value })}
                  onEnd={(value) => onSlotChange(entry.date, { workEndTime: value })}
                  onBreak={() => {}}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

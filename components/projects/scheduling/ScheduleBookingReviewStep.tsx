'use client'

import { format } from 'date-fns'
import { formatClashSummary } from '@/lib/scheduling/bookingClashUtils'
import {
  dayStateBooks,
  draftPersonNeedsWarning,
  type DraftBookingPerson,
} from '@/lib/scheduling/draftProjectBooking'
import { BOOKING_REPLACE_LABEL } from '@/lib/canonical'
import { slotKey, slotToFirestore, type ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
import { weekdayExplanationForDate, weekendBreakdownForDates } from '@/lib/scheduling/bookingSlotRules'
import { useOrganizationPayrollPolicy } from '@/lib/scheduling/useOrganizationPayrollPolicy'
import { BookingDayBreakdownRows } from '@/components/scheduling/BookingDayBreakdownRows'
import { BookingHoursExplanationList } from '@/components/scheduling/BookingHoursExplanation'

function DayChip({
  date,
  state,
}: {
  date: Date
  state: DraftBookingPerson['dayStates'][string]
}) {
  const removed = state === 'removed'
  const accepted = state === 'clash_accepted'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
        removed
          ? 'bg-slate-100 text-slate-400 line-through'
          : accepted
            ? 'bg-amber-50 text-amber-800'
            : 'bg-blue-50 text-blue-700'
      }`}
    >
      {!removed && <span className="font-bold">✓</span>}
      {format(date, 'EEE d MMM')}
    </span>
  )
}

export function ScheduleBookingReviewStep({
  people,
  slots,
  expandedPersonId,
  onToggleExpand,
  onRemovePerson,
  onAddAnother,
  onChangeDates,
}: {
  people: DraftBookingPerson[]
  slots: ScheduleDateSlot[]
  expandedPersonId: string | null
  onToggleExpand: (personId: string) => void
  onRemovePerson: (personId: string) => void
  onAddAnother: () => void
  /** Back to the dates step; the people chosen stay. */
  onChangeDates?: () => void
}) {
  const policy = useOrganizationPayrollPolicy()
  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-600">No one added yet.</p>
        <button
          type="button"
          onClick={onAddAnother}
          className="mt-3 text-sm font-semibold text-blue-600 hover:underline"
        >
          + Add operative or manager
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Review booking</p>
        <p className="mt-1 text-sm text-slate-600">
          Check each person and day before confirming. Tap someone with a warning to see clash details.
        </p>
        {onChangeDates && slots.length > 0 && (
          <button
            type="button"
            onClick={onChangeDates}
            className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            {slots.length === 1 ? '1 date' : `${slots.length} dates`} · Change dates
          </button>
        )}
      </div>

      <div className="space-y-3">
        {people.map((person) => {
          const hasWarning = draftPersonNeedsWarning(person)
          const expanded = expandedPersonId === person.personId
          const bookableDays = slots.filter((slot) => dayStateBooks(person.dayStates[slotKey(slot.date)]))
          // Rulebook 1.18.0 (`weekendBookingBreakdown`): each weekend day this person is booked on, priced by its rule.
          const weekendRows = bookableDays.flatMap((slot) => {
            const stored = slotToFirestore(slot)
            return stored.timeSlot === 'CUSTOM_HOURS'
              ? weekendBreakdownForDates([slot.date], stored.workStartTime, stored.workEndTime, false, policy)
              : []
          })
          // Rulebook 1.39.0 (`bookingHoursExplanation`): custom weekday hours explained the same way.
          const weekdayExplanations = bookableDays.map((slot) => {
            const stored = slotToFirestore(slot)
            return stored.timeSlot === 'CUSTOM_HOURS'
              ? weekdayExplanationForDate(slot.date, stored.workStartTime, stored.workEndTime, false, policy)
              : null
          })

          return (
            <div key={person.personId} className="overflow-hidden card shadow-sm">
              <div className="flex items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => onToggleExpand(person.personId)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left hover:opacity-90"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {person.name
                      .split(' ')
                      .map((part) => part[0] || '')
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
                      {hasWarning && (
                        <span className="text-amber-500" title="Overlap warning">
                          ⚠
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {person.badge} · {bookableDays.length} day
                      {bookableDays.length !== 1 ? 's' : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {slots.map((slot) => (
                        <DayChip
                          key={slotKey(slot.date)}
                          date={slot.date}
                          state={person.dayStates[slotKey(slot.date)] || 'removed'}
                        />
                      ))}
                    </div>
                    {weekendRows.length > 0 ? (
                      <div className="mt-2">
                        <BookingDayBreakdownRows rows={weekendRows} />
                      </div>
                    ) : null}
                    <BookingHoursExplanationList explanations={weekdayExplanations} className="mt-2" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onRemovePerson(person.personId)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>

              {expanded && hasWarning && (
                <div className="border-t border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Overlap warnings</p>
                  <div className="mt-2 space-y-2">
                    {slots
                      .filter((slot) => {
                        const state = person.dayStates[slotKey(slot.date)]
                        return state === 'clash_accepted' || state === 'clash_replace'
                      })
                      .map((slot) => {
                        const key = slotKey(slot.date)
                        const clashes = person.clashByDay[key] || []
                        const replacing = person.dayStates[key] === 'clash_replace'
                        return (
                          <p key={key} className="text-xs text-amber-900">
                            {format(slot.date, 'EEE d MMM')}: {replacing ? `${BOOKING_REPLACE_LABEL} · ` : ''}
                            {formatClashSummary(clashes)}
                          </p>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onAddAnother}
        className="w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
      >
        + Add another person
      </button>
    </div>
  )
}

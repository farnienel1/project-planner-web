'use client'

import { format } from 'date-fns'
import { formatClashSummary } from '@/lib/scheduling/bookingClashUtils'
import {
  acceptDayClash,
  removeDayFromPerson,
  type DraftBookingPerson,
} from '@/lib/scheduling/draftProjectBooking'
import { slotKey, type ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'

function DayStateIcon({ state }: { state: DraftBookingPerson['dayStates'][string] }) {
  if (state === 'free' || state === 'clash_accepted') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
        ✓
      </span>
    )
  }
  if (state === 'removed') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm text-slate-400">
        ✕
      </span>
    )
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-sm font-bold text-amber-600">
      !
    </span>
  )
}

export function SchedulePersonResolveStep({
  person,
  slots,
  onPersonChange,
}: {
  person: DraftBookingPerson
  slots: ScheduleDateSlot[]
  onPersonChange: (person: DraftBookingPerson) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">{person.name}</p>
        <p className="text-xs text-slate-500">{person.kind === 'manager' ? 'Manager' : 'Operative'}</p>
        <p className="mt-2 text-sm text-slate-600">
          Free days show a blue tick. For clashes, accept with ✓ or remove the day with ✕.
        </p>
      </div>

      <div className="space-y-3">
        {slots.map((slot) => {
          const key = slotKey(slot.date)
          const state = person.dayStates[key] || 'free'
          const clashes = person.clashByDay[key] || []
          const removed = state === 'removed'

          return (
            <div
              key={key}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${
                state === 'clash_pending' ? 'border-amber-300' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <DayStateIcon state={state} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      removed ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    {format(slot.date, 'EEE d MMM yyyy')}
                  </p>
                  <p className={`text-xs ${removed ? 'text-slate-400 line-through' : 'text-slate-500'}`}>
                    {slot.slot === 'CUSTOM' ? 'Custom hours' : slot.slot}
                  </p>

                  {state === 'free' && (
                    <p className="mt-1 text-xs font-medium text-blue-600">Available</p>
                  )}

                  {state === 'clash_accepted' && (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      Overlap accepted · {formatClashSummary(clashes)}
                    </p>
                  )}

                  {state === 'clash_pending' && (
                    <p className="mt-1 text-xs text-amber-800">
                      Already booked · {formatClashSummary(clashes)}
                    </p>
                  )}

                  {removed && <p className="mt-1 text-xs text-slate-400">Removed from this booking</p>}
                </div>

                {state === 'clash_pending' && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPersonChange(removeDayFromPerson(person, key))}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label={`Remove ${format(slot.date, 'd MMM')}`}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      onClick={() => onPersonChange(acceptDayClash(person, key))}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                      aria-label={`Accept overlap for ${format(slot.date, 'd MMM')}`}
                    >
                      ✓
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

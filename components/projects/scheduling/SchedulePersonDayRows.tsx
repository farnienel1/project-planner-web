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
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        ✓
      </span>
    )
  }
  if (state === 'removed') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs text-slate-400">
        ✕
      </span>
    )
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-xs font-bold text-amber-600">
      !
    </span>
  )
}

export function SchedulePersonDayRows({
  person,
  slots,
  onPersonChange,
  compact = false,
}: {
  person: DraftBookingPerson
  slots: ScheduleDateSlot[]
  onPersonChange: (person: DraftBookingPerson) => void
  compact?: boolean
}) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {slots.map((slot) => {
        const key = slotKey(slot.date)
        const state = person.dayStates[key] || 'free'
        const clashes = person.clashByDay[key] || []
        const removed = state === 'removed'

        return (
          <div
            key={key}
            className={`rounded-xl border bg-[var(--card)] ${
              compact ? 'p-3' : 'p-4 shadow-sm'
            } ${state === 'clash_pending' ? 'border-[var(--warn)]' : 'border-[var(--line)]'}`}
          >
            <div className="flex items-start gap-3">
              <DayStateIcon state={state} />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    removed ? 'text-[var(--ink3)] line-through' : 'text-[var(--ink)]'
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
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                    aria-label={`Remove ${format(slot.date, 'd MMM')}`}
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => onPersonChange(acceptDayClash(person, key))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
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
  )
}

function SelectionDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--blue)] ${
        selected ? 'bg-[var(--blue)]' : 'bg-[var(--card)]'
      }`}
      aria-hidden
    />
  )
}

export function SchedulePersonPickerRow({
  person,
  selected,
  badge,
  clashLabel,
  onSelect,
}: {
  person: { id: string; name: string; email: string }
  selected: boolean
  badge: string
  clashLabel?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`ritem w-full ${selected ? 'sel' : ''}`}
    >
      <SelectionDot selected={selected} />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--soft2)] text-xs font-bold text-[var(--ink)]">
        {person.name
          .split(' ')
          .map((part) => part[0] || '')
          .join('')
          .slice(0, 2)
          .toUpperCase()}
      </span>
      <span className="grow min-w-0 text-left">
        <span className="t">{person.name}</span>
        {person.email ? <span className="s">{person.email}</span> : null}
      </span>
      {clashLabel ? (
        <span className="pill" data-hue="red">
          {clashLabel}
        </span>
      ) : null}
      <span className="pill" data-hue={badge === 'Operative' ? 'green' : 'user'}>
        {badge}
      </span>
    </button>
  )
}

'use client'

import { useMemo, useState } from 'react'
import {
  buildSchedulablePeople,
  filterSchedulablePeople,
  type SchedulablePerson,
  type SchedulablePersonKind,
} from '@/lib/scheduling/scheduleRosterUtils'
import { format } from 'date-fns'
import {
  acceptDayClash,
  personHasPendingClashes,
  removeDayFromPerson,
  type DraftBookingPerson,
} from '@/lib/scheduling/draftProjectBooking'
import { SchedulePersonPickerRow } from '@/components/projects/scheduling/SchedulePersonDayRows'
import { slotKey, type ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
import {
  BookingConflictRows,
  conflictRowKey,
  type BookingConflictDecision,
  type BookingConflictRow,
} from '@/components/scheduling/BookingConflictRows'
import { formatClashSummary } from '@/lib/scheduling/bookingClashUtils'
import { leaveConflictDetail } from '@/lib/scheduling/leaveConflicts'

/**
 * Rulebook 1.16.0 §5 (owner: clashes in the same rows as annual leave): the person's double bookings (orange) and
 * annual leave (purple) on the chosen days as `BookingConflictRows`. One tick or ✕ decides that day for the person
 * (`acceptDayClash` / `removeDayFromPerson`), so a day with both a clash and leave shows both rows with one decision.
 */
function draftConflictRows(
  person: DraftBookingPerson,
  slots: ReadonlyArray<ScheduleDateSlot>
): { rows: BookingConflictRow[]; decisions: Record<string, BookingConflictDecision | undefined> } {
  const rows: BookingConflictRow[] = []
  const decisions: Record<string, BookingConflictDecision | undefined> = {}
  for (const slot of slots) {
    const day = slotKey(slot.date)
    const clashes = person.clashByDay[day] || []
    const leave = person.leaveByDay?.[day]
    if (clashes.length === 0 && !leave) continue
    const state = person.dayStates[day]
    const decision: BookingConflictDecision | undefined =
      state === 'clash_accepted' ? 'confirm' : state === 'removed' ? 'drop' : undefined
    const base = { personId: person.personId, dayKey: day, personName: person.name, dayLabel: format(slot.date, 'EEE d MMM yyyy') }
    if (clashes.length > 0) {
      const key = conflictRowKey(person.personId, day, 'double_booking')
      rows.push({ ...base, key, kind: 'double_booking', detail: `Already booked · ${formatClashSummary(clashes)}` })
      decisions[key] = decision
    }
    if (leave) {
      const key = conflictRowKey(person.personId, day, 'annual_leave')
      rows.push({ ...base, key, kind: 'annual_leave', detail: leaveConflictDetail(leave), pending: leave.status === 'pending' })
      decisions[key] = decision
    }
  }
  return { rows, decisions }
}
import type { Operative, User } from '@/types'

export function SchedulePersonPickerStep({
  operatives,
  users,
  draftPeople,
  slots,
  onTogglePerson,
  onPersonChange,
}: {
  operatives: Operative[]
  users: User[]
  draftPeople: DraftBookingPerson[]
  slots: ScheduleDateSlot[]
  onTogglePerson: (person: SchedulablePerson) => void
  onPersonChange: (person: DraftBookingPerson) => void
}) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | SchedulablePersonKind>('all')

  const selectedById = useMemo(
    () => new Map(draftPeople.map((person) => [person.personId, person])),
    [draftPeople]
  )

  const allPeople = useMemo(() => buildSchedulablePeople(operatives, users), [operatives, users])
  const filteredPeople = useMemo(
    () => filterSchedulablePeople(allPeople, search, kindFilter),
    [allPeople, search, kindFilter]
  )

  return (
    <div className="space-y-4">
      <div>
        <p className="h2">Add operative or manager</p>
        <p className="mt-1 muted small">
          Select one or more people. If they are already booked or on annual leave, tick ✓ to book that day anyway
          or ✕ to remove it from this selection.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="pp-in"
        aria-label="Search people"
      />

      <div className="chips">
        {(['all', 'operative', 'manager'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setKindFilter(filter)}
            className={`chip ${kindFilter === filter ? 'on' : ''}`}
          >
            {filter === 'all' ? 'All' : filter === 'operative' ? 'Operatives' : 'Managers'}
          </button>
        ))}
        <span className="pill" data-hue="blue">
          {draftPeople.length} selected
        </span>
      </div>

      <div className="space-y-2">
        {filteredPeople.length === 0 ? (
          <div className="empty card pad">
            <p className="muted small">No people match your search.</p>
          </div>
        ) : (
          filteredPeople.map((person) => {
            const selected = selectedById.get(person.id) || null
            const pending = selected ? personHasPendingClashes(selected) : false
            const onLeave = Boolean(selected && Object.keys(selected.leaveByDay ?? {}).length > 0)
            const doubleBooked = Boolean(selected && Object.values(selected.clashByDay).some((list) => list.length > 0))
            const conflicts = selected ? draftConflictRows(selected, slots) : null
            return (
              <div key={person.id} className="space-y-2">
                <SchedulePersonPickerRow
                  person={person}
                  selected={Boolean(selected)}
                  badge={person.ghostBadge ? `${person.badge} · ${person.ghostBadge}` : person.badge}
                  clashLabel={
                    pending ? (doubleBooked && onLeave ? 'Clashes' : onLeave ? 'Annual leave' : 'Already booked') : undefined
                  }
                  onSelect={() => onTogglePerson(person)}
                />

                {selected && conflicts && conflicts.rows.length > 0 ? (
                  <div className="ml-2 pl-1">
                    <BookingConflictRows
                      rows={conflicts.rows}
                      decisions={conflicts.decisions}
                      onDecide={(key, decision) => {
                        const day = conflicts.rows.find((row) => row.key === key)?.dayKey
                        if (!day) return
                        onPersonChange(decision === 'drop' ? removeDayFromPerson(selected, day) : acceptDayClash(selected, day))
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

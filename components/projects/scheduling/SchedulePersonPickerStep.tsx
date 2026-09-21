'use client'

import { useMemo, useState } from 'react'
import {
  buildSchedulablePeople,
  filterSchedulablePeople,
  type SchedulablePerson,
  type SchedulablePersonKind,
} from '@/lib/scheduling/scheduleRosterUtils'
import {
  personHasPendingClashes,
  type DraftBookingPerson,
} from '@/lib/scheduling/draftProjectBooking'
import {
  SchedulePersonDayRows,
  SchedulePersonPickerRow,
} from '@/components/projects/scheduling/SchedulePersonDayRows'
import type { ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
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
          Select one or more people. If they are already booked, tick ✓ to double-book that day or ✕ to
          remove them from this selection.
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
            return (
              <div key={person.id} className="space-y-2">
                <SchedulePersonPickerRow
                  person={person}
                  selected={Boolean(selected)}
                  badge={person.badge}
                  clashLabel={pending ? 'Already booked' : undefined}
                  onSelect={() => onTogglePerson(person)}
                />

                {selected && pending ? (
                  <div className="ml-2 space-y-2 border-l-2 border-[var(--warn)] pl-3">
                    <p className="text-xs font-medium text-[var(--warn)]">
                      Already booked on one or more selected days. Tick to confirm the double-book, or ✕
                      to drop that day.
                    </p>
                    <SchedulePersonDayRows
                      person={selected}
                      slots={slots}
                      onPersonChange={onPersonChange}
                      compact
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

'use client'

import { useMemo, useState } from 'react'
import {
  buildSchedulablePeople,
  filterSchedulablePeople,
  type SchedulablePerson,
  type SchedulablePersonKind,
} from '@/lib/scheduling/scheduleRosterUtils'
import type { DraftBookingPerson } from '@/lib/scheduling/draftProjectBooking'
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
  selectedPersonId,
  activePerson,
  onSelectPerson,
  onActivePersonChange,
}: {
  operatives: Operative[]
  users: User[]
  draftPeople: DraftBookingPerson[]
  slots: ScheduleDateSlot[]
  selectedPersonId: string | null
  activePerson: DraftBookingPerson | null
  onSelectPerson: (person: SchedulablePerson) => void
  onActivePersonChange: (person: DraftBookingPerson) => void
}) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | SchedulablePersonKind>('all')

  const alreadyAdded = useMemo(() => new Set(draftPeople.map((p) => p.personId)), [draftPeople])

  const allPeople = useMemo(() => buildSchedulablePeople(operatives, users), [operatives, users])

  const filteredPeople = useMemo(() => {
    const available = allPeople.filter((p) => !alreadyAdded.has(p.id))
    return filterSchedulablePeople(available, search, kindFilter)
  }, [allPeople, alreadyAdded, search, kindFilter])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Add operative or manager</p>
        <p className="mt-1 text-sm text-slate-600">
          Tap someone to select them. Their days and any clashes appear below.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
      />

      <div className="flex gap-2">
        {(['all', 'operative', 'manager'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setKindFilter(filter)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              kindFilter === filter
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {filter === 'all' ? 'All' : filter === 'operative' ? 'Operatives' : 'Managers'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredPeople.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-500">No people match your search.</p>
          </div>
        ) : (
          filteredPeople.map((person) => {
            const selected = selectedPersonId === person.id
            return (
              <div key={person.id} className="space-y-2">
                <SchedulePersonPickerRow
                  person={person}
                  selected={selected}
                  badge={person.badge}
                  onSelect={() => onSelectPerson(person)}
                />

                {selected && activePerson && (
                  <div className="ml-2 space-y-2 border-l-2 border-blue-200 pl-3">
                    <p className="text-xs font-medium text-slate-500">
                      {activePerson.dayStates &&
                      Object.values(activePerson.dayStates).some((s) => s === 'clash_pending')
                        ? 'Resolve clashes for each day, then add to booking.'
                        : 'All days clear — add to booking when ready.'}
                    </p>
                    <SchedulePersonDayRows
                      person={activePerson}
                      slots={slots}
                      onPersonChange={onActivePersonChange}
                      compact
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

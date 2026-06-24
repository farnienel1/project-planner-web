'use client'

import { useMemo, useState } from 'react'
import {
  buildSchedulablePeople,
  filterSchedulablePeople,
  type SchedulablePerson,
  type SchedulablePersonKind,
} from '@/lib/scheduling/scheduleRosterUtils'
import type { DraftBookingPerson } from '@/lib/scheduling/draftProjectBooking'
import type { Operative, User } from '@/types'

export function SchedulePersonPickerStep({
  operatives,
  users,
  draftPeople,
  onSelectPerson,
}: {
  operatives: Operative[]
  users: User[]
  draftPeople: DraftBookingPerson[]
  onSelectPerson: (person: SchedulablePerson) => void
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
          Choose someone to book on the selected dates. Clashes are checked per day next.
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

      <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {filteredPeople.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No people match your search.</p>
        ) : (
          filteredPeople.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onSelectPerson(person)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-blue-50"
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
                <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
                {person.email && <p className="truncate text-xs text-slate-500">{person.email}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {person.badge}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

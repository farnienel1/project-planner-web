'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import {
  setQuickSelectDates,
  slotKey,
  slotToFirestore,
  sortedDateSlots,
  toggleSelectedDate,
  type ScheduleDateSlot,
} from '@/lib/scheduling/scheduleUtils'
import { db } from '@/lib/firebase/config'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { ScheduleCalendar } from '@/components/projects/scheduling/ScheduleCalendar'
import { ScheduleQuickSelect } from '@/components/projects/scheduling/ScheduleQuickSelect'
import { ScheduleSelectedDates } from '@/components/projects/scheduling/ScheduleSelectedDates'
import type { Project } from '@/types'

export function ScheduleSubcontractorForm({
  project,
  scheduleBasePath,
}: {
  project: Project
  scheduleBasePath: string
}) {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()

  const [month, setMonth] = useState(new Date())
  const [quickDays, setQuickDays] = useState<number | null>(null)
  const [dateSlots, setDateSlots] = useState<Map<string, ScheduleDateSlot>>(new Map())
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState('')
  const [useGeneralAttendance, setUseGeneralAttendance] = useState(true)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All Types')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) loadSubcontractors(organization.id)
  }, [organization?.id, loadSubcontractors])

  const typeFilters = useMemo(() => {
    const types = new Set(subcontractors.map((s) => s.subcontractorType))
    return ['All Types', ...Array.from(types).sort()]
  }, [subcontractors])

  const filteredSubcontractors = useMemo(() => {
    const q = search.trim().toLowerCase()
    return subcontractors
      .filter((s) => typeFilter === 'All Types' || s.subcontractorType === typeFilter)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.subcontractorType.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [subcontractors, search, typeFilter])

  const selectedSubcontractor = useMemo(
    () => subcontractors.find((sub) => sub.id === selectedSubcontractorId) ?? null,
    [subcontractors, selectedSubcontractorId]
  )

  const selectedDates = useMemo(() => sortedDateSlots(dateSlots).map((s) => s.date), [dateSlots])
  const slotsList = useMemo(() => sortedDateSlots(dateSlots), [dateSlots])

  const selectSubcontractor = (subId: string) => {
    if (selectedSubcontractorId === subId) {
      setSelectedSubcontractorId('')
      setUseGeneralAttendance(true)
      setSelectedContactIds(new Set())
      return
    }
    setSelectedSubcontractorId(subId)
    setUseGeneralAttendance(true)
    setSelectedContactIds(new Set())
  }

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  const handleQuickSelect = (days: number) => {
    setQuickDays(days)
    setDateSlots(setQuickSelectDates(days))
  }

  const handleToggleDate = (date: Date) => {
    setQuickDays(null)
    setDateSlots((prev) => toggleSelectedDate(date, prev))
  }

  const handleSlotChange = (date: Date, patch: Partial<ScheduleDateSlot>) => {
    const key = slotKey(date)
    setDateSlots((prev) => {
      const next = new Map(prev)
      const current = next.get(key)
      if (!current) return prev
      next.set(key, { ...current, ...patch })
      return next
    })
  }

  const handleRemoveDate = (date: Date) => {
    setDateSlots((prev) => {
      const next = new Map(prev)
      next.delete(slotKey(date))
      return next
    })
  }

  const confirm = async () => {
    if (!organization?.id || !user) return
    if (!selectedSubcontractorId) {
      setError('Select a sub contractor.')
      return
    }
    if (slotsList.length === 0) {
      setError('Select at least one date.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      for (const slot of slotsList) {
        const firestoreSlot = slotToFirestore(slot)
        await addDoc(collection(db, 'organizations', organization.id, 'subcontractorBookings'), {
          subcontractorId: selectedSubcontractorId,
          projectId: project.id,
          date: Timestamp.fromDate(slot.date),
          timeSlot: firestoreSlot.timeSlot,
          workStartTime: firestoreSlot.workStartTime ?? null,
          workEndTime: firestoreSlot.workEndTime ?? null,
          bookedBy: user.email,
          bookedContactIds: useGeneralAttendance ? [] : Array.from(selectedContactIds),
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        })
      }
      router.push(scheduleBasePath)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create bookings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-violet-700">{project.jobNumber}</p>
        <p className="text-lg font-semibold text-slate-900">{project.siteName}</p>
        <p className="mt-1 text-sm text-slate-600">
          {project.client?.name} · {[project.addressLine1, project.townCity, project.postcode].filter(Boolean).join(', ')}
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Choose sub contractor</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sub contractors…"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                typeFilter === type ? 'bg-violet-600 text-white' : 'border border-slate-300 bg-white text-slate-600'
              }`}
            >
              {type === 'All Types' ? 'All trades' : type}
            </button>
          ))}
        </div>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {filteredSubcontractors.length === 0 ? (
            <p className="text-sm text-slate-500">No sub contractors found.</p>
          ) : (
            filteredSubcontractors.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => selectSubcontractor(sub.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
                  selectedSubcontractorId === sub.id
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{sub.name}</p>
                  <p className="text-xs text-slate-500">{sub.subcontractorType}</p>
                </div>
                <span className="text-xs text-slate-500">{sub.contacts.length} contact(s)</span>
              </button>
            ))
          )}
        </div>
      </section>

      {selectedSubcontractor && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Who&apos;s attending</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={useGeneralAttendance}
              onChange={(e) => {
                setUseGeneralAttendance(e.target.checked)
                if (e.target.checked) setSelectedContactIds(new Set())
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                {selectedSubcontractor.name} (General)
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Use if named operatives are not confirmed yet.
              </span>
            </span>
          </label>
          {!useGeneralAttendance && (
            <div className="space-y-2">
              {selectedSubcontractor.contacts.length === 0 ? (
                <p className="text-sm text-slate-500">No contacts on this sub contractor. Use general attendance.</p>
              ) : (
                selectedSubcontractor.contacts.map((contact) => {
                  const selected = selectedContactIds.has(contact.id)
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleContact(contact.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
                        selected ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                        <p className="text-xs text-slate-500">{contact.position}</p>
                      </div>
                      <span className={`text-xs font-semibold ${selected ? 'text-violet-700' : 'text-slate-400'}`}>
                        {selected ? 'Selected' : 'Select'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Dates · {selectedDates.length} selected
        </p>
        <ScheduleQuickSelect activeDays={quickDays} onSelect={handleQuickSelect} />
        <ScheduleCalendar
          month={month}
          onMonthChange={setMonth}
          selectedDates={selectedDates}
          onToggleDate={handleToggleDate}
        />
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected dates</p>
        <ScheduleSelectedDates
          slots={slotsList}
          onSlotChange={handleSlotChange}
          onRemove={handleRemoveDate}
          accent="purple"
        />
      </section>

      {error && <ErrorBanner message={error} />}

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:pl-64">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-xs text-slate-500">
            {selectedSubcontractorId ? '1 sub contractor' : 'No sub contractor'} · {slotsList.length} day(s)
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={confirm}
            className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

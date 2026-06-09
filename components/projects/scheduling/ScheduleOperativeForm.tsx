'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import {
  detectOperativeClashes,
  isExactDuplicateBooking,
  type OperativeBookingClash,
} from '@/lib/scheduling/bookingClashUtils'
import {
  setQuickSelectDates,
  slotKey,
  slotToFirestore,
  sortedDateSlots,
  toggleSelectedDate,
  type ScheduleDateSlot,
} from '@/lib/scheduling/scheduleUtils'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { OperativeClashReviewPanel } from '@/components/projects/scheduling/OperativeClashReviewPanel'
import { ScheduleCalendar } from '@/components/projects/scheduling/ScheduleCalendar'
import { ScheduleQuickSelect } from '@/components/projects/scheduling/ScheduleQuickSelect'
import { ScheduleSelectedDates } from '@/components/projects/scheduling/ScheduleSelectedDates'
import type { Project } from '@/types'

export function ScheduleOperativeForm({
  project,
  scheduleBasePath,
}: {
  project: Project
  scheduleBasePath: string
}) {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings, createBooking, loadBookings } = useBookingStore()

  const [month, setMonth] = useState(new Date())
  const [quickDays, setQuickDays] = useState<number | null>(null)
  const [dateSlots, setDateSlots] = useState<Map<string, ScheduleDateSlot>>(new Map())
  const [selectedOperatives, setSelectedOperatives] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showClashReview, setShowClashReview] = useState(false)
  const [clashReviewOperativeIds, setClashReviewOperativeIds] = useState<Set<string>>(new Set())
  const [operativeClashSummaries, setOperativeClashSummaries] = useState<Map<string, OperativeBookingClash[]>>(new Map())
  const [approvedOverlapOperativeIds, setApprovedOverlapOperativeIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (organization?.id) {
      loadOperatives(organization.id)
      loadBookings(organization.id)
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
    }
  }, [organization?.id, loadOperatives, loadBookings, loadProjects, loadSmallWorks])

  const allProjects = useMemo(() => {
    const merged = mergeProjectsAndSmallWorks(projects, smallWorks)
    if (!merged.some((p) => p.id === project.id)) merged.push(project)
    return merged
  }, [projects, smallWorks, project])

  const activeOperatives = useMemo(
    () => getActiveOperativesForScheduling(operatives),
    [operatives]
  )

  const filteredOperatives = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeOperatives
    return activeOperatives.filter((o) =>
      `${o.firstName} ${o.lastName}`.toLowerCase().includes(q)
    )
  }, [activeOperatives, search])

  const selectedDates = useMemo(() => sortedDateSlots(dateSlots).map((s) => s.date), [dateSlots])
  const slotsList = useMemo(() => sortedDateSlots(dateSlots), [dateSlots])

  const clashGroups = useMemo(() => {
    return [...clashReviewOperativeIds]
      .map((operativeId) => {
        const operative = activeOperatives.find((o) => o.id === operativeId)
        const clashes = operativeClashSummaries.get(operativeId) || []
        if (!operative || clashes.length === 0) return null
        return { operative, clashes }
      })
      .filter((group): group is { operative: (typeof activeOperatives)[number]; clashes: OperativeBookingClash[] } => group !== null)
      .sort((a, b) =>
        `${a.operative.firstName} ${a.operative.lastName}`.localeCompare(
          `${b.operative.firstName} ${b.operative.lastName}`
        )
      )
  }, [activeOperatives, clashReviewOperativeIds, operativeClashSummaries])

  const detectClashesForSelection = () => {
    const summaries = new Map<string, OperativeBookingClash[]>()
    const pendingReview = new Set<string>()

    for (const operativeId of selectedOperatives) {
      const clashes = detectOperativeClashes({
        operativeIds: [operativeId],
        slots: slotsList,
        bookings,
        operatives: activeOperatives,
        projects: allProjects,
      })
      if (clashes.length === 0) continue
      summaries.set(operativeId, clashes)
      if (!approvedOverlapOperativeIds.has(operativeId)) {
        pendingReview.add(operativeId)
      }
    }

    return { summaries, pendingReview }
  }

  const toggleOperative = (id: string) => {
    setApprovedOverlapOperativeIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setSelectedOperatives((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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

  const approveClashOperative = (operativeId: string) => {
    setApprovedOverlapOperativeIds((prev) => new Set(prev).add(operativeId))
    setClashReviewOperativeIds((prev) => {
      const next = new Set(prev)
      next.delete(operativeId)
      return next
    })
  }

  const dismissClashOperative = (operativeId: string) => {
    setClashReviewOperativeIds((prev) => {
      const next = new Set(prev)
      next.delete(operativeId)
      return next
    })
    setOperativeClashSummaries((prev) => {
      const next = new Map(prev)
      next.delete(operativeId)
      return next
    })
    setApprovedOverlapOperativeIds((prev) => {
      const next = new Set(prev)
      next.delete(operativeId)
      return next
    })
    setSelectedOperatives((prev) => {
      const next = new Set(prev)
      next.delete(operativeId)
      return next
    })
  }

  const cancelClashReview = () => {
    setShowClashReview(false)
    setClashReviewOperativeIds(new Set())
    setOperativeClashSummaries(new Map())
    setApprovedOverlapOperativeIds(new Set())
  }

  const proceedWithBooking = async () => {
    if (!organization?.id || !user) return

    setSaving(true)
    setError(null)
    try {
      for (const operativeId of selectedOperatives) {
        for (const slot of slotsList) {
          if (isExactDuplicateBooking(bookings, project.id, operativeId, slot)) continue
          const firestoreSlot = slotToFirestore(slot)
          await createBooking({
            operativeId,
            projectId: project.id,
            date: slot.date,
            timeSlot: firestoreSlot.timeSlot,
            workStartTime: firestoreSlot.workStartTime,
            workEndTime: firestoreSlot.workEndTime,
            bookedBy: user.email,
            status: 'confirmed',
            organizationId: organization.id,
          })
        }
      }
      cancelClashReview()
      router.push(scheduleBasePath)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create bookings')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmClick = async () => {
    if (!organization?.id || !user) return
    if (selectedOperatives.size === 0) {
      setError('Select at least one operative.')
      return
    }
    if (slotsList.length === 0) {
      setError('Select at least one date.')
      return
    }

    setError(null)
    const { summaries, pendingReview } = detectClashesForSelection()

    if (pendingReview.size > 0) {
      setOperativeClashSummaries(summaries)
      setClashReviewOperativeIds(pendingReview)
      setShowClashReview(true)
      return
    }

    await proceedWithBooking()
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-blue-700">{project.jobNumber}</p>
        <p className="text-lg font-semibold text-slate-900">{project.siteName}</p>
        <p className="mt-1 text-sm text-slate-600">
          {project.client?.name} · {[project.addressLine1, project.townCity, project.postcode].filter(Boolean).join(', ')}
        </p>
      </div>

      {showClashReview && (
        <OperativeClashReviewPanel
          clashesByOperative={clashGroups}
          onApprove={approveClashOperative}
          onDismissOperative={dismissClashOperative}
          onCancelAll={cancelClashReview}
          onConfirmBooking={proceedWithBooking}
          canConfirmBooking={selectedOperatives.size > 0 && slotsList.length > 0 && clashReviewOperativeIds.size === 0}
          saving={saving}
          viewer={user}
          operatives={activeOperatives}
        />
      )}

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operatives</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search operatives…"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {filteredOperatives.length === 0 ? (
            <p className="text-sm text-slate-500">No operatives found.</p>
          ) : (
            filteredOperatives.map((op) => (
              <label
                key={op.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedOperatives.has(op.id)}
                  onChange={() => toggleOperative(op.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {op.firstName} {op.lastName}
                  </p>
                  {op.email && <p className="text-xs text-slate-500">{op.email}</p>}
                </div>
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-slate-500">{selectedOperatives.size} operative(s) selected</p>
      </section>

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
          accent="blue"
        />
      </section>

      {error && <ErrorBanner message={error} />}

      {!showClashReview && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:pl-64">
          <div className="mx-auto max-w-3xl">
            <p className="mb-2 text-xs text-slate-500">
              {selectedOperatives.size} operative(s) × {slotsList.length} date(s)
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmClick}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </div>
      )}

      {showClashReview && clashReviewOperativeIds.size === 0 && approvedOverlapOperativeIds.size > 0 && (
        <p className="text-xs text-amber-700">
          Overlaps approved for {approvedOverlapOperativeIds.size} operative(s). Confirm booking above to continue — a warning will appear on the dashboard like the iOS app.
        </p>
      )}
    </div>
  )
}

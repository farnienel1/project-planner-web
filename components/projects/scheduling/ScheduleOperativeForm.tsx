'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { isExactDuplicateBooking } from '@/lib/scheduling/bookingClashUtils'
import {
  allDraftPeopleResolved,
  buildDraftPersonDayStates,
  isExactDuplicateManagerBooking,
  personHasBookableDays,
  personHasPendingClashes,
  type DraftBookingPerson,
  type WizardStep,
} from '@/lib/scheduling/draftProjectBooking'
import type { ManagerLocationType } from '@/lib/scheduling/managerSiteBookingUtils'
import type { SchedulablePerson } from '@/lib/scheduling/scheduleRosterUtils'
import {
  slotKey,
  slotToFirestore,
  sortedDateSlots,
  type ScheduleDateSlot,
} from '@/lib/scheduling/scheduleUtils'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { ScheduleBookingReviewStep } from '@/components/projects/scheduling/ScheduleBookingReviewStep'
import { ScheduleDatesStep } from '@/components/projects/scheduling/ScheduleDatesStep'
import { SchedulePersonPickerStep } from '@/components/projects/scheduling/SchedulePersonPickerStep'
import type { Project } from '@/types'

const STEP_LABELS: Record<WizardStep, string> = {
  dates: 'Dates',
  'pick-person': 'Add person',
  review: 'Review',
}

export function ScheduleOperativeForm({
  project,
  scheduleBasePath,
  managerLocationType = 'project',
}: {
  project: Project
  scheduleBasePath: string
  managerLocationType?: ManagerLocationType
}) {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings, createBooking, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, saveManagerSiteBooking } =
    useManagerScheduleStore()

  const [step, setStep] = useState<WizardStep>('dates')
  const [month, setMonth] = useState(new Date())
  const [quickDays, setQuickDays] = useState<number | null>(null)
  const [dateSlots, setDateSlots] = useState<Map<string, ScheduleDateSlot>>(new Map())
  const [draftPeople, setDraftPeople] = useState<DraftBookingPerson[]>([])
  const [expandedReviewPersonId, setExpandedReviewPersonId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) {
      loadOperatives(organization.id)
      loadUsers(organization.id)
      loadBookings(organization.id)
      loadManagerSiteBookings(organization.id)
      loadProjects(organization.id, true)
      loadSmallWorks(organization.id)
    }
  }, [
    organization?.id,
    loadOperatives,
    loadUsers,
    loadBookings,
    loadManagerSiteBookings,
    loadProjects,
    loadSmallWorks,
  ])

  const allProjects = useMemo(() => {
    const merged = mergeProjectsAndSmallWorks(projects, smallWorks)
    if (!merged.some((p) => p.id === project.id)) merged.push(project)
    return merged
  }, [projects, smallWorks, project])

  const slotsList = useMemo(() => sortedDateSlots(dateSlots), [dateSlots])
  const canConfirm = allDraftPeopleResolved(draftPeople) && slotsList.length > 0

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

  const rebuildDraftPerson = (draft: DraftBookingPerson, slots: ScheduleDateSlot[]): DraftBookingPerson => {
    const person: SchedulablePerson = {
      id: draft.personId,
      kind: draft.kind,
      name: draft.name,
      email: draft.email,
      badge: draft.badge,
    }
    return buildDraftPersonDayStates({
      person,
      slots,
      bookings,
      managerSiteBookings,
      operatives,
      users,
      projects: allProjects,
      currentProjectId: project.id,
    })
  }

  const rebuildDraftPeopleForNewSlots = (slots: ScheduleDateSlot[]) => {
    if (draftPeople.length > 0) {
      setDraftPeople((prev) =>
        prev.map((draft) => rebuildDraftPerson(draft, slots)).filter(personHasBookableDays)
      )
    }
  }

  useEffect(() => {
    if (slotsList.length === 0) {
      setDraftPeople([])
      if (step !== 'dates') setStep('dates')
      return
    }
    rebuildDraftPeopleForNewSlots(slotsList)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsList.map((s) => `${slotKey(s.date)}:${s.slot}:${s.workStartTime}:${s.workEndTime}`).join('|')])

  const handleTogglePerson = (person: SchedulablePerson) => {
    setError(null)
    setDraftPeople((prev) => {
      if (prev.some((row) => row.personId === person.id)) {
        return prev.filter((row) => row.personId !== person.id)
      }
      return [
        ...prev,
        buildDraftPersonDayStates({
          person,
          slots: slotsList,
          bookings,
          managerSiteBookings,
          operatives,
          users,
          projects: allProjects,
          currentProjectId: project.id,
        }),
      ]
    })
  }

  const handlePersonChange = (updated: DraftBookingPerson) => {
    setDraftPeople((prev) => {
      if (!personHasBookableDays(updated) && !personHasPendingClashes(updated)) {
        return prev.filter((row) => row.personId !== updated.personId)
      }
      return prev.map((row) => (row.personId === updated.personId ? updated : row))
    })
  }

  const confirmBooking = async () => {
    if (!organization?.id || !user || !canConfirm) return

    setSaving(true)
    setError(null)
    try {
      for (const person of draftPeople) {
        const personSlots = slotsList.filter((slot) => {
          const state = person.dayStates[slotKey(slot.date)]
          return state === 'free' || state === 'clash_accepted'
        })

        for (const slot of personSlots) {
          const firestoreSlot = slotToFirestore(slot)
          if (person.kind === 'operative') {
            if (isExactDuplicateBooking(bookings, project.id, person.personId, slot)) continue
            await createBooking({
              operativeId: person.personId,
              projectId: project.id,
              date: slot.date,
              timeSlot: firestoreSlot.timeSlot,
              workStartTime: firestoreSlot.workStartTime,
              workEndTime: firestoreSlot.workEndTime,
              bookedBy: user.email,
              status: 'confirmed',
              organizationId: organization.id,
            })
          } else {
            if (
              isExactDuplicateManagerBooking(
                managerSiteBookings,
                project.id,
                person.personId,
                slot
              )
            ) {
              continue
            }
            await saveManagerSiteBooking(organization.id, {
              userId: person.personId,
              date: slot.date,
              timeSlot: firestoreSlot.timeSlot,
              locationType: managerLocationType,
              locationId: project.id,
              workStartTime: firestoreSlot.workStartTime,
              workEndTime: firestoreSlot.workEndTime,
            })
          }
        }
      }
      router.push(scheduleBasePath)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create bookings')
    } finally {
      setSaving(false)
    }
  }

  const goToDates = () => {
    setError(null)
    setStep('dates')
  }

  const goToPickPerson = () => {
    setError(null)
    setStep('pick-person')
  }

  const primaryAction = () => {
    setError(null)
    if (step === 'dates') {
      if (slotsList.length === 0) {
        setError('Select at least one date.')
        return
      }
      setStep(draftPeople.length > 0 ? 'review' : 'pick-person')
      return
    }
    if (step === 'pick-person') {
      if (draftPeople.length === 0) {
        setError('Select at least one person.')
        return
      }
      if (!allDraftPeopleResolved(draftPeople)) {
        setError('Already booked people need ✓ to double-book that day, or ✕ to remove them.')
        return
      }
      setStep('review')
      return
    }
    void confirmBooking()
  }

  const primaryLabel = () => {
    if (saving) return 'Booking…'
    if (step === 'dates') return draftPeople.length > 0 ? 'Continue to review' : 'Add operative or manager'
    if (step === 'pick-person') return 'Review'
    return 'Confirm booking'
  }

  const primaryEnabled = () => {
    if (saving) return false
    if (step === 'dates') return slotsList.length > 0
    if (step === 'pick-person') return draftPeople.length > 0 && allDraftPeopleResolved(draftPeople)
    if (step === 'review') return canConfirm
    return true
  }

  const showBack =
    step === 'pick-person' || (step === 'review' && draftPeople.length > 0)

  const backAction = () => {
    if (step === 'pick-person') goToDates()
    else if (step === 'review') goToDates()
  }

  return (
    <div className="space-y-5 pb-32">
      <div className="card pad">
        <p className="text-xs font-semibold text-[var(--blue)]">{project.jobNumber}</p>
        <p className="text-lg font-semibold text-[var(--ink)]">{project.siteName}</p>
        <p className="mt-1 text-sm text-[var(--ink2)]">
          {project.client?.name} · {[project.addressLine1, project.townCity, project.postcode].filter(Boolean).join(', ')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['dates', 'pick-person', 'review'] as WizardStep[]).map((wizardStep) => {
          const active = step === wizardStep
          const reached =
            wizardStep === 'dates' ||
            (wizardStep === 'pick-person' && slotsList.length > 0) ||
            (wizardStep === 'review' && draftPeople.length > 0)
          return (
            <span
              key={wizardStep}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                active
                  ? 'bg-blue-600 text-white'
                  : reached
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {STEP_LABELS[wizardStep]}
            </span>
          )
        })}
      </div>

      {step === 'dates' && (
        <ScheduleDatesStep
          month={month}
          onMonthChange={setMonth}
          quickDays={quickDays}
          onQuickDaysChange={setQuickDays}
          dateSlots={dateSlots}
          onDateSlotsChange={setDateSlots}
          onSlotChange={handleSlotChange}
          onRemoveDate={handleRemoveDate}
        />
      )}

      {step === 'pick-person' && (
        <SchedulePersonPickerStep
          operatives={operatives}
          users={users}
          draftPeople={draftPeople}
          slots={slotsList}
          onTogglePerson={handleTogglePerson}
          onPersonChange={handlePersonChange}
        />
      )}

      {step === 'review' && (
        <ScheduleBookingReviewStep
          people={draftPeople}
          slots={slotsList}
          expandedPersonId={expandedReviewPersonId}
          onToggleExpand={(personId) =>
            setExpandedReviewPersonId((prev) => (prev === personId ? null : personId))
          }
          onRemovePerson={(personId) =>
            setDraftPeople((prev) => prev.filter((p) => p.personId !== personId))
          }
          onAddAnother={goToPickPerson}
        />
      )}

      {error && <ErrorBanner message={error} />}

      <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--line)] bg-[var(--card)]/95 p-4 backdrop-blur md:pl-64">
        <div className="mx-auto flex max-w-3xl gap-2">
          {showBack && (
            <button
              type="button"
              onClick={backAction}
              disabled={saving}
              className="btn ghost disabled:opacity-60"
            >
              Back
            </button>
          )}
          <button
            type="button"
            disabled={!primaryEnabled()}
            onClick={primaryAction}
            className={`btn primary flex-1 disabled:cursor-not-allowed disabled:opacity-60 ${
              step === 'review' && canConfirm ? '' : ''
            }`}
          >
            {primaryLabel()}
          </button>
        </div>
        {step === 'pick-person' || step === 'review' ? (
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-[var(--ink3)]">
            {draftPeople.length} person{draftPeople.length !== 1 ? 's' : ''} · {slotsList.length} date
            {slotsList.length !== 1 ? 's' : ''}
            {!allDraftPeopleResolved(draftPeople) && draftPeople.length > 0 && ' · Resolve clashes with ✓ or ✕'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

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
import { SchedulePersonResolveStep } from '@/components/projects/scheduling/SchedulePersonResolveStep'
import type { Project } from '@/types'

const STEP_LABELS: Record<WizardStep, string> = {
  dates: 'Dates',
  'pick-person': 'Add person',
  'resolve-person': 'Resolve clashes',
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
  const [activePerson, setActivePerson] = useState<DraftBookingPerson | null>(null)
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

  const rebuildDraftPeopleForNewSlots = (slots: ScheduleDateSlot[]) => {
    if (draftPeople.length === 0) return
    setDraftPeople((prev) =>
      prev
        .map((draft) => {
          const person: SchedulablePerson = {
            id: draft.personId,
            kind: draft.kind,
            name: draft.name,
            email: draft.email,
            badge: draft.kind === 'manager' ? 'Manager' : 'Operative',
          }
          return buildDraftPersonDayStates({
            person,
            slots,
            bookings,
            managerSiteBookings,
            operatives,
            projects: allProjects,
            currentProjectId: project.id,
          })
        })
        .filter(personHasBookableDays)
    )
  }

  useEffect(() => {
    if (slotsList.length === 0) {
      setDraftPeople([])
      setActivePerson(null)
      if (step !== 'dates') setStep('dates')
      return
    }
    rebuildDraftPeopleForNewSlots(slotsList)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsList.map((s) => `${slotKey(s.date)}:${s.slot}:${s.workStartTime}:${s.workEndTime}`).join('|')])

  const handleSelectPerson = (person: SchedulablePerson) => {
    setError(null)
    const draft = buildDraftPersonDayStates({
      person,
      slots: slotsList,
      bookings,
      managerSiteBookings,
      operatives,
      projects: allProjects,
      currentProjectId: project.id,
    })

    if (!personHasBookableDays(draft) && personHasPendingClashes(draft)) {
      setActivePerson(draft)
      setStep('resolve-person')
      return
    }

    if (!personHasBookableDays(draft)) {
      setError('This person has no available days on the selected dates.')
      return
    }

    if (personHasPendingClashes(draft)) {
      setActivePerson(draft)
      setStep('resolve-person')
      return
    }

    setDraftPeople((prev) => [...prev.filter((p) => p.personId !== draft.personId), draft])
    setStep('review')
  }

  const handleActivePersonResolved = () => {
    if (!activePerson) return
    if (personHasPendingClashes(activePerson)) {
      setError('Resolve every clash before continuing.')
      return
    }
    if (!personHasBookableDays(activePerson)) {
      setError('No days left for this person. Pick someone else or change dates.')
      setActivePerson(null)
      setStep('pick-person')
      return
    }
    setDraftPeople((prev) => [...prev.filter((p) => p.personId !== activePerson.personId), activePerson])
    setActivePerson(null)
    setError(null)
    setStep('review')
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
    setActivePerson(null)
    setError(null)
    setStep('dates')
  }

  const goToPickPerson = () => {
    setActivePerson(null)
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
      setStep(draftPeople.length > 0 ? 'review' : 'dates')
      return
    }
    if (step === 'resolve-person') {
      handleActivePersonResolved()
      return
    }
    void confirmBooking()
  }

  const primaryLabel = () => {
    if (saving) return 'Booking…'
    if (step === 'dates') return draftPeople.length > 0 ? 'Continue to review' : 'Add operative or manager'
    if (step === 'pick-person') return draftPeople.length > 0 ? 'Back to review' : 'Back to dates'
    if (step === 'resolve-person') return 'Add to booking'
    return 'Confirm booking'
  }

  const primaryEnabled = () => {
    if (saving) return false
    if (step === 'dates') return slotsList.length > 0
    if (step === 'resolve-person') {
      return activePerson ? !personHasPendingClashes(activePerson) && personHasBookableDays(activePerson) : false
    }
    if (step === 'review') return canConfirm
    return true
  }

  const showBack =
    step === 'pick-person' || step === 'resolve-person' || (step === 'review' && draftPeople.length > 0)

  const backAction = () => {
    if (step === 'pick-person') goToDates()
    else if (step === 'resolve-person') goToPickPerson()
    else if (step === 'review') goToDates()
  }

  return (
    <div className="space-y-5 pb-32">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-blue-700">{project.jobNumber}</p>
        <p className="text-lg font-semibold text-slate-900">{project.siteName}</p>
        <p className="mt-1 text-sm text-slate-600">
          {project.client?.name} · {[project.addressLine1, project.townCity, project.postcode].filter(Boolean).join(', ')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['dates', 'pick-person', 'resolve-person', 'review'] as WizardStep[]).map((wizardStep) => {
          const active = step === wizardStep
          const reached =
            wizardStep === 'dates' ||
            (wizardStep === 'pick-person' && slotsList.length > 0) ||
            (wizardStep === 'resolve-person' && activePerson !== null) ||
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
          onSelectPerson={handleSelectPerson}
        />
      )}

      {step === 'resolve-person' && activePerson && (
        <SchedulePersonResolveStep
          person={activePerson}
          slots={slotsList}
          onPersonChange={setActivePerson}
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

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:pl-64">
        <div className="mx-auto flex max-w-3xl gap-2">
          {showBack && (
            <button
              type="button"
              onClick={backAction}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Back
            </button>
          )}
          <button
            type="button"
            disabled={!primaryEnabled()}
            onClick={primaryAction}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              step === 'review' && canConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {primaryLabel()}
          </button>
        </div>
        {step === 'review' && (
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-slate-500">
            {draftPeople.length} person{draftPeople.length !== 1 ? 's' : ''} · {slotsList.length} date
            {slotsList.length !== 1 ? 's' : ''}
            {!canConfirm && draftPeople.length > 0 && ' · Resolve all clashes to confirm'}
          </p>
        )}
      </div>
    </div>
  )
}

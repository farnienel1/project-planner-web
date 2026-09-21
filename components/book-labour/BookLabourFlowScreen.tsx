/**
 * iOS parity source: Views/BookLabourFlowView.swift
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { visibleWorks } from '@/lib/access/workAccess'
import {
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  enabledScheduleLocationPicks,
  loadOrganizationDetails,
  type MyScheduleOptions,
  type OrgPayrollTimePolicy,
  type ScheduleLocationPick,
} from '@/lib/settings/organizationSettings'
import { isSmallWorksJobType, normalizeBookingStatus } from '@/lib/ios-parity/enums'
import { dateFromDayKey, dayKey, parseHhMm } from '@/lib/ios-parity/londonTime'
import { IosWriteValidationError } from '@/lib/ios-parity/firestoreCodec'
import { initialsFrom } from '@/lib/daily-overview/buildDailyOverview'
import {
  bookingsOverlapByInterval,
  managerClashInterval,
  intervalsOverlap,
} from '@/lib/warnings/clashIntervals'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Booking, Project } from '@/types'
import {
  bookLabourDayLine,
  buildBookLabourCandidates,
  type BookLabourCandidate,
} from '@/lib/book-labour/candidates'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { PanelHeader } from '@/components/settings/primitives'

type BookToTab = 'other' | 'projects' | 'smallWorks'
type ManagerSlot = 'FULL_DAY' | 'AM' | 'PM' | 'CUSTOM_HOURS'
type OperativeSlot = 'FULL DAY' | 'AM' | 'PM' | 'CUSTOM_HOURS'
type ReturnRoute = 'other' | { projectList: boolean }

type Phase =
  | { kind: 'pickPerson' }
  | { kind: 'pickDestination' }
  | { kind: 'pickOtherLocation' }
  | { kind: 'pickProject'; smallWorks: boolean }
  | {
      kind: 'pickSlotManager'
      locationType: ManagerLocationType
      locationId?: string
      customLocationName?: string
      returnRoute: ReturnRoute
    }
  | { kind: 'pickSlotOperative'; project: Project }
  | {
      kind: 'pickCustomManager'
      locationType: ManagerLocationType
      locationId?: string
      customLocationName?: string
      returnRoute: ReturnRoute
    }
  | { kind: 'pickCustomOperative'; project: Project }

function operativeSlotFromManager(slot: ManagerSlot): OperativeSlot {
  if (slot === 'FULL_DAY') return 'FULL DAY'
  if (slot === 'CUSTOM_HOURS') return 'CUSTOM_HOURS'
  return slot
}

function projectLocality(project: Project): string {
  const line = [project.townCity, project.postcode].map((s) => s?.trim()).filter(Boolean).join(' ')
  if (line) return line
  return project.siteAddress?.trim() || project.addressLine1?.trim() || ' '
}

type BookLabourFlowScreenProps = {
  date?: string
  from?: string
  onClose?: () => void
}

export function BookLabourFlowScreen({
  date: dateProp,
  from: fromProp,
  onClose,
}: BookLabourFlowScreenProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, organization } = useAuthStore()
  const { bookings, loadBookings, createBooking } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, saveManagerSiteBooking } = useManagerScheduleStore()
  const { operatives, loadOperatives, loading: operativesLoading } = useOperativeStore()
  const { users, loadUsers, loading: usersLoading } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings: holidays, loadBookings: loadHolidays } = useHolidayStore()

  const dateParam = dateProp || searchParams.get('date') || dayKey(new Date())
  const from = fromProp || searchParams.get('from')
  const day = useMemo(
    () => (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateFromDayKey(dateParam) : dateFromDayKey(dayKey(new Date()))),
    [dateParam]
  )
  const dayLine = bookLabourDayLine(day)

  const [phase, setPhase] = useState<Phase>({ kind: 'pickPerson' })
  const [multiSelect, setMultiSelect] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [party, setParty] = useState<BookLabourCandidate[]>([])
  const [projectSearch, setProjectSearch] = useState('')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [overlap, setOverlap] = useState<{ message: string; detailLines: string[]; onConfirm: () => void } | null>(
    null
  )
  const [customStart, setCustomStart] = useState('07:30')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [breakRemoved, setBreakRemoved] = useState(false)
  const [scheduleOpts, setScheduleOpts] = useState<MyScheduleOptions>({
    ...DEFAULT_MY_SCHEDULE,
    customItemEnabled: {},
  })
  const [payroll, setPayroll] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadHolidays(organization.id)
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.myScheduleOptions) setScheduleOpts(details.myScheduleOptions)
        if (details?.payrollTimePolicy) {
          setPayroll(details.payrollTimePolicy)
          setCustomStart(details.payrollTimePolicy.standardDayStart)
          setCustomEnd(details.payrollTimePolicy.standardDayEnd)
        }
      })
      .catch(() => {})
  }, [
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadUsers,
    loadProjects,
    loadSmallWorks,
    loadHolidays,
  ])

  const candidates = useMemo(
    () =>
      buildBookLabourCandidates({
        day,
        users,
        operatives,
        bookings,
        managerSiteBookings,
        holidays,
        payrollPolicy: payroll,
      }),
    [day, users, operatives, bookings, managerSiteBookings, holidays, payroll]
  )

  const allWorks = useMemo(() => [...projects, ...smallWorks], [projects, smallWorks])
  const liveProjects = useMemo(
    () =>
      visibleWorks({
        projects: allWorks,
        catalogue: 'projects',
        user,
        operatives,
        bookings,
        managerBookings: managerSiteBookings,
      }).filter((project) => project.isLive),
    [allWorks, user, operatives, bookings, managerSiteBookings]
  )
  const liveSmallWorks = useMemo(
    () =>
      visibleWorks({
        projects: allWorks,
        catalogue: 'smallWorks',
        user,
        operatives,
        bookings,
        managerBookings: managerSiteBookings,
      }).filter((project) => project.isLive),
    [allWorks, user, operatives, bookings, managerSiteBookings]
  )

  const otherPicks = enabledScheduleLocationPicks(scheduleOpts)
  const activeParty = party.length > 0 ? party : []
  const fallbackPerson = activeParty[0]
  const otherEnabled = otherPicks.length > 0

  function closeFlow() {
    if (onClose) {
      onClose()
      return
    }
    if (from === 'warnings') router.push('/dashboard/warnings')
    else router.push(`/dashboard/daily-overview?date=${dateParam}`)
  }

  function goBack() {
    switch (phase.kind) {
      case 'pickPerson':
        closeFlow()
        break
      case 'pickDestination':
        setPhase({ kind: 'pickPerson' })
        break
      case 'pickOtherLocation':
        setPhase({ kind: 'pickDestination' })
        break
      case 'pickProject':
        setProjectSearch('')
        setPhase({ kind: 'pickDestination' })
        break
      case 'pickSlotManager':
        if (phase.returnRoute === 'other') setPhase({ kind: 'pickOtherLocation' })
        else setPhase({ kind: 'pickProject', smallWorks: phase.returnRoute.projectList })
        break
      case 'pickSlotOperative':
        setPhase({ kind: 'pickProject', smallWorks: isSmallWorksJobType(phase.project.jobType) })
        break
      case 'pickCustomManager':
        setPhase({
          kind: 'pickSlotManager',
          locationType: phase.locationType,
          locationId: phase.locationId,
          customLocationName: phase.customLocationName,
          returnRoute: phase.returnRoute,
        })
        break
      case 'pickCustomOperative':
        setPhase({ kind: 'pickSlotOperative', project: phase.project })
        break
    }
  }

  function beginBooking(people: BookLabourCandidate[]) {
    if (people.length === 0) return
    setParty(people)
    setPhase({ kind: 'pickDestination' })
  }

  function projectForLocation(locationType: ManagerLocationType, locationId?: string): Project | undefined {
    if ((locationType !== 'project' && locationType !== 'small_work') || !locationId) return undefined
    return allWorks.find((project) => project.id === locationId)
  }

  function usesOperativePath(person: BookLabourCandidate, locationType: ManagerLocationType, project?: Project) {
    return person.usesOperativeProjectBookings && Boolean(project) && (locationType === 'project' || locationType === 'small_work')
  }

  function duplicateManager(
    userId: string,
    slot: ManagerSlot,
    locationType: ManagerLocationType,
    locationId?: string,
    custom?: string
  ) {
    return managerSiteBookings.some(
      (existing) =>
        existing.userId === userId &&
        dayKey(existing.date) === dayKey(day) &&
        existing.timeSlot === slot &&
        existing.locationType === locationType &&
        (existing.locationId || '') === (locationId || '') &&
        (existing.customLocationName || '') === (custom || '')
    )
  }

  function duplicateOperative(
    operativeId: string,
    projectId: string,
    slot: OperativeSlot,
    workStart?: string,
    workEnd?: string,
    breakOff?: boolean
  ) {
    return bookings.some(
      (existing) =>
        existing.operativeId === operativeId &&
        dayKey(existing.date) === dayKey(day) &&
        existing.projectId === projectId &&
        existing.timeSlot === slot &&
        (existing.workStartTime || '') === (workStart || '') &&
        (existing.workEndTime || '') === (workEnd || '') &&
        existing.isBreakRemoved === Boolean(breakOff) &&
        normalizeBookingStatus(existing.status) !== 'Cancelled'
    )
  }

  function managerWouldClash(userId: string, slot: ManagerSlot, workStart?: string, workEnd?: string) {
    const existing = managerSiteBookings.filter((booking) => booking.userId === userId && dayKey(booking.date) === dayKey(day))
    if (existing.length === 0) return false
    const probe: Pick<ManagerSiteBooking, 'timeSlot' | 'workStartTime' | 'workEndTime'> = {
      timeSlot: slot,
      workStartTime: workStart,
      workEndTime: workEnd,
    }
    const probeIv = managerClashInterval(probe, payroll)
    return existing.some((row) => {
      const iv = managerClashInterval(row, payroll)
      if (!probeIv || !iv) return false
      return intervalsOverlap(probeIv, iv)
    })
  }

  function operativeClashLines(
    operativeId: string,
    projectId: string,
    slot: OperativeSlot,
    workStart?: string,
    workEnd?: string,
    breakOff?: boolean
  ): string[] | null {
    const existing = bookings.filter(
      (booking) =>
        booking.operativeId === operativeId &&
        dayKey(booking.date) === dayKey(day) &&
        normalizeBookingStatus(booking.status) !== 'Cancelled' &&
        normalizeBookingStatus(booking.status) !== 'Completed'
    )
    if (existing.length === 0) return null
    const probe: Pick<Booking, 'timeSlot' | 'workStartTime' | 'workEndTime' | 'isBreakRemoved'> = {
      timeSlot: slot,
      workStartTime: workStart,
      workEndTime: workEnd,
      isBreakRemoved: breakOff,
    }
    const overlapping = existing.filter((row) => bookingsOverlapByInterval(probe, row, payroll))
    if (overlapping.length === 0) return null
    return overlapping.map((booking) => {
      const project = allWorks.find((p) => p.id === booking.projectId)
      const label = project ? `${project.jobNumber} ${project.siteName}` : 'Another job'
      return `${booking.timeSlot} · ${label}`
    })
  }

  async function savePartyBookings(args: {
    slot: ManagerSlot
    locationType: ManagerLocationType
    locationId?: string
    customLocationName?: string
    workStart?: string
    workEnd?: string
    breakRemoved?: boolean
    allowOperativeOverlap?: boolean
  }) {
    const people = activeParty
    if (people.length === 0 || !organization?.id || !user?.id) return
    const resolvedProject = projectForLocation(args.locationType, args.locationId)
    const operativeSlot = operativeSlotFromManager(args.slot)

    const managerClashNames: string[] = []
    for (const person of people) {
      if (usesOperativePath(person, args.locationType, resolvedProject)) continue
      if (duplicateManager(person.user.id, args.slot, args.locationType, args.locationId, args.customLocationName)) {
        continue
      }
      if (managerWouldClash(person.user.id, args.slot, args.workStart, args.workEnd)) {
        managerClashNames.push(person.displayName)
      }
    }
    if (managerClashNames.length > 0) {
      setErrorBanner(
        managerClashNames.length === 1
          ? 'This booking overlaps another in time on that day.'
          : `Overlapping bookings for: ${managerClashNames.join(', ')}.`
      )
      return
    }

    if (!args.allowOperativeOverlap) {
      const clashLines: string[] = []
      for (const person of people) {
        if (!usesOperativePath(person, args.locationType, resolvedProject) || !resolvedProject || !person.linkedOperative) {
          continue
        }
        const lines = operativeClashLines(
          person.linkedOperative.id,
          resolvedProject.id,
          operativeSlot,
          args.workStart,
          args.workEnd,
          args.breakRemoved
        )
        if (lines) clashLines.push(...lines.map((line) => `${person.displayName} · ${line}`))
      }
      if (clashLines.length > 0) {
        setOverlap({
          message:
            people.length > 1
              ? `One or more bookings overlap another in time on ${dayLine}.`
              : `This booking overlaps another in time on ${dayLine}.`,
          detailLines: clashLines,
          onConfirm: () => {
            setOverlap(null)
            void savePartyBookings({ ...args, allowOperativeOverlap: true })
          },
        })
        return
      }
    }

    setSaving(true)
    setErrorBanner(null)
    try {
      for (const person of people) {
        if (usesOperativePath(person, args.locationType, resolvedProject) && resolvedProject && person.linkedOperative) {
          if (
            duplicateOperative(
              person.linkedOperative.id,
              resolvedProject.id,
              operativeSlot,
              args.workStart,
              args.workEnd,
              args.breakRemoved
            )
          ) {
            continue
          }
          await createBooking({
            operativeId: person.linkedOperative.id,
            projectId: resolvedProject.id,
            date: day,
            timeSlot: operativeSlot,
            bookedBy: user.id,
            status: 'Confirmed',
            notes: '',
            workStartTime: args.workStart,
            workEndTime: args.workEnd,
            isBreakRemoved: args.breakRemoved === true,
            organizationId: organization.id,
          })
        } else {
          if (duplicateManager(person.user.id, args.slot, args.locationType, args.locationId, args.customLocationName)) {
            continue
          }
          await saveManagerSiteBooking(organization.id, {
            userId: person.user.id,
            date: day,
            timeSlot: args.slot,
            locationType: args.locationType,
            locationId: args.locationId,
            customLocationName: args.customLocationName,
            workStartTime: args.workStart,
            workEndTime: args.workEnd,
            isBreakRemoved: args.breakRemoved === true,
          })
        }
      }
      closeFlow()
    } catch (error) {
      const extra =
        error instanceof IosWriteValidationError && error.issues.length > 0 ? ` ${error.issues.join('; ')}` : ''
      setErrorBanner(`${error instanceof Error ? error.message : 'Could not book'}${extra}`)
    } finally {
      setSaving(false)
    }
  }

  function onSelectProject(project: Project, smallWorksList: boolean) {
    const people = activeParty
    if (people.some((p) => p.usesOperativeProjectBookings && !p.linkedOperative)) {
      setErrorBanner(
        people.length === 1
          ? 'No operative profile is linked to this user.'
          : 'No operative profile is linked to one of the selected users.'
      )
      return
    }
    if (people.length === 1 && people[0].usesOperativeProjectBookings) {
      setPhase({ kind: 'pickSlotOperative', project })
      return
    }
    setPhase({
      kind: 'pickSlotManager',
      locationType: smallWorksList ? 'small_work' : 'project',
      locationId: project.id,
      returnRoute: { projectList: smallWorksList },
    })
  }

  function validateCustomAndSave(
    locationType: ManagerLocationType,
    locationId?: string,
    customLocationName?: string
  ) {
    const start = parseHhMm(customStart)
    const end = parseHhMm(customEnd)
    if (start == null || end == null || end <= start) {
      setErrorBanner('Enter valid times with end after start.')
      return
    }
    void savePartyBookings({
      slot: 'CUSTOM_HOURS',
      locationType,
      locationId,
      customLocationName,
      workStart: customStart,
      workEnd: customEnd,
      breakRemoved,
    })
  }

  const isCustom = phase.kind === 'pickCustomManager' || phase.kind === 'pickCustomOperative'
  const title = isCustom ? 'Custom hours' : 'Book labour'
  const rosterLoading = (usersLoading && users.length === 0) || (operativesLoading && operatives.length === 0)

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <PanelHeader title={title} onBack={phase.kind === 'pickPerson' ? closeFlow : goBack} />

      {errorBanner ? (
        <div className="mt-4 rounded-xl border border-[#F4C0C0] bg-[#FCEBEB] px-4 py-3 text-[13px] text-[#A32D2D]">
          {errorBanner}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {phase.kind === 'pickPerson' && (
          <PickPerson
            dayLine={dayLine}
            candidates={candidates}
            loading={rosterLoading}
            multiSelect={multiSelect}
            selectedIds={selectedIds}
            onToggleMulti={() => {
              setMultiSelect((value) => !value)
              setSelectedIds(new Set())
            }}
            onToggleId={(id) => {
              setSelectedIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onPick={(person) => beginBooking([person])}
            onContinue={() => beginBooking(candidates.filter((c) => selectedIds.has(c.id)))}
          />
        )}

        {phase.kind !== 'pickPerson' && fallbackPerson ? (
          <PersonSummary people={activeParty} dayLine={dayLine} />
        ) : null}

        {(phase.kind === 'pickDestination' ||
          phase.kind === 'pickOtherLocation' ||
          phase.kind === 'pickProject') && (
          <BookToSelector
            otherEnabled={otherEnabled}
            selected={
              phase.kind === 'pickOtherLocation'
                ? 'other'
                : phase.kind === 'pickProject'
                  ? phase.smallWorks
                    ? 'smallWorks'
                    : 'projects'
                  : undefined
            }
            onOther={() => {
              if (!otherEnabled) return
              setPhase({ kind: 'pickOtherLocation' })
            }}
            onProjects={() => {
              setProjectSearch('')
              setPhase({ kind: 'pickProject', smallWorks: false })
            }}
            onSmallWorks={() => {
              setProjectSearch('')
              setPhase({ kind: 'pickProject', smallWorks: true })
            }}
          />
        )}

        {phase.kind === 'pickDestination' && !otherEnabled ? (
          <p className="px-1 text-[11px] text-[var(--ink3)]">
            Enable at least one location under Organisation → Schedule options to use Other.
          </p>
        ) : null}

        {phase.kind === 'pickOtherLocation' && (
          <LocationList
            picks={otherPicks}
            onPick={(pick) =>
              setPhase({
                kind: 'pickSlotManager',
                locationType: pick.locationType,
                customLocationName: pick.customLocationName,
                returnRoute: 'other',
              })
            }
          />
        )}

        {phase.kind === 'pickProject' && (
          <ProjectList
            smallWorks={phase.smallWorks}
            search={projectSearch}
            onSearch={setProjectSearch}
            list={phase.smallWorks ? liveSmallWorks : liveProjects}
            onPick={(project) => onSelectProject(project, phase.smallWorks)}
          />
        )}

        {phase.kind === 'pickSlotManager' && (
          <SlotPicker
            label={slotLocationLabel(phase, allWorks)}
            dayLine={dayLine}
            disabled={saving}
            onSlot={(slot) =>
              void savePartyBookings({
                slot,
                locationType: phase.locationType,
                locationId: phase.locationId,
                customLocationName: phase.customLocationName,
              })
            }
            onCustom={() =>
              setPhase({
                kind: 'pickCustomManager',
                locationType: phase.locationType,
                locationId: phase.locationId,
                customLocationName: phase.customLocationName,
                returnRoute: phase.returnRoute,
              })
            }
          />
        )}

        {phase.kind === 'pickSlotOperative' && (
          <SlotPicker
            label={`${phase.project.jobNumber} ${phase.project.siteName}`}
            dayLine={dayLine}
            disabled={saving}
            onSlot={(slot) =>
              void savePartyBookings({
                slot,
                locationType: isSmallWorksJobType(phase.project.jobType) ? 'small_work' : 'project',
                locationId: phase.project.id,
              })
            }
            onCustom={() => setPhase({ kind: 'pickCustomOperative', project: phase.project })}
          />
        )}

        {(phase.kind === 'pickCustomManager' || phase.kind === 'pickCustomOperative') && (
          <CustomHoursForm
            start={customStart}
            end={customEnd}
            breakRemoved={breakRemoved}
            policy={payroll}
            saving={saving}
            onStart={setCustomStart}
            onEnd={setCustomEnd}
            onBreak={setBreakRemoved}
            onSave={() => {
              if (phase.kind === 'pickCustomManager') {
                validateCustomAndSave(phase.locationType, phase.locationId, phase.customLocationName)
              } else {
                validateCustomAndSave(
                  isSmallWorksJobType(phase.project.jobType) ? 'small_work' : 'project',
                  phase.project.id
                )
              }
            }}
          />
        )}
      </div>

      {overlap ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-[15px] font-semibold">Booking overlap</p>
            <p className="mt-2 text-[13px] text-[var(--ink3)]">{overlap.message}</p>
            <ul className="mt-3 space-y-1 text-[12px]">
              {overlap.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] px-4 py-2 text-[13px] font-medium"
                onClick={() => setOverlap(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--blue)] px-4 py-2 text-[13px] font-semibold text-white"
                onClick={overlap.onConfirm}
              >
                Book anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function slotLocationLabel(
  phase: Extract<Phase, { kind: 'pickSlotManager' }>,
  projects: Project[]
): string {
  if (phase.locationType === 'office') return 'Office'
  if (phase.locationType === 'working_from_home') return 'Working from home'
  if (phase.locationType === 'site_survey') return 'Site survey'
  if (phase.locationType === 'custom') return phase.customLocationName || 'Custom'
  const project = projects.find((p) => p.id === phase.locationId)
  return project ? `${project.jobNumber} ${project.siteName}` : 'Site'
}

function PersonSummary({ people, dayLine }: { people: BookLabourCandidate[]; dayLine: string }) {
  const first = people[0]
  let title = 'No one selected'
  let subtitle = dayLine
  if (people.length === 1) title = people[0].displayName
  else if (people.length <= 3) {
    title = people.map((p) => p.displayName).join(', ')
    subtitle = `${people.length} people · ${dayLine}`
  } else if (people.length > 3) {
    title = `${people.length} people`
    subtitle = `${people
      .slice(0, 2)
      .map((p) => p.displayName)
      .join(', ')} +${people.length - 2} · ${dayLine}`
  }
  return (
    <div className="flex items-center gap-3 card p-3">
      <Avatar name={first?.displayName || 'P'} operative={first?.user.permissions.operativeMode} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{title}</p>
        <p className="text-[11px] text-[var(--ink3)]">{subtitle}</p>
      </div>
    </div>
  )
}

function Avatar({ name, operative }: { name: string; operative?: boolean }) {
  return (
    <span
      className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[12px] font-medium text-white ${
        operative
          ? 'bg-gradient-to-br from-[#185FA5] to-[#378ADD]'
          : 'bg-gradient-to-br from-[#534AB7] to-[#7F77DD]'
      }`}
    >
      {initialsFrom(name)}
    </span>
  )
}

function RoleChips({ person }: { person: BookLabourCandidate }) {
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {person.user.permissions.operativeMode ? (
        <Chip label="Operative" className="bg-[var(--blue-t)] text-[var(--blue)]" />
      ) : (
        person.roleChips
          .filter((chip) => chip !== 'Operative')
          .map((chip) => <Chip key={chip} label={chip} className="bg-[#EEEDFE] text-[#3C3489]" />)
      )}
      {person.tradeDisplay ? <Chip label={person.tradeDisplay} className="bg-[#FBEAF0] text-[#993556]" /> : null}
    </div>
  )
}

function Chip({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-1.5 py-px text-[9px] font-medium ${className}`}>{label}</span>
}

function PickPerson({
  dayLine,
  candidates,
  loading,
  multiSelect,
  selectedIds,
  onToggleMulti,
  onToggleId,
  onPick,
  onContinue,
}: {
  dayLine: string
  candidates: BookLabourCandidate[]
  loading: boolean
  multiSelect: boolean
  selectedIds: Set<string>
  onToggleMulti: () => void
  onToggleId: (id: string) => void
  onPick: (person: BookLabourCandidate) => void
  onContinue: () => void
}) {
  if (loading) {
    return (
      <div className="card py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue)] border-t-transparent" />
        <p className="mt-3 text-[13px] text-[var(--ink3)]">Loading unbooked labour…</p>
      </div>
    )
  }
  if (candidates.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-[17px] font-semibold">Everyone is booked</p>
        <p className="mt-2 text-[13px] text-[var(--ink3)]">
          No unbooked team members for this day, or only weekdays show unbooked labour.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-[14px] bg-[#FCEBEB] px-3 py-2.5">
        <p className="flex-1 text-[12px] font-medium text-[#A32D2D]">
          {dayLine} · {candidates.length} unbooked
        </p>
        <button
          type="button"
          onClick={onToggleMulti}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            multiSelect ? 'bg-[var(--blue)] text-white' : 'bg-white/70 text-[#A32D2D]'
          }`}
        >
          {multiSelect ? 'Multi-select on' : 'Multi-select'}
        </button>
      </div>
      <p className="px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">
        {multiSelect ? 'Select people' : 'Select a person'}
      </p>
      <div className="divide-y divide-[var(--line)] overflow-hidden card">
        {candidates.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => (multiSelect ? onToggleId(person.id) : onPick(person))}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-[var(--bg)]"
          >
            {multiSelect ? (
              <span
                className={`grid h-5 w-5 place-items-center rounded-full border ${
                  selectedIds.has(person.id) ? 'border-[var(--blue)] bg-[var(--blue)] text-white' : 'border-[var(--ink3)]'
                }`}
              >
                {selectedIds.has(person.id) ? '✓' : ''}
              </span>
            ) : null}
            <Avatar name={person.displayName} operative={person.user.permissions.operativeMode} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{person.displayName}</p>
              <RoleChips person={person} />
            </div>
            {!multiSelect ? <span className="text-[var(--ink3)]">›</span> : null}
          </button>
        ))}
      </div>
      {multiSelect ? (
        <button
          type="button"
          disabled={selectedIds.size === 0}
          onClick={onContinue}
          className="btn primary block disabled:bg-[var(--ink3)]"
        >
          {selectedIds.size === 0 ? 'Continue' : `Continue · ${selectedIds.size}`}
        </button>
      ) : null}
    </div>
  )
}

function BookToSelector({
  otherEnabled,
  selected,
  onOther,
  onProjects,
  onSmallWorks,
}: {
  otherEnabled: boolean
  selected?: BookToTab
  onOther: () => void
  onProjects: () => void
  onSmallWorks: () => void
}) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">Book to</p>
      <div className="grid grid-cols-3 gap-2">
        <BookToCell
          label="Other"
          selected={selected === 'other'}
          enabled={otherEnabled}
          accent="var(--blue)"
          fill="#E6F1FB"
          onClick={onOther}
        />
        <BookToCell
          label="Projects"
          selected={selected === 'projects'}
          enabled
          accent="#0F6E56"
          fill="#E1F5EE"
          onClick={onProjects}
        />
        <BookToCell
          label="Small works"
          selected={selected === 'smallWorks'}
          enabled
          accent="#854F0B"
          fill="#FAECE7"
          onClick={onSmallWorks}
        />
      </div>
    </div>
  )
}

function BookToCell({
  label,
  selected,
  enabled,
  accent,
  fill,
  onClick,
}: {
  label: string
  selected: boolean
  enabled: boolean
  accent: string
  fill: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className="rounded-xl border py-2.5 text-[11px] font-medium disabled:opacity-45"
      style={{
        borderColor: selected ? accent : '#E5E7EB',
        background: selected ? fill : '#fff',
        color: selected ? accent : enabled ? '#111827' : '#9CA3AF',
        borderWidth: selected ? 1.5 : 0.5,
      }}
    >
      {label}
    </button>
  )
}

function LocationList({
  picks,
  onPick,
}: {
  picks: ScheduleLocationPick[]
  onPick: (pick: ScheduleLocationPick) => void
}) {
  if (picks.length === 0) {
    return (
      <p className="card py-10 text-center text-[13px] text-[var(--ink3)]">
        Enable at least one location under Organisation → Schedule options to use Other.
      </p>
    )
  }
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">Select location</p>
      <div className="divide-y divide-[var(--line)] overflow-hidden card">
        {picks.map((pick) => (
          <button
            key={pick.id}
            type="button"
            onClick={() => onPick(pick)}
            className="flex w-full items-center justify-between px-3.5 py-3 text-left text-[13px] font-medium hover:bg-[var(--bg)]"
          >
            {pick.title}
            <span className="text-[var(--ink3)]">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ProjectList({
  smallWorks,
  search,
  onSearch,
  list,
  onPick,
}: {
  smallWorks: boolean
  search: string
  onSearch: (value: string) => void
  list: Project[]
  onPick: (project: Project) => void
}) {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? list.filter((project) =>
        [project.jobNumber, project.siteName, project.siteAddress, project.townCity, project.postcode]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    : list
  if (list.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-[17px] font-semibold">No live {smallWorks ? 'small works' : 'projects'}</p>
        <p className="mt-2 text-[13px] text-[var(--ink3)]">Create or activate work to book here.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={smallWorks ? 'Search small works…' : 'Search projects…'}
        className="w-full rounded-xl border border-[var(--line2)] bg-[var(--card)] px-3 py-2 text-[14px] outline-none"
      />
      <p className="px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">
        {smallWorks ? 'Active small works' : 'Active projects'} · {filtered.length}
      </p>
      <div className="divide-y divide-[var(--line)] overflow-hidden card">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--ink3)]">No matches</p>
        ) : (
          filtered.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onPick(project)}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-[var(--bg)]"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  <span className={smallWorks ? 'text-[#854F0B]' : 'text-[var(--blue)]'}>{project.jobNumber}</span>{' '}
                  {project.siteName}
                </p>
                <p className="truncate text-[10px] text-[var(--ink3)]">{projectLocality(project)}</p>
              </div>
              <span className="text-[var(--ink3)]">›</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function SlotPicker({
  label,
  dayLine,
  disabled,
  onSlot,
  onCustom,
}: {
  label: string
  dayLine: string
  disabled: boolean
  onSlot: (slot: ManagerSlot) => void
  onCustom: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-[15px] font-semibold">{label}</p>
      <p className="text-[11px] text-[var(--ink3)]">{dayLine}</p>
      <p className="px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">Select slot</p>
      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            ['FULL_DAY', 'FULL DAY'],
            ['AM', 'AM'],
            ['PM', 'PM'],
          ] as const
        ).map(([slot, title]) => (
          <button
            key={slot}
            type="button"
            disabled={disabled}
            onClick={() => onSlot(slot)}
            className="rounded-xl border border-[var(--blue)]/35 bg-[var(--blue-t)] py-3 text-[13px] font-medium text-[var(--blue)] disabled:opacity-50"
          >
            {title}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onCustom}
        className="w-full rounded-xl border border-[var(--blue)]/35 bg-[var(--blue-t)] py-3 text-[13px] font-medium text-[var(--blue)] disabled:opacity-50"
      >
        Custom
      </button>
    </div>
  )
}

function CustomHoursForm({
  start,
  end,
  breakRemoved,
  policy,
  saving,
  onStart,
  onEnd,
  onBreak,
  onSave,
}: {
  start: string
  end: string
  breakRemoved: boolean
  policy: OrgPayrollTimePolicy
  saving: boolean
  onStart: (value: string) => void
  onEnd: (value: string) => void
  onBreak: (value: boolean) => void
  onSave: () => void
}) {
  return (
    <div className="space-y-4 card p-4">
      <HoursTimelinePicker
        start={start}
        end={end}
        breakRemoved={breakRemoved}
        policy={policy}
        onStart={onStart}
        onEnd={onEnd}
        onBreak={onBreak}
      />
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="w-full rounded-[14px] bg-[var(--blue)] py-3 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

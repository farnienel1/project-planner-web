'use client'
import { OvertimeRateField } from '@/components/overtime/OvertimeRateField'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@/components/ui'
import { formatAbbreviatedDayInZone } from '@/lib/orgTime/zoneTime'
import { FilterChip } from '@/components/ios/primitives'
import { HoursBreakdownCard } from '@/components/schedule/HoursBreakdownCard'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import {
  bookingDayKey,
  confirmCustomHoursBreak,
  customHoursPrefillForDate,
  policyForBookingDate,
  weekendBreakdownForDates,
  weekdayExplanationForDate,
} from '@/lib/scheduling/bookingSlotRules'
import { CustomOtherLocationField } from '@/components/scheduling/CustomOtherLocationField'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useBookingConflictGate } from '@/components/scheduling/BookingConflictRows'
import { useLeaveConflictCheck } from '@/components/scheduling/useLeaveConflictCheck'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { bookableWorks } from '@/lib/access/workAccess'
import { useDeadlineAssignedProjectIds } from '@/lib/deadlines/useDeadlineAssignedProjectIds'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { splitBookingMoveCatalogues } from '@/lib/projects/bookingMoveCatalogues'
import { worksInTab, worksTabCounts } from '@/lib/canonical'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { hoursBreakdown } from '@/lib/scheduling/paidHours'
import {
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  enabledScheduleLocationPicks,
  loadOrganizationDetails,
  oneOffCustomLocationPick,
  type MyScheduleOptions,
  type OrgPayrollTimePolicy,
  type ScheduleLocationPick,
} from '@/lib/settings/organizationSettings'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OverviewPersonRow } from '@/lib/daily-overview/buildDailyOverview'
import type { Project } from '@/types'
import { hasAdminAccess } from '@/lib/permissions'
import { userBookingRemoveAction } from '@/lib/access/bookingAccess'
import { canBookOtherLocationsFor, normalizeDocumentId, organizationOvertimeMultiplier, overtimeMultiplierMoveFields } from '@/lib/canonical'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { webJobAccessViewer } from '@/lib/access/readPlan'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

type DestTab = 'other' | 'projects' | 'smallWorks'
type StatusFilter = 'active' | 'upcoming' | 'completed'

export type OverviewBookingTarget = OverviewPersonRow | {
  id: string
  name: string
  kind: 'manager'
  bookingId: string
  userId: string
  operativeId?: string
  timeSlotRaw?: string
  workStartTime?: string
  workEndTime?: string
  locationType?: ManagerLocationType
  customLocationName?: string
  projectId?: string
}

function slotKindFromRaw(raw?: string): 'AM' | 'PM' | 'CUSTOM_HOURS' | 'FULL' {
  const compact = (raw || '').toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (compact === 'AM') return 'AM'
  if (compact === 'PM') return 'PM'
  if (compact.includes('CUSTOM')) return 'CUSTOM_HOURS'
  return 'FULL'
}

function operativeSlotFromRaw(raw?: string): string {
  const kind = slotKindFromRaw(raw)
  return kind === 'FULL' ? 'FULL DAY' : kind
}

function managerSlotFromRaw(raw?: string): string {
  const kind = slotKindFromRaw(raw)
  return kind === 'FULL' ? 'FULL_DAY' : kind
}

export function DailyOverviewBookingSheet({
  row,
  day,
  onClose,
}: {
  row: OverviewBookingTarget
  day: Date
  onClose: () => void
}) {
  const { user, organization } = useAuthStore()
  const deadlineAssignedProjectIds = useDeadlineAssignedProjectIds()
  const { bookings, createBooking, updateBooking, deleteBooking } = useBookingStore()
  const {
    managerSiteBookings,
    updateManagerSiteBooking,
    saveManagerSiteBooking,
    deleteManagerSiteBooking,
  } = useManagerScheduleStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { operatives, managers } = useOperativeStore()
  const { users } = useOrgUserStore()
  const [tab, setTab] = useState<DestTab | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduleOpts, setScheduleOpts] = useState<MyScheduleOptions>({
    ...DEFAULT_MY_SCHEDULE,
    customItemEnabled: {},
  })
  const [payroll, setPayroll] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const [workStartTime, setWorkStartTime] = useState(row.workStartTime || DEFAULT_PAYROLL_POLICY.standardDayStart)
  const [workEndTime, setWorkEndTime] = useState(row.workEndTime || DEFAULT_PAYROLL_POLICY.standardDayEnd)
  const [breakRemoved, setBreakRemoved] = useState(false)
  // Rulebook 1.29.0 §25: the labour booking's own overtime rate (`otMultiplierOverride`; null = the organisation's).
  const storedRate = (() => {
    const stored =
      bookings.find((entry) => entry.id === row.bookingId)?.otMultiplierOverride ??
      managerSiteBookings.find((entry) => entry.id === row.bookingId)?.otMultiplierOverride
    return typeof stored === 'number' ? stored : null
  })()
  const [overtimeRate, setOvertimeRate] = useState<number | null>(storedRate)
  // Rulebook 1.32.0 (review fix r274 S4): the rate travels with every save — hours, another job, Other — and with a
  // move to the other collection (a new document); never stored when it equals the organisation's (decision A).
  const { data: rateOrgDocument } = useOrganizationDocument()
  const rateFields = (newDocument: boolean) =>
    overtimeMultiplierMoveFields({
      stored: storedRate,
      chosen: overtimeRate,
      organizationMultiplier: organizationOvertimeMultiplier(rateOrgDocument ?? {}, bookingDayKey(day), timeZone),
      newDocument,
    })
  const hoursTouched = useRef(false)
  const leaveCheck = useLeaveConflictCheck(payroll)
  const leaveGate = useBookingConflictGate('Save')
  // Rulebook 1.19.0 (`customHoursPrefillForDays`): a booking with no clock times opens with that day's own prefill —
  // a set-window Saturday's window, else the standard day in effect on the day — never today's weekday day.
  const prefill = customHoursPrefillForDate(day, payroll)

  useEffect(() => {
    if (!organization?.id) return
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.myScheduleOptions) setScheduleOpts(details.myScheduleOptions)
        if (details?.payrollTimePolicy) setPayroll(details.payrollTimePolicy)
      })
      .catch(() => {})
  }, [organization?.id, loadProjects, loadSmallWorks])

  useEffect(() => {
    hoursTouched.current = false
    const operative = bookings.find((entry) => entry.id === row.bookingId)
    const manager = managerSiteBookings.find((entry) => entry.id === row.bookingId)
    setBreakRemoved(operative?.isBreakRemoved === true || manager?.isBreakRemoved === true)
    setWorkStartTime(row.workStartTime || prefill.start)
    setWorkEndTime(row.workEndTime || prefill.end)
    // Seed once per booking. Later store updates must not wipe slider changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.bookingId])

  useEffect(() => {
    if (hoursTouched.current) return
    if (row.workStartTime && row.workEndTime) return
    setWorkStartTime(row.workStartTime || prefill.start)
    setWorkEndTime(row.workEndTime || prefill.end)
  }, [row.bookingId, row.workStartTime, row.workEndTime, prefill.start, prefill.end])

  const catalogues = useMemo(() => splitBookingMoveCatalogues(projects, smallWorks), [projects, smallWorks])
  // Rulebook 1.21.0 §21 (`bookableJobs`): the jobs this viewer may book onto — visible, not inactive and writable
  // (`canWriteBooking`); the job's dates are never checked. The tabs below only sort that list.
  const timeZone = useOrganizationTimeZone()
  const accessInput = {
    user,
    operatives,
    managers,
    bookings,
    managerBookings: managerSiteBookings,
    deadlineAssignedProjectIds,
  }
  const visibleProjects = useMemo(
    () => bookableWorks({ ...accessInput, projects: catalogues.projects, catalogue: 'projects' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogues.projects, user, operatives, managers, bookings, managerSiteBookings, deadlineAssignedProjectIds]
  )
  const visibleSmallWorks = useMemo(
    () => bookableWorks({ ...accessInput, projects: catalogues.smallWorks, catalogue: 'smallWorks' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogues.smallWorks, user, operatives, managers, bookings, managerSiteBookings, deadlineAssignedProjectIds]
  )
  const otherPicks = enabledScheduleLocationPicks(scheduleOpts)
  const catalogue = tab === 'smallWorks' ? visibleSmallWorks : visibleProjects
  const counts = useMemo(() => worksTabCounts(catalogue, Date.now(), timeZone), [catalogue, timeZone])
  const filtered = worksInTab(catalogue, statusFilter, Date.now(), timeZone).filter((project) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return project.siteName.toLowerCase().includes(q) || project.jobNumber.toLowerCase().includes(q)
  })

  const resolvedUserId = useMemo(() => {
    if (row.userId) return row.userId
    if (!row.operativeId) return undefined
    const op = operatives.find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(row.operativeId))
    if (!op) return undefined
    const byEmail = users.find((entry) => entry.email.trim().toLowerCase() === op.email.trim().toLowerCase())
    if (byEmail) return byEmail.id
    return users.find((entry) => normalizeDocumentId(findOperativeForUser(entry, operatives)?.id) === normalizeDocumentId(row.operativeId))?.id
  }, [row.userId, row.operativeId, operatives, users])

  // Rulebook §2 (1.33.0): moving a labour booking to Other deletes it (there is no cancel), so it is offered only when
  // the viewer may also delete that booking (`bookingRemoveAction`), never refused half-way.
  const labourRemoveAction =
    row.kind === 'operative' && row.bookingId
      ? userBookingRemoveAction(
          user,
          { collection: 'bookings', projectId: row.projectId },
          [...projects, ...smallWorks].find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(row.projectId)),
          managers
        )
      : 'delete'
  const otherForPerson = canBookOtherLocationsFor(webJobAccessViewer(user), resolvedUserId ? [resolvedUserId] : [])
  const otherAllowed = otherForPerson && labourRemoveAction === 'delete'

  const linkedOperative = useMemo(() => {
    if (row.operativeId) return operatives.find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(row.operativeId))
    if (!resolvedUserId) return undefined
    const matchedUser = users.find((entry) => entry.id === resolvedUserId)
    return matchedUser ? findOperativeForUser(matchedUser, operatives) : undefined
  }, [row.operativeId, resolvedUserId, operatives, users])

  const allWorks = useMemo(() => [...catalogues.projects, ...catalogues.smallWorks], [catalogues])

  const currentLabel = useMemo(() => {
    if (row.locationType === 'office') return 'Office'
    if (row.locationType === 'working_from_home') return 'Working from home'
    if (row.locationType === 'site_survey') return 'Site survey'
    if (row.locationType === 'custom') return row.customLocationName || 'Custom'
    const project = row.projectId ? allWorks.find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(row.projectId)) : undefined
    if (project) return `${project.jobNumber} · ${project.siteName}`
    return row.kind === 'operative' ? 'Project booking' : 'Current booking'
  }, [row, allWorks])

  const hoursValid = useMemo(() => {
    const start = workStartTime.split(':').map(Number)
    const end = workEndTime.split(':').map(Number)
    const startMin = (start[0] || 0) * 60 + (start[1] || 0)
    const endMin = (end[0] || 0) * 60 + (end[1] || 0)
    return endMin > startMin
  }, [workStartTime, workEndTime])

  const breakdown = useMemo(
    () =>
      hoursBreakdown({
        timeSlot: 'CUSTOM_HOURS',
        workStartTime,
        workEndTime,
        isBreakRemoved: breakRemoved,
        // Rulebook 1.19.0: the working hours in effect on the day shown.
        policy: policyForBookingDate(day, payroll) ?? payroll,
        dayKey: bookingDayKey(day),
      }),
    [workStartTime, workEndTime, breakRemoved, payroll, day]
  )

  const hoursFields = () => ({
    timeSlot: 'CUSTOM_HOURS',
    workStartTime,
    workEndTime,
    isBreakRemoved: breakRemoved,
  })

  // 1.13.0 lunch warning (`customHoursBreakWarning`): the confirm step before custom hours are saved.
  const breakConfirmed = () => confirmCustomHoursBreak(payroll, day, hoursFields())

  // Rulebook 1.16.0 §5 (`bookingLeaveConflicts`): annual leave on this day is asked before the change saves; ✕ drops
  // the day, so nothing is saved.
  const leaveConfirmed = async (): Promise<boolean> => {
    const operativeId = row.kind === 'operative' ? row.operativeId : linkedOperative?.id
    const userId = resolvedUserId || row.userId || null
    const personId = operativeId || userId
    if (!personId) return true
    const rows = leaveCheck.checkFor(
      {
        id: personId,
        userId,
        operativeIds: operativeId ? [operativeId] : [],
        email: operatives.find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(operativeId))?.email ?? null,
        name: row.name,
      },
      day,
      row.bookingId ? [row.bookingId] : []
    )(hoursFields())
    const dropped = await leaveGate.check(rows)
    if (dropped === null) return false
    if (dropped.size > 0) {
      onClose()
      return false
    }
    return true
  }

  const saveToProject = async (project: Project, asSmallWork: boolean) => {
    if (!organization?.id || !row.bookingId || !user || !hoursValid) return
    if (!breakConfirmed()) return
    if (!(await leaveConfirmed())) return
    setSaving(true)
    setError(null)
    try {
      const hours = hoursFields()
      if (row.kind === 'operative') {
        await updateBooking(row.bookingId, { projectId: project.id, ...hours, ...rateFields(false) })
      } else if (linkedOperative) {
        await createBooking({
          operativeId: linkedOperative.id,
          projectId: project.id,
          date: day,
          timeSlot: operativeSlotFromRaw('CUSTOM_HOURS'),
          bookedBy: user.id,
          status: 'Confirmed',
          notes: '',
          workStartTime: hours.workStartTime,
          workEndTime: hours.workEndTime,
          isBreakRemoved: hours.isBreakRemoved,
          ...(rateFields(true) as { otMultiplierOverride?: number }),
          organizationId: organization.id,
        })
        await deleteManagerSiteBooking(organization.id, row.bookingId)
      } else {
        await updateManagerSiteBooking(organization.id, row.bookingId, {
          locationType: asSmallWork ? 'small_work' : 'project',
          locationId: project.id,
          customLocationName: undefined,
          ...hours,
          ...rateFields(false),
        })
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update booking')
    } finally {
      setSaving(false)
    }
  }

  const saveToOther = async (pick: ScheduleLocationPick) => {
    if (!organization?.id || !hoursValid) return
    if (!breakConfirmed()) return
    if (!(await leaveConfirmed())) return
    if (!resolvedUserId) {
      setError('This person needs a user account to be booked to Other.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const hours = hoursFields()
      if (row.kind === 'operative' && row.bookingId) {
        await saveManagerSiteBooking(organization.id, {
          userId: resolvedUserId,
          date: day,
          timeSlot: managerSlotFromRaw('CUSTOM_HOURS'),
          locationType: pick.locationType,
          customLocationName: pick.customLocationName,
          workStartTime: hours.workStartTime,
          workEndTime: hours.workEndTime,
          isBreakRemoved: hours.isBreakRemoved,
          ...rateFields(true),
        })
        // The labour booking moves to the manager schedule: it is deleted with its tombstone. Other is offered only
        // when `bookingRemoveAction` is `delete` (`otherAllowed`), so this delete is never refused after the save.
        await deleteBooking(row.bookingId, organization.id)
      } else if (row.bookingId) {
        await updateManagerSiteBooking(organization.id, row.bookingId, {
          locationType: pick.locationType,
          locationId: undefined,
          customLocationName: pick.customLocationName,
          ...hours,
          ...rateFields(false),
        })
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update booking')
    } finally {
      setSaving(false)
    }
  }

  const saveHoursOnly = async () => {
    if (!organization?.id || !row.bookingId || !hoursValid) return
    if (!(await leaveConfirmed())) return
    setSaving(true)
    setError(null)
    try {
      const hours = hoursFields()
      if (row.kind === 'operative') {
        await updateBooking(row.bookingId, { ...hours, ...rateFields(false) })
      } else {
        await updateManagerSiteBooking(organization.id, row.bookingId, {
          ...hours,
          ...rateFields(false),
        })
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update booking')
    } finally {
      setSaving(false)
    }
  }

  const openTab = (next: DestTab) => {
    setTab(next)
    setSearch('')
    setStatusFilter('active')
  }

  return (
    <Modal
      open
      hue="daily"
      title={row.name}
      subtitle={`Change this booking · ${formatAbbreviatedDayInZone(day, organizationZoneOr())}`}
      onClose={onClose}
      footer={false}
    >
      {leaveGate.dialog}
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted small">
          Currently booked to <b>{currentLabel}</b>. Choose Other, a project, or small works, and set the start and finish.
        </p>
        <div className="grid g3" style={{ gap: 8 }}>
          {/* Rulebook 1.32.0 §2: Other only when the viewer may book this person there (`canBookOtherLocationsFor`). */}
          <button
            type="button"
            className={`btn ${tab === 'other' ? 'primary' : ''}`}
            disabled={!otherAllowed}
            title={
              otherAllowed
                ? undefined
                : otherForPerson
                  ? 'Only an admin or a manager of this job can move this booking to Other.'
                  : 'Managers book Office, Working from home and Site survey for themselves only.'
            }
            onClick={() => openTab('other')}
          >
            Other
          </button>
          <button type="button" className={`btn ${tab === 'projects' ? 'primary' : ''}`} onClick={() => openTab('projects')}>
            Projects
          </button>
          <button type="button" className={`btn ${tab === 'smallWorks' ? 'primary' : ''}`} onClick={() => openTab('smallWorks')}>
            Small works
          </button>
        </div>
        {error ? <p className="banner" data-hue="red">{error}</p> : null}
        {saving ? <p className="muted small">Saving…</p> : null}
        {tab === 'other' ? (
          <div className="stack" style={{ gap: 12 }}>
            {otherPicks.length === 0 ? (
              <p className="muted small">No saved Other locations. Add a custom one for this booking.</p>
            ) : (
              <div className="rows">
                {otherPicks.map((pick) => (
                  <button
                    key={pick.id}
                    type="button"
                    className="ritem"
                    data-hue="daily"
                    disabled={saving || !hoursValid}
                    onClick={() => void saveToOther(pick)}
                  >
                    <span className="grow">
                      <span className="t">{pick.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <CustomOtherLocationField
              disabled={saving || !hoursValid}
              onUse={(name) => {
                const pick = oneOffCustomLocationPick(name)
                if (pick) void saveToOther(pick)
              }}
            />
          </div>
        ) : null}
        {tab === 'projects' || tab === 'smallWorks' ? (
          <>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <FilterChip title={`Active · ${counts.active}`} selected={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
              <FilterChip title={`Upcoming · ${counts.upcoming}`} selected={statusFilter === 'upcoming'} onClick={() => setStatusFilter('upcoming')} />
              <FilterChip title={`Completed · ${counts.completed}`} selected={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'smallWorks' ? 'Search small works…' : 'Search projects…'}
              className="in"
            />
            <div className="rows">
              {filtered.length === 0 ? (
                <p className="muted small">No {statusFilter} {tab === 'smallWorks' ? 'small works' : 'projects'}.</p>
              ) : (
                filtered.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="ritem"
                    data-hue={tab === 'smallWorks' ? 'sw' : 'proj'}
                    disabled={saving || !hoursValid}
                    onClick={() => void saveToProject(project, tab === 'smallWorks')}
                  >
                    <span className="grow">
                      <span className="t">
                        {project.jobNumber} · {project.siteName}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : null}
        <div className="stack" style={{ gap: 10 }}>
          <p className="eyebrow">Start and finish</p>
          <HoursTimelinePicker
            start={workStartTime}
            end={workEndTime}
            breakRemoved={breakRemoved}
            policy={payroll}
            date={day}
            showBreak
            onStart={(value) => {
              hoursTouched.current = true
              setWorkStartTime(value)
            }}
            onEnd={(value) => {
              hoursTouched.current = true
              setWorkEndTime(value)
            }}
            onBreak={(value) => {
              hoursTouched.current = true
              setBreakRemoved(value)
            }}
          />
          {!hoursValid ? <p className="muted small">Finish needs to be after the start.</p> : null}
          {row.kind === 'operative' || row.kind === 'manager' ? (
            <OvertimeRateField
              dayKey={bookingDayKey(day)}
              timeSlot="CUSTOM_HOURS"
              workStartTime={workStartTime}
              workEndTime={workEndTime}
              isBreakRemoved={breakRemoved}
              value={overtimeRate}
              onChange={setOvertimeRate}
            />
          ) : null}
          <HoursBreakdownCard
            breakdown={breakdown}
            dayRows={weekendBreakdownForDates([day], workStartTime, workEndTime, breakRemoved, payroll)}
            explanation={weekdayExplanationForDate(day, workStartTime, workEndTime, breakRemoved, payroll)}
          />
          <button type="button" className="btn primary" disabled={saving || !hoursValid} onClick={() => void saveHoursOnly()}>
            Save hours on this booking
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function managerBookingToTarget(booking: ManagerSiteBooking, name: string): OverviewBookingTarget {
  return {
    id: `mgr-${booking.id}`,
    name,
    kind: 'manager',
    bookingId: booking.id,
    userId: booking.userId,
    projectId: booking.locationId,
    locationType: booking.locationType,
    customLocationName: booking.customLocationName,
    timeSlotRaw: booking.timeSlot,
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
  }
}

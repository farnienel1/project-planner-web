'use client'

import Link from 'next/link'
import { addDays, format, isSameDay } from 'date-fns'
import { organizationCalendarWeekEnd, organizationCurrentWeekStart, organizationTodayCalendarDate } from '@/lib/orgTime/organizationWeek'
import { useEffect, useMemo, useState } from 'react'
import { useBookingStore, type BookingReplaceOptions } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'
import {
  UNKNOWN_BOOKING_PERSON_LABEL,
  UNRESOLVED_BOOKING_PERSON_CHIP,
  rosterAliasIdsFor,
  scheduleRowPerson,
} from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { weekDaysFrom } from '@/lib/scheduling/scheduleUtils'
import {
  bookingPayrollHours,
  bookingTimesText,
  customHoursRangeLabel,
  formatHoursLabel,
  hoursBreakdown,
  type BookingHoursInput,
} from '@/lib/scheduling/paidHours'
import {
  jobScheduleLeaveMarks,
  JOB_SCHEDULE_LEGEND,
  payrollMultipliedHours,
  scheduleCellHours,
  scheduleCellKind,
  scheduleDayCell,
  subcontractorScheduleCell,
  type JobScheduleLeaveMark,
  type ScheduleCellKind,
  type ScheduleDayBooking,
  type ScheduleDayCell,
} from '@/lib/canonical'
import { bookingOnScheduleDay, scheduleColumnDate, scheduleWeekDayKeys } from '@/lib/scheduling/scheduleWeekDays'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOrgBankHolidays } from '@/components/annual-leave/useOrgBankHolidays'
import { BookingEditSheet } from '@/components/schedule/BookingEditSheet'
import { QuickAddBookingSheet, type QuickAddBookingValues } from '@/components/schedule/QuickAddBookingSheet'
import { useLeaveConflictCheck, type LeaveCheckPerson } from '@/components/scheduling/useLeaveConflictCheck'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingHistoryFrom } from '@/lib/stores/useBookingHistory'
import { ORG_DATA_REFRESHED_EVENT } from '@/lib/stores/refreshOrgData'
import { canBookWork, hasAdminAccess } from '@/lib/permissions'
import { userBookingRemoveAction, userCanWriteBooking } from '@/lib/access/bookingAccess'
import { bookableWorks } from '@/lib/access/workAccess'
import { UserRole, type User } from '@/types'
import { SubcontractorBookingEditSheet } from '@/components/projects/scheduling/SubcontractorBookingEditSheet'
import { watchSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import { managerSiteBookingToScheduleBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Booking, Project } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { bookingDayKey, policyForBookingDayKey } from '@/lib/scheduling/bookingSlotRules'
import { DEFAULT_PAYROLL_POLICY, loadOrganizationDetails, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import {
  findSubcontractorFirm,
  formatSubcontractorBookingLabel,
  idsMatch,
  resolveSubcontractorBookingPeople,
} from '@/lib/subcontractors/bookingPeople'

type SubBooking = {
  id: string
  subcontractorId: string
  date: Date
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  bookedContactIds?: string[]
  bookedOperativeNames?: string[]
}

function initials(name: string) {
  return name.split(' ').map(p => p[0] || '').join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-500',
  'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-rose-600',
]

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold text-white flex-shrink-0 ${sz} ${avatarColor(name)}`}>
      {initials(name)}
    </span>
  )
}

type DayRow = {
  id: string
  personKey: string
  name: string
  slot: string
  hours: number
  overtimeEquation: string | null
  range?: string | null
  roleLabel: string
  roleTone: 'operative' | 'manager' | 'subcontractor'
  quickAdd: QuickAddTarget | null
  /**
   * Rulebook 1.44.0 §21 (owner decision 14 Nov, H = 1): the booking's person id names nobody loaded
   * (`scheduleRowPerson`). The row is shown — never hidden — marked "Not linked to a person", with no Quick Add.
   */
  unresolved?: boolean
  /** Every id this row's bookings are filed under (for the leave marks, `jobScheduleLeaveMarks`). */
  personIds: string[]
  email: string | null
  /** Rulebook 1.37.0: the tile's colour (display only, from the pay rule's result). */
  cell: ScheduleCellKind
  /** Rulebook 1.41.0: this booking's hours as `scheduleDayCell` adds them up for the person's day. */
  dayBooking: ScheduleDayBooking
  booking?: Booking
  managerBooking?: ManagerSiteBooking
  subBooking?: SubBooking
  /**
   * Rulebook 1.43.0 §21: a subcontractor row's day — the working hours in effect that day and its key — so its tile
   * shows only the working window (`subcontractorScheduleCell`), never paid hours or an overtime split.
   */
  subDay?: { policy: OrgPayrollTimePolicy; dayKey: string }
  peopleLabel?: string
  firmName?: string
}

/** Where a Quick Add for this row is written. Subcontractor rows have none. */
type QuickAddTarget =
  | { kind: 'operative'; operativeId: string }
  | { kind: 'manager'; userId: string }

type PersonWeek = {
  key: string
  name: string
  roleLabel: string
  roleTone: DayRow['roleTone']
  peopleLabel?: string
  firmName?: string
  quickAdd: QuickAddTarget | null
  /** Rulebook 1.44.0 §21: an "Unknown person" row (see `DayRow.unresolved`). */
  unresolved?: boolean
  personIds: string[]
  email: string | null
  cells: DayRow[][]
}

/**
 * Colour and label follow the person's account, never the collection the booking sits in.
 * Admin and manager are always blue, operatives green, subcontractors purple.
 * An admin with an operative profile is still blue.
 */
function roleForUser(user: User | undefined): { label: string; tone: DayRow['roleTone'] } {
  if (!user) return { label: 'Op', tone: 'operative' }
  if (user.permissions?.adminAccess || user.isSuperAdmin || user.role === UserRole.ADMIN) {
    return { label: 'Admin', tone: 'manager' }
  }
  if (user.permissions?.manager) return { label: 'Mgr', tone: 'manager' }
  return { label: 'Op', tone: 'operative' }
}

function bookingRowFromHours(input: BookingHoursInput): Pick<DayRow, 'hours' | 'overtimeEquation' | 'range' | 'slot' | 'cell' | 'dayBooking'> {
  const breakdown = hoursBreakdown(input)
  // Rulebook 1.37.0: the tile colour reads the same pay-rule result the hours come from (`payrollHoursResult`).
  const result = bookingPayrollHours(input)
  const cellHours = scheduleCellHours(result)
  const cell = scheduleCellKind({ ...cellHours, timeSlot: input.timeSlot })
  // Rulebook 1.41.0: the clock overtime at its rate (`payrollMultipliedHours`) for the day tile's overtime lines.
  const multiplied = payrollMultipliedHours(result)
  const dayBooking: ScheduleDayBooking = {
    ...cellHours,
    timeSlot: input.timeSlot,
    overtime: multiplied ? { clockHours: multiplied.clockHours, multiplier: multiplied.multiplier, breakHours: multiplied.breakHours } : null,
  }
  const range = customHoursRangeLabel(input)
  // Rulebook 1.20.2: "Custom 07:30–14:00" (`bookingTimesText`); hours are the pay rule's for the day (`totalPaidHours`).
  const slotStr = bookingTimesText(input)
  return {
    hours: breakdown.totalPaidHours,
    overtimeEquation: breakdown.overtimeLine || breakdown.overtimeEquation,
    range,
    slot: slotStr,
    cell,
    dayBooking,
  }
}

/**
 * Rulebook 1.43.0 §21 (owner rule): a subcontractor booking shows only its working window (start–finish), never the
 * standard / overtime split or paid hours (`subcontractorScheduleCell`). The tile and the day's chooser read the times.
 */
function subcontractorRow(
  booking: { timeSlot?: string; workStartTime?: string; workEndTime?: string },
  policy: OrgPayrollTimePolicy,
  dayKey: string
): Pick<DayRow, 'hours' | 'overtimeEquation' | 'range' | 'slot' | 'cell' | 'dayBooking' | 'subDay'> {
  const cell = subcontractorScheduleCell({ bookings: [booking], day: policy, dayKey })
  const times = cell?.timesText || bookingTimesText(booking)
  return {
    hours: 0,
    overtimeEquation: null,
    range: cell?.timesText || null,
    slot: times,
    cell: { tone: 'standard', standardHours: 0, overtimeHours: 0, halfLabel: null },
    dayBooking: { paidHours: 0, overtimeHours: 0, timeSlot: booking.timeSlot ?? null, overtime: null },
    subDay: { policy, dayKey },
  }
}

function toneClass(tone: DayRow['roleTone']) {
  if (tone === 'subcontractor') return 'bg-violet-100 text-violet-700'
  if (tone === 'manager') return 'bg-blue-100 text-blue-700'
  return 'bg-emerald-100 text-emerald-700'
}

/** Rulebook 1.37.0: the iOS Scheduling colours (`PPBookingColor`): standard blue, overtime amber stripes, leave brown. */
const STD_BLUE = '#2457D6'
const HALF_LIGHT = 'rgba(36, 87, 214, 0.35)'
const OT_STRIPES = 'repeating-linear-gradient(135deg, #F4A640 0 4px, rgba(210, 118, 11, 0.55) 4px 6px)'
const LEAVE_BROWN = '#9A5B27'
const LEAVE_PENDING = 'rgba(154, 91, 39, 0.45)'

function leaveColour(mark: JobScheduleLeaveMark): string {
  return mark.pending ? LEAVE_PENDING : LEAVE_BROWN
}


export function ProjectScheduleWeekOverview({
  project,
  organizationId,
  scheduleBasePath,
  variant = 'full',
}: {
  project: Project
  organizationId: string
  scheduleBasePath: string
  variant?: 'full' | 'hub'
}) {
  const { bookings, loadBookings, createBooking, updateBooking, deleteBooking } = useBookingStore()
  const {
    managerSiteBookings,
    loadManagerSiteBookings,
    saveManagerSiteBooking,
    updateManagerSiteBooking,
    deleteManagerSiteBooking,
  } = useManagerScheduleStore()
  const currentUser = useAuthStore((state) => state.user)
  const { operatives, loadOperatives, managers } = useOperativeStore()
  // Rulebook 1.10.0 (`canWriteBooking`): admins book on every job; managers only on jobs they manage; operatives never.
  const canQuickAdd =
    canBookWork(currentUser) &&
    userCanWriteBooking(currentUser, { collection: 'bookings', projectId: project.id }, project, managers)
  // Rulebook 1.21.0 §21 (`bookableJobs`): a new booking only when this job is bookable — not inactive and writable;
  // the job's dates are never checked. Editing existing bookings is not gated by it.
  const jobBookable =
    bookableWorks({
      projects: [project],
      user: currentUser,
      operatives,
      managers,
      bookings: [],
      managerBookings: [],
    }).length > 0
  const { users, userIdAliases, loadUsers } = useOrgUserStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  // Rulebook 1.37.0: annual leave on this job's week (live `holidayBookings` listener, rulebook §1).
  const { bookings: holidays, loadBookings: loadHolidays } = useHolidayStore()
  // Rulebook §1 (1.36.0, FU-4): the organisation's current week and today, not the browser's.
  const [weekStart, setWeekStart] = useState(() => organizationCurrentWeekStart())
  // An earlier week reaches before the launch booking download.
  useBookingHistoryFrom(organizationId, weekStart)
  const [subBookings, setSubBookings] = useState<SubBooking[]>([])
  const [expanded, setExpanded] = useState(variant !== 'hub')
  const [editingRow, setEditingRow] = useState<DayRow | null>(null)
  // Rulebook 1.41.0 §21: a person-day with several bookings is one tile; tapping it lists them to pick one to edit.
  const [choosing, setChoosing] = useState<{ title: string; rows: DayRow[] } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [quickAdd, setQuickAdd] = useState<{ person: PersonWeek; date: Date } | null>(null)
  const [savingQuickAdd, setSavingQuickAdd] = useState(false)
  const [payroll, setPayroll] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  // Rulebook 1.16.0 §5: annual leave on the day is asked before a quick add or edit saves.
  const leaveCheck = useLeaveConflictCheck(payroll)
  const leavePersonFor = (name: string, target: QuickAddTarget | null): LeaveCheckPerson | null => {
    if (!target) return null
    if (target.kind === 'manager') return { id: target.userId, userId: target.userId, name }
    const op = operatives.find((o) => idsMatch(o.id, target.operativeId))
    return { id: target.operativeId, operativeIds: [target.operativeId], email: op?.email ?? null, name }
  }

  useEffect(() => {
    loadBookings(organizationId)
    loadManagerSiteBookings(organizationId)
    loadOperatives(organizationId)
    loadUsers(organizationId)
    loadSubcontractors(organizationId)
    loadHolidays(organizationId)
    loadOrganizationDetails(organizationId)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayroll(details.payrollTimePolicy)
      })
      .catch(() => {})
  }, [organizationId, loadBookings, loadManagerSiteBookings, loadOperatives, loadUsers, loadSubcontractors, loadHolidays])

  // Rulebook 1.9.0 §1: subcontractor bookings are live while this grid is open.
  useEffect(() => {
    const stop = watchSubcontractorBookings(organizationId, (rows) => {
      setSubBookings(
        rows
          .filter((parsed) => idsMatch(parsed.projectId, project.id))
          .map((parsed): SubBooking => {
            const row: SubBooking = {
              id: parsed.id,
              subcontractorId: parsed.subcontractorId,
              date: parsed.date,
              timeSlot: parsed.timeSlot,
              bookedContactIds: parsed.bookedContactIds,
              bookedOperativeNames: parsed.bookedOperativeNames,
            }
            if (parsed.workStartTime) row.workStartTime = parsed.workStartTime
            if (parsed.workEndTime) row.workEndTime = parsed.workEndTime
            if (parsed.isBreakRemoved) row.isBreakRemoved = true
            return row
          })
      )
    })
    const onRefreshed = () => {
      loadOrganizationDetails(organizationId, { fromServer: true, allowCacheFallback: true })
        .then((details) => {
          if (details?.payrollTimePolicy) setPayroll(details.payrollTimePolicy)
        })
        .catch(() => {})
    }
    window.addEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
    return () => {
      stop()
      window.removeEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
    }
  }, [organizationId, project.id])

  const weekDays = useMemo(() => weekDaysFrom(weekStart), [weekStart])
  // The organisation's today, once per render (not once per header and grid cell).
  const todayDate = organizationTodayCalendarDate()
  const weekEnd = organizationCalendarWeekEnd(weekStart)
  // A multi-day leave record skips the region's bank holidays (`leaveRecordDayKeys`), as the allowance does.
  const bank = useOrgBankHolidays(weekStart, weekEnd)
  const projectBookings = useMemo(
    () => bookings.filter((b) => idsMatch(b.projectId, project.id)),
    [bookings, project.id]
  )

  const projectManagerBookings = useMemo(
    () =>
      managerSiteBookings.filter(
        (b) =>
          idsMatch(b.locationId, project.id) &&
          (b.locationType === 'project' || b.locationType === 'small_work')
      ),
    [managerSiteBookings, project.id]
  )

  // Rulebook 1.41.0 / 1.44.0 §21 (guardrail 1): who a row is comes from `resolveBookingPerson` through
  // `scheduleRowPerson` — the person's own id, former ids, same-email documents and `operatives` rows on their email.
  const bookingPeople = useMemo(
    () => ({
      accounts: users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        formerIds: u.formerUserIds ?? [],
        aliasIds: rosterAliasIdsFor(u.id, userIdAliases),
      })),
      operatives: operatives.map((o) => ({ id: o.id, email: o.email ?? null })),
    }),
    [users, userIdAliases, operatives]
  )
  // The rows `scheduleRowPerson` returned, by the id it returned (exactly as stored).
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const operativeById = useMemo(() => new Map(operatives.map((o) => [o.id, o])), [operatives])

  // Rulebook 1.37.0 (review #299, 2): one day key per column, the cell's calendar date; bookings (organisation-zone
  // day of their stored instant) and leave marks are both bucketed by it.
  const dayKeys = useMemo(() => scheduleWeekDayKeys(weekDays), [weekDays])
  const rowsByDay = useMemo(() => {
    const zone = organizationZoneOr()
    return weekDays.map((_day, dayIndex) => {
      const dayKey = dayKeys[dayIndex]
      const opRows: DayRow[] = projectBookings
        .filter((b) => bookingOnScheduleDay(b.date, dayKey, zone))
        .map((b): DayRow => {
          const who = scheduleRowPerson(b.operativeId, bookingPeople)
          const op = who.operativeId ? operativeById.get(who.operativeId) : undefined
          const linkedUser = who.accountId ? userById.get(who.accountId) : undefined
          // The account decides the colour: an admin or manager with an operative profile stays blue.
          const role = roleForUser(linkedUser)
          const name = who.unresolved
            ? who.label || UNKNOWN_BOOKING_PERSON_LABEL
            : rosterDisplayName(op ? { firstName: op.firstName, surname: op.lastName, email: op.email } : null) ||
              rosterDisplayName(linkedUser) ||
              UNKNOWN_BOOKING_PERSON_LABEL
          const email = who.unresolved ? undefined : op?.email || linkedUser?.email
          return {
            id: b.id,
            personKey: who.key,
            name,
            roleLabel: role.label,
            roleTone: role.tone,
            // 1.44.0: an unlinked id gets no Quick Add (it would book more under an id nobody can name).
            quickAdd: who.unresolved ? null : { kind: 'operative' as const, operativeId: b.operativeId },
            unresolved: who.unresolved,
            personIds: [b.operativeId, op?.id, linkedUser?.id].filter((id): id is string => Boolean(id)),
            email: email?.trim() || null,
            booking: b,
            ...bookingRowFromHours({
              ...b,
              // Rulebook 1.19.0: the working hours in effect on that day (history first), never today's.
              policy: policyForBookingDayKey(dayKey, payroll) ?? payroll,
              dayKey,
            }),
          }
        })

      const managerRows: DayRow[] = projectManagerBookings
        .filter((b) => bookingOnScheduleDay(b.date, dayKey, zone))
        .map((b): DayRow => {
          const who = scheduleRowPerson(b.userId, bookingPeople)
          const manager = who.accountId ? userById.get(who.accountId) : undefined
          const linkedOperative = who.operativeId ? operativeById.get(who.operativeId) : undefined
          const name = who.unresolved
            ? who.label || UNKNOWN_BOOKING_PERSON_LABEL
            : rosterDisplayName(manager) ||
              rosterDisplayName(
                linkedOperative
                  ? { firstName: linkedOperative.firstName, surname: linkedOperative.lastName, email: linkedOperative.email }
                  : null
              ) ||
              UNKNOWN_BOOKING_PERSON_LABEL
          const role = manager ? roleForUser(manager) : { label: 'Mgr', tone: 'manager' as const }
          const email = who.unresolved ? undefined : manager?.email || linkedOperative?.email
          return {
            id: b.id,
            personKey: who.key,
            name,
            roleLabel: role.label,
            roleTone: role.tone,
            // Booking flow books a roster operative through operative bookings; keep Quick Add on the same path.
            // 1.44.0: an unlinked id gets no Quick Add.
            quickAdd: who.unresolved
              ? null
              : linkedOperative
                ? { kind: 'operative' as const, operativeId: linkedOperative.id }
                : { kind: 'manager' as const, userId: b.userId },
            unresolved: who.unresolved,
            personIds: [b.userId, manager?.id, linkedOperative?.id].filter((id): id is string => Boolean(id)),
            email: email?.trim() || null,
            managerBooking: b,
            ...bookingRowFromHours({
              ...b,
              // Rulebook 1.19.0: the working hours in effect on that day (history first), never today's.
              policy: policyForBookingDayKey(dayKey, payroll) ?? payroll,
              dayKey,
            }),
          }
        })

      const subRows: DayRow[] = subBookings
        .filter((b) => bookingOnScheduleDay(b.date, dayKey, zone))
        .map((b) => {
          const sub = findSubcontractorFirm(subcontractors, b.subcontractorId)
          const people = resolveSubcontractorBookingPeople(b, sub)
          const firmName = sub?.name?.trim() || 'Sub contractor'
          return {
            id: b.id,
            personKey: people.length
              ? `sub:${b.subcontractorId}:${people.join('|').toLowerCase()}`
              : `sub:${b.subcontractorId}`,
            name: formatSubcontractorBookingLabel(firmName, people),
            peopleLabel: people.join(', ') || undefined,
            firmName,
            roleLabel: 'Sub',
            roleTone: 'subcontractor' as const,
            quickAdd: null,
            personIds: [],
            email: null,
            subBooking: b,
            ...subcontractorRow(b, policyForBookingDayKey(dayKey, payroll) ?? payroll, dayKey),
          }
        })

      return [...opRows, ...managerRows, ...subRows]
    })
  }, [
    weekDays,
    dayKeys,
    projectBookings,
    projectManagerBookings,
    subBookings,
    bookingPeople,
    userById,
    operativeById,
    subcontractors,
    payroll,
  ])

  const people = useMemo((): PersonWeek[] => {
    const order: string[] = []
    const byKey = new Map<string, PersonWeek>()
    rowsByDay.forEach((rows, dayIndex) => {
      for (const row of rows) {
        let person = byKey.get(row.personKey)
        if (!person) {
          person = {
            key: row.personKey,
            name: row.name,
            roleLabel: row.roleLabel,
            roleTone: row.roleTone,
            peopleLabel: row.peopleLabel,
            firmName: row.firmName,
            quickAdd: row.quickAdd,
            unresolved: row.unresolved,
            personIds: [],
            email: null,
            cells: weekDays.map(() => []),
          }
          byKey.set(row.personKey, person)
          order.push(row.personKey)
        } else if (!person.quickAdd && row.quickAdd) {
          person.quickAdd = row.quickAdd
        } else if (row.peopleLabel && (!person.peopleLabel || row.peopleLabel.length > person.peopleLabel.length)) {
          person.name = row.name
          person.peopleLabel = row.peopleLabel
          person.firmName = row.firmName
        }
        if (person.roleTone === 'operative' && row.roleTone === 'manager') {
          person.roleLabel = row.roleLabel
          person.roleTone = row.roleTone
        }
        for (const id of row.personIds) if (!person.personIds.includes(id)) person.personIds.push(id)
        if (!person.email && row.email) person.email = row.email
        person.cells[dayIndex].push(row)
      }
    })
    return order.map((key) => byKey.get(key)!).sort((a, b) => a.name.localeCompare(b.name))
  }, [rowsByDay, weekDays])

  // Rulebook 1.37.0 (`jobScheduleLeaveMarks`): leave marks for the people already on this job's week only — leave
  // never adds a row. Matched under every id the person goes by, without case; organisation-zone days; per day under
  // the working hours in effect that day (for the half-day clock in the tooltip).
  const leaveByPerson = useMemo(() => {
    // The roster fold's aliases (`userIdAliases`: alias id → the person's users id) are their same-email ids.
    const aliasesOf = new Map<string, string[]>()
    for (const [alias, owner] of Object.entries(userIdAliases ?? {})) {
      aliasesOf.set(owner, [...(aliasesOf.get(owner) ?? []), alias])
    }
    const roster = [
      ...users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        formerUserIds: u.formerUserIds ?? [],
        sameEmailUserIds: aliasesOf.get(u.id) ?? [],
      })),
      ...operatives.map((o) => ({ id: o.id, email: o.email ?? null })),
    ]
    const leavePeople = people
      .filter((p) => p.roleTone !== 'subcontractor' && p.personIds.length > 0)
      .map((p) => ({ key: p.key, ids: p.personIds, email: p.email }))
    // Review #299 (5): no marks until the region's bank holidays have loaded — a multi-day record would otherwise
    // mark a bank holiday (or the wrong region's) as leave for a moment.
    if (!bank.loaded) return new Map<string, Array<JobScheduleLeaveMark | null>>()
    const nonWorkingDayKeys = bank.holidays.map((h) => h.date)
    // The store reads every record through `parseHolidayDocument` (organisation-zone day keys); older cached rows
    // without them fall back to their dates in the organisation zone.
    const leaveRecords = holidays.map((h) => ({
      id: h.id,
      userId: h.userId ?? null,
      operativeId: h.operativeId ?? null,
      startDayKey: h.startDayKey ?? bookingDayKey(h.startDate),
      endDayKey: h.endDayKey ?? bookingDayKey(h.endDate),
      timeSlot: h.timeSlot,
      status: h.status,
    }))
    const zone = organizationZoneOr()
    const out = new Map<string, Array<JobScheduleLeaveMark | null>>()
    dayKeys.forEach((dayKey, index) => {
      const rows = jobScheduleLeaveMarks({
        people: leavePeople,
        holidays: leaveRecords,
        dayKeys: [dayKey],
        timeZone: zone,
        nonWorkingDayKeys,
        roster,
        day: policyForBookingDayKey(dayKey, payroll) ?? payroll,
      })
      for (const row of rows) {
        const marks = out.get(row.key) ?? weekDays.map(() => null)
        const mark = row.days[0]
        marks[index] = mark && mark.onLeave ? mark : null
        out.set(row.key, marks)
      }
    })
    return out
  }, [people, users, userIdAliases, operatives, holidays, bank.loaded, bank.holidays, weekDays, dayKeys, payroll])

  const weekCounts = useMemo(() => {
    let staff = 0
    let subs = 0
    for (const rows of rowsByDay) {
      staff += rows.filter((r) => r.roleTone !== 'subcontractor').length
      subs += rows.filter((r) => r.roleTone === 'subcontractor').length
    }
    return { staff, subs }
  }, [rowsByDay])

  const editingBooking: Booking | null = useMemo(() => {
    if (!editingRow) return null
    if (editingRow.booking) return editingRow.booking
    if (editingRow.managerBooking) {
      return managerSiteBookingToScheduleBooking(
        editingRow.managerBooking,
        new Map([[project.id, project.siteName || project.jobNumber]])
      )
    }
    return null
  }, [editingRow, project.id, project.jobNumber, project.siteName])

  const saveEditing = async (updates: Partial<Booking>, options?: BookingReplaceOptions) => {
    if (!editingRow) return
    setSavingEdit(true)
    try {
      // Rulebook 1.41.0 §5: `options.replaces` — the overlapping bookings Replace removes in the same batch.
      if (editingRow.booking) {
        await updateBooking(editingRow.booking.id, updates, options)
      } else if (editingRow.managerBooking) {
        await updateManagerSiteBooking(
          organizationId,
          editingRow.managerBooking.id,
          {
            timeSlot: String(updates.timeSlot || editingRow.managerBooking.timeSlot),
            workStartTime: updates.workStartTime,
            workEndTime: updates.workEndTime,
            isBreakRemoved: updates.isBreakRemoved,
          },
          options
        )
      }
    } finally {
      setSavingEdit(false)
    }
  }

  // Rulebook §2 (1.33.0): the remove button is `bookingRemoveAction` — delete (with the tombstone) for admins and
  // managers of this job (`canDeleteBooking`), nothing for anyone else. There is no cancel.
  const editingRemoveAction = editingRow?.booking
    ? userBookingRemoveAction(currentUser, { collection: 'bookings', projectId: project.id }, project, managers)
    : editingRow?.managerBooking
      ? userBookingRemoveAction(
          currentUser,
          {
            collection: 'managerSiteBookings',
            userId: editingRow.managerBooking.userId,
            locationType: editingRow.managerBooking.locationType,
            locationId: editingRow.managerBooking.locationId ?? null,
          },
          project,
          managers
        )
      : 'none'

  const deleteEditing = async () => {
    if (!editingRow) return
    setSavingEdit(true)
    try {
      if (editingRow.booking) {
        await deleteBooking(editingRow.booking.id, organizationId)
      } else if (editingRow.managerBooking) {
        await deleteManagerSiteBooking(organizationId, editingRow.managerBooking.id)
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const isSmallWork = scheduleBasePath.includes('/small-works/')
  const projectLabel = `${project.jobNumber} ${project.siteName}`.trim()

  const saveQuickAdd = async (values: QuickAddBookingValues, options?: BookingReplaceOptions) => {
    if (!quickAdd?.person.quickAdd || !currentUser) return
    const target = quickAdd.person.quickAdd
    setSavingQuickAdd(true)
    try {
      if (target.kind === 'operative') {
        await createBooking({
          operativeId: target.operativeId,
          projectId: project.id,
          date: quickAdd.date,
          timeSlot: values.timeSlot,
          workStartTime: values.workStartTime,
          workEndTime: values.workEndTime,
          isBreakRemoved: values.isBreakRemoved,
          notes: values.notes || undefined,
          bookedBy: currentUser.email,
          status: 'confirmed',
          organizationId,
        }, options)
      } else {
        await saveManagerSiteBooking(organizationId, {
          userId: target.userId,
          date: quickAdd.date,
          timeSlot: values.timeSlot,
          locationType: isSmallWork ? 'small_work' : 'project',
          locationId: project.id,
          workStartTime: values.workStartTime,
          workEndTime: values.workEndTime,
          isBreakRemoved: values.isBreakRemoved,
        }, options)
      }
    } finally {
      setSavingQuickAdd(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">
            Week of {format(weekStart, 'd MMM yyyy')}
          </p>
          <p className="text-xs text-slate-500">
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM')} · {weekCounts.staff} booked · {weekCounts.subs} sub{weekCounts.subs !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {variant === 'full' ? (
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`${scheduleBasePath}/operatives`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--blue)] px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Operatives &amp; Managers
        </Link>
        <Link
          href={`${scheduleBasePath}/subcontractors`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Subcontractors
        </Link>
      </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Week overview</p>
            <p className="text-xs text-slate-500">
              Tap a booking to see the hours breakdown and edit it.
              {canQuickAdd ? ' Tap an empty box on a person\u2019s row to quick add a booking.' : ''}
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className={`rounded-md px-2.5 py-1 ${expanded ? 'text-slate-500' : 'bg-slate-900 text-white'}`}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className={`rounded-md px-2.5 py-1 ${expanded ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
            >
              Expanded
            </button>
          </div>
        </div>

        {people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
            <p className="text-sm text-slate-400">No bookings this week</p>
            <Link
              href={`${scheduleBasePath}/operatives`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              + Schedule operatives or managers
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto card shadow-sm">
            <div
              className="min-w-[720px]"
              style={{
                display: 'grid',
                gridTemplateColumns: expanded ? 'minmax(140px, 0.9fr) repeat(7, minmax(110px, 1fr))' : 'minmax(120px, 0.8fr) repeat(7, minmax(72px, 1fr))',
              }}
            >
              <div className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Booked in
              </div>
              {weekDays.map((day) => {
                const isTodayDay = isSameDay(day, todayDate)
                return (
                  <div
                    key={day.toISOString()}
                    className={`border-b border-l border-slate-100 px-2 py-2 text-center ${isTodayDay ? 'bg-blue-50' : 'bg-slate-50'}`}
                  >
                    {isTodayDay ? (
                      <span className="mb-0.5 inline-block rounded-full bg-blue-600 px-1.5 py-px text-[9px] font-bold text-white">Today</span>
                    ) : null}
                    <p className={`text-[11px] font-bold ${isTodayDay ? 'text-blue-700' : 'text-slate-700'}`}>
                      {format(day, 'EEE')}
                    </p>
                    <p className="text-[10px] text-slate-500">{format(day, 'd MMM')}</p>
                  </div>
                )
              })}

              {people.map((person) => (
                <PersonRow
                  key={person.key}
                  person={person}
                  leave={leaveByPerson.get(person.key) ?? null}
                  weekDays={weekDays}
                  todayDate={todayDate}
                  expanded={expanded}
                  onEdit={canQuickAdd ? setEditingRow : () => undefined}
                  onChoose={
                    canQuickAdd
                      ? (rows, day) => setChoosing({ title: `${person.peopleLabel || person.name} · ${format(day, 'EEE d MMM')}`, rows })
                      : undefined
                  }
                  onQuickAdd={
                    canQuickAdd && jobBookable
                      ? // Rulebook 1.37.0 (review #299): the column's organisation day, so the sheet, its leave check
                        // and the saved date are that day whatever the browser zone.
                        (target, date) => setQuickAdd({ person: target, date: scheduleColumnDate(date, organizationZoneOr()) })
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        <ScheduleLegend />
      </div>

      {choosing ? (
        <DayBookingChooser
          title={choosing.title}
          rows={choosing.rows}
          onPick={(row) => {
            setChoosing(null)
            setEditingRow(row)
          }}
          onClose={() => setChoosing(null)}
        />
      ) : null}
      {editingRow?.subBooking ? (
        <SubcontractorBookingEditSheet
          organizationId={organizationId}
          booking={{ ...editingRow.subBooking, projectId: project.id }}
          subcontractor={findSubcontractorFirm(subcontractors, editingRow.subBooking.subcontractorId) || null}
          payroll={payroll}
          onClose={() => setEditingRow(null)}
          onSaved={(next) => {
            const id = editingRow.subBooking?.id
            setSubBookings((rows) => {
              if (!id) return rows
              if (next === 'deleted') return rows.filter((row) => row.id !== id)
              return rows.map((row) => (row.id === id ? { ...row, ...next } : row))
            })
            setEditingRow(null)
          }}
        />
      ) : null}
      {quickAdd?.person.quickAdd ? (
        <QuickAddBookingSheet
          personName={quickAdd.person.name}
          roleLabel={quickAdd.person.roleLabel === 'Op' ? 'Operative' : quickAdd.person.roleLabel === 'Mgr' ? 'Manager' : quickAdd.person.roleLabel}
          projectName={projectLabel}
          date={quickAdd.date}
          showNotes={quickAdd.person.quickAdd.kind === 'operative'}
          saving={savingQuickAdd}
          payroll={payroll}
          conflictsFor={(() => {
            const person = leavePersonFor(quickAdd.person.name, quickAdd.person.quickAdd)
            return person ? leaveCheck.checkFor(person, quickAdd.date) : undefined
          })()}
          onSave={saveQuickAdd}
          allowReplace
          onClose={() => setQuickAdd(null)}
        />
      ) : null}
      {editingRow && editingBooking ? (
        <BookingEditSheet
          booking={editingBooking}
          operativeName={editingRow.name}
          projectName={`${project.jobNumber} ${project.siteName}`.trim()}
          saving={savingEdit}
          payroll={payroll}
          conflictsFor={(() => {
            const person = leavePersonFor(editingRow.name, editingRow.quickAdd)
            return person ? leaveCheck.checkFor(person, new Date(editingBooking.date), [editingBooking.id]) : undefined
          })()}
          onSave={saveEditing}
          allowReplace
          onDelete={editingRemoveAction === 'delete' ? deleteEditing : undefined}
          onClose={() => setEditingRow(null)}
        />
      ) : null}
    </div>
  )
}

function PersonRow({
  person,
  leave,
  weekDays,
  todayDate,
  expanded,
  onEdit,
  onChoose,
  onQuickAdd,
}: {
  person: PersonWeek
  /** Rulebook 1.37.0: the leave mark per visible day (`jobScheduleLeaveMarks`), null when none. */
  leave: Array<JobScheduleLeaveMark | null> | null
  weekDays: Date[]
  todayDate: Date
  expanded: boolean
  onEdit: (row: DayRow) => void
  /** Rulebook 1.41.0: a day with several bookings opens a chooser of them (undefined when the viewer may not edit). */
  onChoose?: (rows: DayRow[], day: Date) => void
  onQuickAdd?: (person: PersonWeek, date: Date) => void
}) {
  const minHeight = expanded ? 'min-h-[72px]' : 'min-h-[44px]'
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2">
        <Avatar name={person.peopleLabel || person.name} size="sm" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-slate-900">
            {person.peopleLabel || person.name}
          </p>
          {person.peopleLabel && person.firmName ? (
            <p className="text-[10px] leading-tight text-slate-500">{person.firmName}</p>
          ) : null}
          {person.unresolved ? (
            // Rulebook 1.44.0 §21: never hidden; linked to a person from Settings → Data health.
            <span
              className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-semibold text-amber-800"
              title="This booking is filed under an ID that matches nobody. An admin can link it to a person in Settings → Data health."
            >
              {UNRESOLVED_BOOKING_PERSON_CHIP}
            </span>
          ) : (
            <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${toneClass(person.roleTone)}`}>
              {person.roleLabel}
            </span>
          )}
        </div>
      </div>
      {weekDays.map((day, index) => {
        const cell = person.cells[index]
        const isTodayDay = isSameDay(day, todayDate)
        const mark = leave?.[index] ?? null
        const canQuickAdd = Boolean(onQuickAdd && person.quickAdd)
        return (
          <div
            key={`${person.key}-${day.toISOString()}`}
            className={`border-l border-t border-slate-100 p-1.5 ${isTodayDay ? 'bg-blue-50/40' : 'bg-white'}`}
          >
            {cell.length === 0 ? (
              mark ? (
                <LeaveCell
                  mark={mark}
                  minHeight={minHeight}
                  onClick={canQuickAdd ? () => onQuickAdd!(person, day) : undefined}
                  ariaLabel={`${person.name}, ${format(day, 'EEE d MMM')}: ${mark.title}${canQuickAdd ? '. Opens quick add for a booking.' : ''}`}
                />
              ) : canQuickAdd ? (
                <button
                  type="button"
                  onClick={() => onQuickAdd!(person, day)}
                  aria-label={`Quick add booking for ${person.name} on ${format(day, 'EEE d MMM')}`}
                  className={`group flex w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-[11px] font-semibold text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:border-slate-300 focus-visible:bg-slate-50 focus-visible:outline-none ${minHeight}`}
                >
                  <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    + Quick add
                  </span>
                </button>
              ) : (
                <div className={`rounded-lg border border-dashed border-slate-200 ${minHeight}`} />
              )
            ) : (
              <DayTile
                rows={cell}
                expanded={expanded}
                minHeight={minHeight}
                // A booking on a leave day keeps its cell and gets a thin brown band across the top.
                leave={mark}
                onOpen={() => {
                  if (cell.length === 1) onEdit(cell[0])
                  else onChoose?.(cell, day)
                }}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

/** Rulebook 1.37.0: a day of annual leave with no booking on this job — brown "AL" (pending paler, "AL?"). */
function LeaveCell({
  mark,
  minHeight,
  onClick,
  ariaLabel,
}: {
  mark: JobScheduleLeaveMark
  minHeight: string
  onClick?: () => void
  ariaLabel: string
}) {
  // Each half in its own style (`mark.am` / `mark.pm`): approved brown, pending paler, not leave open.
  const halfColour = (state: JobScheduleLeaveMark['am']) =>
    state === 'approved' ? LEAVE_BROWN : state === 'pending' ? LEAVE_PENDING : 'transparent'
  const half = mark.am !== mark.pm
  const style: React.CSSProperties = half
    ? { background: `linear-gradient(90deg, ${halfColour(mark.am)} 0 50%, ${halfColour(mark.pm)} 50% 100%)` }
    : { background: halfColour(mark.am) }
  const inner = (
    <span className={`text-[11px] font-extrabold ${half ? 'text-slate-800' : 'text-white'}`} data-testid="schedule-leave-label">
      {mark.label}
    </span>
  )
  const className = `flex w-full items-center justify-center rounded-lg border ${half ? 'border-[#9A5B27]/40' : 'border-transparent'} ${minHeight}`
  return onClick ? (
    <button type="button" onClick={onClick} title={mark.title} aria-label={ariaLabel} className={className} style={style}>
      {inner}
    </button>
  ) : (
    <div title={mark.title} aria-label={ariaLabel} className={className} style={style}>
      {inner}
    </div>
  )
}

/**
 * Rulebook 1.41.0 §21 (owner option a): one tile per person-day in the iOS colours, from `scheduleDayCell` — the day
 * total and, with several bookings, their number ("26h · 2 bookings"), standard and overtime underneath, the clock
 * overtime per rate when expanded; on a leave day (brown band) the Std / OT words are left off. One booking keeps its
 * slot text ("Custom 07:30–14:00").
 */
function DayTile({
  rows,
  expanded,
  minHeight,
  leave,
  onOpen,
}: {
  rows: DayRow[]
  expanded: boolean
  minHeight: string
  leave: JobScheduleLeaveMark | null
  onOpen: () => void
}) {
  const first = rows[0]
  // Rulebook 1.43.0 §21: a subcontractor's day shows its working window(s) only (`subcontractorScheduleCell`).
  const subOnly = rows.length > 0 && rows.every((row) => row.roleTone === 'subcontractor' && row.subBooking)
  const day: ScheduleDayCell | null = subOnly
    ? subcontractorScheduleCell({
        bookings: rows.map((row) => row.subBooking ?? null),
        day: first.subDay?.policy ?? null,
        dayKey: first.subDay?.dayKey ?? null,
      })
    : scheduleDayCell({ bookings: rows.map((row) => row.dayBooking), onLeave: Boolean(leave) })
  if (!day) return null
  const single = rows.length === 1
  const clickable = rows.some((row) => Boolean(row.booking || row.managerBooking || row.subBooking))
  const nameOnTile = first.peopleLabel || (first.roleTone === 'subcontractor' ? first.name : '')
  const tall = expanded || Boolean(nameOnTile) || !single
  const { tone } = day
  const otInk = 'text-[#5C3800]'
  const band = leave ? (
    <div
      className="flex h-4 items-center justify-center text-[9px] font-extrabold leading-none text-white"
      style={{ background: leaveColour(leave) }}
      title={leave.title}
      data-testid="schedule-leave-band"
    >
      {leave.label}
    </div>
  ) : null
  const hoursSize = expanded ? 'text-[12px]' : 'text-[11px]'
  const headline = (ink: string) => (
    <>
      {nameOnTile ? <p className={`text-[10px] font-semibold leading-tight ${ink}`}>{nameOnTile}</p> : null}
      {single && !subOnly ? <p className={`${expanded ? 'text-[11px]' : 'text-[10px]'} font-semibold leading-tight ${ink}`}>{first.slot}</p> : null}
      <p className={`${hoursSize} font-bold ${ink}`} data-testid="schedule-day-headline">
        {day.headline}
      </p>
    </>
  )
  const overtimeLines = (ink: string) =>
    expanded && day.overtimeLines.length > 0
      ? day.overtimeLines.map((line) => (
          <p key={line} className={`text-[10px] font-semibold leading-tight ${ink}`}>
            {line}
          </p>
        ))
      : null
  let body: React.ReactNode
  if (tone === 'split') {
    body = (
      <div className="flex flex-1 flex-col">
        <div className="px-1.5 py-1 text-white" style={{ background: STD_BLUE }}>
          {headline('text-white')}
          {day.standardText ? <p className="text-[9px] font-bold uppercase opacity-85">{day.standardText}</p> : null}
        </div>
        <div className={`flex-1 px-1.5 py-1 ${otInk}`} style={{ background: OT_STRIPES }}>
          {day.overtimeText ? <p className="text-[9px] font-extrabold uppercase">{day.overtimeText}</p> : null}
          {overtimeLines(otInk)}
        </div>
      </div>
    )
  } else {
    const ink = tone === 'otOnly' ? otInk : 'text-white'
    const background =
      tone === 'otOnly'
        ? OT_STRIPES
        : tone === 'halfDay'
          ? day.halfLabel === 'PM'
            ? `linear-gradient(90deg, ${HALF_LIGHT} 0 50%, ${STD_BLUE} 50% 100%)`
            : `linear-gradient(90deg, ${STD_BLUE} 0 50%, ${HALF_LIGHT} 50% 100%)`
          : STD_BLUE
    body = (
      <div className={`flex-1 px-1.5 ${tall ? 'py-1.5' : 'py-1'} ${ink}`} style={{ background }}>
        <div className={tone === 'halfDay' ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]' : ''}>
          {headline(ink)}
          {day.caption ? <p className="text-[9px] font-bold uppercase opacity-85">{day.caption}</p> : null}
          {overtimeLines(ink)}
        </div>
      </div>
    )
  }
  const className = `flex w-full flex-col overflow-hidden rounded-lg text-left ${tall ? 'min-h-[72px]' : minHeight} ${clickable ? 'hover:brightness-105' : 'cursor-default'}`
  const content = (
    <>
      {band}
      {body}
    </>
  )
  return clickable ? (
    <button
      type="button"
      onClick={onOpen}
      className={className}
      data-cell-tone={tone}
      data-booking-count={day.bookingCount}
      aria-label={single ? undefined : `${day.headline}. Opens a list of the bookings to edit one.`}
    >
      {content}
    </button>
  ) : (
    <div className={className} data-cell-tone={tone} data-booking-count={day.bookingCount}>
      {content}
    </div>
  )
}

/** Rulebook 1.41.0 §21: the bookings of one person-day, to pick the one to open (each keeps its own edit sheet). */
function DayBookingChooser({
  title,
  rows,
  onPick,
  onClose,
}: {
  title: string
  rows: DayRow[]
  onPick: (row: DayRow) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-[15px] font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{rows.length} bookings — pick one to edit.</p>
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onPick(row)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              data-testid="schedule-day-chooser-row"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-900">{row.slot}</span>
                {row.overtimeEquation ? <span className="block text-[11px] text-slate-500">{row.overtimeEquation}</span> : null}
              </span>
              {row.subBooking ? null : <span className="shrink-0 text-[13px] font-bold text-slate-700">{formatHoursLabel(row.hours)}h</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** Rulebook 1.37.0: the iOS Scheduling legend (`JOB_SCHEDULE_LEGEND`), replacing the role-colour legend. */
function ScheduleLegend() {
  const swatch = (label: string): React.CSSProperties => {
    switch (label) {
      case 'Std + OT':
        return { background: `linear-gradient(180deg, ${STD_BLUE} 0 50%, transparent 50%), ${OT_STRIPES}` }
      case 'OT only':
        return { background: OT_STRIPES }
      case 'Ann. leave':
        return { background: LEAVE_BROWN }
      case 'Half day':
        return { background: `linear-gradient(90deg, ${STD_BLUE} 0 50%, ${HALF_LIGHT} 50% 100%)` }
      default:
        return { background: STD_BLUE }
    }
  }
  return (
    <div className="mt-3 flex flex-wrap gap-3 px-1 text-[11px] text-slate-500" data-testid="schedule-legend">
      {JOB_SCHEDULE_LEGEND.map((label) => (
        <span key={label} className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={swatch(label)} /> {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEAVE_PENDING }} /> AL? = leave requested
      </span>
    </div>
  )
}

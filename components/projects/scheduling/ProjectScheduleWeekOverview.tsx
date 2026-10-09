'use client'

import Link from 'next/link'
import { addDays, endOfWeek, format, isToday as dateFnsIsToday, startOfWeek } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { weekDaysFrom } from '@/lib/scheduling/scheduleUtils'
import {
  customHoursRangeLabel,
  formatHoursLabel,
  hoursBreakdown,
  namedSlotLabel,
} from '@/lib/scheduling/paidHours'
import { BookingEditSheet } from '@/components/schedule/BookingEditSheet'
import { QuickAddBookingSheet, type QuickAddBookingValues } from '@/components/schedule/QuickAddBookingSheet'
import { useAuthStore } from '@/lib/stores/authStore'
import { ORG_DATA_REFRESHED_EVENT } from '@/lib/stores/refreshOrgData'
import { canBookWork } from '@/lib/permissions'
import { UserRole, type User } from '@/types'
import { SubcontractorBookingEditSheet } from '@/components/projects/scheduling/SubcontractorBookingEditSheet'
import { managerSiteBookingToScheduleBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Booking, Project } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { scheduleWorkKindLabel } from '@/lib/jobTypes/jobTypesStorage'
import { asClockHhMm } from '@/lib/ios-parity/firestoreCodec'
import { coversCalendarDay } from '@/lib/ios-parity/londonTime'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import { DEFAULT_PAYROLL_POLICY, loadOrganizationDetails, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import {
  findSubcontractorFirm,
  formatSubcontractorBookingLabel,
  idsMatch,
  parseBookedPeopleFields,
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
  booking?: Booking
  managerBooking?: ManagerSiteBooking
  subBooking?: SubBooking
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
  cells: DayRow[][]
}

function emailKey(value: string | undefined | null): string {
  return String(value || '').trim().toLowerCase()
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

function bookingRowFromHours(input: {
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  unpaidBreakMinutes?: number
  breakWindowStart?: string
  breakWindowEnd?: string
  standardPaidHours?: number
  standardDayStart?: string
  standardDayEnd?: string
  overtimeMultiplier?: number
}): Pick<DayRow, 'hours' | 'overtimeEquation' | 'range' | 'slot'> {
  const breakdown = hoursBreakdown(input)
  const range = customHoursRangeLabel(input)
  const slotStr = range && range !== 'Custom hours' ? range : namedSlotLabel(input.timeSlot)
  return {
    hours: breakdown.totalPaidHours,
    overtimeEquation: breakdown.overtimeLine || breakdown.overtimeEquation,
    range,
    slot: slotStr,
  }
}

function toneClass(tone: DayRow['roleTone']) {
  if (tone === 'subcontractor') return 'bg-violet-100 text-violet-700'
  if (tone === 'manager') return 'bg-blue-100 text-blue-700'
  return 'bg-emerald-100 text-emerald-700'
}

function cellFillClass(tone: DayRow['roleTone']) {
  if (tone === 'subcontractor') return 'bg-violet-50 border-violet-200 hover:bg-violet-100'
  if (tone === 'manager') return 'bg-blue-50 border-blue-200 hover:bg-blue-100'
  return 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
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
  const canQuickAdd = canBookWork(currentUser)
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [subBookings, setSubBookings] = useState<SubBooking[]>([])
  const [expanded, setExpanded] = useState(variant !== 'hub')
  const [editingRow, setEditingRow] = useState<DayRow | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [quickAdd, setQuickAdd] = useState<{ person: PersonWeek; date: Date } | null>(null)
  const [savingQuickAdd, setSavingQuickAdd] = useState(false)
  const [payroll, setPayroll] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)

  useEffect(() => {
    loadBookings(organizationId)
    loadManagerSiteBookings(organizationId)
    loadOperatives(organizationId)
    loadUsers(organizationId)
    loadSubcontractors(organizationId)
    loadOrganizationDetails(organizationId)
      .then((details) => {
        if (details?.payrollTimePolicy) setPayroll(details.payrollTimePolicy)
      })
      .catch(() => {})
  }, [organizationId, loadBookings, loadManagerSiteBookings, loadOperatives, loadUsers, loadSubcontractors])

  useEffect(() => {
    const load = async () => {
      const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'subcontractorBookings'))
      setSubBookings(
        snapshot.docs
          .map((docSnap): SubBooking | null => {
            const data = docSnap.data() as Record<string, unknown>
            if (!idsMatch(String(data.projectId || data.projectID || ''), project.id)) return null
            const date = parseFirestoreDate(data.date)
            if (!date) return null
            const peopleFields = parseBookedPeopleFields(data)
            const row: SubBooking = {
              id: docSnap.id,
              subcontractorId: String(data.subcontractorId || data.subContractorId || ''),
              date,
              timeSlot: String(data.timeSlot || 'FULL DAY'),
              bookedContactIds: peopleFields.bookedContactIds,
              bookedOperativeNames: peopleFields.bookedOperativeNames,
            }
            const start = asClockHhMm(data.workStartTime)
            const end = asClockHhMm(data.workEndTime)
            if (start) row.workStartTime = start
            if (end) row.workEndTime = end
            if (data.isBreakRemoved === true) row.isBreakRemoved = true
            return row
          })
          .filter((row): row is SubBooking => row !== null)
      )
    }
    void load()
    const onRefreshed = () => {
      void load()
      loadOrganizationDetails(organizationId, { fromServer: true, allowCacheFallback: true })
        .then((details) => {
          if (details?.payrollTimePolicy) setPayroll(details.payrollTimePolicy)
        })
        .catch(() => {})
    }
    window.addEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
    return () => window.removeEventListener(ORG_DATA_REFRESHED_EVENT, onRefreshed)
  }, [organizationId, project.id])

  const weekDays = useMemo(() => weekDaysFrom(weekStart), [weekStart])
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
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

  const usersByEmail = useMemo(() => {
    const map = new Map<string, User>()
    for (const user of users) {
      const key = emailKey(user.email)
      if (key && !map.has(key)) map.set(key, user)
    }
    return map
  }, [users])

  const rowsByDay = useMemo(() => {
    return weekDays.map((day) => {
      const opRows: DayRow[] = projectBookings
        .filter((b) => coversCalendarDay(new Date(b.date), day))
        .map((b) => {
          const op = operatives.find((o) => o.id === b.operativeId)
          const name = op ? `${op.firstName} ${op.lastName}`.trim() : 'Operative'
          const linkedUser = op ? usersByEmail.get(emailKey(op.email)) : undefined
          const role = roleForUser(linkedUser)
          return {
            id: b.id,
            personKey: linkedUser ? `user:${linkedUser.id}` : `op:${b.operativeId}`,
            name,
            roleLabel: role.label,
            roleTone: role.tone,
            quickAdd: { kind: 'operative' as const, operativeId: b.operativeId },
            booking: b,
            ...bookingRowFromHours({
              ...b,
              unpaidBreakMinutes: payroll.unpaidBreakMinutes,
              breakWindowStart: payroll.breakWindowStart,
              breakWindowEnd: payroll.breakWindowEnd,
              standardPaidHours: payroll.standardPaidHours,
              standardDayStart: payroll.standardDayStart,
              standardDayEnd: payroll.standardDayEnd,
              overtimeMultiplier: payroll.weekdayOutsideStandardMultiplier,
            }),
          }
        })

      const managerRows: DayRow[] = projectManagerBookings
        .filter((b) => coversCalendarDay(new Date(b.date), day))
        .map((b) => {
          const manager = users.find((u) => u.id === b.userId)
          const name = manager ? `${manager.firstName} ${manager.surname}`.trim() : 'Manager'
          const role = manager ? roleForUser(manager) : { label: 'Mgr', tone: 'manager' as const }
          const linkedOperative = manager
            ? operatives.find((o) => emailKey(o.email) && emailKey(o.email) === emailKey(manager.email))
            : undefined
          return {
            id: b.id,
            personKey: manager ? `user:${manager.id}` : `mgr:${b.userId}`,
            name,
            roleLabel: role.label,
            roleTone: role.tone,
            // Booking flow books a roster operative through operative bookings; keep Quick Add on the same path.
            quickAdd: linkedOperative
              ? { kind: 'operative' as const, operativeId: linkedOperative.id }
              : { kind: 'manager' as const, userId: b.userId },
            managerBooking: b,
            ...bookingRowFromHours({
              ...b,
              unpaidBreakMinutes: payroll.unpaidBreakMinutes,
              breakWindowStart: payroll.breakWindowStart,
              breakWindowEnd: payroll.breakWindowEnd,
              standardPaidHours: payroll.standardPaidHours,
              standardDayStart: payroll.standardDayStart,
              standardDayEnd: payroll.standardDayEnd,
              overtimeMultiplier: payroll.weekdayOutsideStandardMultiplier,
            }),
          }
        })

      const subRows: DayRow[] = subBookings
        .filter((b) => coversCalendarDay(new Date(b.date), day))
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
            subBooking: b,
            ...bookingRowFromHours({
              ...b,
              unpaidBreakMinutes: payroll.unpaidBreakMinutes,
              breakWindowStart: payroll.breakWindowStart,
              breakWindowEnd: payroll.breakWindowEnd,
              standardPaidHours: payroll.standardPaidHours,
              standardDayStart: payroll.standardDayStart,
              standardDayEnd: payroll.standardDayEnd,
              overtimeMultiplier: payroll.weekdayOutsideStandardMultiplier,
            }),
          }
        })

      return [...opRows, ...managerRows, ...subRows]
    })
  }, [weekDays, projectBookings, projectManagerBookings, subBookings, operatives, users, usersByEmail, subcontractors, payroll])

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
        person.cells[dayIndex].push(row)
      }
    })
    return order.map((key) => byKey.get(key)!).sort((a, b) => a.name.localeCompare(b.name))
  }, [rowsByDay, weekDays])

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

  const saveEditing = async (updates: Partial<Booking>) => {
    if (!editingRow) return
    setSavingEdit(true)
    try {
      if (editingRow.booking) {
        await updateBooking(editingRow.booking.id, updates)
      } else if (editingRow.managerBooking) {
        await updateManagerSiteBooking(organizationId, editingRow.managerBooking.id, {
          timeSlot: String(updates.timeSlot || editingRow.managerBooking.timeSlot),
          workStartTime: updates.workStartTime,
          workEndTime: updates.workEndTime,
          isBreakRemoved: updates.isBreakRemoved,
        })
      }
    } finally {
      setSavingEdit(false)
    }
  }

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

  const existingBookingsForQuickAdd = useMemo(() => {
    if (!quickAdd) return []
    const target = quickAdd.person.quickAdd
    const day = quickAdd.date
    const labels: string[] = []
    const personUserId = quickAdd.person.key.startsWith('user:') ? quickAdd.person.key.slice(5) : null
    for (const b of bookings) {
      if (!coversCalendarDay(new Date(b.date), day)) continue
      const sameOperative = target?.kind === 'operative' && b.operativeId === target.operativeId
      if (!sameOperative) continue
      labels.push(`${idsMatch(b.projectId, project.id) ? 'This job' : 'Another job'} ${namedSlotLabel(String(b.timeSlot))}`)
    }
    for (const b of managerSiteBookings) {
      if (!coversCalendarDay(new Date(b.date), day)) continue
      const sameUser = (target?.kind === 'manager' && b.userId === target.userId) || (personUserId && b.userId === personUserId)
      if (!sameUser) continue
      labels.push(`${idsMatch(b.locationId || '', project.id) ? 'This job' : 'Elsewhere'} ${namedSlotLabel(String(b.timeSlot))}`)
    }
    return labels
  }, [quickAdd, bookings, managerSiteBookings, project.id])

  const saveQuickAdd = async (values: QuickAddBookingValues) => {
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
        })
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
        })
      }
    } finally {
      setSavingQuickAdd(false)
    }
  }

  return (
    <div className="space-y-4">
      {variant === 'full' ? (
      <div className="card pad">
        <p className="text-xs font-bold text-[var(--blue)] truncate">
          {project.jobNumber} {project.siteName}
        </p>
        <p className="text-xs text-[var(--ink3)] truncate">
          {project.client?.name}
          {project.addressLine1 ? ` · ${project.addressLine1}` : ''}
        </p>
        <span className="mt-1 inline-block rounded-md bg-[var(--soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink2)]">
          {scheduleWorkKindLabel(project)}
        </span>
      </div>
      ) : null}

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
                const isTodayDay = dateFnsIsToday(day)
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
                  weekDays={weekDays}
                  expanded={expanded}
                  onEdit={setEditingRow}
                  onQuickAdd={canQuickAdd ? (target, date) => setQuickAdd({ person: target, date }) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 px-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Operative</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" /> Manager / Admin</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" /> Sub contractor</span>
        </div>
      </div>

      {editingRow?.subBooking ? (
        <SubcontractorBookingEditSheet
          organizationId={organizationId}
          booking={editingRow.subBooking}
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
          existingToday={existingBookingsForQuickAdd}
          showNotes={quickAdd.person.quickAdd.kind === 'operative'}
          saving={savingQuickAdd}
          payroll={payroll}
          onSave={saveQuickAdd}
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
          onSave={saveEditing}
          onDelete={deleteEditing}
          onClose={() => setEditingRow(null)}
        />
      ) : null}
    </div>
  )
}

function PersonRow({
  person,
  weekDays,
  expanded,
  onEdit,
  onQuickAdd,
}: {
  person: PersonWeek
  weekDays: Date[]
  expanded: boolean
  onEdit: (row: DayRow) => void
  onQuickAdd?: (person: PersonWeek, date: Date) => void
}) {
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
          <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${toneClass(person.roleTone)}`}>
            {person.roleLabel}
          </span>
        </div>
      </div>
      {weekDays.map((day, index) => {
        const cell = person.cells[index]
        const isTodayDay = dateFnsIsToday(day)
        return (
          <div
            key={`${person.key}-${day.toISOString()}`}
            className={`border-l border-t border-slate-100 p-1.5 ${isTodayDay ? 'bg-blue-50/40' : 'bg-white'}`}
          >
            {cell.length === 0 ? (
              onQuickAdd && person.quickAdd ? (
                <button
                  type="button"
                  onClick={() => onQuickAdd(person, day)}
                  aria-label={`Quick add booking for ${person.name} on ${format(day, 'EEE d MMM')}`}
                  className={`group flex w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-[11px] font-semibold text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:border-slate-300 focus-visible:bg-slate-50 focus-visible:outline-none ${expanded ? 'min-h-[72px]' : 'min-h-[44px]'}`}
                >
                  <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    + Quick add
                  </span>
                </button>
              ) : (
                <div className={`rounded-lg border border-dashed border-slate-200 ${expanded ? 'min-h-[72px]' : 'min-h-[44px]'}`} />
              )
            ) : (
              <div className="space-y-1">
                {cell.map((row) => {
                  const clickable = Boolean(row.booking || row.managerBooking || row.subBooking)
                  const nameOnTile = row.peopleLabel || (row.roleTone === 'subcontractor' ? row.name : '')
                  const inner = expanded ? (
                    <>
                      {nameOnTile ? (
                        <p className="text-[10px] font-semibold leading-tight text-slate-800">{nameOnTile}</p>
                      ) : null}
                      <p className="text-[11px] font-semibold leading-tight text-slate-800">{row.slot}</p>
                      <p className="text-[12px] font-bold text-slate-900">{formatHoursLabel(row.hours)}h</p>
                      {row.overtimeEquation ? (
                        <p className="text-[10px] font-semibold leading-tight text-amber-700">{row.overtimeEquation}</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {nameOnTile ? (
                        <p className="text-[10px] font-semibold leading-tight text-slate-700">{nameOnTile}</p>
                      ) : null}
                      <p className="text-[10px] font-semibold leading-tight text-slate-700">{row.slot}</p>
                      <p className="text-[11px] font-bold text-slate-900">{formatHoursLabel(row.hours)}h</p>
                    </>
                  )
                  const className = `w-full rounded-lg border px-1.5 ${expanded || nameOnTile ? 'py-1.5 min-h-[72px]' : 'py-1 min-h-[44px]'} text-left ${cellFillClass(row.roleTone)} ${clickable ? '' : 'cursor-default'}`
                  return clickable ? (
                    <button key={row.id} type="button" onClick={() => onEdit(row)} className={className}>
                      {inner}
                    </button>
                  ) : (
                    <div key={row.id} className={className}>
                      {inner}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

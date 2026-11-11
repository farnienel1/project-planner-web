'use client'

import { enabledScheduleLocations, type MyScheduleClashMarker } from '@/lib/canonical'
import { MyScheduleClashMarkerButton } from '@/components/schedule/MyScheduleClashMarker'
import { intervalsOverlap, operativeClashInterval } from '@/lib/warnings/clashIntervals'
import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  addDays,
  format,
  isSameDay,
  startOfDay,
} from 'date-fns'
import { organizationCalendarWeekStart, organizationCurrentWeekStart, organizationTodayCalendarDate } from '@/lib/orgTime/organizationWeek'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName, samePersonIds } from '@/lib/staff/userRosterUtils'
import {
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  loadOrganizationDetails,
  type MyScheduleOptions,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import {
  managerSiteBookingDisplayTitle,
  managerSiteBookingToScheduleBooking,
  type ManagerLocationType,
  type ManagerSiteBooking,
} from '@/lib/scheduling/managerSiteBookingUtils'
import { AddWeekToCalendarButton } from '@/components/schedule/AddWeekToCalendarButton'
import { myScheduleStripeClass } from '@/components/schedule/MyScheduleLooks'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { CreateOvertimeRateField } from '@/components/overtime/OvertimeRateField'
import { organizationOvertimeMultiplier, overtimeMultiplierCreateFields } from '@/lib/canonical'
import {
  confirmCustomHoursBreak,
  policyForBookingDate,
  slotOfferedOnDate,
  weekendNotesForDates,
  weekendWeekdayMixMessage,
} from '@/lib/scheduling/bookingSlotRules'
import { BookingEditSheet } from '@/components/schedule/BookingEditSheet'
import { userBookingRemoveAction } from '@/lib/access/bookingAccess'
import { useCustomHoursPrefillOnKindChange } from '@/lib/scheduling/useOrganizationPayrollPolicy'
import {
  conflictRowKey,
  useBookingConflictGate,
  type BookingConflictRow,
} from '@/components/scheduling/BookingConflictRows'
import { useLeaveConflictCheck } from '@/components/scheduling/useLeaveConflictCheck'
import { dayKey as orgDayKey } from '@/lib/ios-parity/londonTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { searchWorks } from '@/lib/projects/workStatus'
import { worksInTab, worksTabCounts } from '@/lib/canonical'
import { bookableWorks } from '@/lib/access/workAccess'
import { coversCalendarDay } from '@/lib/ios-parity/londonTime'
import type { Booking, Project } from '@/types'
import { useBookingHistoryFrom } from '@/lib/stores/useBookingHistory'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { myScheduleAnnualLeaveLabel, myScheduleLeaveRecords } from '@/lib/schedule/myScheduleLeave'
import { useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { bookingRequestIdentity } from '@/lib/canonical/bookingSlots'
import { managerBookingIdentity, uniqueBookingsById } from '@/lib/scheduling/bookingRequestIdentity'
import { bookingRowText } from '@/lib/scheduling/bookingRowHours'

/** Labour booked onto this person from Book labour. Shown on the week, not removed from here. */
export type AssignedScheduleBooking = {
  id: string
  date: Date
  title: string
  detail: string
}

type JobFilter = 'all' | 'active' | 'upcoming' | 'completed'

const selfBookInflight = new Set<string>()

function BookColumn({
  title,
  hue,
  count,
  children,
}: {
  title: string
  hue: string
  count: number
  children: ReactNode
}) {
  return (
    <section className="card" data-hue={hue}>
      <div className="card-h">
        <h2 className="h2 grow" style={{ fontSize: 17 }}>
          {title}
        </h2>
        <span className="count soft">{count}</span>
      </div>
      <div className="card-b rows">{children}</div>
    </section>
  )
}

function ColumnSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="in"
      aria-label={placeholder}
    />
  )
}

function StatusFilters({
  value,
  counts,
  onChange,
}: {
  value: JobFilter
  counts: { all: number; active: number; upcoming: number; completed: number }
  onChange: (value: JobFilter) => void
}) {
  const chips: { id: JobFilter; label: string }[] = [
    { id: 'all', label: `All · ${counts.all}` },
    { id: 'active', label: `Active · ${counts.active}` },
    { id: 'upcoming', label: `Upcoming · ${counts.upcoming}` },
    { id: 'completed', label: `Completed · ${counts.completed}` },
  ]
  return (
    <div className="chips">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={`chip ${value === chip.id ? 'on' : ''}`}
          onClick={() => onChange(chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}

type TimeSlot = 'AM' | 'PM' | 'FULL_DAY' | 'CUSTOM_HOURS'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS: { slot: TimeSlot; label: string }[] = [
  { slot: 'AM', label: 'AM' },
  { slot: 'PM', label: 'PM' },
  { slot: 'FULL_DAY', label: 'Full Day' },
  { slot: 'CUSTOM_HOURS', label: 'Custom hours' },
]

/** Rulebook 1.20.2: "Custom 07:30–14:00 · 13h (6.5h × 2)" — the times and the pay rule's hours for that day. */
function slotLabel(booking: ManagerSiteBooking, policy?: OrgPayrollTimePolicy | null): string {
  return bookingRowText(booking, booking.date, policy)
}

function locationStripe(type?: ManagerLocationType): string {
  return myScheduleStripeClass(type)
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

export function MyScheduleSelfBookingScreen({
  userId,
  organizationId,
  organizationName,
  payrollPolicy = DEFAULT_PAYROLL_POLICY,
  assignedBookings = [],
  canEditBookings = false,
  clashMarkers,
}: {
  userId: string
  organizationId: string
  organizationName: string
  payrollPolicy?: OrgPayrollTimePolicy
  assignedBookings?: AssignedScheduleBooking[]
  /** Same gate as Daily Overview editing (`canBookWork`). Opens the shared BookingEditSheet. */
  canEditBookings?: boolean
  /** Rulebook 1.39.0 §10: the clash marker per booking id (`myScheduleClashMarkers`). */
  clashMarkers?: ReadonlyMap<string, MyScheduleClashMarker>
}) {
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const {
    managerSiteBookings,
    loadManagerSiteBookings,
    saveManagerSiteBooking,
    updateManagerSiteBooking,
    deleteManagerSiteBooking,
    loading,
  } = useManagerScheduleStore()
  const { users, userIdAliases, loadUsers } = useOrgUserStore()
  // Rulebook 1.16.0 §5: booking yourself onto a day of your own annual leave asks first.
  const leaveCheck = useLeaveConflictCheck(payrollPolicy)
  // Rulebook 1.17.0 §4.3: the live organisation document, so the weekend note, prefill and break check read the
  // working hours in effect on the booking day (`effectivePayrollTimePolicy` in bookingSlotRules).
  useOrganizationDocument()
  const leaveGate = useBookingConflictGate()

  // Rulebook §1 (1.36.0, FU-4): the organisation's current week and today, not the browser's.
  const [weekStart, setWeekStart] = useState(() => organizationCurrentWeekStart())
  // An earlier week reaches before the launch booking download.
  useBookingHistoryFrom(organizationId, weekStart)
  const [selectedDate, setSelectedDate] = useState<Date>(() => organizationTodayCalendarDate())
  const [multiDay, setMultiDay] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [expandedLoc, setExpandedLoc] = useState<string | null>(null)
  const [customStart, setCustomStart] = useState('07:30')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [breakRemoved, setBreakRemoved] = useState(false)
  // Rulebook 1.32.0 §25 (decision A): the custom-hours rate, null = the organisation's pre-filled rate.
  const [customRate, setCustomRate] = useState<number | null>(null)
  const { data: rateOrgDocument } = useOrganizationDocument()
  const [scheduleOpts, setScheduleOpts] = useState<MyScheduleOptions>({
    ...DEFAULT_MY_SCHEDULE,
    customItemEnabled: {},
  })
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [otherQuery, setOtherQuery] = useState('')
  const [projectQuery, setProjectQuery] = useState('')
  const [smallQuery, setSmallQuery] = useState('')
  const [projectStatus, setProjectStatus] = useState<JobFilter>('active')
  const [smallStatus, setSmallStatus] = useState<JobFilter>('active')
  const [bookSheetDay, setBookSheetDay] = useState<Date | null>(null)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    loadManagerSiteBookings(organizationId)
    loadUsers(organizationId)
    loadProjects(organizationId)
    loadSmallWorks(organizationId)
    loadOrganizationDetails(organizationId)
      .then((details) => {
        if (details?.myScheduleOptions) setScheduleOpts(details.myScheduleOptions)
      })
      .catch(() => {})
  }, [organizationId, loadManagerSiteBookings, loadUsers, loadProjects, loadSmallWorks])

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  // The organisation's today, once per render (not once per day cell of the week strip).
  const todayDate = organizationTodayCalendarDate()

  // Rulebook §10 (1.12.2): the person's own annual leave, approved and pending, matched by account — the same as the
  // read-only My Schedule and iOS. Live: `loadBookings` attaches the holidayBookings listener.
  const authUser = useAuthStore((state) => state.user)
  const rosterOperatives = useOperativeStore((state) => state.operatives)
  const rosterManagers = useOperativeStore((state) => state.managers)
  const loadRosterManagers = useOperativeStore((state) => state.loadManagers)
  const timeZone = useOrganizationTimeZone()
  useEffect(() => {
    // Rulebook 1.10.0: `canSeeJob` / `canWriteBooking` read the managers list.
    if (organizationId) void loadRosterManagers(organizationId)
  }, [organizationId, loadRosterManagers])
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings, loadedOrgId: holidaysLoadedOrgId } = useHolidayStore()
  useEffect(() => {
    if (organizationId) void loadHolidayBookings(organizationId)
  }, [organizationId, loadHolidayBookings])
  const myHolidays = useMemo(() => {
    if (holidaysLoadedOrgId !== organizationId || !authUser || authUser.id !== userId) return []
    return myScheduleLeaveRecords(authUser, holidayBookings, rosterOperatives, [...samePersonIds(userId, users, userIdAliases)])
  }, [holidaysLoadedOrgId, organizationId, authUser, userId, holidayBookings, rosterOperatives, users, userIdAliases])

  const myBookings = useMemo(() => {
    const mineIds = samePersonIds(userId, users, userIdAliases)
    // Rulebook 1.20.2: one row per stored booking (by id). Folding by person/day/place hid a second weekend booking at
    // the same job with other times, because weekend bookings are all custom hours.
    return uniqueBookingsById(managerSiteBookings.filter((b) => mineIds.has(b.userId)))
  }, [managerSiteBookings, userId, users, userIdAliases])

  const myBookingsOn = (day: Date): ManagerSiteBooking[] =>
    myBookings.filter((b) => coversCalendarDay(b.date, day))

  const assignedOn = (day: Date): AssignedScheduleBooking[] =>
    assignedBookings.filter((b) => coversCalendarDay(b.date, day))

  const projectsById = useMemo(() => {
    const map = new Map<string, string>()
    ;[...projects, ...smallWorks].forEach((p) => {
      map.set(p.id, `${p.jobNumber ?? ''} ${p.siteName ?? ''}`.trim() || p.siteName || p.id)
    })
    return map
  }, [projects, smallWorks])

  const calendarBookings = useMemo(
    () =>
      myBookings.map((b) => managerSiteBookingToScheduleBooking(b, projectsById, organizationId)),
    [myBookings, projectsById, organizationId]
  )

  function targetDays(): Date[] {
    if (multiDay && selectedDates.length > 0) return selectedDates
    return [selectedDate]
  }

  // Rulebook 1.18.0 (`customHoursPrefillForDays`): one time pair for the whole request. When the selection changes
  // kind (weekend only ↔ weekday only) the custom hours reset to that kind's default — the first Saturday's window, or
  // the standard day in effect on the first day; a manual edit survives adding another day of the same kind.
  useCustomHoursPrefillOnKindChange(targetDays(), payrollPolicy, (hours) => {
    setCustomStart(hours.start)
    setCustomEnd(hours.end)
  })

  function flash(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg })
    window.setTimeout(() => setToast(null), 2800)
  }

  function locationName(booking: ManagerSiteBooking): string {
    return managerSiteBookingDisplayTitle(booking, projectsById)
  }

  async function commitBooking(args: {
    days: Date[]
    timeSlot: TimeSlot
    locationType: ManagerLocationType
    locationId?: string
    customLocationName?: string
  }) {
    // Rulebook 1.20.2 (`bookingRequestIdentity`): the request is the same booking only with the same custom times too.
    const zone = organizationZoneOr()
    const identityFor = (day: Date) =>
      bookingRequestIdentity({
        personId: userId,
        dayKey: orgDayKey(day, zone),
        timeSlot: args.timeSlot,
        locationType: args.locationType,
        locationId: args.locationId ?? null,
        customLocationName: args.customLocationName ?? null,
        workStartTime: args.timeSlot === 'CUSTOM_HOURS' ? customStart : null,
        workEndTime: args.timeSlot === 'CUSTOM_HOURS' ? customEnd : null,
        isBreakRemoved: args.timeSlot === 'CUSTOM_HOURS' ? breakRemoved : false,
      })
    const keys = args.days.map(identityFor)
    if (keys.some((key) => selfBookInflight.has(key))) return
    keys.forEach((key) => selfBookInflight.add(key))
    setBusy(true)
    try {
      let wrote = 0
      for (const day of args.days) {
        const identity = identityFor(day)
        const already = myBookingsOn(day).some((booking) => managerBookingIdentity(booking, zone) === identity)
        if (already) continue
        await saveManagerSiteBooking(organizationId, {
          userId,
          date: day,
          timeSlot: args.timeSlot,
          locationType: args.locationType,
          locationId: args.locationId,
          customLocationName: args.customLocationName,
          workStartTime: args.timeSlot === 'CUSTOM_HOURS' ? customStart : undefined,
          workEndTime: args.timeSlot === 'CUSTOM_HOURS' ? customEnd : undefined,
          isBreakRemoved: args.timeSlot === 'CUSTOM_HOURS' ? breakRemoved : false,
          ...(args.timeSlot === 'CUSTOM_HOURS'
            ? (() => {
                const organizationMultiplier = organizationOvertimeMultiplier(rateOrgDocument ?? {}, orgDayKey(day, zone), zone)
                return overtimeMultiplierCreateFields({ chosen: customRate ?? organizationMultiplier, organizationMultiplier })
              })()
            : {}),
        })
        wrote += 1
      }
      if (wrote === 0) {
        flash('success', 'That time is already booked.')
      } else {
        flash('success', wrote > 1 ? `Booked across ${wrote} days.` : 'Booking added.')
      }
      setExpandedLoc(null)
      setBookSheetDay(null)
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save booking.')
    } finally {
      keys.forEach((key) => selfBookInflight.delete(key))
      setBusy(false)
    }
  }

  async function book(args: {
    timeSlot: TimeSlot
    locationType: ManagerLocationType
    locationId?: string
    customLocationName?: string
  }) {
    // Rulebook 1.13.0 (Q2): Saturday and Sunday are custom hours only, and one request never mixes weekdays and
    // weekend days (`bookingDaysMixWeekdayAndWeekend`).
    const allDays = targetDays()
    const mix = weekendWeekdayMixMessage(allDays)
    if (mix) {
      flash('error', mix)
      return
    }
    let days = allDays.filter((day) => slotOfferedOnDate(args.timeSlot, day, payrollPolicy))
    if (days.length === 0) {
      flash('error', 'Saturday and Sunday are booked as custom hours only.')
      return
    }
    // 1.13.0 lunch warning (`customHoursBreakWarning`), checked on the first day booked.
    if (
      args.timeSlot === 'CUSTOM_HOURS' &&
      !days.every((day) =>
        confirmCustomHoursBreak(payrollPolicy, day, {
          timeSlot: 'CUSTOM_HOURS',
          workStartTime: customStart,
          workEndTime: customEnd,
          isBreakRemoved: breakRemoved,
        })
      )
    ) {
      return
    }
    // 1.16.0 (§5): your other bookings that day (orange) and annual leave (purple, `bookingLeaveConflicts`) in one
    // list, the same rows as every booking flow — tick to book anyway, or ✕ to drop that day.
    const zone = organizationZoneOr()
    const clashRows: BookingConflictRow[] = days.flatMap((day) => {
      // Owner decision (1.19.0): warn only when the times actually overlap (`slotInterval` via
      // `operativeClashInterval`, `intervalsOverlap`), as every other booking flow does — touching times do not clash.
      const dayPolicy = policyForBookingDate(day, payrollPolicy) ?? payrollPolicy
      const probe = operativeClashInterval(
        {
          timeSlot: args.timeSlot,
          workStartTime: args.timeSlot === 'CUSTOM_HOURS' ? customStart : undefined,
          workEndTime: args.timeSlot === 'CUSTOM_HOURS' ? customEnd : undefined,
        } as Parameters<typeof operativeClashInterval>[0],
        dayPolicy ?? undefined
      )
      const existing = myBookingsOn(day).filter((booking) => {
        const interval = operativeClashInterval(booking as Parameters<typeof operativeClashInterval>[0], dayPolicy ?? undefined)
        return Boolean(probe && interval && intervalsOverlap(probe, interval))
      })
      if (existing.length === 0) return []
      const key = orgDayKey(day, zone)
      return [
        {
          key: conflictRowKey(userId, key, 'double_booking'),
          personId: userId,
          dayKey: key,
          kind: 'double_booking' as const,
          personName: 'You',
          dayLabel: format(day, 'EEE d MMM yyyy'),
          detail: `Already booked · ${existing.map((b) => `${slotLabel(b, payrollPolicy)} — ${locationName(b)}`).join(', ')}`,
        },
      ]
    })
    const leaveRows = leaveCheck.rowsFor(
      [{ id: userId, userId, name: 'You' }],
      days.map((day) => orgDayKey(day, zone)),
      {
        timeSlot: args.timeSlot,
        workStartTime: args.timeSlot === 'CUSTOM_HOURS' ? customStart : undefined,
        workEndTime: args.timeSlot === 'CUSTOM_HOURS' ? customEnd : undefined,
      }
    )
    const dropped = await leaveGate.check([...clashRows, ...leaveRows])
    if (dropped === null) return
    if (dropped.size > 0) {
      days = days.filter((day) => !dropped.has(`${userId}|${orgDayKey(day, zone)}`))
      if (days.length === 0) return
    }
    void commitBooking({ days, ...args })
  }

  // Rulebook §2 (1.33.0): every remove control here is `bookingRemoveAction` — own non-job bookings and bookings on
  // jobs you manage: delete; anything else: no remove control (there is no cancel).
  function removeActionFor(booking: ManagerSiteBooking) {
    const job = booking.locationId
      ? [...projects, ...smallWorks].find((entry) => entry.id.toLowerCase() === String(booking.locationId).toLowerCase())
      : null
    return userBookingRemoveAction(
      authUser,
      { collection: 'managerSiteBookings', userId: booking.userId, locationType: booking.locationType, locationId: booking.locationId ?? null },
      job,
      rosterManagers
    )
  }

  async function removeBooking(booking: ManagerSiteBooking) {
    setBusy(true)
    try {
      await deleteManagerSiteBooking(organizationId, booking.id)
      flash('success', 'Booking removed.')
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not remove booking.')
    } finally {
      setBusy(false)
    }
  }

  const editingManagerBooking = useMemo(
    () => (editingBookingId ? myBookings.find((b) => b.id === editingBookingId) ?? null : null),
    [editingBookingId, myBookings]
  )
  const selfName = useMemo(() => {
    const row = users.find((u) => u.id === userId)
    return (row && rosterDisplayName(row)) || 'You'
  }, [users, userId])

  /** Same write BookingEditSheet already makes for a manager booking in the project week overview. */
  async function saveEditedBooking(booking: ManagerSiteBooking, updates: Partial<Booking>) {
    setSavingEdit(true)
    try {
      await updateManagerSiteBooking(organizationId, booking.id, {
        timeSlot: String(updates.timeSlot || booking.timeSlot),
        workStartTime: updates.workStartTime,
        workEndTime: updates.workEndTime,
        isBreakRemoved: updates.isBreakRemoved,
      })
      flash('success', 'Booking updated.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteEditedBooking(booking: ManagerSiteBooking) {
    setSavingEdit(true)
    try {
      await deleteManagerSiteBooking(organizationId, booking.id)
      flash('success', 'Booking removed.')
    } finally {
      setSavingEdit(false)
    }
  }

  function openBookSheet(day: Date) {
    const next = startOfDay(day)
    setSelectedDate(next)
    setBookSheetDay(next)
    setExpandedLoc(null)
  }

  function toggleDayInMulti(day: Date) {
    setSelectedDates((prev) =>
      prev.some((d) => isSameDay(d, day))
        ? prev.filter((d) => !isSameDay(d, day))
        : [...prev, startOfDay(day)]
    )
  }

  const weekRangeText = `${format(weekDates[0], 'd MMM')} – ${format(weekDates[6], 'd MMM')}`

  // Canonical `enabledScheduleLocations`: built-ins behind their toggles, custom items honouring customItemEnabled.
  const selfLocations: { key: string; type: ManagerLocationType; name: string; custom?: string }[] =
    enabledScheduleLocations(scheduleOpts).map((loc) => ({
      key: loc.id,
      type: loc.locationType,
      name: loc.title,
      custom: loc.customLocationName,
    }))

  const otherQueryText = otherQuery.trim().toLowerCase()
  const filteredOther = selfLocations.filter((loc) => loc.name.toLowerCase().includes(otherQueryText))
  // Rulebook 1.21.0 §21 (`bookableJobs`): jobs the signed-in user may book onto — visible, not inactive and writable
  // for a manager site booking (`canWriteBooking`: a job they manage); the job's dates are never checked. The tabs
  // only sort that list (`worksInTab` / `worksTabCounts`).
  const bookableAccess = {
    user: authUser,
    operatives: rosterOperatives,
    managers: rosterManagers,
    bookings: [],
    managerBookings: managerSiteBookings,
    bookingCollection: 'managerSiteBookings' as const,
  }
  const bookableProjects = bookableWorks({ ...bookableAccess, projects, catalogue: 'projects' })
  const bookableSmallWorks = bookableWorks({ ...bookableAccess, projects: smallWorks, catalogue: 'smallWorks' })
  const filteredProjects = searchWorks(worksInTab(bookableProjects, projectStatus, Date.now(), timeZone), projectQuery)
  const filteredSmallWorks = searchWorks(worksInTab(bookableSmallWorks, smallStatus, Date.now(), timeZone), smallQuery)

  function SlotPicker({
    locKey,
    type,
    locationId,
    customLocationName,
  }: {
    locKey: string
    type: ManagerLocationType
    locationId?: string
    customLocationName?: string
  }) {
    if (expandedLoc !== locKey) return null
    return (
      <div className="mt-3 rounded-[14px] bg-[var(--soft)] px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {SLOTS.filter(({ slot }) => targetDays().some((day) => slotOfferedOnDate(slot, day, payrollPolicy))).map(({ slot, label }) => (
            <button
              key={slot}
              type="button"
              disabled={busy}
              onClick={() => void book({ timeSlot: slot, locationType: type, locationId, customLocationName })}
              className="btn sm"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <HoursTimelinePicker
            start={customStart}
            end={customEnd}
            breakRemoved={breakRemoved}
            policy={payrollPolicy}
            dates={targetDays()}
            onStart={setCustomStart}
            onEnd={setCustomEnd}
            onBreak={setBreakRemoved}
          />
          <p className="mt-2 muted xs">Custom hours uses the times on this 00:00–24:00 bar.</p>
          {targetDays()[0] ? (
            <div className="mt-3">
              <CreateOvertimeRateField dayKey={orgDayKey(targetDays()[0], organizationZoneOr())} value={customRate} onChange={setCustomRate} />
            </div>
          ) : null}
          {/* Rulebook 1.17.0 (`weekendBookingNotes`): one Saturday/Sunday line when both follow the same rule. */}
          {weekendNotesForDates(targetDays(), payrollPolicy).map((note) => (
            <p key={note} className="mt-1 muted xs">
              {note}
            </p>
          ))}
        </div>
      </div>
    )
  }

  function LocationRow({
    locKey,
    name,
    type,
    locationId,
    customLocationName,
  }: {
    locKey: string
    name: string
    type: ManagerLocationType
    locationId?: string
    customLocationName?: string
  }) {
    const open = expandedLoc === locKey
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpandedLoc(open ? null : locKey)}
          className="ritem"
          data-hue="sched"
        >
          <span className={`h-8 w-1.5 shrink-0 rounded-full ${locationStripe(type)}`} />
          <span className="grow">
            <span className="t">{name}</span>
            <span className="s">AM, PM, full day or custom</span>
          </span>
          <Chevron open={open} />
        </button>
        <SlotPicker locKey={locKey} type={type} locationId={locationId} customLocationName={customLocationName} />
      </div>
    )
  }

  function projectLabel(project: Project): string {
    return `${project.jobNumber ?? ''} ${project.siteName ?? ''}`.trim() || 'Project'
  }

  return (
    <div className="stack" data-hue="sched">
      {leaveGate.dialog}
      <div className="phead" data-hue="sched">
        <div className="badge-ico">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </div>
        <div>
          <h1>My Schedule</h1>
          <div className="sub">
            {loading && myBookings.length === 0
              ? 'Opening your week… you can still book a day.'
              : 'Book yourself into a site, the office, or a custom location. AM, PM, full day or custom hours.'}
          </div>
        </div>
        <div className="acts">
          <div className="seg">
            <button type="button" aria-label="Previous week" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              ‹
            </button>
            <button
              type="button"
              className="on"
              onClick={() => {
                const today = organizationTodayCalendarDate()
                setWeekStart(organizationCalendarWeekStart(today))
                setSelectedDate(today)
              }}
            >
              Today
            </button>
            <button type="button" aria-label="Next week" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              ›
            </button>
          </div>
          <button
            type="button"
            className={`btn ${multiDay ? 'hue' : ''}`}
            data-hue="sched"
            onClick={() => {
              setMultiDay((v) => !v)
              setSelectedDates(multiDay ? [] : [startOfDay(selectedDate)])
            }}
          >
            {multiDay ? 'Multi-day on' : 'Multi-day'}
          </button>
          {multiDay && selectedDates.length > 0 ? (
            <button type="button" className="btn ghost" onClick={() => setSelectedDates([])}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {toast && (
        <div className={`banner ${toast.kind === 'success' ? '' : ''}`} data-hue={toast.kind === 'success' ? 'green' : 'red'}>
          <b>{toast.msg}</b>
        </div>
      )}

      <div className="week" data-hue="sched">
        {weekDates.map((day, index) => {
          const isSel = multiDay ? selectedDates.some((d) => isSameDay(d, day)) : isSameDay(day, selectedDate)
          const today = isSameDay(day, todayDate)
          const dayRows = myBookingsOn(day)
          const assignedRows = assignedOn(day)
          const leaveLabel = myScheduleAnnualLeaveLabel(myHolidays, day, undefined, policyForBookingDate(day, payrollPolicy) ?? payrollPolicy)
          const weekend = index > 4
          return (
            <div
              key={day.toISOString()}
              onClick={() => (multiDay ? toggleDayInMulti(day) : setSelectedDate(startOfDay(day)))}
              className={`day ${today ? 'today' : ''} ${weekend ? 'wk' : ''} ${isSel ? 'sel' : ''}`}
            >
              <div className="dn">
                <b>{format(day, 'd')}</b>
                <span>
                  {DOW[index]}
                  {today ? ' · Today' : ''}
                </span>
              </div>
              {leaveLabel ? (
                <div className="bk" data-hue="leave">
                  <b>{leaveLabel.startsWith('Pending') ? 'Pending leave' : 'Annual Leave'}</b>
                  <span className="x">{leaveLabel}</span>
                </div>
              ) : null}
              {assignedRows.map((booking) => (
                <div key={booking.id} className="bk" data-hue="proj">
                  <b>
                    {booking.title} <MyScheduleClashMarkerButton marker={clashMarkers?.get(booking.id)} />
                  </b>
                  <span className="x">{booking.detail}</span>
                </div>
              ))}
              {dayRows.length > 0
                ? dayRows.map((booking) => (
                    <div
                      key={booking.id}
                      className="bk"
                      data-hue={booking.locationType === 'office' ? 'blue' : booking.locationType === 'working_from_home' ? 'daily' : booking.locationType === 'small_work' ? 'sw' : 'proj'}
                      {...(canEditBookings
                        ? {
                            role: 'button',
                            tabIndex: 0,
                            'aria-label': `Edit booking: ${locationName(booking)}, ${slotLabel(booking, payrollPolicy)}`,
                            style: { cursor: 'pointer' },
                            onClick: (event: ReactMouseEvent) => {
                              event.stopPropagation()
                              setEditingBookingId(booking.id)
                            },
                            onKeyDown: (event: ReactKeyboardEvent) => {
                              if (event.target !== event.currentTarget) return
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setEditingBookingId(booking.id)
                              }
                            },
                          }
                        : {})}
                    >
                      <b>
                        {locationName(booking)} <MyScheduleClashMarkerButton marker={clashMarkers?.get(booking.id)} />
                      </b>
                      <span className="x">{slotLabel(booking, payrollPolicy)}</span>
                      {removeActionFor(booking) === 'delete' ? (
                        <button
                          type="button"
                          className="btn xs ghost"
                          onClick={(event) => {
                            event.stopPropagation()
                            void removeBooking(booking)
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))
                : assignedRows.length > 0
                  ? null
                  : (
                    <button
                      type="button"
                      className="emptyday"
                      onClick={(event) => {
                        event.stopPropagation()
                        openBookSheet(day)
                      }}
                    >
                      {weekend ? 'Weekend · Book' : '+ Book'}
                    </button>
                  )}
              {dayRows.length > 0 ? (
                <button
                  type="button"
                  className="btn xs ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    openBookSheet(day)
                  }}
                >
                  + Book
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="muted small">Week of {weekRangeText}</p>

      <AddWeekToCalendarButton
        bookings={calendarBookings}
        weekStart={weekStart}
        projectsById={projectsById}
        organizationName={organizationName}
        payrollPolicy={payrollPolicy}
      />

      {bookSheetDay ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setBookSheetDay(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Book yourself in"
            className="card pad"
            style={{ width: '100%', maxWidth: 1100, maxHeight: '88vh', overflow: 'auto' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="grow">
                <h2 className="h2">Book yourself in</h2>
                <p className="muted small">{format(bookSheetDay, 'EEEE d MMMM')}</p>
              </div>
              <button type="button" className="btn sm ghost" onClick={() => setBookSheetDay(null)}>
                Close
              </button>
            </div>
            <div className="book-cols">
        <BookColumn title="Other" hue="sched" count={filteredOther.length}>
          <ColumnSearch value={otherQuery} onChange={setOtherQuery} placeholder="Search office, home, survey…" />
          {filteredOther.length === 0 ? (
            <p className="muted small">No locations match that search.</p>
          ) : (
            filteredOther.map((loc) => (
              <LocationRow
                key={loc.key}
                locKey={loc.key}
                name={loc.name}
                type={loc.type}
                customLocationName={loc.custom}
              />
            ))
          )}
        </BookColumn>
        <BookColumn title="Projects" hue="proj" count={filteredProjects.length}>
          <ColumnSearch value={projectQuery} onChange={setProjectQuery} placeholder="Search projects…" />
          <StatusFilters value={projectStatus} counts={worksTabCounts(bookableProjects, Date.now(), timeZone)} onChange={setProjectStatus} />
          {filteredProjects.length === 0 ? (
            <p className="muted small">No projects in this filter.</p>
          ) : (
            filteredProjects.map((project) => (
              <LocationRow
                key={project.id}
                locKey={`project:${project.id}`}
                name={projectLabel(project)}
                type="project"
                locationId={project.id}
              />
            ))
          )}
        </BookColumn>
        <BookColumn title="Small works" hue="sw" count={filteredSmallWorks.length}>
          <ColumnSearch value={smallQuery} onChange={setSmallQuery} placeholder="Search small works…" />
          <StatusFilters value={smallStatus} counts={worksTabCounts(bookableSmallWorks, Date.now(), timeZone)} onChange={setSmallStatus} />
          {filteredSmallWorks.length === 0 ? (
            <p className="muted small">No small works in this filter.</p>
          ) : (
            filteredSmallWorks.map((project) => (
              <LocationRow
                key={project.id}
                locKey={`sw:${project.id}`}
                name={projectLabel(project)}
                type="small_work"
                locationId={project.id}
              />
            ))
          )}
        </BookColumn>
            </div>
          </div>
        </div>
      ) : null}

      {canEditBookings && editingManagerBooking ? (
        <BookingEditSheet
          key={editingManagerBooking.id}
          booking={managerSiteBookingToScheduleBooking(editingManagerBooking, projectsById, organizationId)}
          operativeName={selfName}
          projectName={locationName(editingManagerBooking)}
          saving={savingEdit}
          payroll={payrollPolicy}
          // 1.16.0 §5 (`bookingLeaveConflicts`): moving your own booking onto a day you have leave asks first.
          conflictsFor={leaveCheck.checkFor(
            { id: userId, userId, name: 'You' },
            managerSiteBookingToScheduleBooking(editingManagerBooking, projectsById, organizationId).date,
            [editingManagerBooking.id]
          )}
          onSave={(updates) => saveEditedBooking(editingManagerBooking, updates)}
          onDelete={removeActionFor(editingManagerBooking) === 'delete' ? () => deleteEditedBooking(editingManagerBooking) : undefined}
          onClose={() => setEditingBookingId(null)}
        />
      ) : null}
    </div>
  )
}

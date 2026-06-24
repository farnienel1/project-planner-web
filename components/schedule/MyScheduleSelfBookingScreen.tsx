'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addDays,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
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
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import type { Project } from '@/types'

type TimeSlot = 'AM' | 'PM' | 'FULL_DAY' | 'CUSTOM_HOURS'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS: { slot: TimeSlot; label: string }[] = [
  { slot: 'AM', label: 'AM' },
  { slot: 'PM', label: 'PM' },
  { slot: 'FULL_DAY', label: 'Full Day' },
  { slot: 'CUSTOM_HOURS', label: 'Custom hours' },
]

function slotLabel(booking: ManagerSiteBooking): string {
  if (booking.timeSlot === 'CUSTOM_HOURS' && booking.workStartTime && booking.workEndTime) {
    return `${booking.workStartTime}–${booking.workEndTime}`
  }
  if (booking.timeSlot === 'AM') return 'AM'
  if (booking.timeSlot === 'PM') return 'PM'
  if (booking.timeSlot === 'FULL_DAY' || booking.timeSlot === 'FULL DAY') return 'Full day'
  return booking.timeSlot || 'Full day'
}

function locationStripe(type?: ManagerLocationType): string {
  switch (type) {
    case 'project':
      return 'bg-[#185FA5]'
    case 'small_work':
      return 'bg-[#854F0B]'
    case 'office':
      return 'bg-[#534AB7]'
    case 'working_from_home':
      return 'bg-[#0F6E56]'
    case 'site_survey':
      return 'bg-[#993556]'
    default:
      return 'bg-slate-400'
  }
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
}: {
  userId: string
  organizationId: string
  organizationName: string
  payrollPolicy?: OrgPayrollTimePolicy
}) {
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const {
    managerSiteBookings,
    loadManagerSiteBookings,
    saveManagerSiteBooking,
    deleteManagerSiteBooking,
    loading,
  } = useManagerScheduleStore()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()))
  const [multiDay, setMultiDay] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [openSection, setOpenSection] = useState<'self' | 'projects' | 'smallworks' | null>('self')
  const [expandedLoc, setExpandedLoc] = useState<string | null>(null)
  const [customStart, setCustomStart] = useState('07:30')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [breakRemoved, setBreakRemoved] = useState(false)
  const [scheduleOpts, setScheduleOpts] = useState<MyScheduleOptions>({
    ...DEFAULT_MY_SCHEDULE,
    customItemEnabled: {},
  })
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [confirm, setConfirm] = useState<{ msg: string; onYes: () => void } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadManagerSiteBookings(organizationId)
    loadProjects(organizationId, true)
    loadSmallWorks(organizationId)
    loadOrganizationDetails(organizationId)
      .then((details) => {
        if (details?.myScheduleOptions) setScheduleOpts(details.myScheduleOptions)
      })
      .catch(() => {})
  }, [organizationId, loadManagerSiteBookings, loadProjects, loadSmallWorks])

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const liveProjects = useMemo(() => projects.filter((p) => p.isLive !== false), [projects])
  const liveSmallWorks = useMemo(() => smallWorks.filter((p) => p.isLive !== false), [smallWorks])

  const myBookings = useMemo(
    () => managerSiteBookings.filter((b) => b.userId === userId),
    [managerSiteBookings, userId]
  )

  const myBookingsOn = (day: Date): ManagerSiteBooking[] =>
    myBookings.filter((b) => isSameDay(startOfDay(b.date), startOfDay(day)))

  const dayBookings = useMemo(() => myBookingsOn(selectedDate), [myBookings, selectedDate])

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
    setBusy(true)
    try {
      for (const day of args.days) {
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
        })
      }
      flash('success', args.days.length > 1 ? `Booked across ${args.days.length} days.` : 'Booking added.')
      setExpandedLoc(null)
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save booking.')
    } finally {
      setBusy(false)
    }
  }

  function book(args: {
    timeSlot: TimeSlot
    locationType: ManagerLocationType
    locationId?: string
    customLocationName?: string
  }) {
    const days = targetDays()
    if (days.length === 1) {
      const existing = myBookingsOn(days[0])
      if (existing.length > 0) {
        const lines = existing.map((b) => `• ${slotLabel(b)} — ${locationName(b)}`).join('\n')
        setConfirm({
          msg: `You already have:\n${lines}\n\nAdd this booking too?`,
          onYes: () => {
            setConfirm(null)
            void commitBooking({ days, ...args })
          },
        })
        return
      }
    }
    void commitBooking({ days, ...args })
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

  function toggleDayInMulti(day: Date) {
    setSelectedDates((prev) =>
      prev.some((d) => isSameDay(d, day))
        ? prev.filter((d) => !isSameDay(d, day))
        : [...prev, startOfDay(day)]
    )
  }

  const weekRangeText = `${format(weekDates[0], 'd MMM')} – ${format(weekDates[6], 'd MMM')}`

  const selfLocations: { key: string; type: ManagerLocationType; name: string; custom?: string }[] = [
    ...(scheduleOpts.showOffice ? [{ key: 'office', type: 'office' as ManagerLocationType, name: 'Office' }] : []),
    ...(scheduleOpts.showWorkingFromHome
      ? [{ key: 'wfh', type: 'working_from_home' as ManagerLocationType, name: 'Working From Home' }]
      : []),
    ...(scheduleOpts.showSiteSurvey
      ? [{ key: 'survey', type: 'site_survey' as ManagerLocationType, name: 'Site Survey' }]
      : []),
    ...(scheduleOpts.customItems ?? [])
      .filter((item) => scheduleOpts.customItemEnabled[item] !== false)
      .map((item) => ({
        key: `custom:${item}`,
        type: 'custom' as ManagerLocationType,
        name: item,
        custom: item,
      })),
  ]

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
      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {SLOTS.map(({ slot, label }) => (
            <button
              key={slot}
              type="button"
              disabled={busy}
              onClick={() => book({ timeSlot: slot, locationType: type, locationId, customLocationName })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Start
            <input
              type="time"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            End
            <input
              type="time"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={breakRemoved} onChange={(e) => setBreakRemoved(e.target.checked)} />
            No unpaid break
          </label>
          <span className="text-[11px] text-slate-400">“Custom hours” uses these times.</span>
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
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
        >
          <span className={`h-8 w-1.5 shrink-0 rounded-full ${locationStripe(type)}`} />
          <span className="flex-1 truncate text-sm font-medium text-slate-900">{name}</span>
          <Chevron open={open} />
        </button>
        <SlotPicker locKey={locKey} type={type} locationId={locationId} customLocationName={customLocationName} />
      </div>
    )
  }

  function Section({
    id,
    title,
    count,
    children,
  }: {
    id: 'self' | 'projects' | 'smallworks'
    title: string
    count?: number
    children: ReactNode
  }) {
    const open = openSection === id
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => {
            setOpenSection(open ? null : id)
            setExpandedLoc(null)
          }}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50"
        >
          <span className="text-sm font-bold text-slate-900">
            {title}
            {typeof count === 'number' && (
              <span className="ml-2 text-xs font-medium text-slate-400">{count}</span>
            )}
          </span>
          <Chevron open={open} />
        </button>
        {open && <div className="divide-y divide-slate-100 border-t border-slate-100">{children}</div>}
      </div>
    )
  }

  function projectLabel(project: Project): string {
    return `${project.jobNumber ?? ''} ${project.siteName ?? ''}`.trim() || 'Project'
  }

  if (loading && myBookings.length === 0) {
    return <LoadingSpinner label="Loading My Schedule…" />
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
      <p className="mt-1 mb-5 text-sm text-slate-500">
        Book yourself into sites, the office, projects and small works.
      </p>

      {toast && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            toast.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Previous week"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-base font-semibold text-slate-900">{weekRangeText}</span>
          <button
            type="button"
            onClick={() => {
              const today = startOfDay(new Date())
              setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))
              setSelectedDate(today)
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setMultiDay((v) => !v)
              setSelectedDates(multiDay ? [] : [startOfDay(selectedDate)])
            }}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              multiDay ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {multiDay ? 'Multi-day: On' : 'Multi-day'}
          </button>
          {multiDay && selectedDates.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDates([])}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Next week"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {weekDates.map((day, index) => {
          const isSel = multiDay ? selectedDates.some((d) => isSameDay(d, day)) : isSameDay(day, selectedDate)
          const today = isToday(day)
          const has = myBookingsOn(day).length > 0
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => (multiDay ? toggleDayInMulti(day) : setSelectedDate(startOfDay(day)))}
              className={`flex flex-col items-center rounded-xl border py-2 transition ${
                isSel
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={`text-[10px] font-medium ${isSel ? 'text-white/80' : 'text-slate-400'}`}>
                {DOW[index]}
              </span>
              <span className="text-base font-bold">{format(day, 'd')}</span>
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  has ? (isSel ? 'bg-white' : 'bg-blue-500') : 'bg-transparent'
                } ${today && !isSel ? 'ring-1 ring-blue-400' : ''}`}
              />
            </button>
          )
        })}
      </div>

      <AddWeekToCalendarButton
        bookings={calendarBookings}
        weekStart={weekStart}
        projectsById={projectsById}
        organizationName={organizationName}
        payrollPolicy={payrollPolicy}
      />

      <div className="mt-5 space-y-3">
        <Section id="self" title="Book yourself">
          {selfLocations.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              No location options enabled — configure them in Organisation → Schedule options.
            </p>
          ) : (
            selfLocations.map((loc) => (
              <LocationRow
                key={loc.key}
                locKey={loc.key}
                name={loc.name}
                type={loc.type}
                customLocationName={loc.custom}
              />
            ))
          )}
        </Section>

        <Section id="projects" title="Projects" count={liveProjects.length}>
          {liveProjects.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No live projects.</p>
          ) : (
            liveProjects.map((project) => (
              <LocationRow
                key={project.id}
                locKey={`project:${project.id}`}
                name={projectLabel(project)}
                type="project"
                locationId={project.id}
              />
            ))
          )}
        </Section>

        <Section id="smallworks" title="Small Works" count={liveSmallWorks.length}>
          {liveSmallWorks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No live small works.</p>
          ) : (
            liveSmallWorks.map((project) => (
              <LocationRow
                key={project.id}
                locKey={`sw:${project.id}`}
                name={projectLabel(project)}
                type="small_work"
                locationId={project.id}
              />
            ))
          )}
        </Section>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {format(selectedDate, 'EEEE, d MMM')}
          </span>
          {dayBookings.length > 0 && (
            <span className="text-xs text-slate-500">{dayBookings.length} booked</span>
          )}
        </div>
        {dayBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            Nothing booked for this day yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {dayBookings.map((booking) => (
              <li
                key={booking.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <span className={`h-10 w-1.5 shrink-0 rounded-full ${locationStripe(booking.locationType)}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{locationName(booking)}</div>
                  <div className="text-xs text-slate-500">{slotLabel(booking)}</div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeBooking(booking)}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Remove booking"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirm(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Another booking this day</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{confirm.msg}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm.onYes}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Add anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

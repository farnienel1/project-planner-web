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
import { myScheduleStripeClass } from '@/components/schedule/MyScheduleLooks'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { countWorksByTab, filterWorksByTab, searchWorks } from '@/lib/projects/workStatus'
import type { Project } from '@/types'

type JobFilter = 'all' | 'active' | 'upcoming' | 'completed'

const selfBookInflight = new Set<string>()

function bookingIdentity(booking: ManagerSiteBooking): string {
  const day = format(startOfDay(booking.date), 'yyyy-MM-dd')
  return [
    booking.userId,
    day,
    booking.timeSlot,
    booking.locationType,
    booking.locationId || '',
    (booking.customLocationName || '').trim().toLowerCase(),
  ].join('|')
}

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

function uniqueBookings(rows: ManagerSiteBooking[]): ManagerSiteBooking[] {
  const seen = new Set<string>()
  const out: ManagerSiteBooking[] = []
  for (const row of rows) {
    const key = bookingIdentity(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

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
  const [otherQuery, setOtherQuery] = useState('')
  const [projectQuery, setProjectQuery] = useState('')
  const [smallQuery, setSmallQuery] = useState('')
  const [projectStatus, setProjectStatus] = useState<JobFilter>('active')
  const [smallStatus, setSmallStatus] = useState<JobFilter>('active')
  const [bookSheetDay, setBookSheetDay] = useState<Date | null>(null)

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

  const myBookings = useMemo(
    () => uniqueBookings(managerSiteBookings.filter((b) => b.userId === userId)),
    [managerSiteBookings, userId]
  )

  const myBookingsOn = (day: Date): ManagerSiteBooking[] =>
    myBookings.filter((b) => isSameDay(startOfDay(b.date), startOfDay(day)))

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
    const keys = args.days.map(
      (day) =>
        `${userId}|${format(startOfDay(day), 'yyyy-MM-dd')}|${args.timeSlot}|${args.locationType}|${args.locationId || ''}|${(args.customLocationName || '').trim().toLowerCase()}`
    )
    if (keys.some((key) => selfBookInflight.has(key))) return
    keys.forEach((key) => selfBookInflight.add(key))
    setBusy(true)
    try {
      let wrote = 0
      for (const day of args.days) {
        const identity = `${userId}|${format(startOfDay(day), 'yyyy-MM-dd')}|${args.timeSlot}|${args.locationType}|${args.locationId || ''}|${(args.customLocationName || '').trim().toLowerCase()}`
        const already = myBookingsOn(day).some((booking) => bookingIdentity(booking) === identity)
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

  const otherQueryText = otherQuery.trim().toLowerCase()
  const filteredOther = selfLocations.filter((loc) => loc.name.toLowerCase().includes(otherQueryText))
  const filteredProjects = searchWorks(filterWorksByTab(projects, projectStatus), projectQuery)
  const filteredSmallWorks = searchWorks(filterWorksByTab(smallWorks, smallStatus), smallQuery)

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
          {SLOTS.map(({ slot, label }) => (
            <button
              key={slot}
              type="button"
              disabled={busy}
              onClick={() => book({ timeSlot: slot, locationType: type, locationId, customLocationName })}
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
            onStart={setCustomStart}
            onEnd={setCustomEnd}
            onBreak={setBreakRemoved}
          />
          <p className="mt-2 muted xs">Custom hours uses the times on this 00:00–24:00 bar.</p>
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
                const today = startOfDay(new Date())
                setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))
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
          const today = isToday(day)
          const dayRows = myBookingsOn(day)
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
              {dayRows.length > 0
                ? dayRows.map((booking) => (
                    <div key={booking.id} className="bk" data-hue={booking.locationType === 'office' ? 'blue' : booking.locationType === 'working_from_home' ? 'daily' : booking.locationType === 'small_work' ? 'sw' : 'proj'}>
                      <b>{locationName(booking)}</b>
                      <span className="x">{slotLabel(booking)}</span>
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
                    </div>
                  ))
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
          <StatusFilters value={projectStatus} counts={countWorksByTab(projects)} onChange={setProjectStatus} />
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
          <StatusFilters value={smallStatus} counts={countWorksByTab(smallWorks)} onChange={setSmallStatus} />
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

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirm(null)}
        >
          <div className="card pad" style={{ width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="h2">Another booking this day</h2>
            <p className="muted small" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{confirm.msg}</p>
            <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirm(null)} className="btn">
                Cancel
              </button>
              <button type="button" onClick={confirm.onYes} className="btn primary">
                Add anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

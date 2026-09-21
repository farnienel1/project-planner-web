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
import {
  MyScheduleStripeRow,
  MyScheduleTotalHoursCard,
  myScheduleClockSubtitle,
  myScheduleStripeClass,
} from '@/components/schedule/MyScheduleLooks'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
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
      <div className="card overflow-hidden" data-hue="sched">
        <button
          type="button"
          onClick={() => {
            setOpenSection(open ? null : id)
            setExpandedLoc(null)
          }}
          className="card-h w-full"
          data-hue={id === 'projects' ? 'proj' : id === 'smallworks' ? 'sw' : 'sched'}
        >
          <div className="ico-chip sm">
            {id === 'projects' ? (
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 12h18M3 16.5h18" />
              </svg>
            ) : id === 'smallworks' ? (
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
              </svg>
            ) : (
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
          </div>
          <h2 className="h2 grow" style={{ fontSize: 17 }}>
            {title}
            {typeof count === 'number' ? <span className="count soft" style={{ marginLeft: 8 }}>{count}</span> : null}
          </h2>
          <Chevron open={open} />
        </button>
        {open && <div className="card-b rows">{children}</div>}
      </div>
    )
  }

  function projectLabel(project: Project): string {
    return `${project.jobNumber ?? ''} ${project.siteName ?? ''}`.trim() || 'Project'
  }

  if (loading && myBookings.length === 0) {
    return (
      <div className="stack" data-hue="sched">
        <div className="phead" data-hue="sched">
          <div>
            <h1>My Schedule</h1>
            <div className="sub">Opening your week…</div>
          </div>
        </div>
      </div>
    )
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
            Book yourself into a site, the office, or a custom location. AM, PM, full day or custom hours.
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
            <button
              key={day.toISOString()}
              type="button"
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
                    </div>
                  ))
                : <div className="emptyday">{weekend ? 'Weekend' : '+ Book'}</div>}
            </button>
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

      <div className="grid gmain">
        <div className="stack">
          <Section id="self" title={`Book yourself · ${format(selectedDate, 'EEE d MMM')}`}>
            {selfLocations.length === 0 ? (
              <p className="muted small">
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

          <div className="grid g2" style={{ gap: 12 }}>
            <button
              type="button"
              className="stat"
              data-hue="proj"
              onClick={() => {
                setOpenSection(openSection === 'projects' ? null : 'projects')
                setExpandedLoc(null)
              }}
            >
              <div className="ico-chip">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 12h18M3 16.5h18" />
                </svg>
              </div>
              <div className="grow">
                <b style={{ fontSize: 18 }}>Projects</b>
                <span>{liveProjects.length} available</span>
              </div>
            </button>
            <button
              type="button"
              className="stat"
              data-hue="sw"
              onClick={() => {
                setOpenSection(openSection === 'smallworks' ? null : 'smallworks')
                setExpandedLoc(null)
              }}
            >
              <div className="ico-chip">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
                </svg>
              </div>
              <div className="grow">
                <b style={{ fontSize: 18 }}>Small Works</b>
                <span>{liveSmallWorks.length} available</span>
              </div>
            </button>
          </div>

          {openSection === 'projects' ? (
            <Section id="projects" title="Projects" count={liveProjects.length}>
              {liveProjects.length === 0 ? (
                <p className="muted small">No live projects.</p>
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
          ) : null}

          {openSection === 'smallworks' ? (
            <Section id="smallworks" title="Small Works" count={liveSmallWorks.length}>
              {liveSmallWorks.length === 0 ? (
                <p className="muted small">No live small works.</p>
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
          ) : null}
        </div>

        <div className="stack">
          <MyScheduleTotalHoursCard bookings={dayBookings} policy={payrollPolicy} />
          <section className="card" data-hue="sched">
            <div className="card-h">
              <h2 className="h2">{format(selectedDate, 'EEEE, d MMM')}</h2>
              {dayBookings.length > 0 ? <span className="count soft">{dayBookings.length}</span> : null}
            </div>
            <div className="card-b rows">
              {dayBookings.length === 0 ? (
                <p className="muted small">Nothing booked for this day yet.</p>
              ) : (
                dayBookings.map((booking) => (
                  <MyScheduleStripeRow
                    key={booking.id}
                    stripeClass={myScheduleStripeClass(booking.locationType)}
                    title={locationName(booking)}
                    subtitle={myScheduleClockSubtitle(booking, payrollPolicy)}
                    onDelete={() => void removeBooking(booking)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>

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

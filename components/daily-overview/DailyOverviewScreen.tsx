/**
 * iOS parity source: Views/DailyOverviewView.swift
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, FolderIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { canViewDailyOverview, hasAdminAccess } from '@/lib/permissions'
import { dateFromDayKey, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { loadSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import {
  buildDailyOverview,
  initialsFrom,
  overviewFormatHours,
  shiftOverviewDay,
  type OverviewPersonRow,
} from '@/lib/daily-overview/buildDailyOverview'
import { BookLabourFlowScreen } from '@/components/book-labour/BookLabourFlowScreen'
import {
  DailyOverviewBookingSheet,
  managerBookingToTarget,
  type OverviewBookingTarget,
} from '@/components/daily-overview/DailyOverviewBookingSheet'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { User } from '@/types'

function personName(userId: string, users: User[]): string {
  const u = users.find((row) => row.id === userId)
  if (!u) return 'Manager'
  const full = `${u.firstName || ''} ${u.surname || ''}`.trim()
  return full || u.email
}

function holidayName(
  booking: { userId?: string; operativeId?: string },
  users: User[],
  operatives: { id: string; firstName: string; lastName: string }[]
): string {
  if (booking.userId) return personName(booking.userId, users)
  if (booking.operativeId) {
    const op = operatives.find((row) => row.id === booking.operativeId)
    if (op) return `${op.firstName} ${op.lastName}`.trim()
  }
  return 'Team member'
}

export function DailyOverviewScreen() {
  const searchParams = useSearchParams()
  const { user, organization } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading, error: bookingsError } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings: holidays, loadBookings: loadHolidays } = useHolidayStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const [subcontractorBookings, setSubcontractorBookings] = useState<
    Awaited<ReturnType<typeof loadSubcontractorBookings>>
  >([])
  const [day, setDay] = useState(() => londonMidnight(new Date()))
  const [bookLabourOpen, setBookLabourOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<OverviewBookingTarget | null>(null)

  useEffect(() => {
    const raw = searchParams.get('date')
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      setDay(dateFromDayKey(raw))
    }
  }, [searchParams])

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadHolidays(organization.id)
    loadSubcontractors(organization.id)
    loadSubcontractorBookings(organization.id)
      .then(setSubcontractorBookings)
      .catch(() => setSubcontractorBookings([]))
  }, [
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadUsers,
    loadProjects,
    loadSmallWorks,
    loadHolidays,
    loadSubcontractors,
  ])

  const model = useMemo(
    () =>
      buildDailyOverview({
        day,
        projects: [...projects, ...smallWorks],
        bookings,
        managerBookings: managerSiteBookings,
        holidays,
        users,
        operatives,
        subcontractorBookings,
        subcontractors,
      }),
    [
      day,
      projects,
      smallWorks,
      bookings,
      managerSiteBookings,
      holidays,
      users,
      operatives,
      subcontractorBookings,
      subcontractors,
    ]
  )

  const canBook = Boolean(user && (hasAdminAccess(user) || user.permissions?.manager))
  const dateParam = dayKey(day)
  const firstPaint =
    (bookingsLoading || managerLoading) && bookings.length === 0 && managerSiteBookings.length === 0

  if (user && !canViewDailyOverview(user)) {
    return <p className="muted">Daily overview is not available for this account.</p>
  }

  return (
    <>
    <div className="stack" data-hue="daily">
      <div className="phead" data-hue="daily">
        <div className="badge-ico">
          <CalendarDaysIcon className="h-6 w-6" />
        </div>
        <div>
          <h1>Daily overview</h1>
          <div className="sub">Who is where, and who still needs booking</div>
        </div>
        <div className="acts">
          <div className="seg">
            <button type="button" aria-label="Previous day" onClick={() => setDay(shiftOverviewDay(day, -1))}>
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button type="button" className={model.isToday ? 'on' : ''} onClick={() => setDay(londonMidnight(new Date()))}>
              {model.isToday ? 'Today' : 'Back to today'}
            </button>
            <button type="button" aria-label="Next day" onClick={() => setDay(shiftOverviewDay(day, 1))}>
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
          <input
            type="date"
            value={dateParam}
            aria-label="View by date"
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDay(dateFromDayKey(e.target.value))
            }}
            className="in"
            style={{ width: 170, height: 44 }}
          />
        </div>
      </div>

      {bookingsError ? (
        <div className="banner" data-hue="red">
          Could not load bookings from Firebase: {bookingsError}
        </div>
      ) : null}

      <section className="hero" data-hue="daily">
        <div className="row" style={{ position: 'relative', zIndex: 1 }}>
          <div className="grow">
            <div className="eb">{model.dayLabel}</div>
            <div className="big" style={{ marginTop: 4 }}>
              {overviewFormatHours(model.labourHours)}h booked{' '}
              <span style={{ fontSize: 18, opacity: 0.8 }}>
                · {model.peopleCount === 1 ? '1 person' : `${model.peopleCount} people`}
              </span>
            </div>
          </div>
        </div>
        <div className="stats">
          <div className="st">
            <b>{overviewFormatHours(model.labourHours)}</b>
            <span>Standard hrs</span>
          </div>
          <div className="st">
            <b>0</b>
            <span>Overtime 1.5×</span>
          </div>
          <div className="st">
            <b>{model.jobsCount}</b>
            <span>{model.jobsCount === 1 ? 'Job active' : 'Jobs active'}</span>
          </div>
          <div className="st">
            <b>{model.unbookedCount}</b>
            <span>Unbooked</span>
          </div>
        </div>
        <div style={{ marginTop: 18, position: 'relative', zIndex: 1 }}>
          <div className="row small" style={{ opacity: 0.9, marginBottom: 8 }}>
            <b>Where the team is</b>
            <span className="grow" />
            {model.bookedPeopleCount} booked · {model.unbookedCount} unbooked
          </div>
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,.18)' }}>
            {model.officeCount > 0 ? <i style={{ width: `${(100 * model.officeCount) / Math.max(1, model.officeCount + model.wfhCount + model.onSiteCount + model.unbookedCount)}%`, background: '#fff' }} /> : null}
            {model.wfhCount > 0 ? <i style={{ width: `${(100 * model.wfhCount) / Math.max(1, model.officeCount + model.wfhCount + model.onSiteCount + model.unbookedCount)}%`, background: 'rgba(255,255,255,.6)' }} /> : null}
            {model.onSiteCount > 0 ? <i style={{ width: `${(100 * model.onSiteCount) / Math.max(1, model.officeCount + model.wfhCount + model.onSiteCount + model.unbookedCount)}%`, background: 'rgba(255,255,255,.85)' }} /> : null}
          </div>
          <div className="row small" style={{ marginTop: 8, gap: 18, opacity: 0.9 }}>
            <span>● {model.officeCount} Office</span>
            <span>● {model.wfhCount} WFH</span>
            <span>● {model.onSiteCount} On site</span>
          </div>
        </div>
      </section>

      {firstPaint ? <p className="muted py-8 text-center">Loading daily overview…</p> : null}

      <div className="grid gmain">
        <section className="card">
          <div className="card-h">
            <h2 className="h2">By project</h2>
          </div>
          <div className="card-b rows">
            {model.projectCards.length > 0 ? (
              model.projectCards.map(({ project, people, peopleCount, bookedHours, isSmallWorks }) => (
                <div key={project.id} className="card pad" data-hue={isSmallWorks ? 'sw' : 'proj'} style={{ boxShadow: 'none', background: 'var(--soft)' }}>
                  <div className="row">
                    <div className="ico-chip">
                      {isSmallWorks ? <WrenchScrewdriverIcon className="h-5 w-5" /> : <FolderIcon className="h-5 w-5" />}
                    </div>
                    <div className="grow">
                      <span className="tag">{project.jobNumber}</span>{' '}
                      <b style={{ fontFamily: 'var(--head)', fontSize: 16 }}>{project.siteName}</b>
                      <div className="muted small">
                        {peopleCount} {peopleCount === 1 ? 'person' : 'people'} · {overviewFormatHours(bookedHours)}h booked
                      </div>
                    </div>
                    <Link
                      href={isSmallWorks ? `/dashboard/small-works/${project.id}` : `/dashboard/projects/${project.id}`}
                      className="btn sm tint"
                    >
                      {isSmallWorks ? 'Open small works' : 'Open project'}
                    </Link>
                  </div>
                  {people.length > 0 ? (
                    <div className="rows" style={{ marginTop: 12 }}>
                      {people.map((row) => (
                        <PersonRow
                          key={row.personKey}
                          row={row}
                          onOpen={
                            row.kind === 'subcontractor'
                              ? undefined
                              : () => {
                                  const bookingId = row.bookingId || row.id.replace(/^(op|mgr)-/i, '')
                                  if (!bookingId) return
                                  setEditingRow({ ...row, bookingId })
                                }
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="muted small" style={{ marginTop: 8 }}>
                      No named people on this job today.
                    </p>
                  )}
                </div>
              ))
            ) : !firstPaint && model.empty ? (
              <div className="empty">
                <h3>Nothing booked yet</h3>
                <p>No one is booked onto a job for this day.</p>
                {canBook ? (
                  <button type="button" className="btn primary" onClick={() => setBookLabourOpen(true)}>
                    Book labour
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <div className="stack">
          {model.isWeekday && model.unbookedNames.length > 0 ? (
            <section className="card" data-hue="warn">
              <div className="card-h">
                <div className="ico-chip sm">!</div>
                <h2 className="h2">Unbooked labour</h2>
                <div className="acts">
                  <span className="count" data-hue="warn">
                    {model.unbookedNames.length}
                  </span>
                </div>
              </div>
              <div className="card-b rows">
                {model.unbookedNames.map((name) => (
                  <div key={name} className="ritem" style={{ cursor: 'default' }}>
                    <span className="ico-chip sm">{initialsFrom(name)}</span>
                    <span className="grow">
                      <span className="t">{name}</span>
                    </span>
                    <span className="pill" data-hue="warn">
                      Unbooked
                    </span>
                  </div>
                ))}
                {canBook ? (
                  <button type="button" className="btn primary block" onClick={() => setBookLabourOpen(true)}>
                    Book labour
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {model.holidays.length > 0 ? (
            <section className="card" data-hue="leave">
              <div className="card-h">
                <h2 className="h2">Annual leave</h2>
              </div>
              <div className="card-b rows">
                {model.holidays.map((row) => (
                  <div key={row.id} className="ritem" style={{ cursor: 'default' }}>
                    <span className="grow">
                      <span className="t">{holidayName(row, users, operatives)}</span>
                      <span className="s">Annual leave</span>
                    </span>
                    <span className="pill" data-hue="leave">
                      Off
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {model.officeBookings.length > 0 || model.wfhBookings.length > 0 || model.customGroups.length > 0 ? (
            <OtherBlock
              office={model.officeBookings}
              wfh={model.wfhBookings}
              custom={model.customGroups}
              users={users}
              onOpen={(booking) => setEditingRow(managerBookingToTarget(booking, personName(booking.userId, users)))}
            />
          ) : null}

          {model.siteSurveyBookings.length > 0 ? (
            <ManagerCard
              title="Site survey"
              bookings={model.siteSurveyBookings}
              users={users}
              onOpen={(booking) => setEditingRow(managerBookingToTarget(booking, personName(booking.userId, users)))}
            />
          ) : null}
        </div>
      </div>
    </div>
    {bookLabourOpen ? (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[var(--bg)]">
        <div className="mx-auto max-w-2xl px-4 py-6 lg:px-10 lg:py-8">
          <BookLabourFlowScreen date={dateParam} from="daily-overview" onClose={() => setBookLabourOpen(false)} />
        </div>
      </div>
    ) : null}
    {editingRow ? (
      <DailyOverviewBookingSheet row={editingRow} day={day} onClose={() => setEditingRow(null)} />
    ) : null}
    </>
  )
}

function PersonRow({ row, onOpen }: { row: OverviewPersonRow; onOpen?: () => void }) {
  const inner = (
    <>
      <span className="ico-chip sm">{row.initials}</span>
      <span className="grow">
        <span className="t">{row.name}</span>
        <span className="s">{row.subtitle}{onOpen ? ' · Tap to change booking' : ''}</span>
      </span>
      <span className="pill" data-hue="proj">
        {row.pillText}
      </span>
      {onOpen ? (
        <span className="muted xs" style={{ fontWeight: 700 }}>
          Change
        </span>
      ) : null}
    </>
  )
  if (onOpen) {
    return (
      <button
        type="button"
        className="ritem click"
        style={{ marginTop: 12, position: 'relative', zIndex: 1 }}
        data-hue="proj"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onOpen()
        }}
        aria-label={`Change booking for ${row.name}`}
      >
        {inner}
      </button>
    )
  }
  return (
    <div className="ritem" style={{ cursor: 'default', marginTop: 12 }} data-hue="proj">
      {inner}
    </div>
  )
}

function ManagerCard({
  title,
  bookings,
  users,
  onOpen,
}: {
  title: string
  bookings: ManagerSiteBooking[]
  users: User[]
  onOpen?: (booking: ManagerSiteBooking) => void
}) {
  return (
    <section className="card" data-hue="user">
      <div className="card-h">
        <h2 className="h2">{title}</h2>
      </div>
      <div className="card-b rows">
        {bookings.map((b) => {
          const inner = (
            <>
              <span className="grow">
                <span className="t">{personName(b.userId, users)}</span>
              </span>
              <span className="pill" data-hue="sched">
                {b.timeSlot}
              </span>
            </>
          )
          return onOpen ? (
            <button
              key={b.id}
              type="button"
              className="ritem click"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpen(b)
              }}
              aria-label={`Change booking for ${personName(b.userId, users)}`}
            >
              {inner}
              <span className="muted xs" style={{ fontWeight: 700 }}>
                Change
              </span>
            </button>
          ) : (
            <div key={b.id} className="ritem" style={{ cursor: 'default' }}>
              {inner}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function OtherBlock({
  office,
  wfh,
  custom,
  users,
  onOpen,
}: {
  office: ManagerSiteBooking[]
  wfh: ManagerSiteBooking[]
  custom: { name: string; bookings: ManagerSiteBooking[] }[]
  users: User[]
  onOpen?: (booking: ManagerSiteBooking) => void
}) {
  const people = new Set([...office, ...wfh, ...custom.flatMap((g) => g.bookings)].map((b) => b.userId))
  return (
    <section className="card" data-hue="lib">
      <div className="card-h">
        <h2 className="h2">Other</h2>
        <div className="acts">
          <span className="muted small">
            {people.size} person{people.size === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="card-b stack" style={{ gap: 12 }}>
        {office.length > 0 ? <ManagerCard title="Office" bookings={office} users={users} onOpen={onOpen} /> : null}
        {wfh.length > 0 ? <ManagerCard title="Working from home" bookings={wfh} users={users} onOpen={onOpen} /> : null}
        {custom.map((g) => (
          <ManagerCard key={g.name} title={g.name} bookings={g.bookings} users={users} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

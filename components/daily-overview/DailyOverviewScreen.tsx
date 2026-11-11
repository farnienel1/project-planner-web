/**
 * iOS parity source: Views/DailyOverviewView.swift
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, FolderIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useOrganizationDayKey } from '@/lib/warnings/useOrganizationDayKey'
import { useBookingHistoryFrom } from '@/lib/stores/useBookingHistory'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { canViewDailyOverview, hasAdminAccess } from '@/lib/permissions'
import { dateFromDayKey, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { leaveHalfDayLabel, overtimeTotalText } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { watchSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
import {
  dailyOverviewMayPublish,
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
import { overviewHolidayName as holidayName, overviewPersonName as personName } from '@/lib/daily-overview/dailyOverviewToday'
import { useDailyOverviewModel } from '@/lib/daily-overview/useDailyOverviewModel'

export function DailyOverviewScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, organization } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading, error: bookingsError } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings, loading: managerLoading } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, userIdAliases, loadUsers } = useOrgUserStore()
  const { loadProjects, loadSmallWorks } = useProjectStore()
  const { loadBookings: loadHolidays } = useHolidayStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const [subcontractorBookings, setSubcontractorBookings] = useState<SubcontractorBookingRow[]>([])
  const [day, setDay] = useState(() => londonMidnight(new Date(), organizationZoneOr()))
  // Today moves on at the organisation's midnight and when the tab is focused again. A viewer who was on
  // the old today follows to the new one; a viewer on another day stays there.
  const orgTimeZone = useOrganizationTimeZone()
  const todayKey = useOrganizationDayKey(orgTimeZone)
  const today = useMemo(() => new Date(), [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps -- new instant per organisation day
  const lastTodayKey = useRef(todayKey)
  useEffect(() => {
    const previous = lastTodayKey.current
    lastTodayKey.current = todayKey
    if (previous === todayKey) return
    setDay((current) => (dayKey(current) === previous ? londonMidnight(new Date(), organizationZoneOr()) : current))
  }, [todayKey])
  // A past day reaches before the launch booking download.
  useBookingHistoryFrom(organization?.id, day)
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
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
    loadHolidays(organization.id)
    loadSubcontractors(organization.id)
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


  // Rulebook 1.9.0 §1: subcontractor bookings are live while Daily Overview is open.
  useEffect(() => {
    if (!organization?.id) return
    setSubcontractorBookings([])
    return watchSubcontractorBookings(organization.id, setSubcontractorBookings, () => setSubcontractorBookings([]))
  }, [organization?.id])

  // Owner decision 5 (5 Nov 2026): one Daily Overview set-up shared with Home (`useDailyOverviewModel`): the live
  // organisation settings for the day shown and `buildDailyOverview`, unchanged.
  const { model: builtModel, settings } = useDailyOverviewModel({
    day,
    today,
    timeZone: orgTimeZone,
    subcontractorBookings,
    subcontractors,
  })
  const model = builtModel!
  const payrollPolicy = settings.payrollPolicy

  const canBook = Boolean(user && (hasAdminAccess(user) || user.permissions?.manager))
  const dateParam = dayKey(day)
  const mayPublish = dailyOverviewMayPublish({
    bookingsLoading,
    bookingCount: bookings.length,
    managerLoading,
    managerBookingCount: managerSiteBookings.length,
  })
  const firstPaint = !mayPublish && bookings.length === 0 && managerSiteBookings.length === 0

  useEffect(() => {
    if (user && !canViewDailyOverview(user)) router.replace('/dashboard')
  }, [router, user])

  if (user && !canViewDailyOverview(user)) return null

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
            <button type="button" className={model.isToday ? 'on' : ''} onClick={() => setDay(londonMidnight(new Date(), organizationZoneOr()))}>
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

      {firstPaint ? <p className="muted py-8 text-center">Loading daily overview…</p> : (
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
            <b>{overviewFormatHours(model.standardWorkedHours)}</b>
            <span>Standard hrs</span>
          </div>
          <div className="st">
            {/* Rulebook 1.39.0 (owner answer 11 Nov): "12h OT × 1.5 = 18h" (`overtimeTotalText`); clock hours at the
                multiplier, an unpaid break in them off as plain hours (1.20.3). */}
            <b>
              {overtimeTotalText({
                clockHours: model.overtimeWorkedHours,
                multiplier: model.overtimeMultiplier,
                breakHours: model.overtimeBreakHours,
              }) || '0h OT'}
            </b>
            <span>Overtime</span>
          </div>
          <div className="st">
            <b>{model.jobsCount}</b>
            <span>{model.jobsCount === 1 ? 'Job active' : 'Jobs active'}</span>
          </div>
          <div className="st">
            <b>{mayPublish ? model.unbookedCount : '…'}</b>
            <span>Unbooked</span>
          </div>
        </div>
        <div style={{ marginTop: 18, position: 'relative', zIndex: 1 }}>
          <div className="row small" style={{ opacity: 0.9, marginBottom: 8 }}>
            <b>Where the team is</b>
            <span className="grow" />
            {model.bookedPeopleCount} booked · {mayPublish ? model.unbookedCount : '…'} unbooked
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
      )}

      {firstPaint ? null : <div className="grid gmain">
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
          {mayPublish && model.unbookedNames.length > 0 ? (
            <section className="card" data-hue="red">
              <div className="card-h">
                <div className="ico-chip sm" aria-hidden="true">
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.4 1.4 21h21.2L12 2.4zm1.15 13.3h-2.3v-5.1h2.3v5.1zm0 3.3h-2.3v-2h2.3v2z" />
                  </svg>
                </div>
                <h2 className="h2">Unbooked labour</h2>
                <div className="acts">
                  <span className="count" data-hue="red">
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
                    <span className="pill" data-hue="red">
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
                      <span className="t">{holidayName(row, users, operatives, userIdAliases)}</span>
                      {/* Rulebook 1.20.0 §9: a leave half is the exact middle of the day (`leaveHalfDayWindows`). */}
                      <span className="s">Annual leave · {leaveHalfDayLabel(row.timeSlot, payrollPolicy)}</span>
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
              aliases={userIdAliases}
              onOpen={(booking) => setEditingRow(managerBookingToTarget(booking, personName(booking.userId, users, userIdAliases)))}
            />
          ) : null}

          {model.siteSurveyBookings.length > 0 ? (
            <ManagerCard
              title="Site survey"
              bookings={model.siteSurveyBookings}
              users={users}
              aliases={userIdAliases}
              onOpen={(booking) => setEditingRow(managerBookingToTarget(booking, personName(booking.userId, users, userIdAliases)))}
            />
          ) : null}
        </div>
      </div>}
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
  aliases,
  onOpen,
}: {
  title: string
  bookings: ManagerSiteBooking[]
  users: User[]
  aliases?: Record<string, string>
  onOpen?: (booking: ManagerSiteBooking) => void
}) {
  return (
    <section className="card" data-hue="user">
      <div className="card-h">
        <h2 className="h2">{title}</h2>
      </div>
      <div className="card-b rows">
        {bookings.map((b) => {
          const name = personName(b.userId, users, aliases)
          if (!name) return null
          const inner = (
            <>
              <span className="grow">
                <span className="t">{name}</span>
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
              aria-label={`Change booking for ${name}`}
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
  aliases,
  onOpen,
}: {
  office: ManagerSiteBooking[]
  wfh: ManagerSiteBooking[]
  custom: { name: string; bookings: ManagerSiteBooking[] }[]
  users: User[]
  aliases?: Record<string, string>
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
        {office.length > 0 ? <ManagerCard title="Office" bookings={office} users={users} aliases={aliases} onOpen={onOpen} /> : null}
        {wfh.length > 0 ? <ManagerCard title="Working from home" bookings={wfh} users={users} aliases={aliases} onOpen={onOpen} /> : null}
        {custom.map((g) => (
          <ManagerCard key={g.name} title={g.name} bookings={g.bookings} users={users} aliases={aliases} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

/**
 * iOS parity source: Views/DailyOverviewView.swift
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { canViewDailyOverview, hasAdminAccess } from '@/lib/permissions'
import { dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import {
  buildDailyOverview,
  initialsFrom,
  overviewFormatHours,
  shiftOverviewDay,
} from '@/lib/daily-overview/buildDailyOverview'
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
  const { user, organization } = useAuthStore()
  const { bookings, loadBookings, loading: bookingsLoading } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings: holidays, loadBookings: loadHolidays } = useHolidayStore()
  const [day, setDay] = useState(() => londonMidnight(new Date()))

  useEffect(() => {
    if (!organization?.id) return
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadHolidays(organization.id)
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
      }),
    [day, projects, smallWorks, bookings, managerSiteBookings, holidays, users, operatives]
  )

  const canBook = Boolean(user && (hasAdminAccess(user) || user.permissions.manager))
  const dateParam = dayKey(day)

  if (user && !canViewDailyOverview(user)) {
    return <p className="text-ios-muted">Daily overview is not available for this account.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">Daily overview</h1>
        <label className="flex items-center gap-2 text-[14px] font-medium text-[#185FA5]">
          <CalendarDaysIcon className="h-4 w-4" />
          View by date
          <input
            type="date"
            value={dateParam}
            onChange={(e) => setDay(londonMidnight(new Date(`${e.target.value}T12:00:00`)))}
            className="rounded-lg border border-ios-search-border bg-white px-2 py-1 text-ios-ink"
          />
        </label>
      </div>

      <div className="flex items-center rounded-[18px] border border-ios-border bg-ios-card px-2 py-1.5">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => setDay(shiftOverviewDay(day, -1))}
          className="grid h-11 w-11 place-items-center text-ios-muted"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[14px] font-medium">{model.dayLabel}</p>
          <p className="text-[11px] font-medium text-[#185FA5]">{model.isToday ? 'Today · Tap to change' : 'Tap to change'}</p>
        </div>
        <button
          type="button"
          aria-label="Next day"
          onClick={() => setDay(shiftOverviewDay(day, 1))}
          className="grid h-11 w-11 place-items-center text-ios-muted"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#185FA5] to-[#378ADD] p-[18px] text-white">
        <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-white/85">
          {model.isToday ? 'Today at a glance' : 'Day at a glance'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          <p className="text-[28px] font-medium tracking-tight">{overviewFormatHours(model.labourHours)}h</p>
          <p className="text-[13px] font-medium text-white/85">
            · {model.peopleCount} {model.peopleCount === 1 ? 'person' : 'people'}
          </p>
          {model.unbookedCount > 0 ? (
            <span className="ml-auto rounded-full bg-white/18 px-2.5 py-1 text-[10px] font-medium">
              {model.unbookedCount} unbooked
            </span>
          ) : null}
        </div>
        <div className="mt-3.5 grid grid-cols-3 gap-1.5">
          <GlancePill value={overviewFormatHours(model.labourHours)} label="Standard hrs" />
          <GlancePill value="0" label="OT 1.5×" />
          <GlancePill value={String(model.jobsCount)} label={model.jobsCount === 1 ? 'Job active' : 'Jobs active'} />
        </div>
        <div className="mt-3.5 flex items-center justify-between border-t border-white/20 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-white/85">Where the team is</p>
          <p className="text-[9px] font-medium text-white/70">
            {model.bookedPeopleCount} booked · {model.unbookedCount} unbooked
          </p>
        </div>
        <div className="mt-2.5 flex h-2 overflow-hidden rounded bg-black/18">
          {model.officeCount > 0 ? <div className="bg-white" style={{ flex: model.officeCount }} /> : null}
          {model.wfhCount > 0 ? <div className="bg-white/60" style={{ flex: model.wfhCount }} /> : null}
          {model.onSiteCount > 0 ? <div className="bg-white/85" style={{ flex: model.onSiteCount }} /> : null}
          {model.unbookedCount > 0 ? <div className="bg-white/20" style={{ flex: model.unbookedCount }} /> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium">
          <span className={model.officeCount ? '' : 'text-white/55'}>{model.officeCount} Office</span>
          <span className={model.wfhCount ? '' : 'text-white/55'}>{model.wfhCount} WFH</span>
          <span className={model.onSiteCount ? '' : 'text-white/55'}>{model.onSiteCount} On site</span>
        </div>
      </section>

      <div className="xl:grid xl:grid-cols-12 xl:gap-6">
        <div className="space-y-4 xl:col-span-8">
          {model.projectCards.length > 0 ? (
            <section>
              <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">By project</p>
              <div className="grid gap-2.5 lg:grid-cols-2">
                {model.projectCards.map(({ project, bookings: jobBookings, isSmallWorks }) => (
                  <article key={project.id} className="rounded-2xl border border-ios-border bg-ios-card p-3.5">
                    <p className="text-[13px] font-medium">
                      {project.jobNumber} {project.siteName}
                    </p>
                    <p className="mt-1 text-[11px] text-ios-muted">
                      {jobBookings.length} booking{jobBookings.length === 1 ? '' : 's'}
                    </p>
                    <Link
                      href={isSmallWorks ? `/dashboard/small-works/${project.id}` : `/dashboard/projects/${project.id}`}
                      className="mt-2 flex items-center justify-center gap-1 rounded-[10px] bg-[#F7F8FA] py-2 text-[12px] font-medium text-[#185FA5]"
                    >
                      {isSmallWorks ? 'Open small works' : 'Open project'} →
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {model.empty && !bookingsLoading ? (
            <p className="rounded-2xl border border-ios-border bg-ios-card py-10 text-center text-[15px] font-medium text-ios-muted">
              No bookings
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-4 xl:col-span-4 xl:mt-0">
          {model.isWeekday && model.unbookedNames.length > 0 ? (
            <section className="rounded-2xl bg-[#FCEBEB] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-[#A32D2D]">Unbooked labour</p>
                <p className="text-[10px] font-medium text-[#A32D2D]">{model.unbookedNames.length} people</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {model.unbookedNames.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-medium">
                    <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-gradient-to-br from-[#185FA5] to-[#378ADD] text-[8px] font-medium text-white">
                      {initialsFrom(name)}
                    </span>
                    {name}
                  </span>
                ))}
              </div>
              {canBook ? (
                <Link
                  href={`/dashboard/schedule?date=${dateParam}`}
                  className="mt-2 inline-flex rounded-full border border-[#A32D2D] px-2.5 py-1 text-[11px] font-medium text-[#A32D2D]"
                >
                  Book labour
                </Link>
              ) : null}
            </section>
          ) : null}

          {model.holidays.length > 0 ? (
            <section>
              <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Annual leave</p>
              <div className="rounded-2xl border border-ios-border bg-ios-card p-3.5">
                {model.holidays.map((row) => (
                  <p key={row.id} className="py-1.5 text-[13px]">
                    {holidayName(row, users, operatives)}
                    <span className="ml-2 text-[11px] text-ios-muted">{row.timeSlot}</span>
                  </p>
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
            />
          ) : null}

          {model.siteSurveyBookings.length > 0 ? (
            <section>
              <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Site survey</p>
              <ManagerCard title="Site survey" bookings={model.siteSurveyBookings} users={users} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function GlancePill({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[11px] bg-white/14 px-2 py-2 text-center">
      <p className="text-[16px] font-medium">{value}</p>
      <p className="text-[9px] font-medium text-white/85">{label}</p>
    </div>
  )
}

function ManagerCard({
  title,
  bookings,
  users,
}: {
  title: string
  bookings: ManagerSiteBooking[]
  users: User[]
}) {
  return (
    <div className="rounded-2xl border border-ios-border bg-ios-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-[10px] font-medium text-ios-muted">Managers / admins</p>
      </div>
      {bookings.map((b) => (
        <p key={b.id} className="py-1 text-[13px]">
          <span className="mr-2 rounded bg-[#FBEAF0] px-1.5 py-0.5 text-[9px] font-medium text-[#993556]">{b.timeSlot}</span>
          {personName(b.userId, users)}
        </p>
      ))}
    </div>
  )
}

function OtherBlock({
  office,
  wfh,
  custom,
  users,
}: {
  office: ManagerSiteBooking[]
  wfh: ManagerSiteBooking[]
  custom: { name: string; bookings: ManagerSiteBooking[] }[]
  users: User[]
}) {
  const people = new Set([...office, ...wfh, ...custom.flatMap((g) => g.bookings)].map((b) => b.userId))
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Other</p>
        <p className="text-[11px] font-medium text-ios-muted">
          {people.size} person{people.size === 1 ? '' : 's'}
        </p>
      </div>
      <div className="space-y-2">
        {office.length > 0 ? <ManagerCard title="Office" bookings={office} users={users} /> : null}
        {wfh.length > 0 ? <ManagerCard title="Working from home" bookings={wfh} users={users} /> : null}
        {custom.map((g) => (
          <ManagerCard key={g.name} title={g.name} bookings={g.bookings} users={users} />
        ))}
      </div>
    </section>
  )
}

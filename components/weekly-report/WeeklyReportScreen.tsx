'use client'

import { useMemo, useState } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import Link from 'next/link'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { buildOrgScheduleBookings } from '@/lib/scheduling/scheduleBookingMerge'
import { computeManagerBookingClashWarnings } from '@/lib/warnings/managerClashWarnings'
import {
  computeUnbookedLabourWarnings,
  filterWarningsByLookahead,
} from '@/lib/warnings/unbookedLabourWarnings'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrganizationDetails } from '@/lib/settings/organizationSettings'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export function WeeklyReportScreen({
  organizationName,
  bookings,
  managerSiteBookings,
  operatives,
  users,
  projects,
  smallWorks,
  orgDetails,
  loading,
}: {
  organizationName: string
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  projects: Project[]
  smallWorks: Project[]
  orgDetails: OrganizationDetails | null
  loading?: boolean
}) {
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))

  const weekStartDate = useMemo(() => startOfWeek(new Date(weekStart), { weekStartsOn: 1 }), [weekStart])
  const weekEndDate = useMemo(() => endOfWeek(weekStartDate, { weekStartsOn: 1 }), [weekStartDate])

  const mergedWorks = useMemo(() => mergeProjectsAndSmallWorks(projects, smallWorks), [projects, smallWorks])
  const rosterOperatives = useMemo(() => getActiveOperativesForScheduling(operatives), [operatives])

  const projectsById = useMemo(() => {
    const map = new Map<string, string>()
    mergedWorks.forEach((p) => map.set(p.id, p.siteName || p.jobNumber || p.id))
    return map
  }, [mergedWorks])

  const allBookings = useMemo(
    () => buildOrgScheduleBookings(bookings, managerSiteBookings, projectsById),
    [bookings, managerSiteBookings, projectsById]
  )

  const weekBookings = useMemo(
    () =>
      allBookings.filter((booking) => {
        const date = new Date(booking.date)
        return date >= weekStartDate && date <= weekEndDate
      }),
    [allBookings, weekStartDate, weekEndDate]
  )

  const warningDetection = orgDetails?.warningDetection
  const invoicing = orgDetails?.invoicing

  const operativeClashes = useMemo(() => {
    if (!warningDetection?.detectClashes) return []
    const all = computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks)
    return filterWarningsByLookahead(all, warningDetection, invoicing)
  }, [bookings, rosterOperatives, mergedWorks, warningDetection, invoicing])

  const managerClashes = useMemo(() => {
    if (!warningDetection?.detectClashes) return []
    const all = computeManagerBookingClashWarnings(managerSiteBookings, users, mergedWorks)
    return filterWarningsByLookahead(all, warningDetection, invoicing)
  }, [managerSiteBookings, users, mergedWorks, warningDetection, invoicing])

  const unbookedWarnings = useMemo(
    () =>
      warningDetection
        ? computeUnbookedLabourWarnings({
            bookings,
            operatives,
            users,
            holidays: [],
            warningDetection,
            invoicing,
          })
        : [],
    [bookings, operatives, users, warningDetection, invoicing]
  )

  const peopleSummary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; manager: boolean }>()
    for (const booking of weekBookings) {
      const key =
        booking.source === 'manager'
          ? `user:${booking.bookedBy}`
          : `op:${booking.operativeId}`
      const name =
        booking.source === 'manager'
          ? users.find((u) => u.id === booking.bookedBy)
            ? `${users.find((u) => u.id === booking.bookedBy)!.firstName} ${users.find((u) => u.id === booking.bookedBy)!.surname}`.trim()
            : 'Manager'
          : operatives.find((o) => o.id === booking.operativeId)
            ? `${operatives.find((o) => o.id === booking.operativeId)!.firstName} ${operatives.find((o) => o.id === booking.operativeId)!.lastName}`.trim()
            : 'Operative'
      const existing = map.get(key) || { name, count: 0, manager: booking.source === 'manager' }
      existing.count += 1
      map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [weekBookings, users, operatives])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weekly report</p>
        <p className="text-lg font-semibold text-slate-900">{organizationName}</p>
        <p className="mt-1 text-sm text-slate-600">
          Operative bookings, manager site bookings, clashes, and unbooked labour for the selected week.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Week starting</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="text-sm text-slate-500">
          {format(weekStartDate, 'd MMM')} – {format(weekEndDate, 'd MMM yyyy')}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-blue-700">{weekBookings.length}</p>
          <p className="text-xs text-slate-500">Bookings this week</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-700">{operativeClashes.length}</p>
          <p className="text-xs text-slate-500">Operative clashes</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-violet-700">{managerClashes.length}</p>
          <p className="text-xs text-slate-500">Manager overlaps</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-red-700">{unbookedWarnings.length}</p>
          <p className="text-xs text-slate-500">Unbooked labour flags</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">People booked</h2>
        {peopleSummary.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No bookings this week.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {peopleSummary.map((person) => (
              <div key={person.name} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{person.name}</p>
                <p className="text-xs text-slate-500">
                  {person.count} booking{person.count !== 1 ? 's' : ''} · {person.manager ? 'Manager/Admin' : 'Operative'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {(operativeClashes.length > 0 || managerClashes.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Overlaps & warnings</h2>
            <Link href="/dashboard/warnings" className="text-xs font-semibold text-blue-600 hover:underline">
              Open warnings hub →
            </Link>
          </div>
          <div className="space-y-2">
            {operativeClashes.slice(0, 5).map((warning) => (
              <p key={warning.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                {warning.message}
              </p>
            ))}
            {managerClashes.slice(0, 5).map((warning) => (
              <p key={warning.id} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-900">
                {warning.message}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'

function slotHours(slot: string): number {
  const normalized = slot.toUpperCase()
  if (normalized.includes('FULL')) return 8
  if (normalized === 'AM' || normalized === 'PM') return 4
  return 8
}

export default function TimesheetsPage() {
  const { organization, user } = useAuthStore()
  const { bookings, loading: bookingsLoading, loadBookings } = useBookingStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))

  useEffect(() => {
    if (organization?.id) {
      loadBookings(organization.id)
      loadOperatives(organization.id)
    }
  }, [organization, loadBookings, loadOperatives])

  const weekRange = useMemo(() => {
    const start = startOfWeek(new Date(weekStart), { weekStartsOn: 1 })
    return { start, end: endOfWeek(start, { weekStartsOn: 1 }) }
  }, [weekStart])

  const weekBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const date = new Date(booking.date)
        return isWithinInterval(date, weekRange)
      }),
    [bookings, weekRange]
  )

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; days: number; bookings: number }>()
    for (const booking of weekBookings) {
      const operative = operatives.find((o) => o.id === booking.operativeId)
      const name = operative ? `${operative.firstName} ${operative.lastName}`.trim() : `Operative ${booking.operativeId.slice(0, 8)}`
      const key = booking.operativeId
      const hours = slotHours(String(booking.timeSlot))
      const existing = map.get(key) || { name, days: 0, bookings: 0 }
      existing.days += hours / 8
      existing.bookings += 1
      map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [weekBookings, operatives])

  const totalDays = rows.reduce((sum, row) => sum + row.days, 0)

  if (bookingsLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        description="Weekly hours derived from Firebase bookings — mirrors iOS InvoicingView data sources."
        meta={`Week ${format(weekRange.start, 'd MMM')} – ${format(weekRange.end, 'd MMM yyyy')} · ${weekBookings.length} bookings · ${totalDays.toFixed(1)} total days`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Week starting</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {user && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Signed in as <strong>{user.firstName || user.email}</strong>. Timesheet sign-off state is stored per user/week in{' '}
          <code className="rounded bg-blue-100 px-1">organizations/&#123;orgId&#125;/settings/timesheet_&#123;userId&#125;_&#123;week&#125;</code> on iOS.
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No bookings this week" description="Schedule operatives on projects to populate timesheet hours." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Operative</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Bookings</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Days (est.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.bookings}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.days.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

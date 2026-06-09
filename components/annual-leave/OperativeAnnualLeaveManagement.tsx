'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  hasAdminAccess,
  canAccessOperativeAnnualLeaveDirectory,
} from '@/lib/navigation/menuPermissions'
import { isPendingHolidayRequest } from '@/lib/stores/holidayStore'
import {
  buildAnnualLeavePeople,
  resolvePersonName,
  sortAnnualLeavePeople,
  bookingMatchesPerson,
  type AnnualLeavePerson,
  type AnnualLeavePersonSort,
} from '@/lib/annualLeave/annualLeavePerson'
import { isCancellationRequest } from '@/lib/annualLeave/holidayApprovalUtils'
import type { HolidayBooking } from '@/types'
import { OperativeAnnualLeaveCalendar } from './OperativeAnnualLeaveCalendar'

type HubTab = 'manage' | 'approved' | 'requests'

function fmtRange(b: HolidayBooking) {
  const start = format(b.startDate, 'd MMM yyyy')
  const end = format(b.endDate, 'd MMM yyyy')
  return start === end ? start : `${start} – ${end}`
}

function BookingListRow({
  booking,
  name,
  showApprove,
  onApprove,
  onDecline,
}: {
  booking: HolidayBooking
  name: string
  showApprove?: boolean
  onApprove?: () => void
  onDecline?: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm font-bold text-slate-900">{name}</p>
      <p className="mt-0.5 text-sm text-slate-700">{fmtRange(booking)}</p>
      <p className="text-xs text-slate-500">{booking.timeSlot}</p>
      {showApprove && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  )
}

export function OperativeAnnualLeaveManagement() {
  const { user, organization } = useAuthStore()
  const { bookings, saveBooking, deleteBooking } = useHolidayStore()
  const { operatives } = useOperativeStore()
  const { users } = useOrgUserStore()

  const isAdmin = hasAdminAccess(user)
  const [activeTab, setActiveTab] = useState<HubTab>('manage')
  const [sortMode, setSortMode] = useState<AnnualLeavePersonSort>('firstName')
  const [tradeFilter, setTradeFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<AnnualLeavePerson | null>(null)

  const people = useMemo(() => buildAnnualLeavePeople(users, operatives), [users, operatives])

  const tradeChoices = useMemo(
    () => Array.from(new Set(people.map((p) => p.tradeLabel).filter(Boolean))).sort(),
    [people]
  )

  const filteredPeople = useMemo(() => {
    let rows = people
    if (tradeFilter) rows = rows.filter((p) => p.tradeLabel === tradeFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.tradeLabel.toLowerCase().includes(q)
      )
    }
    return sortAnnualLeavePeople(rows, sortMode)
  }, [people, tradeFilter, search, sortMode])

  const teamBookings = useMemo(
    () => bookings.filter((b) => people.some((p) => bookingMatchesPerson(b, p))),
    [bookings, people]
  )

  const approvedBookings = useMemo(
    () =>
      teamBookings
        .filter((b) => b.status === 'approved' && !isCancellationRequest(b))
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    [teamBookings]
  )

  const pendingRequests = useMemo(
    () =>
      teamBookings
        .filter((b) => isPendingHolidayRequest(b))
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    [teamBookings]
  )

  const updateStatus = async (booking: HolidayBooking, status: 'approved' | 'rejected') => {
    if (!organization?.id || !user) return
    if (status === 'approved' && isCancellationRequest(booking)) {
      await deleteBooking(organization.id, booking.id)
      return
    }
    if (status === 'rejected' && isCancellationRequest(booking)) {
      await saveBooking(organization.id, {
        ...booking,
        cancellationRequestedAt: undefined,
        cancellationRequestedByUserId: undefined,
        updatedAt: new Date(),
      })
      return
    }
    await saveBooking(organization.id, {
      ...booking,
      status,
      approvedByUserId: user.id,
      approvedAt: new Date(),
    })
  }

  if (!canAccessOperativeAnnualLeaveDirectory(user)) {
    return (
      <div className="mx-auto max-w-xl pb-10">
        <p className="text-sm text-slate-600">You do not have access to manage operative annual leave.</p>
        <Link href="/dashboard/annual-leave" className="mt-4 inline-block text-sm font-semibold text-blue-600">
          Back to annual leave
        </Link>
      </div>
    )
  }

  if (selectedPerson && activeTab === 'manage') {
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-10">
        <h1 className="text-2xl font-bold text-slate-900">Operative annual leave</h1>
        <OperativeAnnualLeaveCalendar
          person={selectedPerson}
          bookings={bookings}
          onBack={() => setSelectedPerson(null)}
        />
      </div>
    )
  }

  const tabs: { key: HubTab; label: string }[] = isAdmin
    ? [
        { key: 'manage', label: 'Manage operative annual leave' },
        { key: 'approved', label: 'View approved bookings' },
        { key: 'requests', label: 'View annual leave requests' },
      ]
    : [{ key: 'manage', label: 'Manage operative annual leave' }]

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/annual-leave"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Back to annual leave"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">View and manage operative annual leave</h1>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-xl px-2 py-2 text-[11px] font-semibold leading-tight transition-all sm:text-xs ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Sort by
            </label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as AnnualLeavePersonSort)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800"
            >
              <option value="firstName">First name</option>
              <option value="surname">Last name</option>
              <option value="trade">Trade</option>
            </select>

            {tradeChoices.length > 0 && (
              <>
                <label className="mt-3 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Filter by trade
                </label>
                <select
                  value={tradeFilter}
                  onChange={(e) => setTradeFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800"
                >
                  <option value="">All trades</option>
                  {tradeChoices.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="mt-3 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Search
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or trade"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Active team · {filteredPeople.length}
          </p>

          {filteredPeople.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No team members match your filters.</p>
          ) : (
            <div className="space-y-2">
              {filteredPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedPerson(person)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{person.displayName}</p>
                    <p className="text-xs text-slate-500">{person.subtitle}</p>
                    {person.tradeLabel && (
                      <p className="mt-0.5 text-[11px] font-medium text-blue-600">{person.tradeLabel}</p>
                    )}
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Select a person to view their calendar, book approved leave, or approve pending requests.
          </p>
        </div>
      )}

      {activeTab === 'approved' && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Approved bookings · {approvedBookings.length}
          </p>
          {approvedBookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No approved operative bookings.</p>
          ) : (
            approvedBookings.map((b) => (
              <BookingListRow
                key={b.id}
                booking={b}
                name={resolvePersonName(b, users, operatives)}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Pending requests · {pendingRequests.length}
          </p>
          {pendingRequests.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No pending requests.</p>
          ) : (
            pendingRequests.map((b) => (
              <BookingListRow
                key={b.id}
                booking={b}
                name={resolvePersonName(b, users, operatives)}
                showApprove
                onApprove={() => updateStatus(b, 'approved')}
                onDecline={() => {
                  if (window.confirm(`Decline request for ${resolvePersonName(b, users, operatives)}?`)) {
                    updateStatus(b, 'rejected')
                  }
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

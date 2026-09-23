'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
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
  canManagePersonAnnualLeave,
  resolvePersonName,
  sortAnnualLeavePeople,
  bookingMatchesPerson,
  type AnnualLeavePerson,
  type AnnualLeavePersonSort,
} from '@/lib/annualLeave/annualLeavePerson'
import { isCancellationRequest } from '@/lib/annualLeave/holidayApprovalUtils'
import type { HolidayBooking, HolidayTimeSlot } from '@/types'
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
  onSave,
  onDelete,
}: {
  booking: HolidayBooking
  name: string
  showApprove?: boolean
  onApprove?: () => void
  onDecline?: () => void
  onSave?: (next: HolidayBooking) => void
  onDelete?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [slot, setSlot] = useState<HolidayTimeSlot>(booking.timeSlot)
  const [start, setStart] = useState(dayKey(booking.startDate))
  const [end, setEnd] = useState(dayKey(booking.endDate))
  const [editError, setEditError] = useState<string | null>(null)

  const beginEdit = () => {
    setSlot(booking.timeSlot)
    setStart(dayKey(booking.startDate))
    setEnd(dayKey(booking.endDate))
    setEditError(null)
    setEditing(true)
  }

  const saveEdit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      setEditError('Enter a start and end date.')
      return
    }
    if (end < start) {
      setEditError('The end date has to be on or after the start date.')
      return
    }
    onSave?.({
      ...booking,
      timeSlot: slot,
      startDate: dateFromDayKey(start),
      endDate: dateFromDayKey(end),
      updatedAt: new Date(),
    })
    setEditing(false)
  }

  return (
    <div className="card pad">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{name}</p>
          <p className="mt-0.5 text-sm text-slate-700">{fmtRange(booking)}</p>
          <p className="text-xs text-slate-500">{booking.timeSlot}</p>
        </div>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            aria-label="Delete annual leave"
            title="Delete annual leave"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
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
      {onSave && !editing ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={beginEdit}
            className="rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            Delete annual leave
          </button>
        </div>
      ) : null}
      {editing ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Start
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"
              />
            </label>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400">
              End
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['FULL DAY', 'AM', 'PM'] as HolidayTimeSlot[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSlot(option)}
                className={`rounded-xl border py-2 text-xs font-semibold ${
                  slot === option
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {option === 'FULL DAY' ? 'Full day' : option}
              </button>
            ))}
          </div>
          {editError ? <p className="text-xs font-semibold text-red-600">{editError}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={saveEdit}
              className="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
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

  const people = useMemo(() => {
    const rows = buildAnnualLeavePeople(users, operatives)
    return rows.filter((person) => canManagePersonAnnualLeave(user, person, users))
  }, [users, operatives, user])

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
          <div className="card pad">
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
                  className="flex w-full items-center justify-between card px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-slate-50"
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
            Select a person to view their calendar, their future annual leave, and book or delete approved leave.
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
                onSave={(next) => {
                  if (!organization?.id) return
                  void saveBooking(organization.id, next)
                }}
                onDelete={() => {
                  if (!organization?.id) return
                  const who = resolvePersonName(b, users, operatives)
                  if (window.confirm(`Delete annual leave for ${who} on ${fmtRange(b)}?`)) {
                    void deleteBooking(organization.id, b.id)
                  }
                }}
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

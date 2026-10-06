'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { canAccessOperativeAnnualLeaveDirectory } from '@/lib/navigation/menuPermissions'
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
import { bookingDayCount, daysLabel, formatLeaveRange } from '@/lib/annualLeave/formatLeaveDays'
import { getDayKindForBookings } from '@/lib/annualLeave/dayStatus'
import type { HolidayBooking } from '@/types'
import { OperativeAnnualLeaveCalendar } from './OperativeAnnualLeaveCalendar'
import { AnnualLeaveLegend, LeaveDayCalendar } from './LeaveDayCalendar'
import { useOrgBankHolidays } from './useOrgBankHolidays'

type HubTab = 'manage' | 'approved' | 'requests'

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
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
    <div className="card pad">
      <p className="text-sm font-bold text-slate-900">{name}</p>
      <p className="mt-0.5 text-sm text-slate-700">{formatLeaveRange(booking)}</p>
      <p className="text-xs text-slate-500">
        {booking.timeSlot} · {daysLabel(bookingDayCount(booking))}
        {isCancellationRequest(booking) ? ' · Cancellation request' : booking.status === 'pending' ? ' · Leave request' : ''}
      </p>
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

export function OperativeAnnualLeaveManagement({
  embedded = false,
  onQueueCount,
}: {
  embedded?: boolean
  onQueueCount?: (count: number) => void
} = {}) {
  const { user, organization } = useAuthStore()
  const { bookings, saveBooking, deleteBooking } = useHolidayStore()
  const { operatives } = useOperativeStore()
  const { users } = useOrgUserStore()

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

  useEffect(() => {
    onQueueCount?.(pendingRequests.length)
  }, [onQueueCount, pendingRequests.length])

  const [awayMonth, setAwayMonth] = useState(new Date())
  const [declineTarget, setDeclineTarget] = useState<HolidayBooking | null>(null)
  const [holidayNote, setHolidayNote] = useState<string | null>(null)
  const bankYear = new Date().getFullYear()
  const bank = useOrgBankHolidays(new Date(bankYear, 0, 1), new Date(bankYear, 11, 31))

  const awayCaption = (day: Date) => {
    const names = people
      .filter((person) => {
        const rows = teamBookings.filter(
          (booking) => bookingMatchesPerson(booking, person) && booking.status !== 'rejected'
        )
        return getDayKindForBookings(day, rows) !== 'none'
      })
      .map((person) => initials(person.displayName))
    if (names.length === 0) return null
    if (names.length <= 2) return names.join(' ')
    return `${names[0]} +${names.length - 1}`
  }

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
      <OperativeAnnualLeaveCalendar
        person={selectedPerson}
        bookings={bookings}
        onBack={() => setSelectedPerson(null)}
      />
    )
  }

  const tabs: { key: HubTab; label: string }[] = [
    { key: 'manage', label: 'Team' },
    { key: 'approved', label: 'Approved' },
    { key: 'requests', label: 'Requests' },
  ]

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto max-w-xl space-y-4 pb-10'}>
      {embedded ? null : (
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
        <h1 className="text-2xl font-bold text-slate-900">Team annual leave</h1>
      </div>
      )}

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

          <div className="card pad">
            <p className="text-sm font-bold text-slate-900">Who is off</p>
            <p className="mt-0.5 text-xs text-slate-500">Initials show people with leave on that day.</p>
            <div className="mt-3">
              <LeaveDayCalendar
                month={awayMonth}
                onMonthChange={setAwayMonth}
                getDayKind={() => 'none'}
                onDayClick={() => {}}
                bankHolidayName={bank.nameOn}
                onBankHoliday={(name) =>
                  setHolidayNote(
                    `${name} is a bank holiday. It cannot be booked as annual leave, and it does not come out of anyone's allowance.`
                  )
                }
                dayCaption={awayCaption}
              />
            </div>
            <div className="mt-3">
              <AnnualLeaveLegend />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{bank.sentence}</p>
            {holidayNote ? <p className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">{holidayNote}</p> : null}
          </div>

          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Your team · {filteredPeople.length}
          </p>

          {filteredPeople.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
              Nobody matches those filters. Clear the trade or search to see the people you can manage.
            </p>
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
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
              Approved leave for your team shows here after you approve a request or book it for them.
            </p>
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
            Waiting for you · {pendingRequests.length}
          </p>
          {pendingRequests.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
              Nothing is waiting for you. New leave requests and cancellation requests from your team show up here.
            </p>
          ) : (
            pendingRequests.map((b) => (
              <BookingListRow
                key={b.id}
                booking={b}
                name={resolvePersonName(b, users, operatives)}
                showApprove
                onApprove={() => updateStatus(b, 'approved')}
                onDecline={() => setDeclineTarget(b)}
              />
            ))
          )}
        </div>
      )}

      {declineTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-base font-bold text-slate-900">
              Decline request
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {resolvePersonName(declineTarget, users, operatives)} · {formatLeaveRange(declineTarget)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold"
                onClick={() => setDeclineTarget(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--red)] py-2.5 text-sm font-bold text-white"
                onClick={() => {
                  const target = declineTarget
                  setDeclineTarget(null)
                  void updateStatus(target, 'rejected')
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

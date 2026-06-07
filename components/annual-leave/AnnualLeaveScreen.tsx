'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
} from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { newHolidayId, useHolidayStore } from '@/lib/stores/holidayStore'
import {
  canAccessOperativeAnnualLeaveDirectory,
  isOperativeMode,
} from '@/lib/navigation/menuPermissions'
import { getDayKindForBookings, getBookingForDay } from '@/lib/annualLeave/dayStatus'
import type { HolidayBooking, HolidayTimeSlot, User } from '@/types'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { AnnualLeaveLegend, LeaveDayCalendar } from './LeaveDayCalendar'

type OperativeTab = 'request' | 'my-holiday' | 'pending'

function dayCount(booking: HolidayBooking): number {
  const start = booking.startDate.getTime()
  const end = booking.endDate.getTime()
  const days = Math.round((end - start) / 86400000) + 1
  if (booking.timeSlot === 'AM' || booking.timeSlot === 'PM') return days * 0.5
  return days
}

function totalDayCount(bookings: HolidayBooking[]): number {
  return bookings.reduce((sum, b) => sum + dayCount(b), 0)
}

function fmtDate(d: Date) {
  return format(d, 'd MMM yyyy')
}

function fmtRange(b: HolidayBooking) {
  if (isSameDay(b.startDate, b.endDate)) return fmtDate(b.startDate)
  return `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`
}

function leaveYearRange(user: User | null) {
  const now = new Date()
  const startMonth = (user?.annualLeaveYearStartMonth ?? 1) - 1
  let year = now.getFullYear()
  if (now.getMonth() < startMonth) year -= 1
  const start = new Date(year, startMonth, 1)
  const endMonth = user?.annualLeaveYearEndMonth ?? 12
  const endYear = endMonth <= startMonth ? year + 1 : year
  const end = endOfMonth(new Date(endYear, endMonth - 1, 1))
  return { start, end }
}

function allowanceForUser(user: User | null): number {
  if (user?.annualLeaveDaysPerYear && user.annualLeaveDaysPerYear > 0) {
    return user.annualLeaveDaysPerYear
  }
  return 28
}

function LeaveSummaryCard({
  allowance,
  taken,
  pending,
  carriedForward,
  leaveYearStart,
  leaveYearEnd,
}: {
  allowance: number
  taken: number
  pending: number
  carriedForward?: number
  leaveYearStart: Date
  leaveYearEnd: Date
}) {
  const remaining = Math.max(0, allowance - taken - pending)
  const takenPercent = allowance > 0 ? Math.min(100, (taken / allowance) * 100) : 0
  const pendingPercent =
    allowance > 0 ? Math.min(100 - takenPercent, (pending / allowance) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-amber-50/60 p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Current leave year</p>
      <p className="mt-0.5 text-sm font-bold text-slate-800">
        {format(leaveYearStart, 'MMM yyyy')} – {format(leaveYearEnd, 'MMM yyyy')}
      </p>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-slate-500">Remaining</p>
          <p className="text-3xl font-bold leading-none text-slate-900">{remaining}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-500">Allowance</p>
          <p className="text-xl font-bold text-blue-600">{allowance}</p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="flex h-full">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${takenPercent}%` }}
          />
          <div
            className="h-full bg-amber-400 transition-all duration-500"
            style={{ width: `${pendingPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-600">
            Taken <span className="font-bold text-emerald-600">{taken}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="text-xs text-slate-600">
            Pending <span className="font-bold text-amber-600">{pending}</span>
          </span>
        </div>
      </div>

      {carriedForward !== undefined && carriedForward > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">Includes {carriedForward} carried forward</p>
      )}
    </div>
  )
}

function DurationSelector({
  value,
  onChange,
}: {
  value: HolidayTimeSlot
  onChange: (v: HolidayTimeSlot) => void
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Duration</p>
      <div className="grid grid-cols-3 gap-2">
        {(['FULL DAY', 'AM', 'PM'] as HolidayTimeSlot[]).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onChange(slot)}
            className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${
              value === slot
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {slot === 'FULL DAY' ? 'Full day' : slot}
          </button>
        ))}
      </div>
    </div>
  )
}

function BookingRow({
  booking,
  showCancel,
  showApprove,
  onCancel,
  onApprove,
  onReject,
  onDelete,
}: {
  booking: HolidayBooking
  showCancel?: boolean
  showApprove?: boolean
  onCancel?: () => void
  onApprove?: () => void
  onReject?: () => void
  onDelete?: () => void
}) {
  const statusColors = {
    approved: 'text-emerald-600',
    pending: 'text-amber-600',
    rejected: 'text-red-600',
  }
  const statusLabels = {
    approved: 'Approved',
    pending: 'Pending approval',
    rejected: 'Rejected',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{fmtRange(booking)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{booking.timeSlot}</p>
          <p className={`mt-0.5 text-xs font-semibold ${statusColors[booking.status]}`}>
            {statusLabels[booking.status]}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {showApprove && booking.status === 'pending' && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onApprove}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={onReject}
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                Reject
              </button>
            </div>
          )}
          {showCancel && booking.status === 'approved' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Request cancellation
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full p-1 text-slate-300 transition-colors hover:text-red-500"
              aria-label="Delete booking"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ManagerView({
  myBookings,
  organization,
  user,
  saveBooking,
  deleteBooking,
}: {
  myBookings: HolidayBooking[]
  organization: { id: string } | null
  user: User | null
  saveBooking: (orgId: string, booking: HolidayBooking) => Promise<void>
  deleteBooking: (orgId: string, id: string) => Promise<void>
}) {
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [editDay, setEditDay] = useState<Date | null>(null)
  const [timeSlot, setTimeSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [changeSlot, setChangeSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [saving, setSaving] = useState(false)
  const [showBooked, setShowBooked] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const canManageOperatives = canAccessOperativeAnnualLeaveDirectory(user)

  const leaveYear = leaveYearRange(user)
  const allowance = allowanceForUser(user)
  const myApproved = myBookings.filter((b) => b.status === 'approved')
  const myPending = myBookings.filter((b) => b.status === 'pending')
  const taken = totalDayCount(myApproved)
  const pending = totalDayCount(myPending)

  const editBooking =
    editDay != null ? getBookingForDay(editDay, myBookings, 'approved') : null

  const handleDayClick = (day: Date) => {
    const kind = getDayKindForBookings(day, myBookings)
    if (kind === 'approvedFull' || kind === 'pendingFull') return
    if (kind === 'approvedHalf' || kind === 'pendingHalf') {
      setEditDay(day)
      const approved = getBookingForDay(day, myBookings, 'approved')
      if (approved) setChangeSlot(approved.timeSlot)
      return
    }
    setEditDay(null)
    setSelectedDates((prev) =>
      prev.some((d) => isSameDay(d, day))
        ? prev.filter((d) => !isSameDay(d, day))
        : [...prev, day].sort((a, b) => a.getTime() - b.getTime())
    )
  }

  const confirmBooking = async () => {
    if (!organization?.id || !user || selectedDates.length === 0) return
    setSaving(true)
    try {
      for (const day of selectedDates) {
        await saveBooking(organization.id, {
          id: newHolidayId(),
          organizationId: organization.id,
          userId: user.id,
          startDate: day,
          endDate: day,
          status: 'approved',
          timeSlot,
          approvedByUserId: user.id,
          approvedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      setSuccess(`${selectedDates.length} day${selectedDates.length !== 1 ? 's' : ''} booked.`)
      setSelectedDates([])
      setTimeout(() => setSuccess(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const confirmChange = async () => {
    if (!organization?.id || !editBooking) return
    if (
      !window.confirm(
        `Change your annual leave booking on ${fmtDate(editBooking.startDate)} to ${changeSlot}?`
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await saveBooking(organization.id, {
        ...editBooking,
        timeSlot: changeSlot,
        updatedAt: new Date(),
      })
      setSuccess('Annual leave booking updated.')
      setEditDay(null)
      setTimeout(() => setSuccess(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {canManageOperatives && (
        <Link
          href="/dashboard/annual-leave/operatives"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">View and manage operative annual leave</p>
              <p className="text-xs text-slate-500">Book leave and approve requests for your team</p>
            </div>
          </div>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      <LeaveSummaryCard
        allowance={allowance}
        taken={taken}
        pending={pending}
        leaveYearStart={leaveYear.start}
        leaveYearEnd={leaveYear.end}
      />

      <button
        type="button"
        onClick={() => setShowBooked(!showBooked)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
            <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-900">Booked annual leave</span>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${showBooked ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {showBooked && (
        <div className="space-y-2">
          {myBookings.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No bookings yet</p>
          ) : (
            myBookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onDelete={() => {
                  if (organization?.id && window.confirm('Delete this booking?')) {
                    deleteBooking(organization.id, b.id)
                  }
                }}
              />
            ))
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <AnnualLeaveLegend />
        <div className="mt-3">
          <LeaveDayCalendar
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            getDayKind={(day) => getDayKindForBookings(day, myBookings)}
            selectedDays={selectedDates}
            onDayClick={handleDayClick}
            disableLocked
          />
        </div>

        {selectedDates.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">
              {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
            </span>
            {selectedDates.length >= 2 && (
              <span className="ml-1">
                ({fmtDate(selectedDates[0])} – {fmtDate(selectedDates[selectedDates.length - 1])})
              </span>
            )}
            <span className="ml-2 font-medium text-slate-500">{timeSlot}</span>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-400">Tap each day you want to book</p>
          <DurationSelector value={timeSlot} onChange={setTimeSlot} />

          {selectedDates.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700">Selected days</p>
              <div className="space-y-0.5">
                {selectedDates.map((d) => (
                  <p key={d.toISOString()} className="text-xs text-slate-500">
                    {fmtDate(d)} ({timeSlot})
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editBooking && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-900">Change approved booking</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fmtDate(editBooking.startDate)} · currently {editBooking.timeSlot}
          </p>
          <div className="mt-3">
            <DurationSelector value={changeSlot} onChange={setChangeSlot} />
          </div>
          <button
            type="button"
            disabled={saving || changeSlot === editBooking.timeSlot}
            onClick={confirmChange}
            className="mt-4 flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Confirm annual leave booking change'}
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✓ {success}
        </div>
      )}

      <button
        type="button"
        disabled={saving || selectedDates.length === 0}
        onClick={confirmBooking}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all ${
          selectedDates.length > 0
            ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 active:scale-[0.98]'
            : 'cursor-not-allowed bg-slate-200 text-slate-400'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {saving ? 'Confirming…' : 'Confirm booking'}
      </button>
    </div>
  )
}

function OperativeView({
  myBookings,
  organization,
  user,
  saveBooking,
}: {
  myBookings: HolidayBooking[]
  organization: { id: string } | null
  user: User | null
  saveBooking: (orgId: string, booking: HolidayBooking) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<OperativeTab>('request')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [timeSlot, setTimeSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const leaveYear = leaveYearRange(user)
  const allowance = allowanceForUser(user)
  const myApproved = myBookings.filter((b) => b.status === 'approved')
  const myPending = myBookings.filter((b) => b.status === 'pending')
  const taken = totalDayCount(myApproved)
  const pending = totalDayCount(myPending)

  const toggleDay = (day: Date) => {
    const kind = getDayKindForBookings(day, myBookings)
    if (kind === 'approvedFull' || kind === 'pendingFull') return
    setSelectedDates((prev) =>
      prev.some((d) => isSameDay(d, day))
        ? prev.filter((d) => !isSameDay(d, day))
        : [...prev, day].sort((a, b) => a.getTime() - b.getTime())
    )
  }

  const submitRequest = async () => {
    if (!organization?.id || !user || selectedDates.length === 0) return
    setSaving(true)
    try {
      for (const day of selectedDates) {
        await saveBooking(organization.id, {
          id: newHolidayId(),
          organizationId: organization.id,
          userId: user.id,
          startDate: day,
          endDate: day,
          status: 'pending',
          timeSlot,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      setSuccess(
        `Holiday request submitted for ${selectedDates.length} day${selectedDates.length !== 1 ? 's' : ''}.`
      )
      setSelectedDates([])
      setActiveTab('pending')
      setTimeout(() => setSuccess(null), 4000)
    } finally {
      setSaving(false)
    }
  }

  const TABS: { key: OperativeTab; label: string }[] = [
    { key: 'request', label: 'Request' },
    { key: 'my-holiday', label: 'My holiday' },
    { key: 'pending', label: 'Pending' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <LeaveSummaryCard
        allowance={allowance}
        taken={taken}
        pending={pending}
        leaveYearStart={leaveYear.start}
        leaveYearEnd={leaveYear.end}
      />

      {activeTab === 'request' && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <AnnualLeaveLegend />
            <div className="mt-3">
              <LeaveDayCalendar
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                getDayKind={(day) => getDayKindForBookings(day, myBookings)}
                selectedDays={selectedDates}
                onDayClick={toggleDay}
                disableLocked
              />
            </div>

            {selectedDates.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-600">
                  <span className="font-semibold">
                    {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
                  </span>
                  {selectedDates.length >= 2 && (
                    <span className="ml-1">
                      ({fmtDate(selectedDates[0])} – {fmtDate(selectedDates[selectedDates.length - 1])})
                    </span>
                  )}
                </p>
                <span className="text-xs font-semibold text-slate-500">{timeSlot}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-400">Tap each day you want to book</p>
              <DurationSelector value={timeSlot} onChange={setTimeSlot} />

              {selectedDates.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold text-slate-700">Selected days</p>
                  <div className="space-y-0.5">
                    {selectedDates.map((d) => (
                      <p key={d.toISOString()} className="text-xs text-slate-500">
                        {fmtDate(d)} ({timeSlot})
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              ✓ {success}
            </div>
          )}

          <button
            type="button"
            disabled={saving || selectedDates.length === 0}
            onClick={submitRequest}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all ${
              selectedDates.length > 0
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </>
      )}

      {activeTab === 'my-holiday' && (
        <div className="space-y-3">
          <p className="text-base font-bold text-slate-900">My annual leave</p>
          {myApproved.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center">
              <p className="text-sm text-slate-400">No approved leave yet</p>
            </div>
          ) : (
            myApproved.map((b) => <BookingRow key={b.id} booking={b} showCancel />)
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-3">
          <p className="text-base font-bold text-slate-900">Pending</p>
          {myPending.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center">
              <p className="text-sm text-slate-400">No pending requests</p>
            </div>
          ) : (
            myPending.map((b) => <BookingRow key={b.id} booking={b} />)
          )}
        </div>
      )}
    </div>
  )
}

export function AnnualLeaveScreen() {
  const { organization, user } = useAuthStore()
  const { bookings, error, saveBooking, deleteBooking } = useHolidayStore()

  const isOperative = isOperativeMode(user)

  const myBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.userId === user?.id || b.operativeId === user?.id)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    [bookings, user]
  )

  if (user?.annualLeaveEnabled === false) {
    return (
      <div className="mx-auto max-w-xl pb-10">
        <h1 className="text-2xl font-bold text-slate-900">Annual leave</h1>
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Annual leave is not enabled for your account. Contact your manager if you need this turned on.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <h1 className="text-2xl font-bold text-slate-900">Annual leave</h1>

      {error && <ErrorBanner message={error} />}

      {isOperative ? (
        <OperativeView
          myBookings={myBookings}
          organization={organization}
          user={user}
          saveBooking={saveBooking}
        />
      ) : (
        <ManagerView
          myBookings={myBookings}
          organization={organization}
          user={user}
          saveBooking={saveBooking}
          deleteBooking={deleteBooking}
        />
      )}
    </div>
  )
}

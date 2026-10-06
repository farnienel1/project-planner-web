'use client'

import { useMemo, useState } from 'react'
import { isSameDay, startOfDay } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { newHolidayId, useHolidayStore } from '@/lib/stores/holidayStore'
import { bookingMatchesPerson, type AnnualLeavePerson } from '@/lib/annualLeave/annualLeavePerson'
import {
  getBookingForDay,
  getDayKindForBookings,
  isDayLocked,
  type AnnualLeaveDayKind,
} from '@/lib/annualLeave/dayStatus'
import { formatLeaveDate, formatLeaveRange } from '@/lib/annualLeave/formatLeaveDays'
import { leaveDayBlockedReason, leaveSubmitStatus } from '@/lib/annualLeave/leaveRequestDecision'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import type { HolidayBooking, HolidayTimeSlot } from '@/types'
import { AnnualLeaveLegend, LeaveDayCalendar } from './LeaveDayCalendar'
import { useOrgBankHolidays } from './useOrgBankHolidays'

function fmtDate(d: Date) {
  return formatLeaveDate(d)
}

function fmtRange(booking: HolidayBooking) {
  return formatLeaveRange(booking)
}

function monthOfNextBooking(person: AnnualLeavePerson, bookings: HolidayBooking[]): Date {
  const today = startOfDay(new Date())
  const next = bookings
    .filter((booking) => bookingMatchesPerson(booking, person) && booking.status !== 'rejected')
    .map((booking) => startOfDay(booking.startDate))
    .filter((day) => day >= today)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  return next || new Date()
}

function DeleteAnnualLeaveButton({
  onClick,
  disabled,
  label = 'Delete annual leave',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      {label}
    </button>
  )
}

function DurationButtons({
  value,
  onChange,
}: {
  value: HolidayTimeSlot
  onChange: (v: HolidayTimeSlot) => void
}) {
  return (
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
  )
}

export function OperativeAnnualLeaveCalendar({
  person,
  bookings,
  onBack,
}: {
  person: AnnualLeavePerson
  bookings: HolidayBooking[]
  onBack: () => void
}) {
  const { organization, user } = useAuthStore()
  const users = useOrgUserStore((state) => state.users)
  const { saveBooking, deleteBooking } = useHolidayStore()

  const [month, setMonth] = useState(() => monthOfNextBooking(person, bookings))
  const bankYear = month.getFullYear()
  const bank = useOrgBankHolidays(new Date(bankYear, 0, 1), new Date(bankYear, 11, 31))
  const [holidayNote, setHolidayNote] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<HolidayBooking | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [bookSlot, setBookSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [changeSlot, setChangeSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const personBookings = useMemo(
    () => bookings.filter((booking) => bookingMatchesPerson(booking, person)),
    [bookings, person]
  )

  const futureBookings = useMemo(
    () =>
      personBookings
        .filter(
          (booking) =>
            booking.status !== 'rejected' && startOfDay(booking.endDate) >= startOfDay(new Date())
        )
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    [personBookings]
  )

  const selectedKind: AnnualLeaveDayKind | null = selectedDay
    ? getDayKindForBookings(selectedDay, personBookings)
    : null

  const pendingBooking =
    selectedDay && (selectedKind === 'pendingFull' || selectedKind === 'pendingHalf')
      ? getBookingForDay(selectedDay, personBookings, 'pending')
      : null

  const approvedBooking =
    selectedDay && (selectedKind === 'approvedFull' || selectedKind === 'approvedHalf')
      ? getBookingForDay(selectedDay, personBookings, 'approved')
      : null

  const handleDayClick = (day: Date) => {
    const sod = startOfDay(day)
    if (selectedDay && isSameDay(selectedDay, sod)) {
      setSelectedDay(null)
      return
    }
    setSelectedDay(sod)
    const kind = getDayKindForBookings(sod, personBookings)
    if (kind === 'approvedFull' || kind === 'approvedHalf') {
      const b = getBookingForDay(sod, personBookings, 'approved')
      if (b) setChangeSlot(b.timeSlot)
    } else {
      setBookSlot('FULL DAY')
    }
  }

  const bookLeave = async () => {
    if (!organization?.id || !user || !selectedDay) return
    const blocked = leaveDayBlockedReason(selectedDay, Boolean(bank.nameOn(selectedDay)))
    if (blocked) {
      setMessage(blocked)
      return
    }
    const subject = users.find((row) => row.id === person.userId)
    const status = subject ? leaveSubmitStatus(subject) : 'pending'
    setSaving(true)
    try {
      await saveBooking(organization.id, {
        id: newHolidayId(),
        organizationId: organization.id,
        userId: person.userId,
        operativeId: person.operativeId,
        startDate: selectedDay,
        endDate: selectedDay,
        status,
        timeSlot: bookSlot,
        approvedByUserId: status === 'approved' ? user.id : undefined,
        approvedAt: status === 'approved' ? new Date() : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setMessage(`Annual leave booked for ${person.displayName}.`)
      setSelectedDay(null)
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const confirmChange = async () => {
    if (!organization?.id || !approvedBooking) return
    if (
      !window.confirm(
        `Change annual leave booking for ${person.displayName} on ${fmtDate(approvedBooking.startDate)} to ${changeSlot}?`
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await saveBooking(organization.id, {
        ...approvedBooking,
        timeSlot: changeSlot,
        updatedAt: new Date(),
      })
      setMessage('Annual leave booking updated.')
      setSelectedDay(null)
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const approveRequest = async () => {
    if (!organization?.id || !user || !pendingBooking) return
    setSaving(true)
    try {
      await saveBooking(organization.id, {
        ...pendingBooking,
        status: 'approved',
        approvedByUserId: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      setMessage('Request approved.')
      setSelectedDay(null)
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const deleteAnnualLeave = async (booking: HolidayBooking) => {
    if (!organization?.id) return
    setSaving(true)
    try {
      await deleteBooking(organization.id, booking.id)
      setMessage('Annual leave removed.')
      if (approvedBooking?.id === booking.id) setSelectedDay(null)
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
      setPendingDelete(null)
    }
  }

  const declineRequest = async () => {
    if (!organization?.id || !user || !pendingBooking) return
    if (!window.confirm(`Decline this annual leave request for ${person.displayName}?`)) return
    setSaving(true)
    try {
      await saveBooking(organization.id, {
        ...pendingBooking,
        status: 'rejected',
        approvedByUserId: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      setMessage('Request declined.')
      setSelectedDay(null)
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to team list
      </button>

      <div className="card pad">
        <p className="text-lg font-bold text-slate-900">{person.displayName}</p>
        <p className="text-sm text-slate-500">{person.subtitle}</p>
        {person.tradeLabel && (
          <span className="mt-2 inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {person.tradeLabel}
          </span>
        )}
      </div>

      <AnnualLeaveLegend />
      <p className="text-xs leading-relaxed text-slate-500">{bank.sentence}</p>
      {holidayNote ? <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">{holidayNote}</p> : null}

      <div className="card pad">
        <LeaveDayCalendar
          month={month}
          onMonthChange={setMonth}
          getDayKind={(day) => getDayKindForBookings(day, personBookings)}
          bankHolidayName={bank.nameOn}
          onBankHoliday={(name) =>
            setHolidayNote(
              `${name} is a bank holiday. It cannot be booked as annual leave, and it does not come out of ${person.displayName}'s allowance.`
            )
          }
          selectedDay={selectedDay}
          onDayClick={handleDayClick}
          disableLocked={false}
        />
      </div>

      {selectedDay && selectedKind === 'none' && (
        <div className="card pad">
          <p className="text-sm font-bold text-slate-900">
            Book annual leave for {person.displayName}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{fmtDate(selectedDay)}</p>
          <div className="mt-3">
            <DurationButtons value={bookSlot} onChange={setBookSlot} />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={bookLeave}
            className="mt-4 flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Booking…' : 'Confirm annual leave booking'}
          </button>
        </div>
      )}

      {selectedDay && approvedBooking && (
        <div className="card pad">
          <p className="text-sm font-bold text-slate-900">Change approved booking</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fmtDate(selectedDay)} · currently {approvedBooking.timeSlot}
          </p>
          <div className="mt-3">
            <DurationButtons value={changeSlot} onChange={setChangeSlot} />
          </div>
          <button
            type="button"
            disabled={saving || changeSlot === approvedBooking.timeSlot}
            onClick={confirmChange}
            className="mt-4 flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Confirm annual leave booking change'}
          </button>
          <div className="mt-3">
            <DeleteAnnualLeaveButton disabled={saving} onClick={() => setPendingDelete(approvedBooking)} />
          </div>
        </div>
      )}

      {selectedDay && pendingBooking && (
        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-900">Pending request</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {fmtDate(selectedDay)} · {pendingBooking.timeSlot}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={approveRequest}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={declineRequest}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Decline
            </button>
          </div>
        </div>
      )}

      {selectedDay && selectedKind && isDayLocked(selectedKind) && !approvedBooking && !pendingBooking && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This day is fully booked ({selectedKind === 'approvedFull' ? 'approved' : 'pending'}).
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Future annual leave · {futureBookings.length}
        </p>
        {futureBookings.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            No future annual leave booked.
          </p>
        ) : (
          futureBookings.map((booking) => (
            <div key={booking.id} className="card pad">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{fmtRange(booking)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{booking.timeSlot}</p>
                  <p className={`mt-0.5 text-xs font-semibold ${booking.status === 'pending' || booking.cancellationRequestedAt ? 'text-amber-700' : 'text-emerald-600'}`}>
                    {booking.cancellationRequestedAt
                      ? 'Cancellation pending'
                      : booking.status === 'pending'
                        ? 'Awaiting approval'
                        : 'Approved'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPendingDelete(booking)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                  aria-label="Delete annual leave"
                  title="Delete annual leave"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-3">
                <DeleteAnnualLeaveButton disabled={saving} onClick={() => setPendingDelete(booking)} />
              </div>
            </div>
          ))
        )}
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      )}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-base font-bold text-slate-900">Remove annual leave?</p>
            <p className="mt-1 text-sm text-slate-600">
              {person.displayName} · {fmtRange(pendingDelete)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold" onClick={() => setPendingDelete(null)}>
                Keep it
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--red)] py-2.5 text-sm font-bold text-white"
                onClick={() => void deleteAnnualLeave(pendingDelete)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

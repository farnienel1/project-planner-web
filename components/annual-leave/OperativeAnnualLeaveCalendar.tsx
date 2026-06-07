'use client'

import { useMemo, useState } from 'react'
import { format, isSameDay, startOfDay } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { newHolidayId, useHolidayStore } from '@/lib/stores/holidayStore'
import type { AnnualLeavePerson } from '@/lib/annualLeave/annualLeavePerson'
import {
  getBookingForDay,
  getDayKindForPerson,
  isDayLocked,
  type AnnualLeaveDayKind,
} from '@/lib/annualLeave/dayStatus'
import type { HolidayBooking, HolidayTimeSlot } from '@/types'
import { AnnualLeaveLegend, LeaveDayCalendar } from './LeaveDayCalendar'

function fmtDate(d: Date) {
  return format(d, 'd MMM yyyy')
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
  const { saveBooking } = useHolidayStore()

  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [bookSlot, setBookSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [changeSlot, setChangeSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const personBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (person.userId && b.userId === person.userId) ||
          (person.operativeId && b.operativeId === person.operativeId)
      ),
    [bookings, person]
  )

  const selectedKind: AnnualLeaveDayKind | null = selectedDay
    ? getDayKindForPerson(selectedDay, personBookings, person)
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
    const kind = getDayKindForPerson(sod, personBookings, person)
    if (kind === 'approvedFull' || kind === 'approvedHalf') {
      const b = getBookingForDay(sod, personBookings, 'approved')
      if (b) setChangeSlot(b.timeSlot)
    } else {
      setBookSlot('FULL DAY')
    }
  }

  const bookLeave = async () => {
    if (!organization?.id || !user || !selectedDay) return
    setSaving(true)
    try {
      await saveBooking(organization.id, {
        id: newHolidayId(),
        organizationId: organization.id,
        userId: person.userId,
        operativeId: person.operativeId,
        startDate: selectedDay,
        endDate: selectedDay,
        status: 'approved',
        timeSlot: bookSlot,
        approvedByUserId: user.id,
        approvedAt: new Date(),
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-bold text-slate-900">{person.displayName}</p>
        <p className="text-sm text-slate-500">{person.subtitle}</p>
        {person.tradeLabel && (
          <span className="mt-2 inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {person.tradeLabel}
          </span>
        )}
      </div>

      <AnnualLeaveLegend />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <LeaveDayCalendar
          month={month}
          onMonthChange={setMonth}
          getDayKind={(day) => getDayKindForPerson(day, personBookings, person)}
          selectedDay={selectedDay}
          onDayClick={handleDayClick}
          disableLocked={false}
        />
      </div>

      {selectedDay && selectedKind === 'none' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✓ {message}
        </div>
      )}
    </div>
  )
}

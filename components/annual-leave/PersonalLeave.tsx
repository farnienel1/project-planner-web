'use client'

import { useMemo, useState } from 'react'
import { endOfMonth, format, isSameDay, startOfDay } from 'date-fns'
import { newHolidayId } from '@/lib/stores/holidayStore'
import { getBookingForDay, getDayKindForBookings } from '@/lib/annualLeave/dayStatus'
import { computeCarriedForwardDays } from '@/lib/annualLeave/carryOver'
import {
  bookingDayCount,
  daysLabel,
  formatLeaveDate,
  formatLeaveRange,
  leaveDayUnits,
} from '@/lib/annualLeave/formatLeaveDays'
import { useOrgBankHolidays } from '@/components/annual-leave/useOrgBankHolidays'
import type { HolidayBooking, HolidayTimeSlot, User } from '@/types'
import { AnnualLeaveLegend, LeaveDayCalendar } from './LeaveDayCalendar'

type DayPick = { day: Date; slot: HolidayTimeSlot }

function leaveYearRange(user: User | null) {
  const now = new Date()
  const startMonth = (user?.annualLeaveYearStartMonth ?? 1) - 1
  let year = now.getFullYear()
  if (now.getMonth() < startMonth) year -= 1
  const start = new Date(year, startMonth, 1)
  const endMonth = user?.annualLeaveYearEndMonth ?? 12
  const endYear = endMonth <= startMonth ? year + 1 : year
  return { start, end: endOfMonth(new Date(endYear, endMonth - 1, 1)) }
}

function allowanceForUser(user: User | null): number {
  if (user?.annualLeaveDaysPerYear && user.annualLeaveDaysPerYear > 0) return user.annualLeaveDaysPerYear
  return 28
}

function LeaveSummary({
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
  const remaining = allowance + (carriedForward ?? 0) - taken - pending
  const totalAllowance = allowance + (carriedForward ?? 0)
  const used = Math.max(0, taken + pending)
  const ratio = totalAllowance > 0 ? Math.min(1, used / totalAllowance) : 0
  const circumference = 2 * Math.PI * 28

  return (
    <div className="rounded-2xl border border-slate-200 bg-[var(--card)] p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">
        {format(leaveYearStart, 'MMM yyyy')} – {format(leaveYearEnd, 'MMM yyyy')}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0" aria-hidden>
          <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" className="text-slate-200" strokeWidth="8" />
          <circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            stroke="currentColor"
            className="text-emerald-500"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Days remaining</p>
          <p className={`text-3xl font-bold leading-none ${remaining < 0 ? 'text-[var(--red)]' : 'text-slate-900'}`}>
            {remaining < 0
              ? `${formatLeaveCount(remaining)} ${Math.abs(remaining) === 1 ? 'day' : 'days'} over`
              : formatLeaveCount(remaining)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Tile label="Taken" value={formatLeaveCount(taken)} />
        <Tile label="Awaiting approval" value={formatLeaveCount(pending)} />
        <Tile label="Allowance" value={formatLeaveCount(totalAllowance)} />
      </div>
      {carriedForward ? (
        <p className="mt-2 text-[11px] text-slate-500">Includes {formatLeaveCount(carriedForward)} carried forward</p>
      ) : null}
    </div>
  )
}

function formatLeaveCount(days: number): string {
  const negative = days < 0
  const text = daysLabel(Math.abs(days)).replace(/ days?$/, '')
  return negative ? `−${text}` : text
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

export function PersonalLeave({
  mode,
  myBookings,
  organization,
  user,
  saveBooking,
  deleteBooking,
  requestCancellation,
}: {
  mode: 'operative' | 'manager'
  myBookings: HolidayBooking[]
  organization: { id: string } | null
  user: User | null
  saveBooking: (orgId: string, booking: HolidayBooking) => Promise<void>
  deleteBooking?: (orgId: string, id: string) => Promise<void>
  requestCancellation?: (orgId: string, booking: HolidayBooking, userId: string) => Promise<void>
}) {
  const [month, setMonth] = useState(() => new Date())
  const [picks, setPicks] = useState<DayPick[]>([])
  const [editDay, setEditDay] = useState<Date | null>(null)
  const [changeSlot, setChangeSlot] = useState<HolidayTimeSlot>('FULL DAY')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    body: string
    confirmLabel: string
    run: () => Promise<void>
  } | null>(null)

  const leaveYear = leaveYearRange(user)
  const bank = useOrgBankHolidays(leaveYear.start, leaveYear.end)
  const allowance = allowanceForUser(user)
  const approved = myBookings.filter((booking) => booking.status === 'approved')
  const awaiting = myBookings.filter((booking) => booking.status === 'pending' || booking.cancellationRequestedAt)
  const taken = approved.reduce((sum, booking) => sum + bookingDayCount(booking), 0)
  const pending = myBookings
    .filter((booking) => booking.status === 'pending')
    .reduce((sum, booking) => sum + bookingDayCount(booking), 0)
  const carriedForward = computeCarriedForwardDays({
    carriesOver: user?.annualLeaveCarriesOver === true,
    allowance,
    startMonth: user?.annualLeaveYearStartMonth ?? 1,
    endMonth: user?.annualLeaveYearEndMonth ?? 12,
    bookings: myBookings,
  })
  const remaining = allowance + (carriedForward ?? 0) - taken - pending
  const selectedUnits = picks.reduce((sum, pick) => sum + leaveDayUnits(pick.slot), 0)
  const remainingAfter = remaining - selectedUnits
  const editBooking = editDay ? getBookingForDay(editDay, myBookings, 'approved') : null

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date())
    return myBookings
      .filter((booking) => booking.status !== 'rejected' && startOfDay(booking.endDate) >= today)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }, [myBookings])

  const grouped = useMemo(() => {
    const groups = new Map<string, HolidayBooking[]>()
    for (const booking of upcoming) {
      const key = format(booking.startDate, 'MMMM yyyy')
      groups.set(key, [...(groups.get(key) || []), booking])
    }
    return Array.from(groups.entries())
  }, [upcoming])

  const flash = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }

  const toggleDay = (day: Date) => {
    const holiday = bank.nameOn(day)
    if (holiday) {
      setNotice(`${holiday} is a bank holiday. It cannot be booked as annual leave, and it does not come out of your allowance.`)
      return
    }
    const kind = getDayKindForBookings(day, myBookings)
    if (kind !== 'none') {
      if (mode === 'manager' && (kind === 'approvedFull' || kind === 'approvedHalf')) {
        setEditDay(day)
        const approvedBooking = getBookingForDay(day, myBookings, 'approved')
        if (approvedBooking) setChangeSlot(approvedBooking.timeSlot)
        setNotice(null)
        return
      }
      setNotice('This day is already booked.')
      return
    }
    setEditDay(null)
    setNotice(null)
    setPicks((current) =>
      current.some((pick) => isSameDay(pick.day, day))
        ? current.filter((pick) => !isSameDay(pick.day, day))
        : [...current, { day, slot: 'FULL DAY' }].sort((a, b) => a.day.getTime() - b.day.getTime())
    )
  }

  const submit = async () => {
    if (!organization?.id || !user || picks.length === 0) return
    setSaving(true)
    try {
      for (const pick of picks) {
        await saveBooking(organization.id, {
          id: newHolidayId(),
          organizationId: organization.id,
          userId: user.id,
          startDate: pick.day,
          endDate: pick.day,
          status: mode === 'manager' ? 'approved' : 'pending',
          timeSlot: pick.slot,
          approvedByUserId: mode === 'manager' ? user.id : undefined,
          approvedAt: mode === 'manager' ? new Date() : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      flash(
        mode === 'manager'
          ? `${daysLabel(selectedUnits)} booked.`
          : `Holiday request submitted for ${daysLabel(selectedUnits)}.`
      )
      setPicks([])
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Could not save that leave.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <LeaveSummary
        allowance={allowance}
        taken={taken}
        pending={pending}
        carriedForward={carriedForward}
        leaveYearStart={leaveYear.start}
        leaveYearEnd={leaveYear.end}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Book time off</h2>
          <p className="text-sm text-slate-500">
            Tap a day to add it. Set each day to a full day, morning, or afternoon.
          </p>
        </div>
        <div className="card pad">
          <LeaveDayCalendar
            month={month}
            onMonthChange={setMonth}
            getDayKind={(day) => getDayKindForBookings(day, myBookings)}
            selectedDays={picks.map((pick) => pick.day)}
            onDayClick={toggleDay}
            bankHolidayName={bank.nameOn}
            onBankHoliday={(name) =>
              setNotice(`${name} is a bank holiday. It cannot be booked as annual leave, and it does not come out of your allowance.`)
            }
          />
          <div className="mt-3">
            <AnnualLeaveLegend />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{bank.sentence}</p>
        </div>

        {picks.length > 0 ? (
          <div className={`rounded-2xl border p-3 ${remainingAfter < 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-800">{daysLabel(selectedUnits)} selected</span>
              <span className={remainingAfter < 0 ? 'font-semibold text-[var(--red)]' : 'text-slate-600'}>
                Remaining after {formatLeaveCount(remainingAfter)}
              </span>
            </div>
            {remainingAfter < 0 ? (
              <p className="mb-2 text-xs text-[var(--red)]">
                This request is over the allowance. You can still send it, and a manager can allow it.
              </p>
            ) : null}
            <div className="space-y-2">
              {picks.map((pick) => (
                <div key={pick.day.toISOString()} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-2 py-2">
                  <p className="text-sm font-semibold text-slate-800">{formatLeaveDate(pick.day)}</p>
                  <div className="flex items-center gap-1">
                    {(['FULL DAY', 'AM', 'PM'] as HolidayTimeSlot[]).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() =>
                          setPicks((current) =>
                            current.map((row) => (isSameDay(row.day, pick.day) ? { ...row, slot } : row))
                          )
                        }
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                          pick.slot === slot ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {slot === 'FULL DAY' ? 'Full' : slot}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="px-2 text-xs font-semibold text-slate-500"
                      onClick={() => setPicks((current) => current.filter((row) => !isSameDay(row.day, pick.day)))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="mt-3 w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : mode === 'manager' ? 'Confirm booking' : 'Submit request'}
            </button>
          </div>
        ) : null}

        {notice ? <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">{notice}</p> : null}
        {editBooking && mode === 'manager' ? (
          <div className="card pad">
            <p className="text-sm font-bold text-slate-900">Change approved booking</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatLeaveDate(editBooking.startDate)} · currently {editBooking.timeSlot}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['FULL DAY', 'AM', 'PM'] as HolidayTimeSlot[]).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setChangeSlot(slot)}
                  className={`rounded-xl border py-2 text-sm font-semibold ${
                    changeSlot === slot ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {slot === 'FULL DAY' ? 'Full day' : slot}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={saving || changeSlot === editBooking.timeSlot}
              onClick={() =>
                setConfirm({
                  title: 'Change this booking?',
                  body: `${formatLeaveDate(editBooking.startDate)} becomes ${changeSlot}.`,
                  confirmLabel: 'Save change',
                  run: async () => {
                    if (!organization?.id) return
                    await saveBooking(organization.id, { ...editBooking, timeSlot: changeSlot, updatedAt: new Date() })
                    setEditDay(null)
                    flash('Annual leave booking updated.')
                  },
                })
              }
              className="mt-3 w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              Save change
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Upcoming leave</h2>
        {grouped.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            Approved and pending leave from today onward shows here, grouped by month.
          </p>
        ) : (
          grouped.map(([label, rows]) => (
            <div key={label} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {label} · {daysLabel(rows.reduce((sum, booking) => sum + bookingDayCount(booking), 0))}
              </p>
              {rows.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onCancel={
                    mode === 'operative' && booking.status === 'approved' && !booking.cancellationRequestedAt && requestCancellation
                      ? () =>
                          setConfirm({
                            title: 'Request cancellation?',
                            body: 'Your manager needs to approve before this leave is removed.',
                            confirmLabel: 'Request cancellation',
                            run: async () => {
                              if (!organization?.id || !user) return
                              await requestCancellation(organization.id, booking, user.id)
                              flash('Cancellation request sent to your manager.')
                            },
                          })
                      : undefined
                  }
                  onDelete={
                    mode === 'manager' && deleteBooking
                      ? () =>
                          setConfirm({
                            title: 'Remove this booking?',
                            body: formatLeaveRange(booking),
                            confirmLabel: 'Remove',
                            run: async () => {
                              if (!organization?.id) return
                              await deleteBooking(organization.id, booking.id)
                              flash('Annual leave removed.')
                            },
                          })
                      : undefined
                  }
                />
              ))}
            </div>
          ))
        )}
      </section>

      {mode === 'operative' ? (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Your requests</h2>
          <p className="text-sm text-slate-500">These are your own requests waiting on a manager, including cancellations.</p>
          {awaiting.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
              Nothing is waiting. A request you send, or a cancellation you ask for, will show here until it is decided.
            </p>
          ) : (
            awaiting.map((booking) => <BookingCard key={booking.id} booking={booking} />)
          )}
        </section>
      ) : null}

      {toast ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {toast}
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-base font-bold text-slate-900">{confirm.title}</p>
            <p className="mt-1 text-sm text-slate-600">{confirm.body}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold" onClick={() => setConfirm(null)}>
                Keep it
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--red)] py-2.5 text-sm font-bold text-white"
                onClick={() => {
                  const job = confirm.run
                  setConfirm(null)
                  setSaving(true)
                  void job().finally(() => setSaving(false))
                }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function BookingCard({
  booking,
  onCancel,
  onDelete,
}: {
  booking: HolidayBooking
  onCancel?: () => void
  onDelete?: () => void
}) {
  const cancelling = booking.cancellationRequestedAt != null
  const label = cancelling ? 'Cancellation pending' : booking.status === 'approved' ? 'Approved' : booking.status === 'pending' ? 'Awaiting approval' : 'Rejected'
  return (
    <div className="card pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{formatLeaveRange(booking)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{booking.timeSlot}</p>
          <p className={`mt-0.5 text-xs font-semibold ${cancelling || booking.status === 'pending' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {label}
          </p>
        </div>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-slate-600">
            Request cancellation
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" onClick={onDelete} className="text-xs font-semibold text-[var(--red)]">
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}

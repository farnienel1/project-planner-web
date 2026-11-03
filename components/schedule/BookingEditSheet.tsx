'use client'

import { useMemo, useState } from 'react'
import { useBookingConflictGate, type BookingSlotConflictCheck } from '@/components/scheduling/BookingConflictRows'
import type { Booking } from '@/types'
import { slotToFirestore, type ScheduleSlotChoice } from '@/lib/scheduling/scheduleUtils'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { hoursBreakdown } from '@/lib/scheduling/paidHours'
import { HoursBreakdownCard } from '@/components/schedule/HoursBreakdownCard'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { confirmCustomHoursBreak, customHoursPrefillForDate, slotOfferedOnDate, weekendNotesForDates } from '@/lib/scheduling/bookingSlotRules'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'

const SLOT_OPTIONS: { value: ScheduleSlotChoice; label: string }[] = [
  { value: 'AM', label: 'Morning (AM)' },
  { value: 'PM', label: 'Afternoon (PM)' },
  { value: 'FULL DAY', label: 'Full day' },
  { value: 'CUSTOM', label: 'Custom hours' },
]

function firestoreSlotToChoice(slot: string): ScheduleSlotChoice {
  const s = (slot || '').toUpperCase().replace(/_/g, ' ')
  if (s === 'AM' || s.includes('MORNING')) return 'AM'
  if (s === 'PM' || s.includes('AFTERNOON')) return 'PM'
  if (s.includes('FULL')) return 'FULL DAY'
  if (s.includes('CUSTOM')) return 'CUSTOM'
  return 'FULL DAY'
}

export function BookingEditSheet({
  booking,
  operativeName,
  projectName,
  onSave,
  onDelete,
  onCancelBooking,
  onClose,
  saving,
  payroll = DEFAULT_PAYROLL_POLICY,
  conflictsFor,
}: {
  booking: Booking
  operativeName: string
  projectName: string
  onSave: (updates: Partial<Booking>) => Promise<void>
  /**
   * Deleting a labour booking is admin only (rulebook §2, §16): leave it out for managers and pass
   * `onCancelBooking` instead.
   */
  onDelete?: () => Promise<void>
  /** Sets the booking to Cancelled: what a manager does instead of deleting. */
  onCancelBooking?: () => Promise<void>
  onClose: () => void
  saving?: boolean
  payroll?: OrgPayrollTimePolicy
  /** Rulebook 1.16.0: annual leave (and double bookings) on the day for this slot, asked before saving. */
  conflictsFor?: BookingSlotConflictCheck
}) {
  const conflictGate = useBookingConflictGate()
  // Rulebook 1.17.0 §4.3: the live organisation document, so the weekend note, prefill and break check read the
  // working hours in effect on the booking day (`effectivePayrollTimePolicy` in bookingSlotRules).
  useOrganizationDocument()
  const [slot, setSlot] = useState<ScheduleSlotChoice>(firestoreSlotToChoice(String(booking.timeSlot)))
  // Rulebook 1.13.0 (Q2): a weekend day opens custom hours with that day's window (`weekendCustomHoursDefault`).
  const prefill = customHoursPrefillForDate(booking.date, payroll)
  const [workStartTime, setWorkStartTime] = useState(booking.workStartTime || prefill.start)
  const [workEndTime, setWorkEndTime] = useState(booking.workEndTime || prefill.end)
  const [breakRemoved, setBreakRemoved] = useState(booking.isBreakRemoved === true)
  const [notes, setNotes] = useState(booking.notes || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const breakdown = useMemo(() => {
    const firestoreSlot = slotToFirestore({ date: new Date(booking.date), slot, workStartTime, workEndTime })
    return hoursBreakdown({
      timeSlot: firestoreSlot.timeSlot,
      workStartTime: slot === 'CUSTOM' ? firestoreSlot.workStartTime || workStartTime : undefined,
      workEndTime: slot === 'CUSTOM' ? firestoreSlot.workEndTime || workEndTime : undefined,
      isBreakRemoved: slot === 'CUSTOM' ? breakRemoved : undefined,
      policy: payroll,
      date: new Date(booking.date),
    })
  }, [booking.date, slot, workStartTime, workEndTime, breakRemoved, payroll])

  // Rulebook 1.13.0 (Q2): Saturday and Sunday are custom hours only; a stored weekend FULL DAY / AM / PM is kept and shown.
  const storedChoice = firestoreSlotToChoice(String(booking.timeSlot))
  const slotOptions = SLOT_OPTIONS.filter((opt) => slotOfferedOnDate(opt.value, booking.date, payroll, storedChoice))
  const weekendNotes = weekendNotesForDates([booking.date], payroll)

  const handleSave = async () => {
    setError(null)
    // 1.13.0 lunch warning (`customHoursBreakWarning`).
    if (
      slot === 'CUSTOM' &&
      !confirmCustomHoursBreak(payroll, booking.date, { timeSlot: 'CUSTOM_HOURS', workStartTime, workEndTime, isBreakRemoved: breakRemoved })
    ) {
      return
    }
    const checkedSlot = slotToFirestore({ date: new Date(booking.date), slot, workStartTime, workEndTime })
    // 1.16.0 (§5): tick to book anyway, or ✕ to drop the day — dropping the only day saves nothing.
    // An edit asks only when it moves the booking's time (a notes-only save of a booking already on leave does not).
    const slotChanged =
      checkedSlot.timeSlot !== String(booking.timeSlot) ||
      (checkedSlot.workStartTime || '') !== (booking.workStartTime || '') ||
      (checkedSlot.workEndTime || '') !== (booking.workEndTime || '')
    const isNew = !booking.id
    const dropped = await conflictGate.check(conflictsFor && (slotChanged || isNew) ? conflictsFor(checkedSlot) : [])
    if (dropped === null) return
    if (dropped.size > 0) {
      onClose()
      return
    }
    try {
      const firestoreSlot = slotToFirestore({ date: new Date(booking.date), slot, workStartTime, workEndTime })
      await onSave({
        timeSlot: firestoreSlot.timeSlot,
        workStartTime: firestoreSlot.workStartTime,
        workEndTime: firestoreSlot.workEndTime,
        isBreakRemoved: slot === 'CUSTOM' ? breakRemoved : false,
        notes,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save booking')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setError(null)
    try {
      if (onDelete) await onDelete()
      else if (onCancelBooking) await onCancelBooking()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : onDelete ? 'Failed to delete booking' : 'Failed to cancel booking')
    }
  }
  const removeLabel = onDelete ? 'delete booking' : 'cancel booking'
  const showRemove = Boolean(onDelete || onCancelBooking)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      {conflictGate.dialog}
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Edit booking</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{projectName}</p>
              <p className="text-sm text-slate-500">{operativeName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Time slot</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as ScheduleSlotChoice)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {slotOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {weekendNotes.map((note) => (
              <p key={note} className="mt-1 text-xs text-slate-500">
                {note}
              </p>
            ))}
          </div>

          {slot === 'CUSTOM' && (
            <HoursTimelinePicker
              start={workStartTime}
              end={workEndTime}
              breakRemoved={breakRemoved}
              policy={payroll}
              date={new Date(booking.date)}
              showBreak
              onStart={setWorkStartTime}
              onEnd={setWorkEndTime}
              onBreak={setBreakRemoved}
            />
          )}

          <HoursBreakdownCard breakdown={breakdown} />

          {booking.source !== 'manager' ? (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {showRemove ? (
            <button
              type="button"
              disabled={saving}
              onClick={handleDelete}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                confirmDelete
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              } disabled:opacity-50`}
            >
              {confirmDelete ? `Confirm ${removeLabel}` : removeLabel.charAt(0).toUpperCase() + removeLabel.slice(1)}
            </button>
          ) : null}
          {showRemove && confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {onDelete ? 'Cancel delete' : 'Keep booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import type { Booking } from '@/types'
import { slotToFirestore, type ScheduleSlotChoice } from '@/lib/scheduling/scheduleUtils'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { hoursBreakdown } from '@/lib/scheduling/paidHours'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'

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
  onClose,
  saving,
}: {
  booking: Booking
  operativeName: string
  projectName: string
  onSave: (updates: Partial<Booking>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  saving?: boolean
}) {
  const [slot, setSlot] = useState<ScheduleSlotChoice>(firestoreSlotToChoice(String(booking.timeSlot)))
  const [workStartTime, setWorkStartTime] = useState(booking.workStartTime || DEFAULT_PAYROLL_POLICY.standardDayStart)
  const [workEndTime, setWorkEndTime] = useState(booking.workEndTime || DEFAULT_PAYROLL_POLICY.standardDayEnd)
  const [breakRemoved, setBreakRemoved] = useState(booking.isBreakRemoved === true)
  const [status, setStatus] = useState(String(booking.status || 'Confirmed'))
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
      unpaidBreakMinutes: DEFAULT_PAYROLL_POLICY.unpaidBreakMinutes,
      standardPaidHours: DEFAULT_PAYROLL_POLICY.standardPaidHours,
      standardDayStart: DEFAULT_PAYROLL_POLICY.standardDayStart,
      standardDayEnd: DEFAULT_PAYROLL_POLICY.standardDayEnd,
      overtimeMultiplier: DEFAULT_PAYROLL_POLICY.weekdayOutsideStandardMultiplier,
    })
  }, [booking.date, slot, workStartTime, workEndTime, breakRemoved])

  const handleSave = async () => {
    setError(null)
    try {
      const firestoreSlot = slotToFirestore({ date: new Date(booking.date), slot, workStartTime, workEndTime })
      await onSave({
        timeSlot: firestoreSlot.timeSlot,
        workStartTime: firestoreSlot.workStartTime,
        workEndTime: firestoreSlot.workEndTime,
        isBreakRemoved: slot === 'CUSTOM' ? breakRemoved : false,
        status,
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
      await onDelete()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete booking')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
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
              {SLOT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {slot === 'CUSTOM' && (
            <HoursTimelinePicker
              start={workStartTime}
              end={workEndTime}
              breakRemoved={breakRemoved}
              showBreak
              onStart={setWorkStartTime}
              onEnd={setWorkEndTime}
              onBreak={setBreakRemoved}
            />
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hours breakdown</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{breakdown.headline}</p>
            <p className="mt-0.5 text-xs text-slate-500">{breakdown.detail}</p>
            {slot === 'CUSTOM' && breakdown.overtimeEquation ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-800">
                Overtime {breakdown.overtimeEquation}
              </p>
            ) : null}
            {slot === 'CUSTOM' && !breakdown.overtimeEquation ? (
              <p className="mt-2 text-xs text-slate-400">
                {workStartTime}–{workEndTime}
                {breakRemoved
                  ? ' · unpaid break removed'
                  : ` · ${DEFAULT_PAYROLL_POLICY.unpaidBreakMinutes} min unpaid break when it overlaps`}
              </p>
            ) : null}
          </div>

          {booking.source !== 'manager' ? (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="Confirmed">Confirmed</option>
              <option value="Tentative">Tentative</option>
            </select>
          </div>
          ) : null}

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
            {confirmDelete ? 'Confirm delete booking' : 'Delete booking'}
          </button>
          {confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

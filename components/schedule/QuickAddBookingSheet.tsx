'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { slotToFirestore, type ScheduleSlotChoice } from '@/lib/scheduling/scheduleUtils'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { hoursBreakdown } from '@/lib/scheduling/paidHours'
import { HoursBreakdownCard } from '@/components/schedule/HoursBreakdownCard'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { formatClockMinutes, halfDayWindows } from '@/lib/canonical'

export type QuickAddBookingValues = {
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved: boolean
  notes: string
}

/**
 * Quick Add from an empty box on the week overview.
 * Same fields as Edit booking, with the slot list ordered Full day, AM, PM, Custom.
 * The AM and PM clock ranges shown in the dropdown come from the shared rulebook.
 */
export function QuickAddBookingSheet({
  personName,
  roleLabel,
  projectName,
  date,
  existingToday = [],
  showNotes = true,
  saving,
  payroll = DEFAULT_PAYROLL_POLICY,
  onSave,
  onClose,
}: {
  personName: string
  roleLabel?: string
  projectName: string
  date: Date
  /** Other bookings this person already has on the day, for an at-a-glance clash hint. */
  existingToday?: string[]
  showNotes?: boolean
  saving?: boolean
  payroll?: OrgPayrollTimePolicy
  onSave: (values: QuickAddBookingValues) => Promise<void>
  onClose: () => void
}) {
  const [slot, setSlot] = useState<ScheduleSlotChoice>('FULL DAY')
  const [workStartTime, setWorkStartTime] = useState(payroll.standardDayStart)
  const [workEndTime, setWorkEndTime] = useState(payroll.standardDayEnd)
  const [breakRemoved, setBreakRemoved] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const halves = useMemo(() => halfDayWindows(payroll), [payroll])
  const range = (interval: { start: number; end: number }) =>
    `${formatClockMinutes(interval.start)}–${formatClockMinutes(interval.end)}`

  const slotOptions: { value: ScheduleSlotChoice; label: string }[] = [
    { value: 'FULL DAY', label: `Full day (${range(halves.day)})` },
    { value: 'AM', label: `AM (${range(halves.am)})` },
    { value: 'PM', label: `PM (${range(halves.pm)})` },
    { value: 'CUSTOM', label: 'Custom hours' },
  ]

  const breakdown = useMemo(() => {
    const firestoreSlot = slotToFirestore({ date, slot, workStartTime, workEndTime })
    return hoursBreakdown({
      timeSlot: firestoreSlot.timeSlot,
      workStartTime: slot === 'CUSTOM' ? firestoreSlot.workStartTime || workStartTime : undefined,
      workEndTime: slot === 'CUSTOM' ? firestoreSlot.workEndTime || workEndTime : undefined,
      isBreakRemoved: slot === 'CUSTOM' ? breakRemoved : undefined,
      unpaidBreakMinutes: payroll.unpaidBreakMinutes,
      breakWindowStart: payroll.breakWindowStart,
      breakWindowEnd: payroll.breakWindowEnd,
      standardPaidHours: payroll.standardPaidHours,
      standardDayStart: payroll.standardDayStart,
      standardDayEnd: payroll.standardDayEnd,
      overtimeMultiplier: payroll.weekdayOutsideStandardMultiplier,
    })
  }, [date, slot, workStartTime, workEndTime, breakRemoved, payroll])

  const handleSave = async () => {
    setError(null)
    try {
      const firestoreSlot = slotToFirestore({ date, slot, workStartTime, workEndTime })
      await onSave({
        timeSlot: firestoreSlot.timeSlot,
        workStartTime: firestoreSlot.workStartTime,
        workEndTime: firestoreSlot.workEndTime,
        isBreakRemoved: slot === 'CUSTOM' ? breakRemoved : false,
        notes: notes.trim(),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add booking')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quick add booking</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{projectName}</p>
              <p className="text-sm text-slate-500">
                {personName}
                {roleLabel ? ` · ${roleLabel}` : ''} · {format(date, 'EEE d MMM yyyy')}
              </p>
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
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

          {existingToday.length > 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Already booked this day: {existingToday.join(' · ')}. Overlapping hours will show as a clash.
            </p>
          ) : null}

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
          </div>

          {slot === 'CUSTOM' && (
            <HoursTimelinePicker
              start={workStartTime}
              end={workEndTime}
              breakRemoved={breakRemoved}
              policy={payroll}
              showBreak
              onStart={setWorkStartTime}
              onEnd={setWorkEndTime}
              onBreak={setBreakRemoved}
            />
          )}

          <HoursBreakdownCard breakdown={breakdown} />

          {showNotes ? (
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
            {saving ? 'Adding…' : 'Add booking'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

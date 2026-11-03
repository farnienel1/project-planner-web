'use client'

import {
  bookingDayKey,
  confirmCustomHoursBreak,
  policyForBookingDate,
  customHoursPrefillForDate,
  isWeekendDate,
  slotOfferedOnDate,
  weekendBreakdownForDates,
  weekendNotesForDates,
} from '@/lib/scheduling/bookingSlotRules'
import { useMemo, useState } from 'react'
import { useBookingConflictGate, type BookingSlotConflictCheck } from '@/components/scheduling/BookingConflictRows'
import { format } from 'date-fns'
import { slotToFirestore, type ScheduleSlotChoice } from '@/lib/scheduling/scheduleUtils'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { hoursBreakdown } from '@/lib/scheduling/paidHours'
import { HoursBreakdownCard } from '@/components/schedule/HoursBreakdownCard'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { formatClockMinutes, halfDayWindows } from '@/lib/canonical'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'

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
  showNotes = true,
  saving,
  payroll = DEFAULT_PAYROLL_POLICY,
  onSave,
  onClose,
  conflictsFor,
}: {
  personName: string
  roleLabel?: string
  projectName: string
  date: Date
  showNotes?: boolean
  saving?: boolean
  payroll?: OrgPayrollTimePolicy
  onSave: (values: QuickAddBookingValues) => Promise<void>
  onClose: () => void
  /** Rulebook 1.16.0: annual leave (and double bookings) on the day for this slot, asked before saving. */
  conflictsFor?: BookingSlotConflictCheck
}) {
  const conflictGate = useBookingConflictGate()
  // Rulebook 1.17.0 §4.3: the live organisation document, so the weekend note, prefill and break check read the
  // working hours in effect on the booking day (`effectivePayrollTimePolicy` in bookingSlotRules).
  useOrganizationDocument()
  // Rulebook 1.13.0 (Q2): Saturday and Sunday are custom hours only, opened with that day's window when it has one.
  const weekendDay = isWeekendDate(date)
  const prefill = customHoursPrefillForDate(date, payroll)
  const [slot, setSlot] = useState<ScheduleSlotChoice>(weekendDay ? 'CUSTOM' : 'FULL DAY')
  const [workStartTime, setWorkStartTime] = useState(prefill.start)
  const [workEndTime, setWorkEndTime] = useState(prefill.end)
  const [breakRemoved, setBreakRemoved] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Rulebook 1.19.0: the slot times and hours preview use the working hours in effect on the booking day.
  const dayPayroll = policyForBookingDate(date, payroll) ?? payroll
  const halves = useMemo(() => halfDayWindows(dayPayroll), [dayPayroll])
  const range = (interval: { start: number; end: number }) =>
    `${formatClockMinutes(interval.start)}–${formatClockMinutes(interval.end)}`

  // Rulebook 1.13.0 (Q2, `allowedTimeSlotsOnDay`): Saturday and Sunday offer Custom hours only.
  const weekendNotes = weekendNotesForDates([date], payroll)
  const slotOptions: { value: ScheduleSlotChoice; label: string }[] = (
    [
      { value: 'FULL DAY', label: `Full day (${range(halves.day)})` },
      { value: 'AM', label: `AM (${range(halves.am)})` },
      { value: 'PM', label: `PM (${range(halves.pm)})` },
      { value: 'CUSTOM', label: 'Custom hours' },
    ] as { value: ScheduleSlotChoice; label: string }[]
  ).filter((opt) => slotOfferedOnDate(opt.value, date, payroll))

  const breakdown = useMemo(() => {
    const firestoreSlot = slotToFirestore({ date, slot, workStartTime, workEndTime })
    return hoursBreakdown({
      timeSlot: firestoreSlot.timeSlot,
      workStartTime: slot === 'CUSTOM' ? firestoreSlot.workStartTime || workStartTime : undefined,
      workEndTime: slot === 'CUSTOM' ? firestoreSlot.workEndTime || workEndTime : undefined,
      isBreakRemoved: slot === 'CUSTOM' ? breakRemoved : undefined,
      policy: dayPayroll,
      dayKey: bookingDayKey(date),
    })
  }, [date, slot, workStartTime, workEndTime, breakRemoved, dayPayroll])

  const handleSave = async () => {
    setError(null)
    // 1.13.0 lunch warning (`customHoursBreakWarning`).
    if (
      slot === 'CUSTOM' &&
      !confirmCustomHoursBreak(payroll, date, { timeSlot: 'CUSTOM_HOURS', workStartTime, workEndTime, isBreakRemoved: breakRemoved })
    ) {
      return
    }
    const checkedSlot = slotToFirestore({ date, slot, workStartTime, workEndTime })
    // 1.16.0 (§5): tick to book anyway, or ✕ to drop the day — dropping the only day saves nothing.
    const dropped = await conflictGate.check(conflictsFor ? conflictsFor(checkedSlot) : [])
    if (dropped === null) return
    if (dropped.size > 0) {
      onClose()
      return
    }
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
      {conflictGate.dialog}
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
              date={date}
              showBreak
              onStart={setWorkStartTime}
              onEnd={setWorkEndTime}
              onBreak={setBreakRemoved}
            />
          )}

          <HoursBreakdownCard
            breakdown={breakdown}
            dayRows={slot === 'CUSTOM' ? weekendBreakdownForDates([date], workStartTime, workEndTime, breakRemoved, payroll) : []}
          />

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

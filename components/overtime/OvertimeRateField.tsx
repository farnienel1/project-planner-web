'use client'

/**
 * Rulebook 1.29.0 §25: Edit Booking's "Overtime rate" — "Organisation (×1.5)" or "Custom ×__" (1–3 in 0.25 steps),
 * shown on a custom-hours booking that has overtime (`overtimeRateControl`). The value is the booking's
 * `otMultiplierOverride`; null is the organisation's rate. Shown only to people who may edit the booking.
 */
import { useMemo } from 'react'
import { overtimeRateControl } from '@/lib/canonical'
import { useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'

export function OvertimeRateField({
  dayKey,
  timeSlot,
  workStartTime,
  workEndTime,
  isBreakRemoved,
  value,
  onChange,
}: {
  dayKey: string
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  value: number | null
  onChange: (next: number | null) => void
}) {
  const { data } = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const control = useMemo(
    () =>
      overtimeRateControl({
        booking: {
          id: 'edit',
          personId: '',
          dayKey,
          timeSlot,
          workStartTime: workStartTime ?? null,
          workEndTime: workEndTime ?? null,
          isBreakRemoved: isBreakRemoved === true,
          otMultiplierOverride: value,
        },
        organization: data ?? {},
        timeZone,
      }),
    [data, dayKey, timeSlot, workStartTime, workEndTime, isBreakRemoved, value, timeZone]
  )
  if (!control.show && value == null) return null
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="overtime-rate">
        Overtime rate
      </label>
      <select
        id="overtime-rate"
        value={value == null ? 'org' : String(value)}
        onChange={(e) => onChange(e.target.value === 'org' ? null : Number(e.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="org">{control.organizationLabel}</option>
        {control.steps.map((step) => (
          <option key={step} value={String(step)}>
            Custom ×{step}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-500">Prices this booking&apos;s overtime hours only. Signed timesheets keep their figures.</p>
    </div>
  )
}

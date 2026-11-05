'use client'

/**
 * Rulebook 1.29.0 §25: Edit Booking's "Overtime rate" — "Organisation (×1.5)" or "Custom ×__" (1–3 in 0.25 steps),
 * shown on a custom-hours booking that has overtime (`overtimeRateControl`). The value is the booking's
 * `otMultiplierOverride`; null is the organisation's rate. Shown only to people who may edit the booking.
 */
import { useMemo } from 'react'
import { overtimeMultiplierCreateFields, overtimeRateControl, overtimeRateCreateControl } from '@/lib/canonical'
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

/**
 * Rulebook 1.32.0 §25 (owner decision A): the overtime rate on a custom-hours **create** screen, pre-filled with the
 * organisation's rate for that day (`overtimeRateCreateControl`). `value` null means "left at the organisation's
 * rate"; the save passes `overtimeMultiplierCreateFields({ chosen, organizationMultiplier })`, which stores
 * `otMultiplierOverride` only when the person changed it.
 */
export function CreateOvertimeRateField({
  dayKey,
  value,
  onChange,
}: {
  dayKey: string
  value: number | null
  onChange: (next: number | null) => void
}) {
  const { data } = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const control = useMemo(() => overtimeRateCreateControl({ organization: data ?? {}, dayKey, timeZone }), [data, dayKey, timeZone])
  const shown = value ?? control.prefill
  return (
    <label className="block text-[13px] font-semibold text-[var(--ink2)]">
      Overtime rate
      <select
        className="input mt-1 w-full"
        value={String(shown)}
        onChange={(e) => {
          const next = Number(e.target.value)
          onChange(Math.abs(next - control.organizationMultiplier) < 1e-9 ? null : next)
        }}
      >
        {control.options.map((option) => (
          <option key={option.value} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-[12px] font-normal text-[var(--ink3)]">Applies to the hours outside the working day.</span>
    </label>
  )
}

/** The fields a create screen adds for the rate chosen in `CreateOvertimeRateField` (empty when left at the organisation's). */
export function useCreateOvertimeRateFields(dayKey: string, value: number | null): { otMultiplierOverride?: number } {
  const { data } = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  return useMemo(() => {
    const control = overtimeRateCreateControl({ organization: data ?? {}, dayKey, timeZone })
    return overtimeMultiplierCreateFields({ chosen: value ?? control.prefill, organizationMultiplier: control.organizationMultiplier })
  }, [data, dayKey, timeZone, value])
}

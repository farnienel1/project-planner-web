'use client'

import { FormInput, FormLabel } from '@/components/forms/FormShell'
import {
  SetupCard,
  SetupNote,
  SetupSectionLabel,
  SetupSegmentedControl,
} from '@/components/setup/setupFormPrimitives'
import {
  buildWeekdayTimeline,
  formatTime12h,
} from '@/lib/setup/workingHoursUtils'
import type { OrgPayrollTimePolicy, WeekendPayrollSettings } from '@/lib/settings/organizationSettings'

const SEGMENT_COLORS = {
  work: 'bg-blue-500',
  break: 'bg-amber-400',
  overtime: 'bg-orange-400',
}

function StepperRow({
  label,
  value,
  onDecrement,
  onIncrement,
  formatValue,
}: {
  label: string
  value: number
  onDecrement: () => void
  onIncrement: () => void
  formatValue?: (v: number) => string
}) {
  const display = formatValue ? formatValue(value) : String(value)
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrement}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-sm font-bold text-blue-600">{display}</span>
        <button
          type="button"
          onClick={onIncrement}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50"
        >
          +
        </button>
      </div>
    </div>
  )
}

function WorkingHoursSummaryBar({ policy }: { policy: OrgPayrollTimePolicy }) {
  const { rangeLabel, segments } = buildWeekdayTimeline({
    dayStart: policy.standardDayStart,
    dayEnd: policy.standardDayEnd,
    breakStart: policy.breakWindowStart,
    breakEnd: policy.breakWindowEnd,
  })

  const weekendLabel = (day: WeekendPayrollSettings, name: string) =>
    day.allHoursAtMultiplierMode
      ? `${name}: all hours ×${day.allHoursMultiplier.toFixed(1)}`
      : `${name}: defined window (outside ×${policy.weekdayOutsideStandardMultiplier.toFixed(1)})`

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Working hours summary</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">
        Mon–Fri {rangeLabel} · {policy.unpaidBreakMinutes} min break · {policy.standardPaidHours.toFixed(1)} paid hrs · OT ×
        {policy.weekdayOutsideStandardMultiplier.toFixed(1)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {weekendLabel(policy.saturday, 'Sat')} · {weekendLabel(policy.sunday, 'Sun')}
      </p>
      {segments.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>{formatTime12h(policy.standardDayStart)}</span>
            <span>Mon–Fri day</span>
            <span>{formatTime12h(policy.standardDayEnd)}</span>
          </div>
          <div className="relative h-8 overflow-hidden rounded-lg bg-slate-200">
            {segments.map((seg, i) => (
              <div
                key={i}
                className={`absolute top-0 h-full ${SEGMENT_COLORS[seg.kind]}`}
                style={{ left: `${seg.startPct}%`, width: `${seg.widthPct}%` }}
                title={seg.kind === 'break' ? 'Unpaid break' : 'Paid work'}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Paid work
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Unpaid break
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-orange-400" /> Outside window (OT)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function WeekendSection({
  dayLabel,
  settings,
  weekdayMultiplier,
  onChange,
}: {
  dayLabel: string
  settings: WeekendPayrollSettings
  weekdayMultiplier: number
  onChange: (next: WeekendPayrollSettings) => void
}) {
  const mode = settings.allHoursAtMultiplierMode ? 'all_hours' : 'defined_window'

  return (
    <SetupCard>
      <div className="space-y-4 p-4">
        <SetupSectionLabel>{dayLabel}</SetupSectionLabel>

        <SetupSegmentedControl
          value={mode}
          onChange={(v) =>
            onChange({ ...settings, allHoursAtMultiplierMode: v === 'all_hours' })
          }
          options={[
            { value: 'defined_window', label: 'Defined window' },
            { value: 'all_hours', label: 'All hours × multiplier' },
          ]}
        />

        {mode === 'defined_window' ? (
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Defined window, counts as standard</p>
            <p className="text-xs leading-relaxed text-slate-500">
              Hours inside your Mon–Fri standard day window count at the normal rate. Time{' '}
              <strong>outside</strong> this window on {dayLabel} is paid at ×{weekdayMultiplier.toFixed(1)}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-500">
              Every hour worked on {dayLabel} is paid at the multiplier below — regardless of the standard day window.
            </p>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">Hours × multiplier</span>
              <input
                type="number"
                step={0.5}
                min={1}
                max={3}
                value={settings.allHoursMultiplier}
                onChange={(e) =>
                  onChange({ ...settings, allHoursMultiplier: parseFloat(e.target.value) || 1 })
                }
                className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-blue-600 outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </SetupCard>
  )
}

type WorkingHoursSetupSectionProps = {
  value: OrgPayrollTimePolicy
  onChange: (value: OrgPayrollTimePolicy) => void
}

export function WorkingHoursSetupSection({ value, onChange }: WorkingHoursSetupSectionProps) {
  function patch(partial: Partial<OrgPayrollTimePolicy>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-4">
      <SetupNote tone="blue">
        Use the below settings to customise your Organisation&apos;s working hours. Set the start and end time for
        Mon-Fri and then Weekends. This will allow you to tailor any overtime agreements, which will be taken into
        account for timesheets, invoices and generating reports.
      </SetupNote>

      <WorkingHoursSummaryBar policy={value} />

      <SetupCard>
        <div className="space-y-4 p-4">
          <SetupSectionLabel>Standard day (Mon–Fri reference)</SetupSectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>Start time</FormLabel>
              <FormInput
                type="time"
                value={value.standardDayStart}
                onChange={(e) => patch({ standardDayStart: e.target.value })}
              />
            </div>
            <div>
              <FormLabel>End time</FormLabel>
              <FormInput
                type="time"
                value={value.standardDayEnd}
                onChange={(e) => patch({ standardDayEnd: e.target.value })}
              />
            </div>
          </div>

          <StepperRow
            label={`Unpaid break: ${value.unpaidBreakMinutes} min`}
            value={value.unpaidBreakMinutes}
            onDecrement={() => patch({ unpaidBreakMinutes: Math.max(0, value.unpaidBreakMinutes - 5) })}
            onIncrement={() => patch({ unpaidBreakMinutes: value.unpaidBreakMinutes + 5 })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>Break window start</FormLabel>
              <FormInput
                type="time"
                value={value.breakWindowStart}
                onChange={(e) => patch({ breakWindowStart: e.target.value })}
              />
            </div>
            <div>
              <FormLabel>Break window end</FormLabel>
              <FormInput
                type="time"
                value={value.breakWindowEnd}
                onChange={(e) => patch({ breakWindowEnd: e.target.value })}
              />
            </div>
          </div>

          <StepperRow
            label={`Standard paid hours (full day): ${value.standardPaidHours.toFixed(1)}`}
            value={value.standardPaidHours}
            onDecrement={() => patch({ standardPaidHours: Math.max(0, value.standardPaidHours - 0.5) })}
            onIncrement={() => patch({ standardPaidHours: value.standardPaidHours + 0.5 })}
            formatValue={(v) => v.toFixed(1)}
          />

          <p className="text-xs text-slate-400">
            Clock times use 24h format (e.g. 07:30). Mon–Fri hours outside this window are treated as overtime at the
            weekday multiplier below.
          </p>
        </div>
      </SetupCard>

      <SetupCard>
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Weekday OT (outside standard window)</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Applies Monday–Friday to time worked outside the standard day window.
            </p>
          </div>
          <input
            type="number"
            step={0.5}
            min={1}
            max={3}
            value={value.weekdayOutsideStandardMultiplier}
            onChange={(e) =>
              patch({ weekdayOutsideStandardMultiplier: parseFloat(e.target.value) || 1 })
            }
            className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm font-bold text-blue-600 outline-none"
          />
        </div>
      </SetupCard>

      <WeekendSection
        dayLabel="Saturday"
        settings={value.saturday}
        weekdayMultiplier={value.weekdayOutsideStandardMultiplier}
        onChange={(saturday) => patch({ saturday })}
      />

      <WeekendSection
        dayLabel="Sunday"
        settings={value.sunday}
        weekdayMultiplier={value.weekdayOutsideStandardMultiplier}
        onChange={(sunday) => patch({ sunday })}
      />
    </div>
  )
}

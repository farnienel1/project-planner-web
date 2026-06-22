'use client'

import { FormInput, FormLabel } from '@/components/forms/FormShell'
import {
  SetupCard,
  SetupNote,
  SetupSectionLabel,
  SetupSegmentedControl,
  SetupToggle,
} from '@/components/setup/setupFormPrimitives'
import {
  buildWeekdayTimeline,
  computeSpanHours,
  computeStandardPaidHours,
  effectiveWeekendSettings,
  formatTime12h,
  weekendHoursLabel,
  withSyncedPayrollPolicy,
} from '@/lib/setup/workingHoursUtils'
import type { OrgPayrollTimePolicy, WeekendPayrollSettings } from '@/lib/settings/organizationSettings'

const SEGMENT_COLORS = {
  work: 'bg-blue-500',
  break: 'bg-amber-400',
  overtime: 'bg-orange-400',
}

function StepperRow({
  label,
  onDecrement,
  onIncrement,
}: {
  label: string
  onDecrement: () => void
  onIncrement: () => void
}) {
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

function WeekAtAGlance({ policy }: { policy: OrgPayrollTimePolicy }) {
  const paidHours = computeStandardPaidHours(
    policy.standardDayStart,
    policy.standardDayEnd,
    policy.unpaidBreakMinutes
  )
  const sat = effectiveWeekendSettings('saturday', policy)
  const sun = effectiveWeekendSettings('sunday', policy)

  const rows = [
    {
      dot: 'bg-blue-500',
      label: 'Mon–Fri',
      value: `${formatTime12h(policy.standardDayStart)} – ${formatTime12h(policy.standardDayEnd)} · ${paidHours}h`,
    },
    {
      dot: 'bg-yellow-400',
      label: 'Saturday',
      value: weekendHoursLabel(sat, policy.weekdayOutsideStandardMultiplier),
    },
    {
      dot: 'bg-orange-500',
      label: 'Sunday',
      value: policy.sunday.sameAsSaturday
        ? 'Same as Saturday'
        : weekendHoursLabel(sun, policy.weekdayOutsideStandardMultiplier),
    },
  ]

  return (
    <SetupCard>
      <div className="space-y-3 p-4">
        <SetupSectionLabel>Week at a glance</SetupSectionLabel>
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${row.dot}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
              <p className="text-xs text-slate-500">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    </SetupCard>
  )
}

function MonFriPaidDayInfographic({ policy }: { policy: OrgPayrollTimePolicy }) {
  const spanHours = computeSpanHours(policy.standardDayStart, policy.standardDayEnd)
  const paidHours = computeStandardPaidHours(
    policy.standardDayStart,
    policy.standardDayEnd,
    policy.unpaidBreakMinutes
  )
  const breakHours = Math.round((policy.unpaidBreakMinutes / 60) * 10) / 10

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-violet-500">Mon–Fri paid day</p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between text-violet-900">
          <span>Span ({formatTime12h(policy.standardDayStart)} to {formatTime12h(policy.standardDayEnd)})</span>
          <span className="font-bold">{spanHours}h</span>
        </div>
        <div className="flex items-center justify-between text-violet-700">
          <span>Less unpaid break</span>
          <span className="font-bold">− {breakHours}h</span>
        </div>
        <div className="border-t border-violet-200 pt-2 flex items-center justify-between text-violet-950">
          <span className="font-semibold">Standard paid day</span>
          <span className="text-lg font-extrabold">{paidHours}h</span>
        </div>
      </div>
    </div>
  )
}

function WeekendSection({
  dayKey,
  dayLabel,
  policy,
  onChange,
}: {
  dayKey: 'saturday' | 'sunday'
  dayLabel: string
  policy: OrgPayrollTimePolicy
  onChange: (next: OrgPayrollTimePolicy) => void
}) {
  const settings = policy[dayKey]
  const isSunday = dayKey === 'sunday'
  const effective = effectiveWeekendSettings(dayKey, policy)
  const mode = effective.allHoursAtMultiplierMode ? 'all_hours' : 'defined_window'
  const disabled = isSunday && settings.sameAsSaturday

  function patchWeekend(partial: Partial<WeekendPayrollSettings>) {
    const nextDay = { ...settings, ...partial }
    let nextPolicy = { ...policy, [dayKey]: nextDay }

    if (isSunday && partial.sameAsSaturday === true) {
      nextPolicy = {
        ...nextPolicy,
        sunday: {
          ...policy.saturday,
          sameAsSaturday: true,
        },
      }
    }

    onChange(nextPolicy)
  }

  return (
    <SetupCard>
      <div className="space-y-4 p-4">
        <SetupSectionLabel>{dayLabel}</SetupSectionLabel>

        {isSunday && (
          <SetupToggle
            label="Same setup as Saturday"
            description="Use Saturday's defined window and multiplier settings for Sunday."
            checked={settings.sameAsSaturday === true}
            onChange={(sameAsSaturday) => patchWeekend({ sameAsSaturday })}
          />
        )}

        {!disabled && (
          <>
            <SetupSegmentedControl
              value={mode}
              onChange={(v) =>
                patchWeekend({
                  allHoursAtMultiplierMode: v === 'all_hours',
                  definedWindowStart:
                    effective.definedWindowStart ?? policy.standardDayStart,
                  definedWindowEnd: effective.definedWindowEnd ?? policy.standardDayEnd,
                  countsAsStandardHours:
                    effective.countsAsStandardHours ?? policy.standardPaidHours,
                  outsideWindowMultiplier:
                    effective.outsideWindowMultiplier ?? policy.weekdayOutsideStandardMultiplier,
                })
              }
              options={[
                { value: 'defined_window', label: 'Defined window' },
                { value: 'all_hours', label: 'All hours × multiplier' },
              ]}
            />

            {mode === 'defined_window' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormLabel>Window start</FormLabel>
                    <FormInput
                      type="time"
                      value={effective.definedWindowStart ?? policy.standardDayStart}
                      onChange={(e) => patchWeekend({ definedWindowStart: e.target.value })}
                    />
                  </div>
                  <div>
                    <FormLabel>Window end</FormLabel>
                    <FormInput
                      type="time"
                      value={effective.definedWindowEnd ?? policy.standardDayEnd}
                      onChange={(e) => patchWeekend({ definedWindowEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Counts as</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Standard hours inside the defined window</span>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={24}
                      value={effective.countsAsStandardHours ?? 8}
                      onChange={(e) =>
                        patchWeekend({ countsAsStandardHours: parseFloat(e.target.value) || 0 })
                      }
                      className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-blue-600 outline-none"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Outside window × multiplier</p>
                      <p className="text-xs text-slate-500">Hours outside the defined window on {dayLabel}</p>
                    </div>
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      max={3}
                      value={effective.outsideWindowMultiplier ?? policy.weekdayOutsideStandardMultiplier}
                      onChange={(e) =>
                        patchWeekend({
                          outsideWindowMultiplier: parseFloat(e.target.value) || 1,
                        })
                      }
                      className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-blue-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Hours × multiplier</span>
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  max={3}
                  value={effective.allHoursMultiplier}
                  onChange={(e) =>
                    patchWeekend({ allHoursMultiplier: parseFloat(e.target.value) || 1 })
                  }
                  className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-blue-600 outline-none"
                />
              </div>
            )}
          </>
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
    onChange(withSyncedPayrollPolicy(partial, value))
  }

  const paidHours = computeStandardPaidHours(
    value.standardDayStart,
    value.standardDayEnd,
    value.unpaidBreakMinutes
  )

  const { segments } = buildWeekdayTimeline({
    dayStart: value.standardDayStart,
    dayEnd: value.standardDayEnd,
    breakStart: value.breakWindowStart,
    unpaidBreakMinutes: value.unpaidBreakMinutes,
  })

  return (
    <div className="space-y-4">
      <SetupNote tone="blue">
        Use the below settings to customise your Organisation&apos;s working hours. Set the start and end time for
        Mon-Fri and then Weekends. This will allow you to tailor any overtime agreements, which will be taken into
        account for timesheets, invoices and generating reports.
      </SetupNote>

      <WeekAtAGlance policy={value} />

      <SetupCard>
        <div className="space-y-4 p-4">
          <SetupSectionLabel>Mon–Fri standard day &amp; weekday OT</SetupSectionLabel>

          <p className="text-sm font-semibold text-slate-900">
            Mon–Fri {formatTime12h(value.standardDayStart)} – {formatTime12h(value.standardDayEnd)} ·{' '}
            {value.unpaidBreakMinutes} min break · {paidHours}h paid · OT ×
            {value.weekdayOutsideStandardMultiplier.toFixed(1)}
          </p>

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
                readOnly
                className="bg-slate-50 text-slate-500"
              />
            </div>
          </div>

          {segments.length > 0 && (
            <div>
              <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>{formatTime12h(value.standardDayStart)}</span>
                <span>Mon–Fri day</span>
                <span>{formatTime12h(value.standardDayEnd)}</span>
              </div>
              <div className="relative h-8 overflow-hidden rounded-lg bg-slate-200">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 h-full ${SEGMENT_COLORS[seg.kind]}`}
                    style={{ left: `${seg.startPct}%`, width: `${seg.widthPct}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          <MonFriPaidDayInfographic policy={value} />

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Weekday OT (outside standard window)</p>
              <p className="text-xs text-slate-500">Monday–Friday time outside the standard day window.</p>
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
              className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-blue-600 outline-none"
            />
          </div>

          <p className="text-xs text-slate-400">
            Clock times use 24h format (e.g. 07:30). Paid hours are calculated from span minus unpaid break.
          </p>
        </div>
      </SetupCard>

      <WeekendSection
        dayKey="saturday"
        dayLabel="Saturday"
        policy={value}
        onChange={(next) => {
          if (next.sunday.sameAsSaturday) {
            onChange({
              ...next,
              sunday: { ...next.saturday, sameAsSaturday: true },
            })
            return
          }
          onChange(next)
        }}
      />
      <WeekendSection dayKey="sunday" dayLabel="Sunday" policy={value} onChange={onChange} />
    </div>
  )
}

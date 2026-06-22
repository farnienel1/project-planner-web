'use client'

import { FormSelect } from '@/components/forms/FormShell'
import {
  SetupCard,
  SetupNote,
  SetupSectionLabel,
  SetupToggle,
} from '@/components/setup/setupFormPrimitives'
import { DEFAULT_WARNING_DETECTION, type OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'

const SEVERITY_GUIDE = [
  {
    key: 'past',
    label: 'Past',
    description: 'Warnings for dates that have already passed.',
    badge: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    border: 'border-l-slate-300',
  },
  {
    key: 'today',
    label: 'Today',
    description: 'Requires immediate attention — clashes or issues happening today.',
    badge: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
    border: 'border-l-red-400',
  },
  {
    key: 'soon',
    label: 'Soon',
    description: 'Coming up within the next few days — plan ahead before they become urgent.',
    badge: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-l-amber-400',
  },
  {
    key: 'future',
    label: 'Upcoming',
    description: 'Further ahead in your detection window — visible but lower urgency.',
    badge: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-400',
    border: 'border-l-blue-300',
  },
] as const

type WarningsSetupSectionProps = {
  value: OrgWarningDetectionSettings
  onChange: (value: OrgWarningDetectionSettings) => void
}

export function WarningsSetupSection({ value, onChange }: WarningsSetupSectionProps) {
  const lookAheadMode = value.clashLookaheadMode === 'numberOfDays' ? 'days' : 'week'

  function patch(partial: Partial<OrgWarningDetectionSettings>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-4">
      <SetupNote tone="emerald">
        <strong>Why Warnings matter:</strong> Project Planner continuously scans your schedule for booking clashes,
        unbooked labour and material list issues. Catching these early prevents double-bookings on site and helps you
        spot when operatives are free — saving costly mis-allocation.
      </SetupNote>

      <SetupCard>
        <div className="space-y-4 p-4">
          <SetupSectionLabel>Warning detection</SetupSectionLabel>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs leading-relaxed text-slate-500">
              How far ahead should clashes, missed bookings and material lists be detected. It is set to End of the
              working week by default.
            </p>
          </div>

          <div>
            <SetupSectionLabel>Detection period</SetupSectionLabel>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-slate-900">Look ahead</span>
                <FormSelect
                  value={lookAheadMode}
                  onChange={(e) =>
                    patch({
                      clashLookaheadMode:
                        e.target.value === 'days' ? 'numberOfDays' : 'endOfWorkingWeek',
                    })
                  }
                  className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600"
                >
                  <option value="week">End of the working week</option>
                  <option value="days">Set number of days</option>
                </FormSelect>
              </div>
              {lookAheadMode === 'days' && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-700">Days ahead: {value.clashLookaheadDays}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          clashLookaheadDays: Math.max(1, value.clashLookaheadDays - 1),
                        })
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch({ clashLookaheadDays: value.clashLookaheadDays + 1 })
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Applies to clashes, unbooked labour, and material cut-off checks. Changing the look-ahead updates warnings
              immediately once your organisation is live.
            </p>
          </div>
        </div>
      </SetupCard>

      <SetupCard>
        <div className="space-y-3 p-4">
          <SetupSectionLabel>Exclude users from warnings</SetupSectionLabel>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-75">
            <div>
              <p className="text-sm font-semibold text-slate-900">Excluded users</p>
              <p className="text-xs text-slate-400">No users to exclude yet — add your team in the next step.</p>
            </div>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-500">0</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Use this feature to remove certain users such as PAYE staff from the warnings page so they will not show up
            when not booked in. You can manage exclusions in Settings after your team is set up.
          </p>
        </div>
      </SetupCard>

      <SetupCard>
        <div className="space-y-4 p-4">
          <SetupSectionLabel>Warning types</SetupSectionLabel>
          <SetupToggle
            label="Detect scheduling clashes"
            description="Alert when an operative is double-booked on the same day."
            checked={value.detectClashes}
            onChange={(detectClashes) => patch({ detectClashes })}
          />
          <div className="h-px bg-slate-100" />
          <SetupToggle
            label="Include weekends for unbooked labour detection"
            description="Only affects unbooked labour warnings."
            checked={value.includeWeekendsForUnbookedLabour}
            onChange={(includeWeekendsForUnbookedLabour) =>
              patch({ includeWeekendsForUnbookedLabour })
            }
          />
        </div>
      </SetupCard>

      <div>
        <SetupSectionLabel>Warning severity guide</SetupSectionLabel>
        <p className="mb-3 text-xs text-slate-400">
          Warnings are colour-coded by urgency so you can prioritise what needs action first.
        </p>
        <div className="space-y-2">
          {SEVERITY_GUIDE.map((item) => (
            <div
              key={item.key}
              className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm border-l-4 ${item.border}`}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                  {item.label}
                </span>
                <p className="text-xs leading-relaxed text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
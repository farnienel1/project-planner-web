'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  loadOrganizationDetails,
  savePayrollPolicy,
  DEFAULT_PAYROLL_POLICY,
  type OrgPayrollTimePolicy,
  type WeekendPayrollSettings,
} from '@/lib/settings/organizationSettings'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Toggle,
  Input,
  FormField,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

type WeekendKey = 'saturday' | 'sunday'

const HM_RE = /^\d{1,2}:\d{2}$/

function isValidHM(value: string): boolean {
  const trimmed = (value ?? '').trim()
  if (!HM_RE.test(trimmed)) return false
  const [hours, minutes] = trimmed.split(':').map((part) => parseInt(part, 10))
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
}

function minutesOf(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => parseInt(part, 10))
  return hours * 60 + minutes
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format = (v) => String(v),
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="text-sm text-slate-900">
        {label}: <span className="font-semibold">{format(value)}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Decrease"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  )
}

function MultiplierField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-900">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-400">×</span>
      </div>
    </div>
  )
}

export function WorkingHoursPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [draft, setDraft] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.payrollTimePolicy) setDraft(details.payrollTimePolicy)
      })
      .catch(() => {})
  }, [organization?.id])

  function patch(partial: Partial<OrgPayrollTimePolicy>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function patchWeekend(key: WeekendKey, partial: Partial<WeekendPayrollSettings>) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...partial } }))
  }

  function weekend(key: WeekendKey): WeekendPayrollSettings {
    return draft[key]
  }

  function validate(): string | null {
    for (const [field, label] of [
      ['standardDayStart', 'Standard day start'],
      ['standardDayEnd', 'Standard day end'],
      ['breakWindowStart', 'Break window start'],
      ['breakWindowEnd', 'Break window end'],
    ] as const) {
      if (!isValidHM(draft[field])) return `${label} must be a valid 24h time (e.g. 07:30).`
    }
    if (minutesOf(draft.standardDayEnd) <= minutesOf(draft.standardDayStart)) {
      return 'Standard day end must be after the start time.'
    }
    if (minutesOf(draft.breakWindowEnd) <= minutesOf(draft.breakWindowStart)) {
      return 'Break window end must be after the break start.'
    }
    const breakFrom = minutesOf(draft.breakWindowStart)
    const breakTo = minutesOf(draft.breakWindowEnd)
    const dayStart = minutesOf(draft.standardDayStart)
    const dayEnd = minutesOf(draft.standardDayEnd)
    if (breakFrom < dayStart || breakTo > dayEnd) {
      return 'Break window must fall within the working day.'
    }
    if (!(draft.standardPaidHours > 0)) return 'Standard paid hours must be greater than 0.'
    if (!(draft.weekdayOutsideStandardMultiplier > 0)) return 'Weekday OT multiplier must be greater than 0.'

    for (const key of ['saturday', 'sunday'] as WeekendKey[]) {
      const settings = weekend(key)
      const name = key === 'saturday' ? 'Saturday' : 'Sunday'
      if (!(settings.allHoursMultiplier > 0)) return `${name} multiplier must be greater than 0.`
      if (!settings.allHoursAtMultiplierMode) {
        if (!isValidHM(settings.definedWindowStart ?? '') || !isValidHM(settings.definedWindowEnd ?? '')) {
          return `${name} custom window must use valid 24h times.`
        }
        if (minutesOf(settings.definedWindowEnd ?? '') <= minutesOf(settings.definedWindowStart ?? '')) {
          return `${name} custom window end must be after the start.`
        }
        if (!(settings.outsideWindowMultiplier && settings.outsideWindowMultiplier > 0)) {
          return `${name} outside-window multiplier must be greater than 0.`
        }
      }
    }
    return null
  }

  async function save() {
    if (!organization?.id) return
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      await savePayrollPolicy(organization.id, draft)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save working hours.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <PanelHeader title="Working hours" onBack={onBack} />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {saved && (
        <div className="mt-4">
          <SuccessBanner message="Working hours saved" />
        </div>
      )}

      <SectionLabel label="Standard day (Mon–Fri reference)" />
      <SettingsCard>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start time">
              <Input value={draft.standardDayStart} placeholder="07:30" onChange={(e) => patch({ standardDayStart: e.target.value })} />
            </FormField>
            <FormField label="End time">
              <Input value={draft.standardDayEnd} placeholder="16:00" onChange={(e) => patch({ standardDayEnd: e.target.value })} />
            </FormField>
          </div>

          <Stepper
            label="Unpaid break"
            value={draft.unpaidBreakMinutes}
            onChange={(value) => patch({ unpaidBreakMinutes: value })}
            min={0}
            max={120}
            step={5}
            format={(value) => `${value} min`}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Break window start">
              <Input value={draft.breakWindowStart} placeholder="12:00" onChange={(e) => patch({ breakWindowStart: e.target.value })} />
            </FormField>
            <FormField label="Break window end">
              <Input value={draft.breakWindowEnd} placeholder="12:30" onChange={(e) => patch({ breakWindowEnd: e.target.value })} />
            </FormField>
          </div>

          <Stepper
            label="Standard paid hours (full day)"
            value={draft.standardPaidHours}
            onChange={(value) => patch({ standardPaidHours: value })}
            min={1}
            max={12}
            step={0.5}
            format={(value) => value.toFixed(1)}
          />

          <p className="text-xs text-slate-500">
            Clock times use 24h format (e.g. 07:30). Mon–Fri hours outside this window are treated as overtime at the
            weekday multiplier below.
          </p>
        </div>
      </SettingsCard>

      <SectionLabel label="Weekday overtime" />
      <SettingsCard>
        <div className="space-y-2 p-4">
          <MultiplierField
            label="Weekday OT (outside standard window)"
            value={draft.weekdayOutsideStandardMultiplier}
            onChange={(value) => patch({ weekdayOutsideStandardMultiplier: value })}
          />
          <p className="text-xs text-slate-500">Applies Monday–Friday to time worked outside the standard day window.</p>
        </div>
      </SettingsCard>

      {(['saturday', 'sunday'] as WeekendKey[]).map((key) => {
        const settings = weekend(key)
        const name = key === 'saturday' ? 'Saturday' : 'Sunday'
        const allMode = settings.allHoursAtMultiplierMode
        return (
          <div key={key}>
            <SectionLabel label={name} />
            <SettingsCard>
              <div className="space-y-4 p-4">
                {key === 'sunday' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-900">Same as Saturday</span>
                    <Toggle
                      checked={!!settings.sameAsSaturday}
                      onChange={(on) => {
                        if (on) {
                          patchWeekend('sunday', { ...draft.saturday, sameAsSaturday: true })
                        } else {
                          patchWeekend('sunday', { sameAsSaturday: false })
                        }
                      }}
                    />
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">All hours at multiplier</div>
                    {allMode && (
                      <p className="mt-1 text-xs text-slate-500">
                        All hours on {name} will be at the multiplier rate. Paid time still assumes a{' '}
                        {draft.unpaidBreakMinutes}-minute unpaid break unless removed on a booking.
                      </p>
                    )}
                  </div>
                  <Toggle
                    checked={allMode}
                    onChange={(on) => {
                      if (on) {
                        patchWeekend(key, { allHoursAtMultiplierMode: true })
                      } else {
                        patchWeekend(key, {
                          allHoursAtMultiplierMode: false,
                          definedWindowStart: settings.definedWindowStart ?? draft.standardDayStart,
                          definedWindowEnd: settings.definedWindowEnd ?? '13:00',
                        })
                      }
                    }}
                  />
                </div>

                <MultiplierField
                  label="Multiplier"
                  value={settings.allHoursMultiplier}
                  onChange={(value) => patchWeekend(key, { allHoursMultiplier: value })}
                />

                {!allMode && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Window start">
                        <Input
                          value={settings.definedWindowStart ?? ''}
                          placeholder="07:30"
                          onChange={(e) => patchWeekend(key, { definedWindowStart: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Window end">
                        <Input
                          value={settings.definedWindowEnd ?? ''}
                          placeholder="13:00"
                          onChange={(e) => patchWeekend(key, { definedWindowEnd: e.target.value })}
                        />
                      </FormField>
                    </div>
                    <MultiplierField
                      label="Outside window · multiplier"
                      value={settings.outsideWindowMultiplier ?? 1.5}
                      onChange={(value) => patchWeekend(key, { outsideWindowMultiplier: value })}
                    />
                  </>
                )}
              </div>
            </SettingsCard>
          </div>
        )
      })}

      <div className="mt-6">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

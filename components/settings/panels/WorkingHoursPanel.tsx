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
import { settingsHeader } from '@/lib/settings/settingsHeader'
import { settingsSaveBarHint } from '@/lib/settings/settingsDirty'
import {
  SettingsFormBody,
  useSettingsBaseline,
  useSettingsDirty,
  useSettingsLeave,
} from '@/components/settings/SettingsDirty'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Input,
  FormField,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
  ToggleRow,
  Segmented,
  Stepper,
  MultiplierInput,
  SaveBar,
} from '@/components/settings/primitives'

type WeekendKey = 'saturday' | 'sunday'
type WeekendMode = 'all' | 'window'

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

function TimeInput({ value, placeholder, onChange, label }: { value: string; placeholder: string; onChange: (value: string) => void; label: string }) {
  return (
    <Input
      value={value}
      placeholder={placeholder}
      inputMode="numeric"
      maxLength={5}
      aria-label={label}
      className="tabular-nums"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Visual of the Mon–Fri day: overtime either side, the standard window, and the unpaid break. */
function DayTimeline({ policy }: { policy: OrgPayrollTimePolicy }) {
  const valid =
    isValidHM(policy.standardDayStart) &&
    isValidHM(policy.standardDayEnd) &&
    isValidHM(policy.breakWindowStart) &&
    isValidHM(policy.breakWindowEnd) &&
    minutesOf(policy.standardDayEnd) > minutesOf(policy.standardDayStart)
  if (!valid) {
    return <p className="text-[13px] text-[var(--ink3)]">Enter valid 24h times to see the day.</p>
  }
  const from = 5 * 60
  const to = 21 * 60
  const span = to - from
  const pct = (minutes: number) => `${Math.min(100, Math.max(0, ((minutes - from) / span) * 100))}%`
  const dayStart = minutesOf(policy.standardDayStart)
  const dayEnd = minutesOf(policy.standardDayEnd)
  const breakStart = minutesOf(policy.breakWindowStart)
  const breakEnd = minutesOf(policy.breakWindowEnd)
  const width = (a: number, b: number) => `calc(${pct(b)} - ${pct(a)})`
  return (
    <div>
      <div className="relative h-9 overflow-hidden rounded-lg bg-[var(--warn-t)]" aria-hidden>
        <div className="absolute inset-y-0 rounded-md bg-[var(--blue)]" style={{ left: pct(dayStart), width: width(dayStart, dayEnd) }} />
        <div
          className="absolute inset-y-0 bg-[var(--card)] opacity-80"
          style={{ left: pct(breakStart), width: width(breakStart, breakEnd) }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] font-semibold tabular-nums text-[var(--ink3)]" aria-hidden>
        <span>05:00</span>
        <span>09:00</span>
        <span>13:00</span>
        <span>17:00</span>
        <span>21:00</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--ink2)]">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--blue)]" /> Standard day {policy.standardDayStart}–{policy.standardDayEnd}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--line2)]" /> Unpaid break {policy.unpaidBreakMinutes} min ({policy.breakWindowStart}–{policy.breakWindowEnd})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--warn)]" /> Overtime ×{policy.weekdayOutsideStandardMultiplier}
        </span>
      </div>
    </div>
  )
}

function weekendSummary(settings: WeekendPayrollSettings): string {
  if (settings.allHoursAtMultiplierMode) return `All hours at ×${settings.allHoursMultiplier}`
  return `${settings.definedWindowStart ?? '—'}–${settings.definedWindowEnd ?? '—'} standard, outside ×${settings.outsideWindowMultiplier ?? 1.5}`
}

export function WorkingHoursPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const requestLeave = useSettingsLeave()
  const [draft, setDraft] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const { state: loadState, markLoaded, markFailed, isDirty } = useSettingsBaseline<OrgPayrollTimePolicy>()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const header = settingsHeader('working-hours')
  const dirty = isDirty(draft)
  useSettingsDirty(dirty)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (!details?.payrollTimePolicy) {
          markFailed()
          return
        }
        setDraft(details.payrollTimePolicy)
        markLoaded(details.payrollTimePolicy)
      })
      .catch(() => markFailed())
  }, [organization?.id, markLoaded, markFailed])

  function patch(partial: Partial<OrgPayrollTimePolicy>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function patchWeekend(key: WeekendKey, partial: Partial<WeekendPayrollSettings>) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...partial } }))
  }

  function weekend(key: WeekendKey): WeekendPayrollSettings {
    return draft[key]
  }

  /** Same behaviour as the old "All hours at multiplier" switch. */
  function setWeekendMode(key: WeekendKey, mode: WeekendMode) {
    const settings = weekend(key)
    if (mode === 'all') {
      patchWeekend(key, { allHoursAtMultiplierMode: true })
    } else {
      patchWeekend(key, {
        allHoursAtMultiplierMode: false,
        definedWindowStart: settings.definedWindowStart ?? draft.standardDayStart,
        definedWindowEnd: settings.definedWindowEnd ?? '13:00',
      })
    }
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
      markLoaded(draft)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save working hours.')
    } finally {
      setSaving(false)
    }
  }

  function weekendFields(key: WeekendKey) {
    const settings = weekend(key)
    const name = key === 'saturday' ? 'Saturday' : 'Sunday'
    const mode: WeekendMode = settings.allHoursAtMultiplierMode ? 'all' : 'window'
    return (
      <div className="space-y-4">
        <Segmented<WeekendMode>
          ariaLabel={`${name} pay`}
          value={mode}
          onChange={(next) => setWeekendMode(key, next)}
          options={[
            { value: 'all', label: 'All hours at one rate' },
            { value: 'window', label: 'Standard window + overtime' },
          ]}
        />
        {mode === 'all' ? (
          <MultiplierInput
            label={`Rate for all ${name} hours`}
            hint={`Paid time still assumes a ${draft.unpaidBreakMinutes}-minute unpaid break unless it's removed on a booking.`}
            value={settings.allHoursMultiplier}
            onChange={(value) => patchWeekend(key, { allHoursMultiplier: value })}
          />
        ) : (
          <>
            <div className="[display:grid] grid-cols-2 gap-3">
              <FormField label="Window start">
                <TimeInput
                  label={`${name} window start`}
                  value={settings.definedWindowStart ?? ''}
                  placeholder="07:30"
                  onChange={(value) => patchWeekend(key, { definedWindowStart: value })}
                />
              </FormField>
              <FormField label="Window end">
                <TimeInput
                  label={`${name} window end`}
                  value={settings.definedWindowEnd ?? ''}
                  placeholder="13:00"
                  onChange={(value) => patchWeekend(key, { definedWindowEnd: value })}
                />
              </FormField>
            </div>
            <MultiplierInput
              label="Rate outside the window"
              hint="Hours inside the window count as standard hours."
              value={settings.outsideWindowMultiplier ?? 1.5}
              onChange={(value) => patchWeekend(key, { outsideWindowMultiplier: value })}
            />
          </>
        )}
      </div>
    )
  }

  const sunday = weekend('sunday')

  return (
    <div className="mx-auto max-w-3xl">
      <PanelHeader
        title={header.title}
        description="Your standard day, unpaid break and overtime rates. Timesheets and pay use these rules."
        iconPath={header.iconPath}
        hue={header.hue}
        onBack={() => requestLeave(onBack)}
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {saved && (
        <div className="mb-4">
          <SuccessBanner message="Working hours saved" />
        </div>
      )}

      <SettingsFormBody state={loadState}>
      <SettingsCard>
        <div className="p-5">
          <DayTimeline policy={draft} />
        </div>
      </SettingsCard>

      <SectionLabel label="Standard working day" description="Monday to Friday. Clock times use 24h format, e.g. 07:30." />
      <SettingsCard>
        <div className="[display:grid] grid-cols-2 gap-4 p-5">
          <FormField label="Start time">
            <TimeInput label="Start time" value={draft.standardDayStart} placeholder="07:30" onChange={(value) => patch({ standardDayStart: value })} />
          </FormField>
          <FormField label="End time">
            <TimeInput label="End time" value={draft.standardDayEnd} placeholder="16:00" onChange={(value) => patch({ standardDayEnd: value })} />
          </FormField>
        </div>
        <div className="p-5">
          <Stepper
            label="Standard paid hours"
            hint="Hours paid for a full day"
            value={draft.standardPaidHours}
            onChange={(value) => patch({ standardPaidHours: value })}
            min={1}
            max={12}
            step={0.5}
            format={(value) => `${value.toFixed(1)} h`}
          />
        </div>
      </SettingsCard>

      <SectionLabel label="Unpaid break" description="Taken off paid time on every booking unless removed." />
      <SettingsCard>
        <div className="p-5">
          <Stepper
            label="Break length"
            value={draft.unpaidBreakMinutes}
            onChange={(value) => patch({ unpaidBreakMinutes: value })}
            min={0}
            max={120}
            step={5}
            format={(value) => `${value} min`}
          />
        </div>
        <div className="[display:grid] grid-cols-2 gap-4 p-5">
          <FormField label="Break window start">
            <TimeInput label="Break window start" value={draft.breakWindowStart} placeholder="12:00" onChange={(value) => patch({ breakWindowStart: value })} />
          </FormField>
          <FormField label="Break window end">
            <TimeInput label="Break window end" value={draft.breakWindowEnd} placeholder="12:30" onChange={(value) => patch({ breakWindowEnd: value })} />
          </FormField>
        </div>
      </SettingsCard>

      <SectionLabel label="Weekday overtime" description="Monday to Friday hours worked outside the standard day." />
      <SettingsCard>
        <div className="p-5">
          <MultiplierInput
            label="Overtime rate"
            hint="e.g. 1.5 = time and a half"
            value={draft.weekdayOutsideStandardMultiplier}
            onChange={(value) => patch({ weekdayOutsideStandardMultiplier: value })}
          />
        </div>
      </SettingsCard>

      <SectionLabel label="Saturday" description={weekendSummary(weekend('saturday'))} />
      <SettingsCard>
        <div className="p-5">{weekendFields('saturday')}</div>
      </SettingsCard>

      <SectionLabel label="Sunday" description={sunday.sameAsSaturday ? 'Follows Saturday' : weekendSummary(sunday)} />
      <SettingsCard>
        <div className="p-5">
          <ToggleRow
            title="Same as Saturday"
            description={sunday.sameAsSaturday ? `Sunday uses Saturday's rules: ${weekendSummary(weekend('saturday'))}.` : 'Turn on to pay Sunday exactly like Saturday.'}
            checked={!!sunday.sameAsSaturday}
            onChange={(on) => {
              if (on) {
                patchWeekend('sunday', { ...draft.saturday, sameAsSaturday: true })
              } else {
                patchWeekend('sunday', { sameAsSaturday: false })
              }
            }}
          />
        </div>
        {!sunday.sameAsSaturday ? <div className="p-5">{weekendFields('sunday')}</div> : null}
      </SettingsCard>
      </SettingsFormBody>

      <SaveBar dirty={dirty} hint={settingsSaveBarHint(loadState)}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={save} />
      </SaveBar>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  cancelScheduledPayrollPolicyChange,
  savePayrollPolicy,
  schedulePayrollPolicyChange,
  organizationTodayKey,
  DEFAULT_PAYROLL_POLICY,
  type OrgPayrollTimePolicy,
  type WeekendPayrollSettings,
} from '@/lib/settings/organizationSettings'
import {
  PAYROLL_POLICY_LIMITS,
  formatPaymentRunDay,
  payrollTimePolicyScheduleDateError,
  validatePayrollTimePolicy,
  formatClockMinutes,
  weekendBreakFor,
  weekendLunchBreakCopy,
  weekdayPaidDayPreview,
  weekdayPaidHours,
  withDerivedWeekdayPaidHours,
  PAYROLL_POLICY_TIME_STEP_MINUTES,
  PAYROLL_BREAK_TIME_STEP_MINUTES,
  payrollPolicyTimeOnStep,
  payrollBreakTimeOnStep,
  weekendDayPreview,
} from '@/lib/canonical'
import { BookingDayBreakdownRows } from '@/components/scheduling/BookingDayBreakdownRows'
import { useApplyLiveWhenClean, useLiveOrganizationDetails } from '@/components/settings/useLiveOrganizationSettings'
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
  Select,
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

/** 1.20.3: a stepped break length lands on the 15-minute step (a length saved off it, e.g. 40, moves to 30 / 60). */
function snapBreakMinutes(value: number): number {
  return Math.round(value / PAYROLL_BREAK_TIME_STEP_MINUTES) * PAYROLL_BREAK_TIME_STEP_MINUTES
}

function stepTimes(step: number): string[] {
  return Array.from({ length: (24 * 60) / step }, (_, index) => formatClockMinutes(index * step))
}

/** 00:00, 00:30 … 23:30 — rulebook 1.20.2 `PAYROLL_POLICY_TIME_STEP_MINUTES` (day start and finish, weekend window). */
const DAY_STEP_TIMES = stepTimes(PAYROLL_POLICY_TIME_STEP_MINUTES)
/** 00:00, 00:15 … 23:45 — rulebook 1.20.3 `PAYROLL_BREAK_TIME_STEP_MINUTES` (lunch break start and end). */
const BREAK_STEP_TIMES = stepTimes(PAYROLL_BREAK_TIME_STEP_MINUTES)

/**
 * Rulebook 1.20.2 / 1.20.3 §4.3: day start and finish are picked in 30-minute steps (:00 / :30), lunch break start and
 * end in 15-minute steps (`kind="break"`, e.g. 10:45). A time saved before the step applied that is not on it is shown
 * as saved (and stays valid until it is changed).
 */
function TimeInput({
  value,
  placeholder,
  onChange,
  label,
  kind = 'day',
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  label: string
  kind?: 'day' | 'break'
}) {
  const current = (value ?? '').trim()
  const onStep = kind === 'break' ? payrollBreakTimeOnStep : payrollPolicyTimeOnStep
  const offStep = current !== '' && !onStep(current)
  const times = kind === 'break' ? BREAK_STEP_TIMES : DAY_STEP_TIMES
  return (
    <Select
      value={current}
      aria-label={label}
      className="tabular-nums"
      onChange={(e) => onChange(e.target.value)}
    >
      {current === '' ? <option value="">{placeholder}</option> : null}
      {offStep ? <option value={current}>{current} (saved)</option> : null}
      {times.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </Select>
  )
}

/**
 * Owner (3 Nov): one card per section with a dark navy header band (light and dark mode), so Mon–Fri, Saturday,
 * Sunday, Overtime and Scheduled changes read as separate blocks. Design tokens only (`--navy`, `--card`, `--line`).
 */
function HoursSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card mt-6 overflow-hidden first:mt-0" aria-label={title}>
      <div className="bg-[var(--navy)] px-5 py-3">
        <h2 className="text-[15.5px] font-bold leading-snug text-white">{title}</h2>
        {description ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/80">{description}</p> : null}
      </div>
      <div className="[&>*+*]:border-t [&>*+*]:border-[var(--line)]">{children}</div>
    </section>
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
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--line2)]" /> {policy.breakPaid ? 'Paid' : 'Unpaid'} break {policy.unpaidBreakMinutes} min ({policy.breakWindowStart}–{policy.breakWindowEnd})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--warn)]" /> Overtime ×{policy.weekdayOutsideStandardMultiplier}
        </span>
      </div>
    </div>
  )
}

/**
 * Rulebook 1.20.0 §4.3: the live calculation under Monday–Friday — "06:30–14:30 = 8h − 45 min unpaid break = 7h15m"
 * (`weekdayPaidDayPreview`). The paid day is derived; there is no paid-hours box.
 */
function WeekdayPaidDayLine({ policy }: { policy: OrgPayrollTimePolicy }) {
  const valid = isValidHM(policy.standardDayStart) && isValidHM(policy.standardDayEnd) && minutesOf(policy.standardDayEnd) > minutesOf(policy.standardDayStart)
  return (
    <div className="p-5">
      <p className="text-[14px] font-medium text-[var(--ink)]">Paid hours for a full day</p>
      <p
        className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-[17px] font-bold tabular-nums text-[var(--ink)]"
        data-testid="weekday-paid-day"
      >
        {valid ? weekdayPaidDayPreview(policy).line : 'Enter valid 24h times to see the paid day.'}
      </p>
      <p className="mt-1 text-[12px] text-[var(--ink3)]">Worked out from the start, finish and lunch break below.</p>
    </div>
  )
}

/**
 * Rulebook 1.19.0 / 1.20.3: the live calculation under Saturday / Sunday, as Monday–Friday has. Everything — the example
 * hours, the break (paid / unpaid, window, length, minutes taken off) and the paid hours — comes from the canonical
 * `weekendDayPreview(draft, day)` (`weekendBookingBreakdown` → `payrollHoursResult`), priced from the draft being edited,
 * so switching that day's break Paid / Unpaid or changing its length or times changes it at once. No figure is computed here.
 */
function WeekendDayPreview({ policy, day }: { policy: OrgPayrollTimePolicy; day: WeekendKey }) {
  const valid = isValidHM(policy.standardDayStart) && isValidHM(policy.standardDayEnd)
  const preview = valid ? weekendDayPreview(policy, day, 'Europe/London') : null
  if (!preview) return null
  const name = day === 'saturday' ? 'Saturday' : 'Sunday'
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-[var(--ink2)]" data-testid={`${day}-preview-summary`}>
        {preview.summary}
      </p>
      <BookingDayBreakdownRows rows={preview.rows} title={`${name} example · ${preview.start}–${preview.end}`} />
    </div>
  )
}

/** `YYYY-MM-DD` + 1 calendar day (date input minimum). */
function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}

function weekendSummary(settings: WeekendPayrollSettings): string {
  const lunch = settings.breakPaid === false ? ' · unpaid lunch' : ''
  if (settings.allHoursAtMultiplierMode) return `All hours at ×${settings.allHoursMultiplier}${lunch}`
  return `${settings.definedWindowStart ?? '—'}–${settings.definedWindowEnd ?? '—'} standard, outside ×${settings.outsideWindowMultiplier ?? 1.5}${lunch}`
}

type SaveChoice = 'closed' | 'choose' | 'schedule'

export function WorkingHoursPanel({ onBack }: { onBack: () => void }) {
  const { organization, user } = useAuthStore()
  const requestLeave = useSettingsLeave()
  const [draft, setDraft] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const { state: loadState, markLoaded, markFailed, isDirty } = useSettingsBaseline<OrgPayrollTimePolicy>()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedMessage, setSavedMessage] = useState('Working hours saved')
  const [error, setError] = useState('')
  const [saveChoice, setSaveChoice] = useState<SaveChoice>('closed')
  const [scheduleDate, setScheduleDate] = useState('')
  const header = settingsHeader('working-hours')
  const dirty = isDirty(draft)
  useSettingsDirty(dirty)

  const live = useLiveOrganizationDetails()
  // Rulebook 1.19.0: the organisation document the draft was taken from. Saves run in a transaction and are refused
  // when another admin changed the working hours since (`payrollTimePolicySaveConflict`).
  const baseDoc = useRef<Record<string, unknown> | null>(null)
  useEffect(() => {
    if (!dirty && live.data) baseDoc.current = live.data
  }, [dirty, live.data])
  const scheduled = live.details?.payrollTimePolicyScheduled ?? null
  const todayKey = organizationTodayKey(live.data)
  const apply = useCallback(
    (policy: OrgPayrollTimePolicy) => {
      setDraft(policy)
      markLoaded(policy)
    },
    [markLoaded]
  )
  useApplyLiveWhenClean({
    source: live.details?.payrollTimePolicy ?? null,
    status: live.status,
    dirty,
    apply,
    onFailed: markFailed,
  })

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

  function flashSaved(message: string) {
    setSavedMessage(message)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }

  function openSave() {
    if (!organization?.id) return
    // Rulebook 1.20.0 §4.3: the policy is saved with its weekday paid day derived (finish − start − unpaid break).
    // 1.20.2 / 1.20.3: day times on the 30-minute step, break times and length on the 15-minute step; a value saved off
    // its step passes until it is changed.
    const validationError = validatePayrollTimePolicy(withDerivedWeekdayPaidHours(draft), live.details?.payrollTimePolicy ?? null)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setScheduleDate('')
    setSaveChoice('choose')
  }

  async function applyNow() {
    if (!organization?.id) return
    setSaving(true)
    setError('')
    try {
      const savedPolicy = withDerivedWeekdayPaidHours(draft)
      await savePayrollPolicy(organization.id, savedPolicy, user?.id, baseDoc.current)
      setSaveChoice('closed')
      setDraft(savedPolicy)
      markLoaded(savedPolicy)
      flashSaved('Working hours saved — in effect from today')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save working hours.')
    } finally {
      setSaving(false)
    }
  }

  async function scheduleChange() {
    if (!organization?.id) return
    const dateError = payrollTimePolicyScheduleDateError(scheduleDate, todayKey)
    if (dateError) {
      setError(dateError)
      return
    }
    setSaving(true)
    setError('')
    try {
      await schedulePayrollPolicyChange(organization.id, draft, scheduleDate, user?.id, baseDoc.current)
      setSaveChoice('closed')
      // Today's rules are unchanged; the draft goes back to them and the live listener confirms.
      const today = live.details?.payrollTimePolicy ?? draft
      setDraft(today)
      markLoaded(today)
      flashSaved(`Change scheduled for ${formatPaymentRunDay(scheduleDate)}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not schedule the change.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelScheduled() {
    if (!organization?.id) return
    setSaving(true)
    setError('')
    try {
      await cancelScheduledPayrollPolicyChange(organization.id, user?.id, live.data)
      flashSaved('Scheduled change cancelled')
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel the scheduled change.')
    } finally {
      setSaving(false)
    }
  }

  function weekendFields(key: WeekendKey) {
    const settings = weekend(key)
    const name = key === 'saturday' ? 'Saturday' : 'Sunday'
    const mode: WeekendMode = settings.allHoursAtMultiplierMode ? 'all' : 'window'
    const lunch = weekendLunchBreakCopy(draft, key)
    const dayBreak = weekendBreakFor(draft, settings)
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
            hint={
              settings.breakPaid === false
                ? `Hours worked less the unpaid lunch break, all at this rate.`
                : `Every hour worked is paid at this rate.`
            }
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
        {/* Rulebook 1.19.0 §4.3: each weekend day's own lunch break — Paid / Unpaid, length, window — in both modes,
            prefilled from the weekday break (`weekendBreakFor`). */}
        <FormField label={lunch.title}>
          <Segmented<'paid' | 'unpaid'>
            ariaLabel={lunch.title}
            value={dayBreak.paid ? 'paid' : 'unpaid'}
            onChange={(value) => patchWeekend(key, { breakPaid: value === 'paid' })}
            options={[
              { value: 'paid', label: 'Paid' },
              { value: 'unpaid', label: 'Unpaid' },
            ]}
          />
          <p className="mt-1.5 text-[12.5px] text-[var(--ink3)]">{lunch.detail}</p>
        </FormField>
        <Stepper
          label={`${name} break length`}
          value={dayBreak.minutes}
          onChange={(value) => patchWeekend(key, { breakMinutes: snapBreakMinutes(value) })}
          min={PAYROLL_POLICY_LIMITS.breakMinutes.min}
          max={PAYROLL_POLICY_LIMITS.breakMinutes.max}
          step={PAYROLL_BREAK_TIME_STEP_MINUTES}
          format={(value) => `${value} min`}
        />
        <div className="[display:grid] grid-cols-2 gap-3">
          <FormField label="Break start">
            <TimeInput
              kind="break"
              label={`${name} break start`}
              value={dayBreak.start}
              placeholder={draft.breakWindowStart}
              onChange={(value) => patchWeekend(key, { breakWindowStart: value })}
            />
          </FormField>
          <FormField label="Break end">
            <TimeInput
              kind="break"
              label={`${name} break end`}
              value={dayBreak.end}
              placeholder={draft.breakWindowEnd}
              onChange={(value) => patchWeekend(key, { breakWindowEnd: value })}
            />
          </FormField>
        </div>
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
          <SuccessBanner message={savedMessage} />
        </div>
      )}
      <SettingsFormBody state={loadState}>
      <HoursSection title="Monday to Friday" description="Your standard day and lunch break. Start and finish are in 30-minute steps (e.g. 07:30); lunch break times and length in 15-minute steps (e.g. 10:45).">
        <div className="p-5">
          <DayTimeline policy={draft} />
        </div>
        <div className="[display:grid] grid-cols-2 gap-4 p-5">
          <FormField label="Start time">
            <TimeInput label="Start time" value={draft.standardDayStart} placeholder="07:30" onChange={(value) => patch({ standardDayStart: value })} />
          </FormField>
          <FormField label="End time">
            <TimeInput label="End time" value={draft.standardDayEnd} placeholder="16:00" onChange={(value) => patch({ standardDayEnd: value })} />
          </FormField>
        </div>
        {/* Rulebook 1.20.0 §4.3: no manual paid hours Monday–Friday — the day is start, finish and the lunch break. */}
        <WeekdayPaidDayLine policy={draft} />
        <div className="px-5 pt-4">
          <p className="text-[14px] font-semibold text-[var(--ink)]">Lunch break</p>
          <p className="text-[12.5px] text-[var(--ink3)]">
            {draft.breakPaid ? 'Paid — counts toward hours worked.' : 'Unpaid — taken off paid time on every booking unless removed.'}
          </p>
        </div>
        <div className="p-5">
          <Segmented<'unpaid' | 'paid'>
            ariaLabel="Lunch break pay"
            value={draft.breakPaid ? 'paid' : 'unpaid'}
            onChange={(value) => patch({ breakPaid: value === 'paid' })}
            options={[
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
        </div>
        <div className="p-5">
          <Stepper
            label="Break length"
            value={draft.unpaidBreakMinutes}
            onChange={(value) => patch({ unpaidBreakMinutes: snapBreakMinutes(value) })}
            min={PAYROLL_POLICY_LIMITS.breakMinutes.min}
            max={PAYROLL_POLICY_LIMITS.breakMinutes.max}
            step={PAYROLL_BREAK_TIME_STEP_MINUTES}
            format={(value) => `${value} min`}
          />
        </div>
        <div className="[display:grid] grid-cols-2 gap-4 p-5">
          <FormField label="Break window start">
            <TimeInput kind="break" label="Break window start" value={draft.breakWindowStart} placeholder="12:00" onChange={(value) => patch({ breakWindowStart: value })} />
          </FormField>
          <FormField label="Break window end">
            <TimeInput kind="break" label="Break window end" value={draft.breakWindowEnd} placeholder="12:30" onChange={(value) => patch({ breakWindowEnd: value })} />
          </FormField>
        </div>
      </HoursSection>

      <HoursSection title="Overtime" description="Monday to Friday hours worked outside the standard day.">
        <div className="p-5">
          <MultiplierInput
            label="Overtime rate"
            hint="e.g. 1.5 = time and a half"
            value={draft.weekdayOutsideStandardMultiplier}
            onChange={(value) => patch({ weekdayOutsideStandardMultiplier: value })}
          />
        </div>
      </HoursSection>

      <HoursSection title="Saturday" description={weekendSummary(weekend('saturday'))}>
        <div className="p-5">
          <WeekendDayPreview policy={draft} day="saturday" />
        </div>
        <div className="p-5">{weekendFields('saturday')}</div>
      </HoursSection>

      <HoursSection title="Sunday" description={sunday.sameAsSaturday ? 'Follows Saturday' : weekendSummary(sunday)}>
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
        <div className="p-5">
          <WeekendDayPreview policy={draft} day="sunday" />
        </div>
        {!sunday.sameAsSaturday ? <div className="p-5">{weekendFields('sunday')}</div> : null}
      </HoursSection>

      <HoursSection title="Scheduled changes" description="A change saved for a later date takes effect on that day.">
        {scheduled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-[14px] font-semibold text-[var(--ink)]">Scheduled change</p>
              <p className="text-[13px] text-[var(--ink2)]">
                New working hours take effect on {formatPaymentRunDay(scheduled.effectiveFrom)}:{' '}
                {scheduled.policy.standardDayStart}–{scheduled.policy.standardDayEnd}, {weekdayPaidHours(scheduled.policy)}h paid.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={cancelScheduled}
              className="rounded-xl px-3 py-2 text-[13px] font-semibold text-[var(--red)] hover:bg-[var(--soft)] disabled:opacity-50"
            >
              Cancel scheduled change
            </button>
          </div>
        ) : (
          <p className="p-5 text-[13px] text-[var(--ink3)]">
            No change scheduled. Press Save and choose a date to schedule one.
          </p>
        )}
      </HoursSection>
      </SettingsFormBody>

      <SaveBar dirty={dirty} hint={settingsSaveBarHint(loadState)}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={openSave} />
      </SaveBar>

      {saveChoice !== 'closed' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="working-hours-save-title"
            className="w-full max-w-md rounded-2xl bg-[var(--card)] p-5 shadow-xl"
          >
            <h2 id="working-hours-save-title" className="text-[17px] font-bold text-[var(--ink)]">
              {saveChoice === 'schedule' ? 'Schedule change' : 'When should this start?'}
            </h2>
            {saveChoice === 'choose' ? (
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink2)]">
                Apply from today and today&apos;s bookings use the new working hours — the weekly report, timesheets and
                invoices follow. Or schedule the change to start on a later date.
                {scheduled ? ` A change is already scheduled for ${formatPaymentRunDay(scheduled.effectiveFrom)}; applying today keeps it, scheduling replaces it.` : ''}
              </p>
            ) : (
              <div className="mt-3">
                <FormField label="New working hours start on">
                  <Input
                    type="date"
                    value={scheduleDate}
                    min={nextDayKey(todayKey)}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </FormField>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-[14px] font-semibold text-[var(--ink2)] hover:bg-[var(--soft)]"
                onClick={() => setSaveChoice(saveChoice === 'schedule' ? 'choose' : 'closed')}
                disabled={saving}
              >
                {saveChoice === 'schedule' ? 'Back' : 'Cancel'}
              </button>
              {saveChoice === 'choose' ? (
                <>
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--line2)] px-4 py-2 text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--soft)]"
                    onClick={() => setSaveChoice('schedule')}
                    disabled={saving}
                  >
                    Schedule from a date
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--blue)] px-4 py-2 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    onClick={applyNow}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Apply from today'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="rounded-xl bg-[var(--blue)] px-4 py-2 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  onClick={scheduleChange}
                  disabled={saving || !scheduleDate}
                >
                  {saving ? 'Saving…' : 'Schedule'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

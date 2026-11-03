'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  halfDayWindows,
  payrollBreakOnDay,
  payrollDayWindows,
  weekendBookingBreakdown,
  weekendBreakFor,
  weekendCustomHoursDefault,
  weekendLunchBreakCopy,
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
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--line2)]" /> {policy.breakPaid ? 'Paid' : 'Unpaid'} break {policy.unpaidBreakMinutes} min ({policy.breakWindowStart}–{policy.breakWindowEnd})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--warn)]" /> Overtime ×{policy.weekdayOutsideStandardMultiplier}
        </span>
      </div>
    </div>
  )
}

/** Any Saturday / Sunday: the preview prices one example day under the draft, so only the weekday matters. */
const PREVIEW_DAY: Record<WeekendKey, string> = { saturday: '2026-01-03', sunday: '2026-01-04' }

/**
 * Rulebook 1.19.0: the live calculation under Saturday / Sunday, as Monday–Friday has — that day's window (or every
 * hour at N× over the standard day), its lunch break and the paid hours, priced only by the canonical pay rule
 * (`weekendBookingBreakdown` → `payrollHoursResult`, `payrollDayWindows`). No figure is computed here.
 */
function WeekendDayPreview({ policy, day }: { policy: OrgPayrollTimePolicy; day: WeekendKey }) {
  const valid = isValidHM(policy.standardDayStart) && isValidHM(policy.standardDayEnd)
  if (!valid) return null
  const dayKey = PREVIEW_DAY[day]
  const window = weekendCustomHoursDefault(policy, dayKey, 'Europe/London')
  const span = window ?? (() => {
    const standard = halfDayWindows(policy).day
    return { start: formatClockMinutes(standard.start), end: formatClockMinutes(standard.end) }
  })()
  const rows = weekendBookingBreakdown(policy, [dayKey], span.start, span.end, false, 'Europe/London')
  const bands = payrollDayWindows(policy, dayKey, 'Europe/London')
  const dayBreak = payrollBreakOnDay(policy, dayKey, 'Europe/London')
  if (rows.length === 0) return null
  const name = day === 'saturday' ? 'Saturday' : 'Sunday'
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-[var(--ink2)]">
        {bands.allHoursMultiplier != null
          ? `Every hour at ×${bands.allHoursMultiplier}`
          : `${span.start}–${span.end} counts as set hours`}
        {dayBreak
          ? ` · ${dayBreak.paid ? 'Paid' : 'Unpaid'} break ${formatClockMinutes(dayBreak.start)}–${formatClockMinutes(dayBreak.end)} (${dayBreak.minutes} min)`
          : ''}
      </p>
      <BookingDayBreakdownRows rows={rows} title={`${name} example · ${span.start}–${span.end}`} />
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
    const validationError = validatePayrollTimePolicy(draft)
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
      await savePayrollPolicy(organization.id, draft, user?.id, baseDoc.current)
      setSaveChoice('closed')
      markLoaded(draft)
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
          onChange={(value) => patchWeekend(key, { breakMinutes: value })}
          min={PAYROLL_POLICY_LIMITS.breakMinutes.min}
          max={PAYROLL_POLICY_LIMITS.breakMinutes.max}
          step={5}
          format={(value) => `${value} min`}
        />
        <div className="[display:grid] grid-cols-2 gap-3">
          <FormField label="Break start">
            <TimeInput
              label={`${name} break start`}
              value={dayBreak.start}
              placeholder={draft.breakWindowStart}
              onChange={(value) => patchWeekend(key, { breakWindowStart: value })}
            />
          </FormField>
          <FormField label="Break end">
            <TimeInput
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
      {scheduled ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--soft)] p-4">
          <div>
            <p className="text-[14px] font-semibold text-[var(--ink)]">Scheduled change</p>
            <p className="text-[13px] text-[var(--ink2)]">
              New working hours take effect on {formatPaymentRunDay(scheduled.effectiveFrom)}:{' '}
              {scheduled.policy.standardDayStart}–{scheduled.policy.standardDayEnd}, {scheduled.policy.standardPaidHours}h paid.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={cancelScheduled}
            className="rounded-xl px-3 py-2 text-[13px] font-semibold text-[var(--red)] hover:bg-[var(--card)] disabled:opacity-50"
          >
            Cancel scheduled change
          </button>
        </div>
      ) : null}

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
            min={PAYROLL_POLICY_LIMITS.paidHours.min}
            max={PAYROLL_POLICY_LIMITS.paidHours.max}
            step={0.5}
            format={(value) => `${value.toFixed(1)} h`}
          />
        </div>
      </SettingsCard>

      <SectionLabel
        label="Lunch break"
        description={draft.breakPaid ? 'Paid — counts toward hours worked.' : 'Unpaid — taken off paid time on every booking unless removed.'}
      />
      <SettingsCard>
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
            onChange={(value) => patch({ unpaidBreakMinutes: value })}
            min={PAYROLL_POLICY_LIMITS.breakMinutes.min}
            max={PAYROLL_POLICY_LIMITS.breakMinutes.max}
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
        <div className="p-5">
          <WeekendDayPreview policy={draft} day="saturday" />
        </div>
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
        <div className="p-5">
          <WeekendDayPreview policy={draft} day="sunday" />
        </div>
        {!sunday.sameAsSaturday ? <div className="p-5">{weekendFields('sunday')}</div> : null}
      </SettingsCard>
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

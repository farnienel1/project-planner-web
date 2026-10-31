'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  DEFAULT_INVOICING,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  WEEKDAY_OPTIONS,
  capitalizeDay,
  loadOrganizationDetails,
  paymentRunShowsMonthCoverage,
  saveInvoicingSettings,
  type OrgInvoicingSettings,
} from '@/lib/settings/organizationSettings'
import { settingsSaveBarHint } from '@/lib/settings/settingsDirty'
import {
  SettingsFormBody,
  useSettingsBaseline,
  useSettingsDirty,
  useSettingsLeave,
} from '@/components/settings/SettingsDirty'
import {
  DAY_OF_MONTH_OPTIONS,
  paymentRunModeChange,
  validateInvoicingSettings,
} from '@/lib/settings/invoicingValidation'
import { ordinalDay, settingsHeader } from '@/lib/settings/settingsHeader'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Select,
  Textarea,
  FormField,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
  ChoiceCard,
  Segmented,
  SaveBar,
} from '@/components/settings/primitives'
import { TimesheetSubmissionSection } from '@/components/settings/TimesheetSubmissionSection'
import {
  syncedTimesheetSubmission,
  withPaymentDateAt,
  withRecurringPaymentDay,
} from '@/lib/settings/timesheetSubmissionDraft'

type DateMode = OrgInvoicingSettings['paymentDateMode']

/** Days 1–31 coloured by run, so gaps and overlaps are obvious before saving. */
function MonthCoverage({ ranges }: { ranges: Array<{ startDay: number; endDay: number }> }) {
  const inRun = (index: number, day: number) => {
    const range = ranges[index]
    return !!range && range.startDay > 0 && range.endDay > 0 && day >= range.startDay && day <= range.endDay
  }
  const days = DAY_OF_MONTH_OPTIONS.map((day) => {
    const one = inRun(0, day)
    const two = inRun(1, day)
    return { day, state: one && two ? 'overlap' : one ? 'one' : two ? 'two' : 'gap' }
  })
  const gaps = days.filter((d) => d.state === 'gap').length
  const overlaps = days.filter((d) => d.state === 'overlap').length
  const cell: Record<string, string> = {
    one: 'bg-[var(--blue)] text-white',
    two: 'bg-[var(--ops)] text-white',
    overlap: 'bg-[var(--red)] text-white',
    gap: 'bg-[var(--card)] text-[var(--ink3)] shadow-[inset_0_0_0_1.5px_var(--line2)] [background-image:repeating-linear-gradient(135deg,var(--soft2)_0_3px,transparent_3px_6px)]',
  }
  return (
    <div>
      <div className="[display:grid] grid-cols-[repeat(16,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(31,minmax(0,1fr))]" aria-hidden>
        {days.map(({ day, state }) => (
          <span key={day} className={`grid h-7 place-items-center rounded-[5px] text-[10.5px] font-bold tabular-nums ${cell[state]}`}>
            {day}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--ink2)]">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--blue)]" /> Run 1
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--ops)]" /> Run 2
        </span>
        {gaps === 0 && overlaps === 0 ? (
          <span className="font-semibold text-[var(--green)]">✓ Every day covered once</span>
        ) : (
          <span className="font-semibold text-[var(--red)]">
            {[gaps ? `${gaps} day${gaps === 1 ? '' : 's'} not covered` : '', overlaps ? `${overlaps} day${overlaps === 1 ? '' : 's'} in both runs` : '']
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}

function DaySelect({ value, onChange, placeholder, label }: { value: string; onChange: (value: number) => void; placeholder: string; label: string }) {
  return (
    <Select value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="">{placeholder}</option>
      {DAY_OF_MONTH_OPTIONS.map((day) => (
        <option key={day} value={day}>
          {ordinalDay(day)}
        </option>
      ))}
    </Select>
  )
}

function WeekdaySelect({ value, onChange, label, prefix = '' }: { value: string; onChange: (value: string) => void; label: string; prefix?: string }) {
  return (
    <Select value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {WEEKDAY_OPTIONS.map((day) => (
        <option key={day} value={day}>
          {prefix}
          {capitalizeDay(day)}
        </option>
      ))}
    </Select>
  )
}

export function PaymentRunsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const requestLeave = useSettingsLeave()
  const header = settingsHeader('payment-runs')
  const [draft, setDraft] = useState<OrgInvoicingSettings>(DEFAULT_INVOICING)
  const { state: loadState, markLoaded, markFailed, isDirty } = useSettingsBaseline<OrgInvoicingSettings>()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const dirty = isDirty(draft)
  useSettingsDirty(dirty)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (!details?.invoicing) {
          markFailed()
          return
        }
        const next = {
          ...details.invoicing,
          timesheetSubmission: syncedTimesheetSubmission(details.invoicing),
        }
        setDraft(next)
        markLoaded(next)
      })
      .catch(() => markFailed())
  }, [organization?.id, markLoaded, markFailed])

  function patch(partial: Partial<OrgInvoicingSettings>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function setPaymentRunMode(mode: OrgInvoicingSettings['paymentRunMode']) {
    const next = paymentRunModeChange(draft, mode)
    if (Object.keys(next).length === 0) return
    patch(next)
  }

  const ranges =
    draft.paymentRunDateRanges.length >= 2
      ? draft.paymentRunDateRanges
      : DEFAULT_PAYMENT_RUN_DATE_RANGES

  function setRange(index: number, key: 'startDay' | 'endDay', value: number) {
    const next = ranges.map((range) => ({ ...range }))
    next[index] = { ...next[index], [key]: value }
    patch({ paymentRunDateRanges: next })
  }

  function setPaymentDate(index: number, day: number) {
    patch(withPaymentDateAt(draft, index, day))
  }

  async function save() {
    if (!organization?.id) return
    setError('')
    const validationError = validateInvoicingSettings(draft)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    try {
      await saveInvoicingSettings(organization.id, {
        ...draft,
        timesheetSubmission: syncedTimesheetSubmission(draft),
      })
      const savedDraft = {
        ...draft,
        timesheetSubmission: syncedTimesheetSubmission(draft),
      }
      setDraft(savedDraft)
      markLoaded(savedDraft)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save payment run settings.')
    } finally {
      setSaving(false)
    }
  }

  const runMode = draft.paymentRunMode
  const dateMode = draft.paymentDateMode
  const showMonthCoverage = paymentRunShowsMonthCoverage(draft)

  const paidOn = (index: number) => {
    const day = Number(draft.paymentDates[index]) || 0
    return day ? `paid on the ${ordinalDay(day)}` : 'pay date not set'
  }
  const summary =
    runMode === 'date_ranges'
      ? ranges.map((range, index) => {
          const span = range.startDay && range.endDay ? `${ordinalDay(range.startDay)}–${ordinalDay(range.endDay)}` : 'not set'
          return `Run ${index + 1}: work from the ${span}, ${dateMode === 'specific_dates' ? paidOn(index) : 'pay date not set'}`
        })
      : [
          `Weekly in arrears: ${capitalizeDay(draft.recurringRunStartDay)} to ${capitalizeDay(draft.recurringRunEndDay)} of the previous week`,
          dateMode === 'recurring_date'
            ? `Paid every ${capitalizeDay(draft.recurringPaymentDay)}`
            : `Paid on ${draft.paymentDates.filter((d) => Number(d) > 0).map((d) => `the ${ordinalDay(Number(d))}`).join(' and ') || 'dates not set'}`,
        ]

  return (
    <div className="mx-auto max-w-3xl">
      <PanelHeader
        title={header.title}
        description="When each pay period runs, when people are paid, and when timesheets are due."
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
          <SuccessBanner message="Payment run settings saved" />
        </div>
      )}

      <SettingsFormBody state={loadState}>
      <div className="card p-4">
        <div className="text-[12px] font-semibold text-[var(--ink3)]">At a glance</div>
        <ul className="mt-1.5 space-y-1">
          {summary.map((line) => (
            <li key={line} className="flex gap-2 text-[14px] text-[var(--ink)]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--blue)]" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-[var(--ink3)]">
          Set your pay periods first, then the pay day. Warnings can use the end of the pay period for detection.
        </p>
      </div>

      <SectionLabel step={1} label="How you run pay" description="Pick how your pay periods are set up." />
      <div role="radiogroup" aria-label="Payment runs" className="[display:grid] gap-2.5 sm:grid-cols-2">
        <ChoiceCard
          selected={runMode === 'date_ranges'}
          title="Set payment run date ranges"
          description="Two runs a month on fixed days of the month."
          example="e.g. 1st–15th and 16th–31st"
          onClick={() => setPaymentRunMode('date_ranges')}
        />
        <ChoiceCard
          selected={runMode === 'recurring_timeframe'}
          title="Choose recurring timeframe"
          description="A weekly run, paid in arrears for the previous week."
          example="e.g. Monday to Sunday, paid Friday"
          onClick={() => setPaymentRunMode('recurring_timeframe')}
        />
      </div>

      <SectionLabel
        step={2}
        label="Pay periods"
        description={
          runMode === 'date_ranges'
            ? 'Both runs together must cover days 1–31 with no gaps or overlaps, e.g. run 1: 1–15, run 2: 16–31.'
            : 'The working week each payment covers.'
        }
      />
      <SettingsCard>
        {runMode === 'date_ranges' ? (
          <>
            {ranges.map((range, index) => (
              <div key={index} className="[display:grid] grid-cols-[auto_1fr_1fr] items-end gap-3 p-5">
                <span
                  className={`mb-1.5 grid h-7 min-w-[52px] place-items-center rounded-md px-2 text-[12px] font-bold text-white ${
                    index === 0 ? 'bg-[var(--blue)]' : 'bg-[var(--ops)]'
                  }`}
                >
                  Run {index + 1}
                </span>
                <FormField label="Start day">
                  <DaySelect
                    label={`Payment run ${index + 1} start day`}
                    placeholder="Select"
                    value={String(range.startDay || '')}
                    onChange={(value) => setRange(index, 'startDay', value)}
                  />
                </FormField>
                <FormField label="End day">
                  <DaySelect
                    label={`Payment run ${index + 1} end day`}
                    placeholder="Select"
                    value={String(range.endDay || '')}
                    onChange={(value) => setRange(index, 'endDay', value)}
                  />
                </FormField>
              </div>
            ))}
            {showMonthCoverage ? (
              <div className="bg-[var(--soft)] p-5">
                <MonthCoverage ranges={ranges} />
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-3 p-5">
            <div className="[display:grid] grid-cols-[1fr_auto_1fr] items-end gap-3">
              <FormField label="Start day">
                <WeekdaySelect label="Start day" value={draft.recurringRunStartDay} onChange={(value) => patch({ recurringRunStartDay: value })} />
              </FormField>
              <span className="pb-2.5 text-[var(--ink3)]" aria-hidden>
                →
              </span>
              <FormField label="End day">
                <WeekdaySelect label="End day" value={draft.recurringRunEndDay} onChange={(value) => patch({ recurringRunEndDay: value })} />
              </FormField>
            </div>
            <p className="inline-flex rounded-lg bg-[var(--soft2)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--ink2)]">
              In arrears: {capitalizeDay(draft.recurringRunStartDay)} to {capitalizeDay(draft.recurringRunEndDay)} (of the previous week)
            </p>
          </div>
        )}
      </SettingsCard>

      <SectionLabel step={3} label="Pay day" description="When operatives are paid for each run." />
      <SettingsCard>
        <div className="space-y-4 p-5">
          <Segmented<DateMode>
            ariaLabel="Payment day / dates"
            value={dateMode}
            onChange={(mode) => patch({ paymentDateMode: mode })}
            options={[
              { value: 'specific_dates', label: 'Set payment date/s', disabled: runMode === 'recurring_timeframe' },
              { value: 'recurring_date', label: 'Recurring payment date', disabled: runMode === 'date_ranges' },
            ]}
          />
          {dateMode === 'specific_dates' ? (
            <div className="[display:grid] gap-3 sm:grid-cols-2">
              {ranges.map((_, index) => (
                <FormField key={index} label={`Payment date ${index + 1}`}>
                  <DaySelect
                    label={`Payment date ${index + 1}`}
                    placeholder="Select day"
                    value={String(draft.paymentDates[index] || '')}
                    onChange={(value) => setPaymentDate(index, value)}
                  />
                </FormField>
              ))}
            </div>
          ) : (
            <FormField label="Recurring payment date">
              <WeekdaySelect
                label="Recurring payment date"
                prefix="Every "
                value={draft.recurringPaymentDay}
                onChange={(value) => patch(withRecurringPaymentDay(draft, value))}
              />
            </FormField>
          )}
        </div>
      </SettingsCard>

      <TimesheetSubmissionSection draft={draft} onChange={patch} step={4} />

      <SectionLabel
        step={5}
        label="Note to operatives"
        description="Shown on operative timesheet pages. Add anything specific, e.g. submit price work by Thursday."
      />
      <SettingsCard>
        <div className="p-5">
          <Textarea
            value={draft.noteToUsers}
            onChange={(e) => patch({ noteToUsers: e.target.value })}
            rows={5}
            aria-label="Note to operatives"
            placeholder="Explain how payment runs and timesheet requirements work…"
          />
        </div>
      </SettingsCard>

      </SettingsFormBody>

      <SaveBar dirty={dirty} hint={settingsSaveBarHint(loadState)}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={save} />
      </SaveBar>
    </div>
  )
}

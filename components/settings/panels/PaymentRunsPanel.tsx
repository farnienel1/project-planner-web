'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  DEFAULT_INVOICING,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  WEEKDAY_OPTIONS,
  capitalizeDay,
  loadOrganizationDetails,
  saveInvoicingSettings,
  type OrgInvoicingSettings,
} from '@/lib/settings/organizationSettings'
import {
  DAY_OF_MONTH_OPTIONS,
  validateInvoicingSettings,
} from '@/lib/settings/invoicingValidation'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Select,
  Textarea,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

function RadioCard({ selected, title, onClick }: { selected: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-blue-600' : 'border-slate-300'
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
      </span>
      <span className={`text-sm font-medium ${selected ? 'text-blue-700' : 'text-slate-900'}`}>{title}</span>
    </button>
  )
}

export function PaymentRunsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [draft, setDraft] = useState<OrgInvoicingSettings>(DEFAULT_INVOICING)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.invoicing) setDraft(details.invoicing)
      })
      .catch(() => {})
  }, [organization?.id])

  function patch(partial: Partial<OrgInvoicingSettings>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function setPaymentRunMode(mode: OrgInvoicingSettings['paymentRunMode']) {
    if (mode === 'recurring_timeframe') {
      patch({ paymentRunMode: mode, paymentDateMode: 'recurring_date' })
      return
    }
    patch({
      paymentRunMode: mode,
      paymentDateMode: 'specific_dates',
      paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range })),
      paymentDates: draft.paymentDates.length >= 2 ? draft.paymentDates : ['', ''],
    })
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
    const dates = [...(draft.paymentDates.length >= 2 ? draft.paymentDates : ['', ''])]
    dates[index] = String(day)
    patch({ paymentDates: dates })
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
      await saveInvoicingSettings(organization.id, draft)
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

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <PanelHeader title="Payment Runs and Timesheets" onBack={onBack} />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {saved && (
        <div className="mt-4">
          <SuccessBanner message="Payment run settings saved" />
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900">How payment runs should be configured</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-700">
          Set your payment run periods first, then choose payment day/dates. Warnings can use end of invoicing period for
          detection.
        </p>
      </div>

      <p className="mt-4 px-1 text-xs text-slate-500">
        Date ranges should cover the full month (days 1–31). Both runs together must cover every day without gaps or
        overlaps — e.g. run 1: days 1–15, run 2: days 16–31.
      </p>

      <SectionLabel label="Payment runs" />
      <SettingsCard>
        <div className="space-y-3 p-4">
          <RadioCard
            selected={runMode === 'date_ranges'}
            title="Set payment run date ranges"
            onClick={() => setPaymentRunMode('date_ranges')}
          />
          <RadioCard
            selected={runMode === 'recurring_timeframe'}
            title="Choose recurring timeframe"
            onClick={() => setPaymentRunMode('recurring_timeframe')}
          />

          {runMode === 'date_ranges' ? (
            <div className="space-y-4 pt-1">
              {ranges.map((range, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment run date range {index + 1}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1 block text-xs text-slate-500">Start day</span>
                      <Select
                        value={String(range.startDay || '')}
                        onChange={(e) => setRange(index, 'startDay', Number(e.target.value))}
                      >
                        <option value="">Select</option>
                        {DAY_OF_MONTH_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <span className="mb-1 block text-xs text-slate-500">End day</span>
                      <Select
                        value={String(range.endDay || '')}
                        onChange={(e) => setRange(index, 'endDay', Number(e.target.value))}
                      >
                        <option value="">Select</option>
                        {DAY_OF_MONTH_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-900">Start day</span>
                <Select
                  value={draft.recurringRunStartDay}
                  onChange={(e) => patch({ recurringRunStartDay: e.target.value })}
                >
                  {WEEKDAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {capitalizeDay(day)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-900">End day</span>
                <Select value={draft.recurringRunEndDay} onChange={(e) => patch({ recurringRunEndDay: e.target.value })}>
                  {WEEKDAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {capitalizeDay(day)}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-slate-400">
                In arrears: {capitalizeDay(draft.recurringRunStartDay)} to {capitalizeDay(draft.recurringRunEndDay)} (of
                the previous week)
              </p>
            </div>
          )}
        </div>
      </SettingsCard>

      <SectionLabel label="Payment day / dates" />
      <SettingsCard>
        <div className="space-y-4 p-4">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(
              [
                ['specific_dates', 'Set payment date/s'],
                ['recurring_date', 'Recurring payment date'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                disabled={runMode === 'recurring_timeframe' && mode === 'specific_dates'}
                onClick={() => patch({ paymentDateMode: mode })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                  dateMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {dateMode === 'specific_dates' ? (
            <div className="space-y-3">
              {ranges.map((_, index) => (
                <div key={index}>
                  <span className="mb-1 block text-xs text-slate-500">Payment date {index + 1}</span>
                  <Select
                    value={draft.paymentDates[index] || ''}
                    onChange={(e) => setPaymentDate(index, Number(e.target.value))}
                  >
                    <option value="">Select day</option>
                    {DAY_OF_MONTH_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-900">Recurring payment date</span>
              <Select
                value={draft.recurringPaymentDay}
                onChange={(e) => patch({ recurringPaymentDay: e.target.value })}
              >
                {WEEKDAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    Every {capitalizeDay(day)}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </SettingsCard>

      <SectionLabel label="Note to user" />
      <SettingsCard>
        <div className="p-4">
          <Textarea
            value={draft.noteToUsers}
            onChange={(e) => patch({ noteToUsers: e.target.value })}
            rows={5}
            placeholder="Explain how payment runs and timesheet requirements work…"
          />
          <p className="mt-2 text-xs text-slate-500">
            Detail any specific requirements (e.g. submit price work by Thursday). These notes appear on operative
            timesheet pages.
          </p>
        </div>
      </SettingsCard>

      <div className="mt-6">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

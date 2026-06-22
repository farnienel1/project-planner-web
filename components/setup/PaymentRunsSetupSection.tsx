'use client'

import { FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import {
  SetupCard,
  SetupNote,
  SetupSectionLabel,
  SetupSegmentedControl,
} from '@/components/setup/setupFormPrimitives'
import {
  DAY_OF_MONTH_OPTIONS,
  validateInvoicingSettings,
} from '@/lib/settings/invoicingValidation'
import {
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  WEEKDAY_OPTIONS,
  capitalizeDay,
  type OrgInvoicingSettings,
  type PaymentRunDateRange,
} from '@/lib/settings/organizationSettings'

type PaymentRunsSetupSectionProps = {
  value: OrgInvoicingSettings
  onChange: (value: OrgInvoicingSettings) => void
  validationError?: string | null
}

export function PaymentRunsSetupSection({
  value,
  onChange,
  validationError,
}: PaymentRunsSetupSectionProps) {
  const liveValidation = validationError ?? validateInvoicingSettings(value)

  function patch(partial: Partial<OrgInvoicingSettings>) {
    onChange({ ...value, ...partial })
  }

  function setPaymentRunMode(mode: OrgInvoicingSettings['paymentRunMode']) {
    if (mode === 'recurring_timeframe') {
      patch({ paymentRunMode: mode, paymentDateMode: 'recurring_date' })
      return
    }
    patch({
      paymentRunMode: mode,
      paymentDateMode: 'specific_dates',
      paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((r) => ({ ...r })),
      paymentDates:
        value.paymentDates.length >= 2
          ? value.paymentDates
          : ['', ''],
    })
  }

  function patchDateRange(index: number, partial: Partial<PaymentRunDateRange>) {
    const ranges =
      value.paymentRunDateRanges.length >= 2
        ? value.paymentRunDateRanges.map((r) => ({ ...r }))
        : DEFAULT_PAYMENT_RUN_DATE_RANGES.map((r) => ({ ...r }))
    ranges[index] = { ...ranges[index], ...partial }
    patch({ paymentRunDateRanges: ranges })
  }

  function patchPaymentDate(index: number, day: number) {
    const dates = [...(value.paymentDates.length >= 2 ? value.paymentDates : ['', ''])]
    dates[index] = String(day)
    patch({ paymentDates: dates })
  }

  const ranges =
    value.paymentRunDateRanges.length >= 2
      ? value.paymentRunDateRanges
      : DEFAULT_PAYMENT_RUN_DATE_RANGES

  return (
    <div className="space-y-4">
      <SetupNote tone="blue">
        Configure how payment runs and timesheets work for your organisation. These settings are saved to Firestore and
        sync to the iOS app — you will not need to set them up again after sign-in.
      </SetupNote>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900">How payment runs should be configured</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-700">
          Set your payment run periods first, then choose payment day/dates. Warnings can then use end of invoicing
          period for detection.
        </p>
      </div>

      <SetupCard>
        <div className="space-y-3 p-4">
          <SetupSectionLabel>Payment runs</SetupSectionLabel>
          <SetupSegmentedControl
            value={value.paymentRunMode}
            onChange={(mode) => setPaymentRunMode(mode as OrgInvoicingSettings['paymentRunMode'])}
            options={[
              { value: 'date_ranges', label: 'Set payment run date ranges' },
              { value: 'recurring_timeframe', label: 'Choose recurring timeframe' },
            ]}
          />

          {value.paymentRunMode === 'date_ranges' && (
            <div className="space-y-4 pt-1">
              <p className="text-xs text-slate-500">
                Use days of the month (1–31). Both runs together must cover every day without gaps or overlaps — e.g.
                run 1: days 1–15, run 2: days 16–31.
              </p>
              {ranges.map((range, index) => (
                <div key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Payment run {index + 1}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Start Day</FormLabel>
                      <FormSelect
                        value={range.startDay || ''}
                        onChange={(e) =>
                          patchDateRange(index, { startDay: Number(e.target.value) })
                        }
                      >
                        <option value="">Select day</option>
                        {DAY_OF_MONTH_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </FormSelect>
                    </div>
                    <div>
                      <FormLabel>End Day</FormLabel>
                      <FormSelect
                        value={range.endDay || ''}
                        onChange={(e) =>
                          patchDateRange(index, { endDay: Number(e.target.value) })
                        }
                      >
                        <option value="">Select day</option>
                        {DAY_OF_MONTH_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </FormSelect>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {value.paymentRunMode === 'recurring_timeframe' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Start Day</span>
                <FormSelect
                  value={value.recurringRunStartDay}
                  onChange={(e) => patch({ recurringRunStartDay: e.target.value })}
                  className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600"
                >
                  {WEEKDAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {capitalizeDay(day)}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">End Day</span>
                <FormSelect
                  value={value.recurringRunEndDay}
                  onChange={(e) => patch({ recurringRunEndDay: e.target.value })}
                  className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600"
                >
                  {WEEKDAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {capitalizeDay(day)}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <p className="text-xs text-slate-400">
                In arrears: {capitalizeDay(value.recurringRunStartDay)} to{' '}
                {capitalizeDay(value.recurringRunEndDay)} (of the previous week)
              </p>
            </div>
          )}
        </div>
      </SetupCard>

      <SetupCard>
        <div className="space-y-3 p-4">
          <SetupSectionLabel>Payment day/dates</SetupSectionLabel>

          {value.paymentRunMode === 'date_ranges' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Set one payment date (day of the month) for each payment run — when operatives are paid after that run.
              </p>
              {ranges.map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    Payment date for run {index + 1}
                  </span>
                  <FormSelect
                    value={value.paymentDates[index] ?? ''}
                    onChange={(e) => patchPaymentDate(index, Number(e.target.value))}
                    className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600"
                  >
                    <option value="">Select day</option>
                    {DAY_OF_MONTH_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        Day {day}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              ))}
            </div>
          ) : (
            <>
              <SetupSegmentedControl
                value={value.paymentDateMode}
                onChange={(paymentDateMode) =>
                  patch({
                    paymentDateMode: paymentDateMode as OrgInvoicingSettings['paymentDateMode'],
                  })
                }
                options={[
                  { value: 'specific_dates', label: 'Set payment date/s' },
                  { value: 'recurring_date', label: 'Recurring payment date' },
                ]}
              />

              {value.paymentDateMode === 'recurring_date' && (
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">Recurring payment date</span>
                  <FormSelect
                    value={value.recurringPaymentDay}
                    onChange={(e) => patch({ recurringPaymentDay: e.target.value })}
                    className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600"
                  >
                    {WEEKDAY_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        Every {capitalizeDay(day)}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              )}

              {value.paymentDateMode === 'specific_dates' && (
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">Payment date</span>
                  <FormSelect
                    value={value.paymentDates[0] ?? ''}
                    onChange={(e) => patch({ paymentDates: [e.target.value] })}
                    className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600"
                  >
                    <option value="">Select day</option>
                    {DAY_OF_MONTH_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        Day {day}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              )}
            </>
          )}
        </div>
      </SetupCard>

      <SetupCard>
        <div className="space-y-2 p-4">
          <SetupSectionLabel>Note to user</SetupSectionLabel>
          <FormTextarea
            rows={3}
            value={value.noteToUsers}
            onChange={(e) => patch({ noteToUsers: e.target.value })}
          />
          <p className="text-xs leading-relaxed text-slate-400">
            These notes appear on operative timesheet pages in the web and iOS apps.
          </p>
        </div>
      </SetupCard>

      {liveValidation && value.paymentRunMode === 'date_ranges' && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {liveValidation}
        </p>
      )}
    </div>
  )
}

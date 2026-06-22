'use client'

import { FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import {
  SetupCard,
  SetupNote,
  SetupRadioCard,
  SetupSectionLabel,
  SetupSegmentedControl,
} from '@/components/setup/setupFormPrimitives'
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
}

export function PaymentRunsSetupSection({ value, onChange }: PaymentRunsSetupSectionProps) {
  function patch(partial: Partial<OrgInvoicingSettings>) {
    onChange({ ...value, ...partial })
  }

  function setPaymentRunMode(mode: OrgInvoicingSettings['paymentRunMode']) {
    if (mode === 'recurring_timeframe') {
      patch({ paymentRunMode: mode, paymentDateMode: 'recurring_date' })
      return
    }
    patch({ paymentRunMode: mode })
  }

  function patchDateRange(index: number, partial: Partial<PaymentRunDateRange>) {
    const ranges = value.paymentRunDateRanges.length >= 2
      ? value.paymentRunDateRanges.map((r) => ({ ...r }))
      : DEFAULT_PAYMENT_RUN_DATE_RANGES.map((r) => ({ ...r }))
    ranges[index] = { ...ranges[index], ...partial }
    patch({ paymentRunDateRanges: ranges })
  }

  return (
    <div className="space-y-4">
      <SetupNote tone="blue">
        Configure how payment runs and timesheets work for your organisation. These settings appear on operative
        timesheet pages, sync to the iOS app, and control how work is grouped for payroll.
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
              {(value.paymentRunDateRanges.length >= 2
                ? value.paymentRunDateRanges
                : DEFAULT_PAYMENT_RUN_DATE_RANGES
              ).map((range, index) => (
                <div key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Payment run {index + 1}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Start date</FormLabel>
                      <FormInput
                        type="date"
                        value={range.startDate}
                        onChange={(e) => patchDateRange(index, { startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <FormLabel>End date</FormLabel>
                      <FormInput
                        type="date"
                        value={range.endDate}
                        onChange={(e) => patchDateRange(index, { endDate: e.target.value })}
                      />
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
          <SetupRadioCard
            checked={value.paymentDateMode === 'specific_dates'}
            onChange={() => patch({ paymentDateMode: 'specific_dates' })}
            label="Set payment date/s"
            description="Choose specific calendar dates when operatives are paid."
          />
          <SetupRadioCard
            checked={value.paymentDateMode === 'recurring_date'}
            onChange={() => patch({ paymentDateMode: 'recurring_date' })}
            label="Recurring payment date"
            description="Pay on the same weekday each payment run."
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
            <div className="space-y-2">
              {(value.paymentDates.length > 0 ? value.paymentDates : ['']).map((date, index) => (
                <div key={index} className="flex items-center gap-2">
                  <FormInput
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const next = [...(value.paymentDates.length > 0 ? value.paymentDates : [''])]
                      next[index] = e.target.value
                      patch({ paymentDates: next.filter(Boolean) })
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch({ paymentDates: [...value.paymentDates, ''] })}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                + Add payment date
              </button>
            </div>
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
    </div>
  )
}

'use client'

import { FormTextarea } from '@/components/forms/FormShell'
import {
  SetupCard,
  SetupNote,
  SetupRadioCard,
  SetupSectionLabel,
  SetupSegmentedControl,
} from '@/components/setup/setupFormPrimitives'
import {
  WEEKDAY_OPTIONS,
  capitalizeDay,
  type OrgInvoicingSettings,
} from '@/lib/settings/organizationSettings'
import { FormSelect } from '@/components/forms/FormShell'

type PaymentRunsSetupSectionProps = {
  value: OrgInvoicingSettings
  onChange: (value: OrgInvoicingSettings) => void
}

export function PaymentRunsSetupSection({ value, onChange }: PaymentRunsSetupSectionProps) {
  function patch(partial: Partial<OrgInvoicingSettings>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-4">
      <SetupNote tone="blue">
        Configure how payment runs and timesheets work for your organisation. These settings appear on operative
        timesheet pages and control how work is grouped for payroll.
      </SetupNote>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900">How payment runs should be configured</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-700">
          Choose whether you set fixed date ranges for each payment run, or a recurring weekly timeframe that repeats
          automatically. Then set when operatives are paid.
        </p>
      </div>

      <SetupCard>
        <div className="space-y-3 p-4">
          <SetupSectionLabel>Payment runs</SetupSectionLabel>
          <SetupRadioCard
            checked={value.paymentRunMode === 'date_ranges'}
            onChange={() => patch({ paymentRunMode: 'date_ranges' })}
            label="Set payment run date ranges"
            description="Define specific start and end dates for each payment period."
          />
          <SetupRadioCard
            checked={value.paymentRunMode === 'recurring_timeframe'}
            onChange={() => patch({ paymentRunMode: 'recurring_timeframe' })}
            label="Choose recurring timeframe"
            description="Set a repeating weekly window — e.g. Monday to Sunday in arrears."
          />

          {value.paymentRunMode === 'recurring_timeframe' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Start day</span>
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
                <span className="text-sm font-medium text-slate-700">End day</span>
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
            Use this section to explain how payment runs and timesheet requirements work. These notes appear on
            operative timesheet pages.
          </p>
        </div>
      </SetupCard>
    </div>
  )
}

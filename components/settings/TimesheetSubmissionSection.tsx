'use client'

import {
  DAY_OF_MONTH_OPTIONS,
} from '@/lib/settings/invoicingValidation'
import {
  WEEKDAY_OPTIONS,
  capitalizeDay,
  type OrgInvoicingSettings,
} from '@/lib/settings/organizationSettings'
import {
  previewTimesheetSubmissionCopy,
  resetTimesheetSubmissionAt,
  syncedTimesheetSubmission,
  withTimesheetSubmissionAt,
} from '@/lib/settings/timesheetSubmissionDraft'
import { MATERIAL_CUTOFF_TIME_OPTIONS, materialCutoffTimeLabel } from '@/lib/settings/orgHubUtils'
import { ordinalDay } from '@/lib/settings/settingsHeader'
import { FormField, SectionLabel, SettingsCard, Select } from '@/components/settings/primitives'

function clockValue(hour: number, minute: number): number {
  return hour * 60 + minute
}

function splitClock(total: number): { hour: number; minute: number } {
  return { hour: Math.floor(total / 60), minute: total % 60 }
}

export function TimesheetSubmissionSection({
  draft,
  onChange,
  step,
}: {
  draft: OrgInvoicingSettings
  onChange: (partial: Partial<OrgInvoicingSettings>) => void
  /** Optional step number shown in the section heading. */
  step?: number
}) {
  const rows = syncedTimesheetSubmission(draft)
  const isRecurring = draft.paymentRunMode === 'recurring_timeframe'

  if (isRecurring) {
    const row = rows[0]
    if (!row) return null
    return (
      <>
        <SectionLabel
          step={step}
          label="Timesheet reminders"
          description="Remind everyone who submits timesheets about the previous payment run. Defaults are 08:00 three days before payday, and close of play the day before."
        />
        <SettingsCard>
          <div className="p-5">
            <TimesheetRowFields
              paymentLabel={`Paid every ${capitalizeDay(draft.recurringPaymentDay)}`}
              deadlineDay={row.timesheetDeadlineWeekday}
              notifyDay={row.notifyWeekday}
              deadlineMinutes={clockValue(row.timesheetDeadlineHour, row.timesheetDeadlineMinute)}
              notifyMinutes={clockValue(row.notifyHour, row.notifyMinute)}
              dayOptions={WEEKDAY_OPTIONS.map((day) => ({ value: day, label: capitalizeDay(day) }))}
              preview={previewTimesheetSubmissionCopy(draft, 0)}
              customised={row.notifyCustomised}
              onDeadlineDay={(value) =>
                onChange({ timesheetSubmission: withTimesheetSubmissionAt(draft, 0, { timesheetDeadlineWeekday: value }) })
              }
              onNotifyDay={(value) =>
                onChange({ timesheetSubmission: withTimesheetSubmissionAt(draft, 0, { notifyWeekday: value }) })
              }
              onDeadlineTime={(total) => {
                const clock = splitClock(total)
                onChange({
                  timesheetSubmission: withTimesheetSubmissionAt(draft, 0, {
                    timesheetDeadlineHour: clock.hour,
                    timesheetDeadlineMinute: clock.minute,
                  }),
                })
              }}
              onNotifyTime={(total) => {
                const clock = splitClock(total)
                onChange({
                  timesheetSubmission: withTimesheetSubmissionAt(draft, 0, {
                    notifyHour: clock.hour,
                    notifyMinute: clock.minute,
                  }),
                })
              }}
              onReset={() => onChange({ timesheetSubmission: resetTimesheetSubmissionAt(draft, 0) })}
            />
          </div>
        </SettingsCard>
      </>
    )
  }

  return (
    <>
      <SectionLabel
        step={step}
        label="Timesheet reminders"
        description="One reminder per payment run. Changing the payment day refreshes these times unless you have customised that row."
      />
      <SettingsCard>
        {rows.slice(0, 2).map((row, index) => {
          const paymentDay = Number(draft.paymentDates[index]) || 0
          return (
            <div key={index} className="p-5">
              <TimesheetRowFields
                runLabel={`Run ${index + 1}`}
                runTone={index === 0 ? 'blue' : 'ops'}
                paymentLabel={paymentDay ? `Paid on the ${ordinalDay(paymentDay)}` : 'Set a payment date above'}
                deadlineDay={row.timesheetDeadlineDay ? String(row.timesheetDeadlineDay) : ''}
                notifyDay={row.notifyDay ? String(row.notifyDay) : ''}
                deadlineMinutes={clockValue(row.timesheetDeadlineHour, row.timesheetDeadlineMinute)}
                notifyMinutes={clockValue(row.notifyHour, row.notifyMinute)}
                dayOptions={DAY_OF_MONTH_OPTIONS.map((day) => ({ value: String(day), label: ordinalDay(day) }))}
                preview={previewTimesheetSubmissionCopy(draft, index)}
                customised={row.notifyCustomised}
                disabled={!paymentDay}
                onDeadlineDay={(value) =>
                  onChange({
                    timesheetSubmission: withTimesheetSubmissionAt(draft, index, {
                      timesheetDeadlineDay: Number(value),
                    }),
                  })
                }
                onNotifyDay={(value) =>
                  onChange({
                    timesheetSubmission: withTimesheetSubmissionAt(draft, index, {
                      notifyDay: Number(value),
                    }),
                  })
                }
                onDeadlineTime={(total) => {
                  const clock = splitClock(total)
                  onChange({
                    timesheetSubmission: withTimesheetSubmissionAt(draft, index, {
                      timesheetDeadlineHour: clock.hour,
                      timesheetDeadlineMinute: clock.minute,
                    }),
                  })
                }}
                onNotifyTime={(total) => {
                  const clock = splitClock(total)
                  onChange({
                    timesheetSubmission: withTimesheetSubmissionAt(draft, index, {
                      notifyHour: clock.hour,
                      notifyMinute: clock.minute,
                    }),
                  })
                }}
                onReset={() => onChange({ timesheetSubmission: resetTimesheetSubmissionAt(draft, index) })}
              />
            </div>
          )
        })}
      </SettingsCard>
    </>
  )
}

function TimeSelect({ value, disabled, onChange, label }: { value: number; disabled?: boolean; onChange: (total: number) => void; label: string }) {
  return (
    <Select value={String(value)} disabled={disabled} aria-label={label} onChange={(e) => onChange(Number(e.target.value))}>
      {MATERIAL_CUTOFF_TIME_OPTIONS.map((total) => (
        <option key={total} value={total}>
          {materialCutoffTimeLabel(total)}
        </option>
      ))}
    </Select>
  )
}

function DaySelect({
  value,
  disabled,
  options,
  onChange,
  label,
}: {
  value: string
  disabled?: boolean
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  label: string
}) {
  return (
    <Select value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}

function TimesheetRowFields({
  runLabel,
  runTone = 'blue',
  paymentLabel,
  deadlineDay,
  notifyDay,
  deadlineMinutes,
  notifyMinutes,
  dayOptions,
  preview,
  customised,
  disabled,
  onDeadlineDay,
  onNotifyDay,
  onDeadlineTime,
  onNotifyTime,
  onReset,
}: {
  runLabel?: string
  runTone?: 'blue' | 'ops'
  paymentLabel: string
  deadlineDay: string
  notifyDay: string
  deadlineMinutes: number
  notifyMinutes: number
  dayOptions: Array<{ value: string; label: string }>
  preview: string
  customised: boolean
  disabled?: boolean
  onDeadlineDay: (value: string) => void
  onNotifyDay: (value: string) => void
  onDeadlineTime: (total: number) => void
  onNotifyTime: (total: number) => void
  onReset: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {runLabel ? (
            <span
              className={`grid h-7 min-w-[52px] place-items-center rounded-md px-2 text-[12px] font-bold text-white ${
                runTone === 'ops' ? 'bg-[var(--ops)]' : 'bg-[var(--blue)]'
              }`}
            >
              {runLabel}
            </span>
          ) : null}
          <span className="text-[14.5px] font-semibold text-[var(--ink)]">{paymentLabel}</span>
        </div>
        {customised ? (
          <button type="button" onClick={onReset} className="text-[12.5px] font-semibold text-[var(--blue)] hover:underline">
            Reset to payment-day defaults
          </button>
        ) : null}
      </div>

      <div className="[display:grid] gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[var(--soft)] p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="mb-2.5 text-[13px] font-semibold text-[var(--ink)]">Timesheets to be submitted by</div>
          <div className="[display:grid] grid-cols-2 gap-2">
            <FormField label="Day">
              <DaySelect label="Timesheets to be submitted by" value={deadlineDay} disabled={disabled} options={dayOptions} onChange={onDeadlineDay} />
            </FormField>
            <FormField label="Time">
              <TimeSelect label="Deadline time" value={deadlineMinutes} disabled={disabled} onChange={onDeadlineTime} />
            </FormField>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--soft)] p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="mb-2.5 text-[13px] font-semibold text-[var(--ink)]">When to send the notification</div>
          <div className="[display:grid] grid-cols-2 gap-2">
            <FormField label="Day">
              <DaySelect label="When to send the notification" value={notifyDay} disabled={disabled} options={dayOptions} onChange={onNotifyDay} />
            </FormField>
            <FormField label="Time">
              <TimeSelect label="Notification time" value={notifyMinutes} disabled={disabled} onChange={onNotifyTime} />
            </FormField>
          </div>
        </div>
      </div>

      {preview ? (
        <div className="rounded-xl bg-[var(--blue-t)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--ink2)]">
          <span className="font-semibold text-[var(--ink)]">Operatives will see: </span>
          {preview}
        </div>
      ) : null}
      {!customised ? (
        <p className="text-[12.5px] text-[var(--ink3)]">Auto-filled from the payment day. Edit to keep a custom pair.</p>
      ) : null}
    </div>
  )
}

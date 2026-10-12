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
import { SectionLabel, SettingsCard, Select } from '@/components/settings/primitives'

function clockValue(hour: number, minute: number): number {
  return hour * 60 + minute
}

function splitClock(total: number): { hour: number; minute: number } {
  return { hour: Math.floor(total / 60), minute: total % 60 }
}

export function TimesheetSubmissionSection({
  draft,
  onChange,
}: {
  draft: OrgInvoicingSettings
  onChange: (partial: Partial<OrgInvoicingSettings>) => void
}) {
  const rows = syncedTimesheetSubmission(draft)
  const isRecurring = draft.paymentRunMode === 'recurring_timeframe'

  if (isRecurring) {
    const row = rows[0]
    if (!row) return null
    return (
      <>
        <SectionLabel label="Timesheet submission" />
        <SettingsCard>
          <div className="space-y-4 p-4">
            <p className="text-xs text-slate-500">
              Remind everyone who submits timesheets about the previous payment run. Defaults are 08:00 three days
              before payday, and close of play the day before.
            </p>
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
      <SectionLabel label="Timesheet submission" />
      <SettingsCard>
        <div className="space-y-4 p-4">
          <p className="text-xs text-slate-500">
            One reminder per payment run. Changing the payment day refreshes these times unless you have customised
            that row.
          </p>
          {rows.slice(0, 2).map((row, index) => {
            const paymentDay = Number(draft.paymentDates[index]) || 0
            return (
              <div key={index} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment run {index + 1}
                </div>
                <TimesheetRowFields
                  paymentLabel={paymentDay ? `Paid on the ${paymentDay}` : 'Set a payment date above'}
                  deadlineDay={row.timesheetDeadlineDay ? String(row.timesheetDeadlineDay) : ''}
                  notifyDay={row.notifyDay ? String(row.notifyDay) : ''}
                  deadlineMinutes={clockValue(row.timesheetDeadlineHour, row.timesheetDeadlineMinute)}
                  notifyMinutes={clockValue(row.notifyHour, row.notifyMinute)}
                  dayOptions={DAY_OF_MONTH_OPTIONS.map((day) => ({ value: String(day), label: String(day) }))}
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
        </div>
      </SettingsCard>
    </>
  )
}

function TimesheetRowFields({
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
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900">{paymentLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-xs text-slate-500">Timesheets to be submitted by</span>
          <Select value={deadlineDay} disabled={disabled} onChange={(e) => onDeadlineDay(e.target.value)}>
            <option value="">Select</option>
            {dayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span className="mb-1 block text-xs text-slate-500">Deadline time</span>
          <Select
            value={String(deadlineMinutes)}
            disabled={disabled}
            onChange={(e) => onDeadlineTime(Number(e.target.value))}
          >
            {MATERIAL_CUTOFF_TIME_OPTIONS.map((total) => (
              <option key={total} value={total}>
                {materialCutoffTimeLabel(total)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span className="mb-1 block text-xs text-slate-500">When to send the notification</span>
          <Select value={notifyDay} disabled={disabled} onChange={(e) => onNotifyDay(e.target.value)}>
            <option value="">Select</option>
            {dayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span className="mb-1 block text-xs text-slate-500">Notification time</span>
          <Select
            value={String(notifyMinutes)}
            disabled={disabled}
            onChange={(e) => onNotifyTime(Number(e.target.value))}
          >
            {MATERIAL_CUTOFF_TIME_OPTIONS.map((total) => (
              <option key={total} value={total}>
                {materialCutoffTimeLabel(total)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {preview ? (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">{preview}</div>
      ) : null}
      {customised ? (
        <button type="button" onClick={onReset} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
          Reset to payment-day defaults
        </button>
      ) : (
        <p className="text-xs text-slate-400">Auto-filled from the payment day. Edit to keep a custom pair.</p>
      )}
    </div>
  )
}

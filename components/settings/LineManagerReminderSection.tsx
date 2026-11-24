'use client'

import {
  LINE_MANAGER_REMINDER_ADMIN_NOTE,
  LINE_MANAGER_REMINDER_DAYS_LABEL,
  LINE_MANAGER_REMINDER_DAYS_OPTIONS,
  LINE_MANAGER_REMINDER_HELP,
  LINE_MANAGER_REMINDER_LABEL,
  lineManagerReminderSummary,
  parseLineManagerReminderDays,
} from '@/lib/canonical'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { FormField, SectionLabel, Select, SettingsCard } from '@/components/settings/primitives'

/**
 * Rulebook 1.78.0 §4.5 / §8 (owner decision 23 Nov): the line-manager sign-off reminder — how many days before each
 * payment run's payday (1, 2 or 3; default 2) the reminder goes out at 08:00. Part of the payment-runs draft, saved by
 * the screen's own Save (`invoicing.lineManagerReminderDaysBeforePayday`, `invoicingToFirestore`).
 */
export function LineManagerReminderSection({
  draft,
  onChange,
  step,
  disabled,
}: {
  draft: OrgInvoicingSettings
  onChange: (partial: Partial<OrgInvoicingSettings>) => void
  step?: number
  disabled?: boolean
}) {
  const days = parseLineManagerReminderDays(draft.lineManagerReminderDaysBeforePayday)
  return (
    <>
      <SectionLabel step={step} label={LINE_MANAGER_REMINDER_LABEL} description={LINE_MANAGER_REMINDER_HELP} />
      <SettingsCard>
        <div className="p-5">
          <FormField label={LINE_MANAGER_REMINDER_DAYS_LABEL}>
            <Select
              value={String(days)}
              disabled={disabled}
              aria-label={LINE_MANAGER_REMINDER_DAYS_LABEL}
              onChange={(e) => onChange({ lineManagerReminderDaysBeforePayday: Number(e.target.value) })}
            >
              {LINE_MANAGER_REMINDER_DAYS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} day{option === 1 ? '' : 's'}
                </option>
              ))}
            </Select>
          </FormField>
          <p className="mt-2 text-sm text-(--ink3)">{lineManagerReminderSummary(days)}</p>
          <p className="mt-1 text-sm text-(--ink3)">{LINE_MANAGER_REMINDER_ADMIN_NOTE}</p>
        </div>
      </SettingsCard>
    </>
  )
}

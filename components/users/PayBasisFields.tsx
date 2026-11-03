'use client'

import { PAY_BASIS_DAY_HELP, PAY_BASIS_HOURLY_HELP, PAY_BASIS_SAVE_NOTE } from '@/lib/canonical/payRate'
import { FormInput } from '@/components/forms/FormShell'
import { SegmentedControl } from '@/components/ui/controls'
import { MONEY_SAVE_MAX, parseBoundedNumber } from '@/lib/security/boundedValue'
import { readStoredRates } from '@/lib/timesheets/payBasis'
import { currencySymbol } from '@/lib/canonical'
import { useOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'

// Rulebook 1.11.0 §8: the pay copy is the rulebook's, so web and iOS say the same (one basis; saving one removes the other).
const DAY_HELP = PAY_BASIS_DAY_HELP
const HOURLY_HELP = PAY_BASIS_HOURLY_HELP

export function PayBasisFields({
  payBasis,
  amount,
  onChange,
  disabled,
  placeholder = 'example',
}: {
  payBasis: 'day' | 'hourly'
  amount: string
  onChange: (next: { payBasis: 'day' | 'hourly'; amount: string }) => void
  disabled?: boolean
  /** Manage-user card uses the blank placeholder. Other forms use the example amounts. */
  placeholder?: 'example' | 'manage'
}) {
  const hourly = payBasis === 'hourly'
  const symbol = currencySymbol(useOrganizationCurrency())
  const amountPlaceholder =
    placeholder === 'manage'
      ? 'Leave blank if not set'
      : hourly
        ? 'Hourly rate, e.g. 18.50'
        : 'Day rate, e.g. 250'
  return (
    <div className="space-y-2 sm:col-span-2">
      <SegmentedControl
        value={payBasis}
        disabled={disabled}
        options={[
          { value: 'day', label: 'Day rate' },
          { value: 'hourly', label: 'Hourly rate' },
        ]}
        onChange={(value) => onChange({ payBasis: value === 'hourly' ? 'hourly' : 'day', amount })}
      />
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--ink2)]">{symbol}</span>
        <FormInput
          type="number"
          step="0.01"
          min="0"
          value={amount}
          disabled={disabled}
          placeholder={amountPlaceholder}
          aria-label={hourly ? 'Hourly rate' : 'Day rate'}
          onChange={(event) => onChange({ payBasis, amount: event.target.value })}
        />
        <span className="text-sm font-semibold text-[var(--ink2)]">{hourly ? '/hr' : '/day'}</span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--ink3)]">{hourly ? HOURLY_HELP : DAY_HELP}</p>
      <p className="text-[12.5px] leading-relaxed text-[var(--ink3)]">{PAY_BASIS_SAVE_NOTE}</p>
    </div>
  )
}

export function payChoiceFromProfile(profile?: {
  payBasis?: 'day' | 'hourly' | null
  dayRate?: number | null
  hourlyRate?: number | null
} | null): { payBasis: 'day' | 'hourly'; amount: string } {
  const stored = readStoredRates(profile || {})
  if (stored.payBasis == null) return { payBasis: 'day', amount: '' }
  const value = stored.payBasis === 'hourly' ? stored.hourlyRate : stored.dayRate
  return {
    payBasis: stored.payBasis,
    amount: value == null ? '' : String(value),
  }
}

export function payChoiceToRates(payBasis: 'day' | 'hourly', amount: string): {
  payBasis?: 'day' | 'hourly'
  dayRate?: number
  hourlyRate?: number
} {
  const trimmed = amount.trim()
  if (!trimmed) return { payBasis: undefined, dayRate: undefined, hourlyRate: undefined }
  const value = parseBoundedNumber(trimmed, { min: 0, max: MONEY_SAVE_MAX })
  if (value == null) return { payBasis: undefined, dayRate: undefined, hourlyRate: undefined }
  if (payBasis === 'hourly') return { payBasis: 'hourly', hourlyRate: value, dayRate: undefined }
  return { payBasis: 'day', dayRate: value, hourlyRate: undefined }
}

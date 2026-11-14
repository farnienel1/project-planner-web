'use client'

import { PAY_BASIS_DAY_HELP, PAY_BASIS_HOURLY_HELP, PAY_BASIS_SAVE_NOTE } from '@/lib/canonical/payRate'
import { FormInput } from '@/components/forms/FormShell'
import { SegmentedControl } from '@/components/ui/controls'
import { MONEY_SAVE_MAX, parseBoundedNumber } from '@/lib/security/boundedValue'
import { readStoredRates } from '@/lib/timesheets/payBasis'
import { currencySymbol } from '@/lib/canonical'
import { useOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { ProfileIcon } from '@/components/users/profile-ui/icons'

// Rulebook 1.11.0 §8: the pay copy is the rulebook's, so web and iOS say the same (one basis; saving one removes the other).
const DAY_HELP = PAY_BASIS_DAY_HELP
const HOURLY_HELP = PAY_BASIS_HOURLY_HELP

export function PayBasisFields({
  payBasis,
  amount,
  onChange,
  disabled,
  placeholder = 'example',
  error,
  variant,
}: {
  payBasis: 'day' | 'hourly'
  amount: string
  onChange: (next: { payBasis: 'day' | 'hourly'; amount: string }) => void
  disabled?: boolean
  /** Manage-user card uses the blank placeholder. Other forms use the example amounts. */
  placeholder?: 'example' | 'manage'
  /** Field-level error under the amount (rulebook 1.14.0 `payRateRequiredError`). */
  error?: string | null
  /**
   * `profile`: the Edit user look (docs/design/user-profile-ui/): the same switch, input, units, error and help text,
   * laid out as a pay row with the save note in a blue note. Every other form keeps the default look.
   */
  variant?: 'profile'
}) {
  const hourly = payBasis === 'hourly'
  const symbol = currencySymbol(useOrganizationCurrency())
  const amountPlaceholder =
    placeholder === 'manage'
      ? 'Leave blank if not set'
      : hourly
        ? 'Hourly rate, e.g. 18.50'
        : 'Day rate, e.g. 250'
  const basisOptions = [
    { value: 'day', label: 'Day rate' },
    { value: 'hourly', label: 'Hourly rate' },
  ]
  const onBasis = (value: string) => onChange({ payBasis: value === 'hourly' ? 'hourly' : 'day', amount })
  const amountInput = (
    <FormInput
      type="number"
      step="0.01"
      min="0"
      value={amount}
      disabled={disabled}
      placeholder={amountPlaceholder}
      aria-label={hourly ? 'Hourly rate' : 'Day rate'}
      aria-invalid={error ? true : undefined}
      onChange={(event) => onChange({ payBasis, amount: event.target.value })}
    />
  )
  if (variant === 'profile') {
    return (
      <div className="up-f wide">
        <div className="up-payrow">
          <div className="up-seg">
            <SegmentedControl value={payBasis} disabled={disabled} options={basisOptions} onChange={onBasis} />
          </div>
          <div className="up-money">
            <span>{symbol}</span>
            {amountInput}
            <em>{hourly ? '/hr' : '/day'}</em>
          </div>
        </div>
        {error ? (
          <p role="alert" className="up-err">
            {error}
          </p>
        ) : null}
        <p className="up-f-hint">{hourly ? HOURLY_HELP : DAY_HELP}</p>
        <div className="pu-note info">
          <ProfileIcon name="info" />
          <div>{PAY_BASIS_SAVE_NOTE}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2 sm:col-span-2">
      <SegmentedControl value={payBasis} disabled={disabled} options={basisOptions} onChange={onBasis} />
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--ink2)]">{symbol}</span>
        {amountInput}
        <span className="text-sm font-semibold text-[var(--ink2)]">{hourly ? '/hr' : '/day'}</span>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--red,#dc2626)]">
          {error}
        </p>
      ) : null}
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

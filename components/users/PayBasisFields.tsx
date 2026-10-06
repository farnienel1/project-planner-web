'use client'

import { FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'

export function PayBasisFields({
  payBasis,
  amount,
  onChange,
  disabled,
}: {
  payBasis: 'day' | 'hourly'
  amount: string
  onChange: (next: { payBasis: 'day' | 'hourly'; amount: string }) => void
  disabled?: boolean
}) {
  const hourly = payBasis === 'hourly'
  return (
    <>
      <div>
        <FormLabel>Pay</FormLabel>
        <FormSelect
          value={payBasis}
          disabled={disabled}
          onChange={(event) => onChange({ payBasis: event.target.value === 'hourly' ? 'hourly' : 'day', amount })}
        >
          <option value="day">Day rate</option>
          <option value="hourly">Hourly rate</option>
        </FormSelect>
      </div>
      <div>
        <FormLabel>{hourly ? 'Hourly rate' : 'Day rate'}</FormLabel>
        <FormInput
          type="number"
          step="0.01"
          min="0"
          value={amount}
          disabled={disabled}
          placeholder={hourly ? '£ per hour' : '£ per day'}
          onChange={(event) => onChange({ payBasis, amount: event.target.value })}
        />
      </div>
    </>
  )
}

export function payChoiceFromProfile(profile?: {
  payBasis?: 'day' | 'hourly'
  dayRate?: number
  hourlyRate?: number
} | null): { payBasis: 'day' | 'hourly'; amount: string } {
  const hourly = profile?.payBasis === 'hourly' || (profile?.hourlyRate != null && profile?.dayRate == null && profile?.payBasis !== 'day')
  const value = hourly ? profile?.hourlyRate : profile?.dayRate
  return {
    payBasis: hourly ? 'hourly' : 'day',
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
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { payBasis: undefined, dayRate: undefined, hourlyRate: undefined }
  if (payBasis === 'hourly') return { payBasis: 'hourly', hourlyRate: value, dayRate: undefined }
  return { payBasis: 'day', dayRate: value, hourlyRate: undefined }
}

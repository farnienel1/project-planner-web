/**
 * iOS TimesheetMoneyEntrySheet amount parsing:
 * Double(amountText.replacingOccurrences(of: "£", with: "").trimmingCharacters)
 * Web also refuses amounts above MONEY_SAVE_MAX so Infinity / 1e20 cannot be written.
 */

import { MONEY_SAVE_MAX, parseBoundedNumber } from '@/lib/security/boundedValue'

export function parseTimesheetMoneyAmount(text: string): number | null {
  const cleaned = text.replace(/£/g, '').replace(/,/g, '').trim()
  if (!cleaned) return null
  return parseBoundedNumber(cleaned, { min: Number.MIN_VALUE, max: MONEY_SAVE_MAX })
}

/** iOS TimesheetManagerAmountEditSheet — Save accepts 0. */
export function parseTimesheetManagerAmount(text: string): number | null {
  const cleaned = text.replace(/£/g, '').replace(/,/g, '').trim()
  if (!cleaned) return null
  return parseBoundedNumber(cleaned, { min: 0, max: MONEY_SAVE_MAX })
}

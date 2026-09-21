/**
 * iOS TimesheetMoneyEntrySheet amount parsing:
 * Double(amountText.replacingOccurrences(of: "£", with: "").trimmingCharacters)
 */

export function parseTimesheetMoneyAmount(text: string): number | null {
  const cleaned = text.replace(/£/g, '').replace(/,/g, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

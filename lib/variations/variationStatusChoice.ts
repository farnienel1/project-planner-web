/**
 * The Open / Submitted / Closed buttons that replaced the status dropdown (owner request 17 Nov, UI only). The buttons
 * hand the SAME status to the SAME handler (`setVariationStatus`) as the dropdown did, so the stored write is
 * unchanged (`variationStatusWriteFields`); `variationStatusChoiceTest` proves it.
 */
import type { VariationStatus } from './variationModel'

export const VARIATION_STATUS_OPTIONS: ReadonlyArray<{ value: VariationStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'closed', label: 'Closed' },
]

/**
 * The status a button press hands to the handler, or null when nothing changes — a dropdown fires no change when the
 * chosen value is the current one, so neither does pressing the button already on.
 */
export function variationStatusChoice(current: VariationStatus, pressed: VariationStatus): VariationStatus | null {
  return pressed === current ? null : pressed
}

/** The button arrow keys move the FOCUS to (wrapping), Home / End to the ends; any other key is null. Never chooses. */
export function variationStatusKeyTarget(current: VariationStatus, key: string): VariationStatus | null {
  const index = VARIATION_STATUS_OPTIONS.findIndex((option) => option.value === current)
  const last = VARIATION_STATUS_OPTIONS.length - 1
  const at = index < 0 ? 0 : index
  let next: number | null = null
  if (key === 'ArrowRight' || key === 'ArrowDown') next = at === last ? 0 : at + 1
  else if (key === 'ArrowLeft' || key === 'ArrowUp') next = at === 0 ? last : at - 1
  else if (key === 'Home') next = 0
  else if (key === 'End') next = last
  return next == null ? null : VARIATION_STATUS_OPTIONS[next].value
}

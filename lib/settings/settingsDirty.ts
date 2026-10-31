/**
 * Settings "has changed" check. UI only: decides whether Save is enabled, never what Save writes.
 *
 * Compares by value, not by reference: nested maps (Saturday / Sunday) and arrays are walked,
 * object key order is ignored, a key holding `undefined` counts the same as a missing key,
 * and NaN equals NaN.
 */
export function settingsDraftIsDirty(baseline: unknown, draft: unknown): boolean {
  return !settingsValuesEqual(baseline, draft)
}

export function settingsValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => settingsValuesEqual(item, b[index]))
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (!settingsValuesEqual(left[key], right[key])) return false
  }
  return true
}

/**
 * Where a settings form is: still reading the saved values, ready to edit, or the read failed.
 * Edits only count once the saved values are in, so a late load cannot wipe an edit, and a
 * failed load never lets Save write defaults over what is stored.
 */
export type SettingsBaselineState<T> =
  | { status: 'loading' }
  | { status: 'ready'; baseline: T }
  | { status: 'failed' }

export const SETTINGS_LOAD_FAILED_MESSAGE =
  'Could not load the saved settings. Check your connection and reload the page before making changes.'

export function settingsFormIsDirty<T>(state: SettingsBaselineState<T>, draft: T): boolean {
  return state.status === 'ready' && settingsDraftIsDirty(state.baseline, draft)
}

/** SaveBar copy while the form cannot be edited; undefined keeps the SaveBar's own copy. */
export function settingsSaveBarHint<T>(state: SettingsBaselineState<T>): string | undefined {
  if (state.status === 'loading') return 'Loading saved settings…'
  if (state.status === 'failed') return 'Saved settings could not be loaded.'
  return undefined
}

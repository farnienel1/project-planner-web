/**
 * Save control for warning settings.
 * Back with unsaved edits stays on the page — the settings dirty dialog
 * asks Cancel (stay) or Continue (discard). Do not auto-save on leave.
 */

export type WarningSettingsSavePhase = 'clean' | 'dirty' | 'saving' | 'saved' | 'error'

export type WarningSettingsSaveState = {
  phase: WarningSettingsSavePhase
  /** Kept for the save-button Saved flash. Leave is handled by the dirty dialog. */
  leaveWhenSaved: boolean
}

export const initialWarningSettingsSaveState: WarningSettingsSaveState = {
  phase: 'clean',
  leaveWhenSaved: false,
}

export type WarningSettingsSaveEvent =
  | { type: 'edit' }
  | { type: 'save' }
  | { type: 'saveSucceeded' }
  | { type: 'saveFailed' }
  | { type: 'back' }
  | { type: 'savedShown' }
  | { type: 'savedDismissed' }

export type WarningSettingsSaveStep = {
  state: WarningSettingsSaveState
  /** Start the settings write. */
  persist: boolean
  /** Navigate away. Never set while the phase is still saving. */
  leave: boolean
}

export function warningSettingsSaveLabel(phase: WarningSettingsSavePhase): 'Save' | 'Saving…' | 'Saved' {
  if (phase === 'saving') return 'Saving…'
  if (phase === 'saved') return 'Saved'
  return 'Save'
}

export function stepWarningSettingsSave(
  state: WarningSettingsSaveState,
  event: WarningSettingsSaveEvent
): WarningSettingsSaveStep {
  const hold = (next: WarningSettingsSaveState, persist = false): WarningSettingsSaveStep => ({
    state: next,
    persist,
    leave: false,
  })

  switch (event.type) {
    case 'edit':
      if (state.phase === 'saving') return hold(state)
      return hold({ phase: 'dirty', leaveWhenSaved: false })
    case 'save':
      if (state.phase !== 'dirty' && state.phase !== 'error') return hold(state)
      return hold({ phase: 'saving', leaveWhenSaved: false }, true)
    case 'saveSucceeded':
      if (state.phase !== 'saving') return hold(state)
      return hold({ phase: 'saved', leaveWhenSaved: state.leaveWhenSaved })
    case 'saveFailed':
      if (state.phase !== 'saving') return hold(state)
      return hold({ phase: 'error', leaveWhenSaved: false })
    case 'back':
      if (state.phase === 'saving') {
        return hold({ phase: 'saving', leaveWhenSaved: false })
      }
      if (state.phase === 'dirty' || state.phase === 'error') {
        return hold(state)
      }
      return { state, persist: false, leave: true }
    case 'savedShown':
      if (state.phase === 'saved' && state.leaveWhenSaved) {
        return { state: { phase: 'saved', leaveWhenSaved: false }, persist: false, leave: true }
      }
      return hold(state)
    case 'savedDismissed':
      if (state.phase === 'saved' && !state.leaveWhenSaved) {
        return hold({ phase: 'clean', leaveWhenSaved: false })
      }
      return hold(state)
    default:
      return hold(state)
  }
}

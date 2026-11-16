'use client'

/**
 * Settings → Personal → Sounds (docs/design/feedback/feedback-sounds-haptics-guide.md §5, owner decision 1, 16 Nov).
 * This browser only (`localStorage` `pp.feedback.sounds`); no Firestore, rules or sync. Default on.
 */

import { useSyncExternalStore } from 'react'
import { SettingsRow } from '@/components/settings/primitives/SettingsRow'
import { Toggle } from '@/components/settings/primitives/Toggle'
import {
  FEEDBACK_SAMPLE_LABEL,
  FEEDBACK_SETTING_HELP,
  FEEDBACK_SETTING_LABEL,
  FEEDBACK_SOUNDS_DEFAULT,
  feedbackSoundsEnabled,
  playFeedbackSample,
  setFeedbackSoundsEnabled,
  unlockFeedbackSounds,
} from '@/lib/feedbackSounds/feedback'

/** A speaker (Heroicons outline "speaker-wave"). */
const SPEAKER_ICON =
  'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z'

/** Re-reads the setting when this page changes it, or another tab does (`storage` event). */
const settingListeners = new Set<() => void>()
function subscribe(listener: () => void) {
  settingListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    settingListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}
function settingChanged() {
  settingListeners.forEach((listener) => listener())
}

export function SoundsSettingRow() {
  // The server render shows the default; the browser shows the stored choice.
  const on = useSyncExternalStore(subscribe, () => feedbackSoundsEnabled(), () => FEEDBACK_SOUNDS_DEFAULT)

  const change = (next: boolean) => {
    // Storage unavailable (private mode): the switch stays on the default, as the guide says.
    setFeedbackSoundsEnabled(next)
    settingChanged()
    // Inside the click: the browser lets audio start now.
    if (next) unlockFeedbackSounds()
  }

  return (
    <SettingsRow
      icon={SPEAKER_ICON}
      iconBg="bg-blue-50"
      iconColor="text-blue-600"
      label={FEEDBACK_SETTING_LABEL}
      description={FEEDBACK_SETTING_HELP}
    >
      <div className="flex items-center gap-3">
        <button type="button" className="btn sm" onClick={() => playFeedbackSample()}>
          {FEEDBACK_SAMPLE_LABEL}
        </button>
        <Toggle checked={on} onChange={change} ariaLabel={FEEDBACK_SETTING_LABEL} />
      </div>
    </SettingsRow>
  )
}

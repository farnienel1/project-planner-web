'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  notificationPreferenceCopy,
  visibleNotificationPreferenceKeys,
  type UserNotificationPreferences,
} from '@/lib/canonical'
import { notificationPreferenceAudience } from '@/lib/permissions'
import {
  loadUserNotificationPreferences,
  saveUserNotificationPreferences,
} from '@/lib/settings/notificationPreferences'
import {
  ErrorBanner,
  PanelHeader,
  SettingsCard,
  SettingsRow,
  SuccessBanner,
  Toggle,
  SaveBar,
  SaveButton,
} from '@/components/settings/primitives'
import { settingsSaveBarHint } from '@/lib/settings/settingsDirty'
import { PUSH_TEST_SENT_MESSAGE, sendPushTestToSelf } from '@/lib/notifications/pushTest'
import {
  SettingsFormBody,
  useSettingsBaseline,
  useSettingsDirty,
  useSettingsLeave,
} from '@/components/settings/SettingsDirty'

const BELL_ICON =
  'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'

export function MyNotificationsPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuthStore()
  const requestLeave = useSettingsLeave()
  const audience = notificationPreferenceAudience(user)
  const visibleKeys = audience ? visibleNotificationPreferenceKeys(audience) : []
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(DEFAULT_USER_NOTIFICATION_PREFERENCES)
  const { state: loadState, markLoaded, markFailed, isDirty } = useSettingsBaseline<UserNotificationPreferences>()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [testState, setTestState] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; msg?: string }>({ kind: 'idle' })
  const dirty = isDirty(prefs)
  useSettingsDirty(dirty)

  useEffect(() => {
    if (!user?.id) return
    loadUserNotificationPreferences(user.id)
      .then((loaded) => {
        setPrefs(loaded)
        markLoaded(loaded)
      })
      .catch(() => markFailed())
  }, [user?.id, markLoaded, markFailed])

  async function save() {
    if (!user?.id) return
    setSaving(true)
    setFeedback(null)
    try {
      await saveUserNotificationPreferences(user.id, prefs)
      markLoaded(prefs)
      setSaved(true)
      setFeedback({ kind: 'success', msg: 'Saved' })
      window.setTimeout(() => {
        setFeedback(null)
        setSaved(false)
      }, 2000)
    } catch (error) {
      setFeedback({
        kind: 'error',
        msg: error instanceof Error ? error.message : 'Could not save preferences',
      })
    } finally {
      setSaving(false)
    }
  }

  // Rulebook §13 `push_test`: one inbox row to the signed-in user, pushed to every phone signed in to this account.
  async function sendTest() {
    if (!user?.id) return
    setTestState({ kind: 'sending' })
    try {
      const written = await sendPushTestToSelf({ organizationId: user.organizationId ?? '', userId: user.id })
      setTestState(written > 0 ? { kind: 'sent', msg: PUSH_TEST_SENT_MESSAGE } : { kind: 'error', msg: 'Sign in again, then try once more.' })
    } catch (error) {
      setTestState({
        kind: 'error',
        msg: error instanceof Error && error.message ? `Not sent: ${error.message}` : 'Not sent — try again.',
      })
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="My notifications" onBack={() => requestLeave(onBack)} />
      {feedback?.kind === 'success' ? <SuccessBanner message={feedback.msg} /> : null}
      {feedback?.kind === 'error' ? <ErrorBanner message={feedback.msg} /> : null}

      <SettingsFormBody state={loadState}>
      <SettingsCard>
        {visibleKeys.map((key) => {
          const copy = notificationPreferenceCopy(key, audience)
          return (
          <SettingsRow
            key={key}
            icon={BELL_ICON}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            label={copy.label}
            description={copy.description}
          >
            <Toggle
              checked={prefs[key] !== false}
              onChange={(value) => setPrefs({ ...prefs, [key]: value })}
            />
          </SettingsRow>
          )
        })}
      </SettingsCard>
      </SettingsFormBody>

      <SettingsCard>
        <SettingsRow
          icon={BELL_ICON}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Send test notification"
          description={
            testState.kind === 'sent' || testState.kind === 'error'
              ? testState.msg
              : 'Sends a notification to your own phone. It also appears in your notification centre.'
          }
        >
          <button
            type="button"
            className="btn sm"
            onClick={sendTest}
            disabled={!user?.id || testState.kind === 'sending'}
          >
            {testState.kind === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </SettingsRow>
      </SettingsCard>

      <SaveBar dirty={dirty} hint={settingsSaveBarHint(loadState)}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={save} />
      </SaveBar>
    </div>
  )
}

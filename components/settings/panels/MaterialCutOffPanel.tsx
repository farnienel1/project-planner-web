'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadMaterialCutOffSettings,
  loadNotificationPreferencesFromFirestore,
  saveMaterialCutOffSettingsForOrgAndUser,
  type NotificationPreferences,
} from '@/lib/settings/notificationPreferences'
import { MATERIAL_CUTOFF_TIME_OPTIONS, materialCutoffTimeLabel } from '@/lib/settings/orgHubUtils'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  SettingsRow,
  Toggle,
  Select,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

const ICON = {
  bell: 'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
}

export function MaterialCutOffPanel({ onBack }: { onBack: () => void }) {
  const { user, organization } = useAuthStore()
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (!organization?.id) return
    void (async () => {
      const orgOrShared = await loadMaterialCutOffSettings(organization.id, user?.id)
      const personal = user?.id ? await loadNotificationPreferencesFromFirestore(user.id) : null
      setPrefs(personal ?? orgOrShared)
    })()
  }, [organization?.id, user?.id])

  const cutOffOn = prefs.materialOrderCutOff
  const cutOffMinutes = prefs.materialCutOffHour * 60 + prefs.materialCutOffMinute
  const footerText = !cutOffOn
    ? 'Turn on the notification to choose a time'
    : `Managers are reminded daily at ${materialCutoffTimeLabel(cutOffMinutes)}`

  async function persist(next: NotificationPreferences) {
    if (!organization?.id) return
    const previous = prefs
    setPrefs(next)
    try {
      await saveMaterialCutOffSettingsForOrgAndUser(organization.id, user?.id, next)
      setFeedback({ kind: 'success', msg: 'Settings saved' })
      window.setTimeout(() => setFeedback(null), 2500)
    } catch (error) {
      setPrefs(previous)
      setFeedback({
        kind: 'error',
        msg: error instanceof Error ? error.message : 'Could not save settings',
      })
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      <PanelHeader title="Material cut-off" onBack={onBack} />

      {feedback?.kind === 'success' && <SuccessBanner message={feedback.msg} />}
      {feedback?.kind === 'error' && <ErrorBanner message={feedback.msg} />}

      <p className="px-1 text-[13px] text-slate-500">
        Remind all managers when materials still need ordering before the daily cut-off. Saved on the organisation and
        on your profile so iOS and the web app stay in sync.
      </p>

      <SectionLabel label="Notification" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.bell}
          iconBg="bg-[#854F0B]/[0.18]"
          iconColor="text-[#854F0B]"
          label="Material cut-off notification"
          description="Email all managers"
        >
          <Toggle
            checked={cutOffOn}
            onChange={(value) => void persist({ ...prefs, materialOrderCutOff: value })}
          />
        </SettingsRow>
      </SettingsCard>

      <SectionLabel label="Daily cut-off" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.clock}
          iconBg="bg-[#185FA5]/10"
          iconColor="text-[#185FA5]"
          label="Cut-off time"
          description={footerText}
        >
          <Select
            className="w-32 shrink-0 bg-white py-2 text-xs font-semibold text-blue-600"
            value={String(cutOffMinutes)}
            disabled={!cutOffOn}
            onChange={(event) => {
              const total = parseInt(event.target.value, 10)
              void persist({
                ...prefs,
                materialCutOffHour: Math.floor(total / 60),
                materialCutOffMinute: total % 60,
              })
            }}
          >
            {MATERIAL_CUTOFF_TIME_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {materialCutoffTimeLabel(minutes)}
              </option>
            ))}
          </Select>
        </SettingsRow>
        <SettingsRow
          icon={ICON.calendar}
          iconBg="bg-[#EEEDFE]"
          iconColor="text-[#3C3489]"
          label="Include Saturday"
          description="Send the reminder on Saturdays"
        >
          <Toggle
            checked={prefs.materialCutOffOnSaturday}
            disabled={!cutOffOn}
            onChange={(value) => void persist({ ...prefs, materialCutOffOnSaturday: value })}
          />
        </SettingsRow>
        <SettingsRow
          icon={ICON.calendar}
          iconBg="bg-[#FAECE7]"
          iconColor="text-[#993C1D]"
          label="Include Sunday"
          description="Send the reminder on Sundays"
        >
          <Toggle
            checked={prefs.materialCutOffOnSunday}
            disabled={!cutOffOn}
            onChange={(value) => void persist({ ...prefs, materialCutOffOnSunday: value })}
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  )
}

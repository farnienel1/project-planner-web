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
  const timeLabel = materialCutoffTimeLabel(cutOffMinutes)
  const helperText = !cutOffOn
    ? 'Turn on the notification to choose a time.'
    : `Managers are reminded daily at ${timeLabel}.`

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

  function setCutOffMinutes(total: number) {
    void persist({
      ...prefs,
      materialCutOffHour: Math.floor(total / 60),
      materialCutOffMinute: total % 60,
    })
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-12">
      <PanelHeader title="Material cut-off" onBack={onBack} />

      {feedback?.kind === 'success' && <SuccessBanner message={feedback.msg} />}
      {feedback?.kind === 'error' && <ErrorBanner message={feedback.msg} />}

      <p className="text-[15px] leading-6 text-slate-500">
        Remind all managers when materials still need ordering before the daily cut-off. The time is stored on the
        organisation and on your profile so iOS and the web app stay in sync.
      </p>

      <div>
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
      </div>

      <div>
        <SectionLabel label="Daily cut-off" />
        <SettingsCard>
          <div className="flex items-start gap-3 px-4 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--blue)]/10">
              <svg className="h-5 w-5 text-[var(--blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ICON.clock} />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Cut-off time</p>
              <p className="mt-1 text-[13px] leading-5 text-slate-500">{helperText}</p>
              <label className="mt-3 block">
                <span className="sr-only">Cut-off time</span>
                <select
                  className="h-11 w-full max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-semibold text-[var(--blue)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[#185FA5]/15 disabled:bg-slate-50 disabled:text-slate-400"
                  value={String(cutOffMinutes)}
                  disabled={!cutOffOn}
                  onChange={(event) => setCutOffMinutes(parseInt(event.target.value, 10))}
                >
                  {MATERIAL_CUTOFF_TIME_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {materialCutoffTimeLabel(minutes)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <SettingsRow
            icon={ICON.calendar}
            iconBg="bg-[#EEEDFE]"
            iconColor="text-[#3C3489]"
            label="Include Saturday"
            description="Send on Saturdays"
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
            description="Send on Sundays"
          >
            <Toggle
              checked={prefs.materialCutOffOnSunday}
              disabled={!cutOffOn}
              onChange={(value) => void persist({ ...prefs, materialCutOffOnSunday: value })}
            />
          </SettingsRow>
        </SettingsCard>
      </div>
    </div>
  )
}

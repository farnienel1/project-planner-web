'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { canAccessOrganisationSettingsHub } from '@/lib/navigation/menuPermissions'
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
import { settingsDraftIsDirty } from '@/lib/settings/settingsDirty'
import { useSettingsDirty, useSettingsLeave } from '@/components/settings/SettingsDirty'

const BELL_ICON =
  'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'

export function MyNotificationsPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuthStore()
  const requestLeave = useSettingsLeave()
  const canEditCompany = canAccessOrganisationSettingsHub(user)
  const audience = notificationPreferenceAudience(user)
  const visibleKeys = audience ? visibleNotificationPreferenceKeys(audience) : []
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(DEFAULT_USER_NOTIFICATION_PREFERENCES)
  const [baseline, setBaseline] = useState<UserNotificationPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const dirty = Boolean(baseline) && settingsDraftIsDirty(baseline, prefs)
  useSettingsDirty(dirty)

  useEffect(() => {
    if (!user?.id) return
    void loadUserNotificationPreferences(user.id).then((loaded) => {
      setPrefs(loaded)
      setBaseline(loaded)
    })
  }, [user?.id])

  async function save() {
    if (!user?.id) return
    setSaving(true)
    setFeedback(null)
    try {
      await saveUserNotificationPreferences(user.id, prefs)
      setBaseline(prefs)
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

  return (
    <div className="space-y-5">
      <PanelHeader title="My notifications" onBack={() => requestLeave(onBack)} />
      {feedback?.kind === 'success' ? <SuccessBanner message={feedback.msg} /> : null}
      {feedback?.kind === 'error' ? <ErrorBanner message={feedback.msg} /> : null}

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

      <p className="px-1 text-[13px] leading-5 text-[var(--ink3)]">
        Turn off any reminder you do not want. Organisation cut-off time is set in organisation settings.
        My Schedule extra locations are managed in Organisation Settings Hub → Schedule options.
      </p>

      {canEditCompany ? (
        <SettingsCard>
          <Link href="/dashboard/settings/material-cutoff" className="block">
            <SettingsRow
              icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              label="Organisation cut-off time"
              description="Company-wide reminder time and Saturday / Sunday"
              chevron
            />
          </Link>
          <Link href="/dashboard/settings/schedule-options" className="block">
            <SettingsRow
              icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              label="Schedule options"
              description="Office, working from home, site survey and custom locations"
              chevron
            />
          </Link>
        </SettingsCard>
      ) : null}

      <SaveBar dirty={dirty}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={save} />
      </SaveBar>
    </div>
  )
}

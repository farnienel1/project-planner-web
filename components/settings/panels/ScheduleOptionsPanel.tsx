'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  loadOrganizationDetails,
  saveMyScheduleOptions,
  type MyScheduleOptions,
} from '@/lib/settings/organizationSettings'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  SettingsRow,
  Toggle,
  Input,
  SuccessBanner,
  ErrorBanner,
  SaveBar,
  SaveButton,
} from '@/components/settings/primitives'
import { settingsDraftIsDirty } from '@/lib/settings/settingsDirty'
import { useSettingsDirty, useSettingsLeave } from '@/components/settings/SettingsDirty'

const ICON_CALENDAR =
  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5'

export function ScheduleOptionsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const requestLeave = useSettingsLeave()
  const [opts, setOpts] = useState<MyScheduleOptions>({
    showOffice: true,
    showWorkingFromHome: true,
    showSiteSurvey: true,
    customItems: [],
    customItemEnabled: {},
  })
  const [baseline, setBaseline] = useState<MyScheduleOptions | null>(null)
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const dirty = Boolean(baseline) && settingsDraftIsDirty(baseline, opts)
  useSettingsDirty(dirty)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.myScheduleOptions) {
          setOpts(details.myScheduleOptions)
          setBaseline(details.myScheduleOptions)
        }
      })
      .catch(() => {})
  }, [organization?.id])

  async function save() {
    if (!organization?.id) return
    setSaving(true)
    setFeedback(null)
    try {
      await saveMyScheduleOptions(organization.id, opts)
      setBaseline(opts)
      setSaved(true)
      setFeedback({ kind: 'success', msg: 'Schedule options saved' })
      window.setTimeout(() => {
        setFeedback(null)
        setSaved(false)
      }, 2500)
    } catch (error) {
      setFeedback({ kind: 'error', msg: error instanceof Error ? error.message : 'Could not save options' })
    } finally {
      setSaving(false)
    }
  }

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed) return
    const existing = opts.customItems ?? []
    if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setFeedback({ kind: 'error', msg: 'That option already exists.' })
      window.setTimeout(() => setFeedback(null), 2500)
      return
    }
    const items = [...existing, trimmed].sort((a, b) => a.localeCompare(b))
    const enabled = { ...(opts.customItemEnabled ?? {}), [trimmed]: true }
    setNewItem('')
    setOpts({ ...opts, customItems: items, customItemEnabled: enabled })
  }

  function removeItem(name: string) {
    const items = (opts.customItems ?? []).filter((item) => item !== name)
    const enabled = { ...(opts.customItemEnabled ?? {}) }
    delete enabled[name]
    setOpts({ ...opts, customItems: items, customItemEnabled: enabled })
  }

  const customItems = opts.customItems ?? []

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <PanelHeader title="Schedule options" onBack={() => requestLeave(onBack)} />

      {feedback?.kind === 'success' && (
        <div className="mt-4">
          <SuccessBanner message={feedback.msg} />
        </div>
      )}
      {feedback?.kind === 'error' && (
        <div className="mt-4">
          <ErrorBanner message={feedback.msg} />
        </div>
      )}

      <p className="mt-4 px-1 text-xs text-slate-500">
        Add or remove admin/manager additional options within My Schedule. Office, Working From Home and Site Survey are
        included as standard.
      </p>

      <SectionLabel label="Additional options" />
      <SettingsCard>
        <SettingsRow icon={ICON_CALENDAR} iconBg="bg-[#FBEAF0]" iconColor="text-[#993556]" label="Office">
          <Toggle checked={!!opts.showOffice} onChange={(value) => setOpts({ ...opts, showOffice: value })} />
        </SettingsRow>
        <SettingsRow icon={ICON_CALENDAR} iconBg="bg-[#FBEAF0]" iconColor="text-[#993556]" label="Working From Home">
          <Toggle
            checked={!!opts.showWorkingFromHome}
            onChange={(value) => setOpts({ ...opts, showWorkingFromHome: value })}
          />
        </SettingsRow>
        <SettingsRow icon={ICON_CALENDAR} iconBg="bg-[#FBEAF0]" iconColor="text-[#993556]" label="Site Survey">
          <Toggle checked={!!opts.showSiteSurvey} onChange={(value) => setOpts({ ...opts, showSiteSurvey: value })} />
        </SettingsRow>
      </SettingsCard>

      <SectionLabel label="Custom items" />
      <SettingsCard>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Input
              value={newItem}
              placeholder="Create an extra booking option…"
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addItem()
                }
              }}
            />
            <button
              type="button"
              onClick={addItem}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add
            </button>
          </div>

          {customItems.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No custom options yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {customItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <span className="text-sm text-slate-900">{item}</span>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={opts.customItemEnabled?.[item] ?? true}
                      onChange={(value) => {
                        const enabled = { ...(opts.customItemEnabled ?? {}), [item]: value }
                        if (!value) {
                          setOpts({
                            ...opts,
                            customItems: opts.customItems.filter((entry) => entry !== item),
                            customItemEnabled: Object.fromEntries(
                              Object.entries(enabled).filter(([key]) => key !== item)
                            ),
                          })
                          return
                        }
                        setOpts({ ...opts, customItemEnabled: enabled })
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item)}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${item}`}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsCard>

      <SaveBar dirty={dirty}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={save} />
      </SaveBar>
    </div>
  )
}

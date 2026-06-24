'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  DEFAULT_WARNING_DETECTION,
  loadOrganizationDetails,
  saveWarningDetection,
  type OrgWarningDetectionSettings,
} from '@/lib/settings/organizationSettings'
import {
  warningLookAheadFromUiMode,
  warningLookAheadToUiMode,
  type WarningLookAheadUiMode,
} from '@/lib/settings/warningDetectionUi'
import { getOperativeModeUsers } from '@/lib/staff/userRosterUtils'
import { personDisplayName } from '@/lib/settings/orgHubUtils'
import {
  PanelHeader,
  SettingsCard,
  SettingsRow,
  Toggle,
  Select,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

export function WarningsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()

  const [lookAheadMode, setLookAheadMode] = useState<WarningLookAheadUiMode>('week')
  const [daysAhead, setDaysAhead] = useState(DEFAULT_WARNING_DETECTION.clashLookaheadDays)
  const [clashes, setClashes] = useState(true)
  const [weekends, setWeekends] = useState(false)
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([])
  const [excludePickerOpen, setExcludePickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization?.id, loadUsers])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then((details) => {
      if (!details) return
      const warnings = details.warningDetection
      setLookAheadMode(warningLookAheadToUiMode(warnings.clashLookaheadMode))
      setDaysAhead(warnings.clashLookaheadDays)
      setClashes(warnings.detectClashes)
      setWeekends(warnings.includeWeekendsForUnbookedLabour)
      setExcludedUserIds(warnings.excludedUserIdsFromUnbookedWarnings ?? [])
    })
  }, [organization?.id])

  const operativeUsers = useMemo(() => getOperativeModeUsers(users), [users])

  const toggleExcludedUser = (userId: string) => {
    setExcludedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    )
  }

  const save = async () => {
    if (!organization?.id) return
    setSaving(true)
    setError('')
    try {
      const settings: OrgWarningDetectionSettings = {
        detectClashes: clashes,
        clashLookaheadMode: warningLookAheadFromUiMode(lookAheadMode),
        clashLookaheadDays: daysAhead,
        includeWeekendsForUnbookedLabour: weekends,
        excludedUserIdsFromUnbookedWarnings: excludedUserIds,
      }
      await saveWarningDetection(organization.id, settings)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save warning settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      <PanelHeader title="Warnings" onBack={onBack} />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Warning detection</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            How far ahead should clashes, missed bookings and material lists be detected. It is set to End of the
            working week by default.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Detection period</p>
          <SettingsCard>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-slate-900">Look ahead</span>
              <Select
                value={lookAheadMode}
                onChange={(event) => setLookAheadMode(event.target.value as WarningLookAheadUiMode)}
                className="w-auto max-w-[12rem] border-none bg-transparent text-right text-sm font-semibold text-blue-600 outline-none py-0"
              >
                <option value="week">End of the working week</option>
                <option value="invoicing">End of invoicing period</option>
                <option value="days">Set number of days</option>
              </Select>
            </div>
            {lookAheadMode === 'days' && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-sm text-slate-700">Days ahead: {daysAhead}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDaysAhead(Math.max(1, daysAhead - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysAhead(daysAhead + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            {lookAheadMode === 'invoicing' && (
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  Warnings are calculated up to the end of your current payment run / invoicing period — using the
                  payment run settings under Payment Runs and Timesheets.
                </p>
              </div>
            )}
          </SettingsCard>
          <p className="mt-2 text-xs text-slate-400">
            Applies to clashes, unbooked labour, and material cut-off checks. Changing the look-ahead updates warnings
            after you save.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Exclude users from the warnings</p>
        <SettingsCard>
          <SettingsRow
            icon="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            iconBg="bg-slate-100"
            iconColor="text-slate-500"
            label="Excluded users"
            value={String(excludedUserIds.length)}
            chevron
            onClick={() => setExcludePickerOpen((open) => !open)}
          />
        </SettingsCard>
        {excludePickerOpen && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 max-h-64 overflow-y-auto">
            {operativeUsers.length === 0 ? (
              <p className="text-xs text-slate-500 px-1 py-2">No operative users found yet.</p>
            ) : (
              operativeUsers.map((operativeUser) => {
                const checked = excludedUserIds.includes(operativeUser.id)
                return (
                  <label
                    key={operativeUser.id}
                    className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExcludedUser(operativeUser.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 text-slate-800">{personDisplayName(operativeUser)}</span>
                    <span className="text-xs text-slate-400">{operativeUser.email}</span>
                  </label>
                )
              })
            )}
          </div>
        )}
        <p className="text-xs text-slate-400 leading-relaxed">
          Use this feature to remove certain users such as PAYE staff from the warnings page so they will not show up when
          not booked in.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Clashes</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Clashes</p>
            <p className="text-xs text-slate-400 mt-0.5">Includes all days — weekend clashes are covered when this is on.</p>
          </div>
          <Toggle checked={clashes} onChange={setClashes} />
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Include weekends for unbooked labour detection</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Any labour that is not booked in over the weekend will trigger a warning. We do not recomend this setting
              is turned on, unless you organisation works 7 Days a week regularily or offers a 24/7 service.
            </p>
          </div>
          <Toggle checked={weekends} onChange={setWeekends} />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {saved && <SuccessBanner message="Settings saved. Warnings have been updated." />}
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  )
}

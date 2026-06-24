'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  DEFAULT_ANNUAL_LEAVE,
  loadOrganizationDetails,
  saveAnnualLeaveDefaults,
  type OrgAnnualLeaveDefaults,
} from '@/lib/settings/organizationSettings'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Toggle,
  Input,
  Select,
  FormField,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function AnnualLeaveDefaultsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()

  const [daysText, setDaysText] = useState(String(DEFAULT_ANNUAL_LEAVE.daysPerYear))
  const [startMonth, setStartMonth] = useState(DEFAULT_ANNUAL_LEAVE.startMonth)
  const [endMonth, setEndMonth] = useState(DEFAULT_ANNUAL_LEAVE.endMonth)
  const [carriesOver, setCarriesOver] = useState(DEFAULT_ANNUAL_LEAVE.carriesOver)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        const defaults = details?.annualLeaveDefaults
        if (!defaults) return
        const days = defaults.daysPerYear
        setDaysText(Number.isInteger(days) ? String(days) : days.toFixed(1))
        setStartMonth(defaults.startMonth)
        setEndMonth(defaults.endMonth)
        setCarriesOver(defaults.carriesOver)
      })
      .catch(() => {})
  }, [organization?.id])

  async function save() {
    if (!organization?.id) return
    const normalized = daysText.replace(',', '.').trim()
    const parsed = parseFloat(normalized)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid annual leave allowance (a positive number of days).')
      return
    }
    setSaving(true)
    setError('')
    try {
      const defaults: OrgAnnualLeaveDefaults = {
        daysPerYear: parsed,
        startMonth,
        endMonth,
        carriesOver,
      }
      await saveAnnualLeaveDefaults(organization.id, defaults)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save annual leave defaults.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <PanelHeader title="Annual leave" onBack={onBack} />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {saved && (
        <div className="mt-4">
          <SuccessBanner message="Annual leave defaults saved" />
        </div>
      )}

      <SectionLabel label="Default annual leave for new users" />
      <SettingsCard>
        <div className="space-y-5 p-4">
          <FormField label="Days per year" hint="Applied when adding new manager / operative users.">
            <Input
              value={daysText}
              inputMode="decimal"
              placeholder="e.g. 25"
              onChange={(e) => setDaysText(e.target.value)}
            />
          </FormField>

          <FormField
            label="Company leave year"
            hint="Runs from the first day of the start month through the last day of the end month (e.g. April → March)."
          >
            <div className="flex items-center gap-3">
              <Select value={String(startMonth)} onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </Select>
              <span className="text-slate-400">→</span>
              <Select value={String(endMonth)} onChange={(e) => setEndMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </Select>
            </div>
          </FormField>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900">Carry unused days into next leave year</div>
              <p className="mt-1 text-xs text-slate-500">
                Unused allowance from the previous leave year is added to this year&apos;s balance (after booked and
                pending time in that year).
              </p>
            </div>
            <Toggle checked={carriesOver} onChange={setCarriesOver} />
          </div>
        </div>
      </SettingsCard>

      <p className="mt-3 px-1 text-xs text-slate-500">
        These settings apply only when adding new manager/operative users. Existing users keep their current annual leave
        values unless an admin/manager edits their profile.
      </p>

      <div className="mt-6">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  DEFAULT_ANNUAL_LEAVE,
  loadOrganizationDetails,
  saveAnnualLeaveDefaults,
  saveOrganizationBankHolidayRegion,
  type OrgAnnualLeaveDefaults,
} from '@/lib/settings/organizationSettings'
import { bankHolidayRegionIdFromSelection, bankHolidaySelectionFromStored } from '@/lib/orgSetup/orgSetupSettings'
import {
  BANK_HOLIDAY_REGIONS,
  bankHolidayRegionLabel,
} from '@/lib/settings/bankHolidayRegions'
import { LEAVE_DAYS_SAVE_MAX, parseBoundedNumber } from '@/lib/security/boundedValue'
import { settingsHeader } from '@/lib/settings/settingsHeader'
import { settingsDraftIsDirty } from '@/lib/settings/settingsDirty'
import { useSettingsDirty, useSettingsLeave } from '@/components/settings/SettingsDirty'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Input,
  Select,
  FormField,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
  ToggleRow,
  Callout,
  SaveBar,
} from '@/components/settings/primitives'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function leaveYearSummary(startMonth: number, endMonth: number): string {
  const start = MONTHS[startMonth - 1] ?? '—'
  const end = MONTHS[endMonth - 1] ?? '—'
  return `1 ${start} – end of ${end}`
}

export function AnnualLeaveDefaultsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const requestLeave = useSettingsLeave()
  const header = settingsHeader('annual-leave-defaults')

  const [daysText, setDaysText] = useState(String(DEFAULT_ANNUAL_LEAVE.daysPerYear))
  const [startMonth, setStartMonth] = useState(DEFAULT_ANNUAL_LEAVE.startMonth)
  const [endMonth, setEndMonth] = useState(DEFAULT_ANNUAL_LEAVE.endMonth)
  const [carriesOver, setCarriesOver] = useState(DEFAULT_ANNUAL_LEAVE.carriesOver)
  const [bankHolidayRegion, setBankHolidayRegion] = useState('GB')
  const [baseline, setBaseline] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const snapshot = JSON.stringify({ daysText, startMonth, endMonth, carriesOver, bankHolidayRegion })
  const dirty = Boolean(baseline) && settingsDraftIsDirty(baseline, snapshot)
  useSettingsDirty(dirty)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        const defaults = details?.annualLeaveDefaults
        if (!defaults) return
        const days = defaults.daysPerYear
        const nextDays = Number.isInteger(days) ? String(days) : days.toFixed(1)
        const nextRegion = bankHolidaySelectionFromStored(details.bankHolidayRegionId || details.countryCode)
        setDaysText(nextDays)
        setStartMonth(defaults.startMonth)
        setEndMonth(defaults.endMonth)
        setCarriesOver(defaults.carriesOver)
        setBankHolidayRegion(nextRegion)
        setBaseline(
          JSON.stringify({
            daysText: nextDays,
            startMonth: defaults.startMonth,
            endMonth: defaults.endMonth,
            carriesOver: defaults.carriesOver,
            bankHolidayRegion: nextRegion,
          })
        )
      })
      .catch(() => {})
  }, [organization?.id])

  async function save() {
    if (!organization?.id) return
    const normalized = daysText.replace(',', '.').trim()
    const parsed = parseBoundedNumber(normalized, { min: Number.MIN_VALUE, max: LEAVE_DAYS_SAVE_MAX })
    if (parsed == null) {
      setError('Enter a valid annual leave allowance (a positive number of days, up to 365).')
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
      await saveOrganizationBankHolidayRegion(
        organization.id,
        bankHolidayRegionIdFromSelection(bankHolidayRegion)
      )
      setBaseline(snapshot)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save annual leave defaults.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PanelHeader
        title={header.title}
        description="The allowance, leave year and bank holidays new users start with."
        iconPath={header.iconPath}
        hue={header.hue}
        onBack={() => requestLeave(onBack)}
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {saved && (
        <div className="mb-4">
          <SuccessBanner message="Annual leave defaults saved" />
        </div>
      )}

      <Callout title="Applies to new users only">
        These settings apply only when adding new manager/operative users. Existing users keep their current annual leave
        values unless an admin/manager edits their profile.
      </Callout>

      <SectionLabel label="Allowance" description="Applied when adding new manager / operative users." />
      <SettingsCard>
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold text-[var(--ink)]">Days per year</div>
            <div className="mt-0.5 text-[13px] text-[var(--ink3)]">Half days are allowed, e.g. 25.5</div>
          </div>
          <label className="flex shrink-0 items-center rounded-xl bg-[var(--card)] pr-3 shadow-[inset_0_0_0_1.5px_var(--line2)] focus-within:shadow-[inset_0_0_0_1.5px_var(--blue),0_0_0_3px_var(--blue-t)]">
            <input
              value={daysText}
              inputMode="decimal"
              placeholder="e.g. 25"
              aria-label="Days per year"
              onChange={(e) => setDaysText(e.target.value)}
              className="w-[72px] bg-transparent py-2 pl-3 text-right text-[15px] font-bold tabular-nums text-[var(--ink)] outline-none"
            />
            <span className="pl-1.5 text-[13.5px] font-semibold text-[var(--ink3)]">days</span>
          </label>
        </div>
      </SettingsCard>

      <SectionLabel
        label="Company leave year"
        description="Runs from the first day of the start month through the last day of the end month (e.g. April → March)."
      />
      <SettingsCard>
        <div className="space-y-4 p-5">
          <div className="[display:grid] grid-cols-[1fr_auto_1fr] items-end gap-3">
            <FormField label="Starts">
              <Select value={String(startMonth)} onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </Select>
            </FormField>
            <span className="pb-2.5 text-[var(--ink3)]" aria-hidden>
              →
            </span>
            <FormField label="Ends">
              <Select value={String(endMonth)} onChange={(e) => setEndMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <p className="inline-flex rounded-lg bg-[var(--soft2)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--ink2)]">
            Leave year: {leaveYearSummary(startMonth, endMonth)}
          </p>
        </div>
        <div className="p-5">
          <ToggleRow
            title="Carry unused days into next leave year"
            description="Unused allowance from the previous leave year is added to this year's balance (after booked and pending time in that year)."
            checked={carriesOver}
            onChange={setCarriesOver}
          />
        </div>
      </SettingsCard>

      <SectionLabel
        label="Bank holiday region"
        description="Bank holidays shown in annual leave and scheduling follow this region. It should match where your organisation is based."
      />
      <SettingsCard>
        <div className="space-y-3 p-5">
          <FormField label="Region" hint="Syncs with the iOS app and applies organisation-wide.">
            <Select value={bankHolidayRegion} onChange={(e) => setBankHolidayRegion(e.target.value)}>
              {BANK_HOLIDAY_REGIONS.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.label}
                </option>
              ))}
            </Select>
          </FormField>
          <p className="inline-flex rounded-lg bg-[var(--soft2)] px-2.5 py-1 text-[12.5px] text-[var(--ink2)]">
            Currently set to&nbsp;<strong className="font-semibold text-[var(--ink)]">{bankHolidayRegionLabel(bankHolidayRegion)}</strong>
          </p>
        </div>
      </SettingsCard>

      <SaveBar dirty={dirty}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={save} />
      </SaveBar>
    </div>
  )
}

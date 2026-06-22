'use client'

import { FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
import {
  BANK_HOLIDAY_REGIONS,
  bankHolidayRegionLabel,
} from '@/lib/settings/bankHolidayRegions'
import {
  MONTHS,
  SetupCard,
  SetupNote,
  SetupSectionLabel,
  SetupToggle,
  SetupWarningNote,
} from '@/components/setup/setupFormPrimitives'
import type { OrgAnnualLeaveDefaults } from '@/lib/settings/organizationSettings'

type AnnualLeaveSetupSectionProps = {
  value: OrgAnnualLeaveDefaults
  countryCode: string
  countryLabel: string
  onChange: (value: OrgAnnualLeaveDefaults) => void
  onRegionChange: (countryCode: string, countryLabel: string) => void
}

export function AnnualLeaveSetupSection({
  value,
  countryCode,
  onChange,
  onRegionChange,
}: AnnualLeaveSetupSectionProps) {
  function patch(partial: Partial<OrgAnnualLeaveDefaults>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-4">
      <SetupNote>
        Default annual leave for <strong>new</strong> managers and operatives. Existing users keep their own values
        unless an admin edits their profile.
      </SetupNote>

      <SetupCard>
        <div className="space-y-4 p-4">
          <p className="text-xs font-medium text-slate-500">Default annual leave for new users</p>

          <div>
            <FormLabel>Days per year</FormLabel>
            <FormInput
              type="number"
              min={0}
              max={365}
              value={value.daysPerYear}
              onChange={(e) => patch({ daysPerYear: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-400">
              The standard allowance applied when you add a new manager or operative to your organisation.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Company leave year</p>
            <p className="mb-2 mt-1 text-xs text-slate-400">
              Runs from the first day of the start month through the last day of the end month.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <FormLabel>Starts</FormLabel>
                <FormSelect
                  value={value.startMonth}
                  onChange={(e) => patch({ startMonth: Number(e.target.value) })}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <span className="mt-6 font-bold text-slate-400">→</span>
              <div className="flex-1">
                <FormLabel>Ends</FormLabel>
                <FormSelect
                  value={value.endMonth}
                  onChange={(e) => patch({ endMonth: Number(e.target.value) })}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </FormSelect>
              </div>
            </div>
          </div>

          <SetupToggle
            label="Carry unused days into next leave year"
            description="Unused allowance from the previous leave year is added to this year's balance."
            checked={value.carriesOver}
            onChange={(carriesOver) => patch({ carriesOver })}
          />
        </div>
      </SetupCard>

      <SetupCard>
        <div className="space-y-3 p-4">
          <SetupSectionLabel>Bank holiday region</SetupSectionLabel>
          <p className="text-xs leading-relaxed text-slate-500">
            Bank holidays shown in annual leave and scheduling follow the region you select. This should match where
            your organisation is based — including England &amp; Wales, Scotland and Northern Ireland.
          </p>
          <FormLabel required>Region</FormLabel>
          <FormSelect
            value={countryCode}
            onChange={(e) => {
              onRegionChange(e.target.value, bankHolidayRegionLabel(e.target.value))
            }}
          >
            {BANK_HOLIDAY_REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.label}
              </option>
            ))}
          </FormSelect>
          <p className="text-xs text-slate-400">
            Currently set to{' '}
            <strong className="font-semibold text-slate-600">{bankHolidayRegionLabel(countryCode)}</strong>. This
            syncs with your organisation region and is shared with the iOS app.
          </p>
        </div>
      </SetupCard>

      <SetupWarningNote>
        These settings apply to any new users that are added to your organisation. You can manually adjust individual
        allowances on each user&apos;s profile after. An example would be, where some user&apos;s recieve more annual
        leave than others, so you can set your standard annual leave terms, with any custom agreements defined on that
        user&apos;s profile in the web app or ios/android app after this setup.
      </SetupWarningNote>
    </div>
  )
}

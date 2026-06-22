'use client'

import { useState } from 'react'
import { FormInput } from '@/components/forms/FormShell'
import {
  SetupCard,
  SetupNote,
  SetupStepHeader,
  SetupStepNav,
  SetupToggle,
} from '@/components/setup/setupFormPrimitives'
import { AnnualLeaveSetupSection } from '@/components/setup/AnnualLeaveSetupSection'
import { PaymentRunsSetupSection } from '@/components/setup/PaymentRunsSetupSection'
import { ScheduleOptionsSetupSection } from '@/components/setup/ScheduleOptionsSetupSection'
import { WarningsSetupSection } from '@/components/setup/WarningsSetupSection'
import { WorkingHoursSetupSection } from '@/components/setup/WorkingHoursSetupSection'
import { formatCutoffTime, parseCutoffTime } from '@/lib/settings/notificationPreferences'
import type { OrganisationFeaturesSetup } from '@/lib/orgSetup/orgSetupSettings'

type FeatureSubStep =
  | 'working-hours'
  | 'annual-leave'
  | 'schedule'
  | 'warnings'
  | 'material-cutoff'
  | 'payment-runs'

const FEATURE_STEPS: { id: FeatureSubStep; label: string }[] = [
  { id: 'working-hours', label: 'Working hours' },
  { id: 'annual-leave', label: 'Annual leave' },
  { id: 'schedule', label: 'Schedule options' },
  { id: 'payment-runs', label: 'Payment runs' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'material-cutoff', label: 'Material cut-off' },
]

type OrganisationFeaturesStepProps = {
  value: OrganisationFeaturesSetup
  countryCode: string
  countryLabel: string
  onChange: (value: OrganisationFeaturesSetup) => void
  onRegionChange: (countryCode: string, countryLabel: string) => void
  stepIndex: number
  onStepIndexChange: (index: number) => void
  onBack: () => void
  onComplete: () => void
}

function FeatureProgress({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center gap-1.5">
      {FEATURE_STEPS.map((step, index) => (
        <div
          key={step.id}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            index < current ? 'bg-emerald-500' : index === current ? 'bg-blue-600' : 'bg-slate-200'
          }`}
          title={step.label}
        />
      ))}
    </div>
  )
}

export function OrganisationFeaturesStep({
  value,
  countryCode,
  countryLabel,
  onChange,
  onRegionChange,
  stepIndex,
  onStepIndexChange,
  onBack,
  onComplete,
}: OrganisationFeaturesStepProps) {
  const [error, setError] = useState('')
  const subStep = FEATURE_STEPS[stepIndex]?.id ?? 'working-hours'
  const isLast = stepIndex >= FEATURE_STEPS.length - 1

  function patch(partial: Partial<OrganisationFeaturesSetup>) {
    onChange({ ...value, ...partial })
  }

  function goNext() {
    setError('')
    if (isLast) {
      onComplete()
      return
    }
    onStepIndexChange(stepIndex + 1)
  }

  function goBack() {
    setError('')
    if (stepIndex === 0) {
      onBack()
      return
    }
    onStepIndexChange(stepIndex - 1)
  }

  const cutoffTime = formatCutoffTime(
    value.notificationPreferences.materialCutOffHour,
    value.notificationPreferences.materialCutOffMinute
  )

  return (
    <div>
      <SetupStepHeader
        eyebrow={`Step 2 of guided setup · Features & functions (${stepIndex + 1}/${FEATURE_STEPS.length})`}
        title="Project Planner features & functions"
        description="These are all settings that can be tailored to the way your organisation runs — payment runs, annual leave for staff on the books, and more in-depth options such as Warnings: a clever feature built into Project Planner to help with booking clashes and labour mis-allocation."
      />

      <FeatureProgress current={stepIndex} />
      <p className="mb-6 text-sm font-semibold text-slate-700">{FEATURE_STEPS[stepIndex]?.label}</p>

      {subStep === 'working-hours' && (
        <WorkingHoursSetupSection
          value={value.payrollTimePolicy}
          onChange={(payrollTimePolicy) => patch({ payrollTimePolicy })}
        />
      )}

      {subStep === 'annual-leave' && (
        <AnnualLeaveSetupSection
          value={value.annualLeaveDefaults}
          countryCode={countryCode}
          countryLabel={countryLabel}
          onChange={(annualLeaveDefaults) => patch({ annualLeaveDefaults })}
          onRegionChange={onRegionChange}
        />
      )}

      {subStep === 'schedule' && (
        <ScheduleOptionsSetupSection
          value={value.myScheduleOptions}
          onChange={(myScheduleOptions) => patch({ myScheduleOptions })}
        />
      )}

      {subStep === 'warnings' && (
        <WarningsSetupSection
          value={value.warningDetection}
          onChange={(warningDetection) => patch({ warningDetection })}
        />
      )}

      {subStep === 'material-cutoff' && (
        <div className="space-y-4">
          <SetupNote>
            Sends a daily reminder to all managers when material orders need to be placed before the cut-off time.
            Saved to your admin profile and used across the organisation.
          </SetupNote>
          <SetupCard>
            <SetupToggle
              label="Material cut-off notification to all managers"
              description={`Daily at ${cutoffTime}`}
              checked={value.notificationPreferences.materialOrderCutOff}
              onChange={(materialOrderCutOff) =>
                patch({
                  notificationPreferences: {
                    ...value.notificationPreferences,
                    materialOrderCutOff,
                  },
                })
              }
            />
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-slate-700">Material cut-off time</span>
              <FormInput
                type="time"
                value={cutoffTime}
                onChange={(e) => {
                  const parsed = parseCutoffTime(e.target.value)
                  patch({
                    notificationPreferences: {
                      ...value.notificationPreferences,
                      materialCutOffHour: parsed.hour,
                      materialCutOffMinute: parsed.minute,
                    },
                  })
                }}
                className="w-auto border-none bg-transparent text-right font-semibold text-blue-600"
              />
            </div>
            <SetupToggle
              label="Material cut-off email on Saturday"
              checked={value.notificationPreferences.materialCutOffOnSaturday}
              onChange={(materialCutOffOnSaturday) =>
                patch({
                  notificationPreferences: {
                    ...value.notificationPreferences,
                    materialCutOffOnSaturday,
                  },
                })
              }
            />
            <SetupToggle
              label="Material cut-off email on Sunday"
              checked={value.notificationPreferences.materialCutOffOnSunday}
              onChange={(materialCutOffOnSunday) =>
                patch({
                  notificationPreferences: {
                    ...value.notificationPreferences,
                    materialCutOffOnSunday,
                  },
                })
              }
            />
          </SetupCard>
        </div>
      )}

      {subStep === 'payment-runs' && (
        <PaymentRunsSetupSection
          value={value.invoicing}
          onChange={(invoicing) => patch({ invoicing })}
        />
      )}

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <SetupStepNav
        onBack={goBack}
        onNext={goNext}
        nextLabel={isLast ? 'Continue to team setup' : 'Continue'}
      />
    </div>
  )
}

export const ORG_FEATURES_STEP_COUNT = FEATURE_STEPS.length

'use client'

import { useState } from 'react'
import { FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import {
  MONTHS,
  SetupCard,
  SetupNote,
  SetupStepHeader,
  SetupStepNav,
  SetupSectionLabel,
  SetupToggle,
} from '@/components/setup/setupFormPrimitives'
import {
  capitalizeDay,
  WEEKDAY_OPTIONS,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
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
  { id: 'warnings', label: 'Warnings' },
  { id: 'material-cutoff', label: 'Material cut-off' },
  { id: 'payment-runs', label: 'Payment runs' },
]

type OrganisationFeaturesStepProps = {
  value: OrganisationFeaturesSetup
  onChange: (value: OrganisationFeaturesSetup) => void
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
  onChange,
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

  function patchPayroll(partial: Partial<OrgPayrollTimePolicy>) {
    onChange({ ...value, payrollTimePolicy: { ...value.payrollTimePolicy, ...partial } })
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
      <p className="mb-6 text-sm font-semibold text-slate-700">
        {FEATURE_STEPS[stepIndex]?.label}
      </p>

      {subStep === 'working-hours' && (
        <div className="space-y-4">
          <SetupNote>
            Default working hours for new operatives. Mon–Fri hours outside the standard window count
            as overtime at the weekday multiplier.
          </SetupNote>
          <SetupCard>
            <div className="space-y-4 p-4">
              <SetupSectionLabel>Standard day (Mon–Fri reference)</SetupSectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>Start time</FormLabel>
                  <FormInput
                    type="time"
                    value={value.payrollTimePolicy.standardDayStart}
                    onChange={(e) => patchPayroll({ standardDayStart: e.target.value })}
                  />
                </div>
                <div>
                  <FormLabel>End time</FormLabel>
                  <FormInput
                    type="time"
                    value={value.payrollTimePolicy.standardDayEnd}
                    onChange={(e) => patchPayroll({ standardDayEnd: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>Unpaid break (minutes)</FormLabel>
                  <FormInput
                    type="number"
                    min={0}
                    step={5}
                    value={value.payrollTimePolicy.unpaidBreakMinutes}
                    onChange={(e) => patchPayroll({ unpaidBreakMinutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <FormLabel>Standard paid hours</FormLabel>
                  <FormInput
                    type="number"
                    min={0}
                    step={0.5}
                    value={value.payrollTimePolicy.standardPaidHours}
                    onChange={(e) => patchPayroll({ standardPaidHours: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>Break window start</FormLabel>
                  <FormInput
                    type="time"
                    value={value.payrollTimePolicy.breakWindowStart}
                    onChange={(e) => patchPayroll({ breakWindowStart: e.target.value })}
                  />
                </div>
                <div>
                  <FormLabel>Break window end</FormLabel>
                  <FormInput
                    type="time"
                    value={value.payrollTimePolicy.breakWindowEnd}
                    onChange={(e) => patchPayroll({ breakWindowEnd: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <FormLabel>Weekday overtime multiplier</FormLabel>
                <FormInput
                  type="number"
                  min={1}
                  max={3}
                  step={0.5}
                  value={value.payrollTimePolicy.weekdayOutsideStandardMultiplier}
                  onChange={(e) =>
                    patchPayroll({ weekdayOutsideStandardMultiplier: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </SetupCard>
          {(['saturday', 'sunday'] as const).map((day) => (
            <SetupCard key={day}>
              <div className="p-4 space-y-3">
                <SetupSectionLabel>{day.charAt(0).toUpperCase() + day.slice(1)}</SetupSectionLabel>
                <SetupToggle
                  label="All hours at multiplier"
                  description={`All hours on ${day} use the multiplier rate.`}
                  checked={value.payrollTimePolicy[day].allHoursAtMultiplierMode}
                  onChange={(checked) =>
                    patchPayroll({
                      [day]: { ...value.payrollTimePolicy[day], allHoursAtMultiplierMode: checked },
                    })
                  }
                />
                <div>
                  <FormLabel>Multiplier</FormLabel>
                  <FormInput
                    type="number"
                    min={1}
                    max={3}
                    step={0.5}
                    value={value.payrollTimePolicy[day].allHoursMultiplier}
                    onChange={(e) =>
                      patchPayroll({
                        [day]: {
                          ...value.payrollTimePolicy[day],
                          allHoursMultiplier: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>
            </SetupCard>
          ))}
        </div>
      )}

      {subStep === 'annual-leave' && (
        <div className="space-y-4">
          <SetupNote>
            Default annual leave for <strong>new</strong> managers and operatives. Existing users keep
            their own values unless an admin edits their profile.
          </SetupNote>
          <SetupCard>
            <div className="space-y-4 p-4">
              <div>
                <FormLabel>Days per year</FormLabel>
                <FormInput
                  type="number"
                  min={0}
                  max={365}
                  value={value.annualLeaveDefaults.daysPerYear}
                  onChange={(e) =>
                    patch({
                      annualLeaveDefaults: {
                        ...value.annualLeaveDefaults,
                        daysPerYear: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>Leave year starts</FormLabel>
                  <FormSelect
                    value={value.annualLeaveDefaults.startMonth}
                    onChange={(e) =>
                      patch({
                        annualLeaveDefaults: {
                          ...value.annualLeaveDefaults,
                          startMonth: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </FormSelect>
                </div>
                <div>
                  <FormLabel>Leave year ends</FormLabel>
                  <FormSelect
                    value={value.annualLeaveDefaults.endMonth}
                    onChange={(e) =>
                      patch({
                        annualLeaveDefaults: {
                          ...value.annualLeaveDefaults,
                          endMonth: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              </div>
              <SetupToggle
                label="Carry unused days into next leave year"
                checked={value.annualLeaveDefaults.carriesOver}
                onChange={(carriesOver) =>
                  patch({
                    annualLeaveDefaults: { ...value.annualLeaveDefaults, carriesOver },
                  })
                }
              />
            </div>
          </SetupCard>
        </div>
      )}

      {subStep === 'schedule' && (
        <div className="space-y-4">
          <SetupNote>
            Options shown in <strong>My Schedule</strong> for admins and managers when booking their
            own time (office, WFH, site survey, plus any custom items).
          </SetupNote>
          <SetupCard>
            <SetupToggle
              label="Office"
              checked={value.myScheduleOptions.showOffice}
              onChange={(showOffice) =>
                patch({ myScheduleOptions: { ...value.myScheduleOptions, showOffice } })
              }
            />
            <SetupToggle
              label="Working from home"
              checked={value.myScheduleOptions.showWorkingFromHome}
              onChange={(showWorkingFromHome) =>
                patch({ myScheduleOptions: { ...value.myScheduleOptions, showWorkingFromHome } })
              }
            />
            <SetupToggle
              label="Site survey"
              checked={value.myScheduleOptions.showSiteSurvey}
              onChange={(showSiteSurvey) =>
                patch({ myScheduleOptions: { ...value.myScheduleOptions, showSiteSurvey } })
              }
            />
          </SetupCard>
        </div>
      )}

      {subStep === 'warnings' && (
        <div className="space-y-4">
          <SetupNote tone="emerald">
            <strong>Why Warnings matter:</strong> Project Planner continuously scans your schedule for
            booking clashes, unbooked labour and material list issues. Catching these early prevents
            double-bookings on site and helps you spot when operatives are free — saving costly
            mis-allocation. You can fine-tune detection windows and exclusions later in Settings.
          </SetupNote>
          <SetupCard>
            <div className="space-y-4 p-4">
              <SetupToggle
                label="Detect scheduling clashes"
                checked={value.warningDetection.detectClashes}
                onChange={(detectClashes) =>
                  patch({ warningDetection: { ...value.warningDetection, detectClashes } })
                }
              />
              <div>
                <FormLabel>Look ahead</FormLabel>
                <FormSelect
                  value={
                    value.warningDetection.clashLookaheadMode === 'numberOfDays' ? 'days' : 'week'
                  }
                  onChange={(e) =>
                    patch({
                      warningDetection: {
                        ...value.warningDetection,
                        clashLookaheadMode:
                          e.target.value === 'days' ? 'numberOfDays' : 'endOfWorkingWeek',
                      },
                    })
                  }
                >
                  <option value="week">End of the working week</option>
                  <option value="days">Set number of days</option>
                </FormSelect>
              </div>
              {value.warningDetection.clashLookaheadMode === 'numberOfDays' && (
                <div>
                  <FormLabel>Days ahead</FormLabel>
                  <FormInput
                    type="number"
                    min={1}
                    value={value.warningDetection.clashLookaheadDays}
                    onChange={(e) =>
                      patch({
                        warningDetection: {
                          ...value.warningDetection,
                          clashLookaheadDays: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              )}
              <SetupToggle
                label="Include weekends for unbooked labour detection"
                description="Only affects unbooked labour warnings."
                checked={value.warningDetection.includeWeekendsForUnbookedLabour}
                onChange={(includeWeekendsForUnbookedLabour) =>
                  patch({
                    warningDetection: {
                      ...value.warningDetection,
                      includeWeekendsForUnbookedLabour,
                    },
                  })
                }
              />
            </div>
          </SetupCard>
        </div>
      )}

      {subStep === 'material-cutoff' && (
        <div className="space-y-4">
          <SetupNote>
            Sends a daily reminder to all managers when material orders need to be placed before the
            cut-off time. Saved to your admin profile and used across the organisation.
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
        <div className="space-y-4">
          <SetupNote>
            How payment runs and timesheets roll up for your team. Matches{' '}
            <strong>Settings → Payment runs &amp; timesheets</strong>.
          </SetupNote>
          <SetupCard>
            <div className="space-y-4 p-4">
              <div>
                <FormLabel>Payment run mode</FormLabel>
                <FormSelect
                  value={value.invoicing.paymentRunMode}
                  onChange={(e) =>
                    patch({
                      invoicing: {
                        ...value.invoicing,
                        paymentRunMode: e.target.value as 'date_ranges' | 'recurring_timeframe',
                      },
                    })
                  }
                >
                  <option value="recurring_timeframe">Choose recurring timeframe</option>
                  <option value="date_ranges">Set payment run date ranges</option>
                </FormSelect>
              </div>
              {value.invoicing.paymentRunMode === 'recurring_timeframe' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormLabel>Run period starts</FormLabel>
                    <FormSelect
                      value={value.invoicing.recurringRunStartDay}
                      onChange={(e) =>
                        patch({
                          invoicing: { ...value.invoicing, recurringRunStartDay: e.target.value },
                        })
                      }
                    >
                      {WEEKDAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {capitalizeDay(day)}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                  <div>
                    <FormLabel>Run period ends</FormLabel>
                    <FormSelect
                      value={value.invoicing.recurringRunEndDay}
                      onChange={(e) =>
                        patch({
                          invoicing: { ...value.invoicing, recurringRunEndDay: e.target.value },
                        })
                      }
                    >
                      {WEEKDAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {capitalizeDay(day)}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                </div>
              )}
              <div>
                <FormLabel>Payment date mode</FormLabel>
                <FormSelect
                  value={value.invoicing.paymentDateMode}
                  onChange={(e) =>
                    patch({
                      invoicing: {
                        ...value.invoicing,
                        paymentDateMode: e.target.value as 'specific_dates' | 'recurring_date',
                      },
                    })
                  }
                >
                  <option value="recurring_date">Recurring payment date</option>
                  <option value="specific_dates">Set payment date/s</option>
                </FormSelect>
              </div>
              {value.invoicing.paymentDateMode === 'recurring_date' && (
                <div>
                  <FormLabel>Recurring payment day</FormLabel>
                  <FormSelect
                    value={value.invoicing.recurringPaymentDay}
                    onChange={(e) =>
                      patch({
                        invoicing: { ...value.invoicing, recurringPaymentDay: e.target.value },
                      })
                    }
                  >
                    {WEEKDAY_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        Every {capitalizeDay(day)}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              )}
              <div>
                <FormLabel>Note to users on timesheets</FormLabel>
                <FormTextarea
                  rows={3}
                  value={value.invoicing.noteToUsers}
                  onChange={(e) =>
                    patch({ invoicing: { ...value.invoicing, noteToUsers: e.target.value } })
                  }
                />
              </div>
            </div>
          </SetupCard>
        </div>
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

import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/canonical'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { dailyOverviewStandardHoursLabel } from '@/lib/daily-overview/standardHoursLabel'

const ZONE = 'Europe/London'
const SAT = '2026-11-21'
const SUN = '2026-11-22'
const MON = '2026-11-23'
const windowDay = {
  allHoursAtMultiplierMode: false,
  allHoursMultiplier: 2,
  definedWindowStart: '07:30',
  definedWindowEnd: '14:00',
  countsAsStandardHours: 8,
  outsideWindowMultiplier: 1.5,
  sameAsSaturday: false,
}
const policy = {
  ...DEFAULT_PAYROLL_POLICY,
  saturday: windowDay,
  sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false },
} as unknown as OrgPayrollTimePolicy

test('Daily overview label: a set-window weekend day reads "Weekend window hrs" with the window', () => {
  assert.deepEqual(dailyOverviewStandardHoursLabel(policy, SAT, ZONE), {
    label: 'Weekend window hrs',
    hint: '07:30–14:00 counts as a full day',
  })
})

test('Daily overview label: a weekend day paid every hour at a multiplier keeps "Standard hrs"', () => {
  assert.deepEqual(dailyOverviewStandardHoursLabel(policy, SUN, ZONE), { label: 'Standard hrs', hint: null })
})

test('Daily overview label: weekdays and a missing policy keep "Standard hrs"', () => {
  assert.deepEqual(dailyOverviewStandardHoursLabel(policy, MON, ZONE), { label: 'Standard hrs', hint: null })
  assert.deepEqual(dailyOverviewStandardHoursLabel(null, SAT, ZONE), { label: 'Standard hrs', hint: null })
})

import { weekendCustomHoursDefault } from '@/lib/canonical'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

/**
 * Owner decision 23 Nov (item 31, option 1): the label of Daily Overview's standard-hours figure. On a Saturday or
 * Sunday whose working-hours rule is a set window, a booking that covers the window counts as one full day (rulebook
 * §4.3, 1.49.0), so the figure reads "Weekend window hrs" with the window as a hint ("07:30–14:00 counts as a full
 * day"). The window is the rulebook's (`weekendCustomHoursDefault`: that day's set window under the policy in effect;
 * null on a weekday or a day paid every hour at a multiplier) — never worked out here. Wording only: the figure is
 * unchanged.
 */
export function dailyOverviewStandardHoursLabel(
  policy: OrgPayrollTimePolicy | null | undefined,
  dayKey: string,
  timeZone: string
): { label: string; hint: string | null } {
  const window = weekendCustomHoursDefault(policy, dayKey, timeZone)
  if (!window) return { label: 'Standard hrs', hint: null }
  return { label: 'Weekend window hrs', hint: `${window.start}–${window.end} counts as a full day` }
}

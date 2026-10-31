/**
 * iOS parity source: Core/PayrollTimePolicyCatalog.swift
 * Spec: docs/ios-parity/04-business-logic.md — ported for Home sorting; full hours engine is section 17.
 */

import { dayKey } from '@/lib/ios-parity/londonTime'
import { DEFAULT_PAYROLL_TIME_POLICY, type PayrollTimePolicy } from '@/lib/home/upNext'

export { dayKey }

export interface OrgPayrollSettings {
  payrollTimePolicy?: PayrollTimePolicy
  payrollTimePolicyPrior?: PayrollTimePolicy
  payrollTimePolicyEffectiveFrom?: string
  payrollTimePolicyScheduled?: { policy: PayrollTimePolicy; effectiveFrom: string } | null
}

/**
 * Working hours in effect on `day` — same rule as canonical `effectivePayrollTimePolicy`:
 * a scheduled change from its day on, the prior rules before effectiveFrom, otherwise current.
 */
export function policyForDay(
  day: Date,
  organization: OrgPayrollSettings | null | undefined,
  timeZone?: string
): PayrollTimePolicy {
  if (!organization) return DEFAULT_PAYROLL_TIME_POLICY
  const current = organization.payrollTimePolicy ?? DEFAULT_PAYROLL_TIME_POLICY
  const key = dayKey(day, timeZone)
  const scheduled = organization.payrollTimePolicyScheduled
  if (scheduled && key >= scheduled.effectiveFrom) return scheduled.policy
  const effectiveFrom = organization.payrollTimePolicyEffectiveFrom
  if (!effectiveFrom) return current
  if (key >= effectiveFrom) return current
  return organization.payrollTimePolicyPrior ?? current
}

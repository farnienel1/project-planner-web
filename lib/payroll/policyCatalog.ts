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
}

export function policyForDay(
  day: Date,
  organization: OrgPayrollSettings | null | undefined
): PayrollTimePolicy {
  if (!organization) return DEFAULT_PAYROLL_TIME_POLICY
  const current = organization.payrollTimePolicy ?? DEFAULT_PAYROLL_TIME_POLICY
  const effectiveFrom = organization.payrollTimePolicyEffectiveFrom
  if (!effectiveFrom) return current
  const key = dayKey(day)
  if (key >= effectiveFrom) return current
  return organization.payrollTimePolicyPrior ?? current
}

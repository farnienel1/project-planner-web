import type { OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'

export type WarningLookAheadUiMode = 'week' | 'days' | 'invoicing'

export function warningLookAheadToUiMode(
  mode: OrgWarningDetectionSettings['clashLookaheadMode']
): WarningLookAheadUiMode {
  if (mode === 'numberOfDays') return 'days'
  if (mode === 'endOfInvoicingPeriod') return 'invoicing'
  return 'week'
}

export function warningLookAheadFromUiMode(
  mode: WarningLookAheadUiMode
): OrgWarningDetectionSettings['clashLookaheadMode'] {
  if (mode === 'days') return 'numberOfDays'
  if (mode === 'invoicing') return 'endOfInvoicingPeriod'
  return 'endOfWorkingWeek'
}

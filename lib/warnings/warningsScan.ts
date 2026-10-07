import type { OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'

export type WarningsScreenPhase = 'scanning' | 'empty' | 'list'

/**
 * iOS WarningsDetailView (filterChip defaults to .all) stays on the scanning
 * empty state until live detection finishes. Bookings already in memory with an
 * empty roster, operative list, or project list is not "No active warnings".
 */
export function warningsScreenPhase(input: {
  detectionReady: boolean
  rosterReady: boolean
  operativesReady: boolean
  projectsReady: boolean
  warningCount: number
}): WarningsScreenPhase {
  if (!input.detectionReady || !input.rosterReady || !input.operativesReady || !input.projectsReady) {
    return 'scanning'
  }
  return input.warningCount > 0 ? 'list' : 'empty'
}

/**
 * iOS scans with the organisation document's OrgWarningDetectionSettings
 * (OrgWarningDetectionSettings.coverageStart/coverageEnd). An unsaved settings
 * draft must not choose the window before that read settles, and must not
 * replace a saved mode such as endOfInvoicingPeriod.
 */
export function warningDetectionForScan(
  server: OrgWarningDetectionSettings | null | undefined,
  cached: OrgWarningDetectionSettings | null | undefined,
  serverSettled: boolean
): OrgWarningDetectionSettings | null {
  if (!serverSettled) return null
  if (server) return server
  return cached ?? null
}

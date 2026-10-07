import type { OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { organizationIdsMatch } from '@/lib/orgMembership/webActiveOrg'

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

export function countGeneratedWarnings(result: {
  clashWarnings: readonly unknown[]
  managerClashWarnings: readonly unknown[]
  unbookedWarnings: readonly unknown[]
  materialWarnings: readonly unknown[]
  qualificationWarnings: readonly unknown[]
  unverifiedWarnings: readonly unknown[]
}): number {
  return (
    result.clashWarnings.length +
    result.managerClashWarnings.length +
    result.unbookedWarnings.length +
    result.materialWarnings.length +
    result.qualificationWarnings.length +
    result.unverifiedWarnings.length
  )
}

/** Rows saved for another company are not an empty list for this one. */
export function partitionRowsByOrganization<T extends { organizationId?: string | null }>(
  rows: readonly T[],
  organizationId: string
): { rows: T[]; foreign: boolean } {
  if (!organizationId) return { rows: [], foreign: false }
  const own: T[] = []
  let foreignCount = 0
  for (const row of rows) {
    const named = String(row.organizationId || '').trim()
    if (!named || organizationIdsMatch(named, organizationId)) own.push(row)
    else foreignCount += 1
  }
  if (foreignCount > 0 && own.length === 0) return { rows: [], foreign: true }
  return { rows: own, foreign: false }
}

/** True while a scan must not replace warnings already on screen with an empty list. */
export function warningsScanPartial(input: {
  detectionReady: boolean
  rosterReady: boolean
  operativesReady: boolean
  projectsReady: boolean
  bookingsLoading: boolean
  ownBookingCount: number
  bookingsForeign: boolean
  managerLoading: boolean
  ownManagerBookingCount: number
  managerForeign: boolean
  rosterForeign: boolean
  operativesForeign: boolean
}): boolean {
  if (!input.detectionReady || !input.rosterReady || !input.operativesReady || !input.projectsReady) return true
  if (input.bookingsForeign || input.managerForeign || input.rosterForeign || input.operativesForeign) return true
  if (input.bookingsLoading && input.ownBookingCount === 0) return true
  if (input.managerLoading && input.ownManagerBookingCount === 0) return true
  return false
}

/**
 * A failed or partial scan keeps warnings already computed.
 * A finished scan with none is the honest empty list.
 */
export function retainWarningsAfterScan<T>(input: {
  previous: T | null
  next: T
  partial: boolean
  previousCount: number
  nextCount: number
  sameOrganization: boolean
}): T {
  if (!input.sameOrganization || !input.previous) return input.next
  if (input.partial && input.previousCount > 0 && input.nextCount === 0) return input.previous
  return input.next
}

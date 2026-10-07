import type { OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { organizationIdsMatch } from '@/lib/orgMembership/webActiveOrg'

export type WarningsScreenPhase = 'scanning' | 'empty' | 'list'

/**
 * The scanning empty state stays up only while nothing real has been published.
 * Rows from a finished source show immediately. A slow roster, materials, or
 * qualification read must not hide them. Zero rows before those sources finish
 * is still scanning, not "No active warnings".
 */
export function warningsScreenPhase(input: {
  detectionReady: boolean
  rosterReady: boolean
  operativesReady: boolean
  projectsReady: boolean
  warningCount: number
}): WarningsScreenPhase {
  if (input.warningCount > 0) return 'list'
  if (!input.detectionReady || !input.rosterReady || !input.operativesReady || !input.projectsReady) {
    return 'scanning'
  }
  return 'empty'
}

export type WarningScanLanes = {
  clashes: boolean
  managerClashes: boolean
  unbooked: boolean
  materials: boolean
  qualifications: boolean
  unverified: boolean
}

/** Each warning family publishes when its own reads have finished. */
export function warningScanLanes(input: {
  detectionReady: boolean
  bookingsReady: boolean
  managerReady: boolean
  rosterReady: boolean
  operativesReady: boolean
  projectsReady: boolean
  holidaysReady: boolean
  materialsReady: boolean
  sendRecordsReady: boolean
}): WarningScanLanes {
  return {
    clashes: input.detectionReady && input.bookingsReady && input.operativesReady,
    managerClashes: input.detectionReady && input.managerReady && input.bookingsReady,
    unbooked:
      input.detectionReady &&
      input.bookingsReady &&
      input.managerReady &&
      input.rosterReady &&
      input.operativesReady &&
      input.holidaysReady,
    materials:
      input.materialsReady && input.sendRecordsReady && input.projectsReady && input.bookingsReady,
    qualifications: input.operativesReady,
    unverified: input.operativesReady && input.rosterReady,
  }
}

type WarningLaneResult = {
  clashWarnings: readonly unknown[]
  managerClashWarnings: readonly unknown[]
  unbookedWarnings: readonly unknown[]
  materialWarnings: readonly unknown[]
  qualificationWarnings: readonly unknown[]
  unverifiedWarnings: readonly unknown[]
  coreCount: number
  highCount: number
  mediumCount: number
  lowCount: number
}

function countsForLanes<T extends WarningLaneResult>(result: T): T {
  const highCount = result.clashWarnings.length + result.unbookedWarnings.length
  const mediumCount = result.managerClashWarnings.length
  const lowCount =
    result.materialWarnings.length + result.qualificationWarnings.length + result.unverifiedWarnings.length
  return {
    ...result,
    highCount,
    mediumCount,
    lowCount,
    coreCount: highCount + mediumCount + lowCount,
  }
}

function keepLane<T>(ready: boolean, computed: readonly T[], previous: readonly T[] | undefined): readonly T[] {
  if (ready) return computed
  return previous ?? []
}

/**
 * Publish families whose sources have finished. A family still loading keeps
 * the rows already shown for it, so an empty partial cannot wipe the list.
 */
export function publishReadyWarningLanes<T extends WarningLaneResult>(input: {
  previous: T | null
  computed: T
  lanes: WarningScanLanes
  sameOrganization: boolean
}): T {
  const previous = input.sameOrganization ? input.previous : null
  return countsForLanes({
    ...input.computed,
    clashWarnings: keepLane(input.lanes.clashes, input.computed.clashWarnings, previous?.clashWarnings),
    managerClashWarnings: keepLane(
      input.lanes.managerClashes,
      input.computed.managerClashWarnings,
      previous?.managerClashWarnings
    ),
    unbookedWarnings: keepLane(input.lanes.unbooked, input.computed.unbookedWarnings, previous?.unbookedWarnings),
    materialWarnings: keepLane(input.lanes.materials, input.computed.materialWarnings, previous?.materialWarnings),
    qualificationWarnings: keepLane(
      input.lanes.qualifications,
      input.computed.qualificationWarnings,
      previous?.qualificationWarnings
    ),
    unverifiedWarnings: keepLane(
      input.lanes.unverified,
      input.computed.unverifiedWarnings,
      previous?.unverifiedWarnings
    ),
  })
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

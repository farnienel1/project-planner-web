/**
 * Flatten dated Warnings cards and order them with the shared rulebook helper.
 * Filter chips still decide which kinds are present; this only reorders.
 */

import { sortWarningsByDate, type WarningsSortDirection } from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { LeaveCoverageWarning } from '@/lib/warnings/leaveCoverageWarnings'
import type { ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import type { MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import type { UnbookedLabourDayGroup } from '@/lib/warnings/unbookedLabourWarnings'
import type { QualificationExpiryWarning, UnverifiedOperativeWarning } from '@/lib/warnings/generateOrgWarnings'

export type WarningListItem =
  | { kind: 'unbooked'; dayKey: string; group: UnbookedLabourDayGroup }
  | { kind: 'leave'; dayKey: string; warning: LeaveCoverageWarning }
  | { kind: 'material'; dayKey: string; warning: MissedMaterialOrderWarning }
  | { kind: 'qualification'; dayKey: string; warning: QualificationExpiryWarning }
  | { kind: 'unverified'; dayKey: string; warning: UnverifiedOperativeWarning }
  | { kind: 'managerClash'; dayKey: string; warning: ManagerBookingClashWarning }
  | { kind: 'clash'; dayKey: string; warning: OperativeBookingClashWarning }

export function orderWarningListItems(input: {
  unbookedGroups?: readonly UnbookedLabourDayGroup[]
  leaveWarnings?: readonly LeaveCoverageWarning[]
  materialWarnings?: readonly MissedMaterialOrderWarning[]
  qualificationWarnings?: readonly QualificationExpiryWarning[]
  unverifiedWarnings?: readonly UnverifiedOperativeWarning[]
  managerClashWarnings?: readonly ManagerBookingClashWarning[]
  clashWarnings?: readonly OperativeBookingClashWarning[]
  direction: WarningsSortDirection
  timeZone?: string
}): WarningListItem[] {
  const zone = input.timeZone
  const rows: WarningListItem[] = [
    ...(input.unbookedGroups ?? []).map((group) => ({
      kind: 'unbooked' as const,
      dayKey: group.id,
      group,
    })),
    ...(input.leaveWarnings ?? []).map((warning) => ({
      kind: 'leave' as const,
      dayKey: warning.dayKey,
      warning,
    })),
    ...(input.materialWarnings ?? []).map((warning) => ({
      kind: 'material' as const,
      dayKey: dayKey(warning.date, zone),
      warning,
    })),
    ...(input.qualificationWarnings ?? []).map((warning) => ({
      kind: 'qualification' as const,
      dayKey: warning.dayKey,
      warning,
    })),
    ...(input.unverifiedWarnings ?? []).map((warning) => ({
      kind: 'unverified' as const,
      dayKey: '',
      warning,
    })),
    ...(input.managerClashWarnings ?? []).map((warning) => ({
      kind: 'managerClash' as const,
      dayKey: dayKey(warning.date, zone),
      warning,
    })),
    ...(input.clashWarnings ?? []).map((warning) => ({
      kind: 'clash' as const,
      dayKey: dayKey(warning.date, zone),
      warning,
    })),
  ]
  return sortWarningsByDate(rows, input.direction)
}

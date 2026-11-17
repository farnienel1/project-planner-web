/**
 * Owner decision G (17 Nov follow-up): the signed-in person's own "a signed timesheet changed" answer — the yellow
 * triangle beside Timesheets in the sidebar and on the hub's "My timesheets" card. Worked out once, in the app shell
 * (`useMineChangedMonitor`), from the person's own sheets of the last `RECENT_PAY_RUN_COUNT` pay runs and their own
 * bookings; the hub only reads the result (`useMineChangedStore`). The rules are the rulebook's:
 * `signedTimesheetBookingChanges` (through `periodBookingChanges`) waiting for the person, or a revision due on an
 * exported latest version (`timesheetRevisionDue`). Pure — no Firebase.
 */
import { resolveTimesheetPeriod, timesheetPeriodFromInvoicing, timesheetRevisionDue, timesheetVersionsForPeriod } from '@/lib/canonical'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { periodBookingChanges, type BookingChangeCatalogue } from '@/lib/timesheets/timesheetBookingChanges'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import type { User } from '@/types'

export type MineSheetRow = { period: { start: Date; end: Date }; draft: TimesheetDraft }

/**
 * Rulebook 1.55.0 §8 (`timesheetRevisionDue`): the listed draft is the period's latest version; it is passed as a
 * one-version chain (its stored id and its resolved `exportedAt`), with its `signedTimesheetBookingChanges`.
 */
export function revisionDueOf(
  draft: TimesheetDraft | undefined,
  documentId: string | null | undefined,
  change: { exported?: boolean | null; changed?: boolean | null } | null | undefined
): boolean {
  if (!draft || !documentId) return false
  const chain = timesheetVersionsForPeriod([{ documentId, data: { exportedAt: draft.exportedAt ?? null } }])[0] ?? []
  return timesheetRevisionDue({ chain, change }).due
}

/**
 * The person's stored sheets that can need them (signed, or exported for a revision), each on the pay run it belongs to
 * (`resolveTimesheetPeriod` against the live payment-run settings, organisation zone).
 */
export function mineSheetRows(
  stored: ReadonlyArray<{ weekStart: Date; endDayKey?: string | null; draft: TimesheetDraft }>,
  invoicing: OrgInvoicingSettings,
  now: Date,
  timeZone: string
): MineSheetRow[] {
  const live = timesheetPeriodFromInvoicing({
    paymentRunMode: invoicing.paymentRunMode,
    ranges: invoicing.paymentRunDateRanges,
    recurringRunStartDay: invoicing.recurringRunStartDay,
    recurringRunEndDay: invoicing.recurringRunEndDay,
    referenceDayKey: dayKey(now, timeZone),
    timeZone,
  })
  return stored
    .filter((row) => Boolean(row.draft.operativeSignedAt) || Boolean(row.draft.exportedAt))
    .map((row) => {
      const resolved = resolveTimesheetPeriod({
        storedStartDayKey: dayKey(row.weekStart, timeZone),
        storedEndDayKey: row.endDayKey ?? null,
        currentPeriod: live,
      })
      return {
        period: { start: dateFromDayKey(resolved.startDayKey, timeZone), end: dateFromDayKey(resolved.endDayKey, timeZone) },
        draft: row.draft,
      }
    })
}

/**
 * The start day keys of the person's pay runs that need them: a signed, unexported sheet whose bookings changed
 * (`waitingFor === 'person'`), or a revision due. A pay run the loaded bookings do not cover (`catalogue.coversPeriod`)
 * is never read as changed by its bookings (`periodBookingChanges`).
 */
export function mineChangedPeriodStarts(input: {
  rows: ReadonlyArray<MineSheetRow>
  subject: User
  catalogue: BookingChangeCatalogue
  timeZone: string
  documentIdOf: (draft: TimesheetDraft) => string | null
}): string[] {
  const starts = new Set<string>()
  for (const row of input.rows) {
    const change = periodBookingChanges(input.catalogue, input.subject, row.draft, row.period)
    if (change?.waitingFor === 'person' || revisionDueOf(row.draft, input.documentIdOf(row.draft), change)) {
      starts.add(periodStartKey(row.period.start, input.timeZone))
    }
  }
  return [...starts].sort()
}

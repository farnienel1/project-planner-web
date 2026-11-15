/**
 * Rulebook 1.47.0 §8: a signed timesheet reopens when its bookings change. Web only passes its draft and the
 * collector's live payroll lines to the rulebook (`signedTimesheetBookingChanges`); no comparison happens here.
 */
import {
  signedTimesheetBookingChanges,
  type SignedTimesheetBookingChanges,
  type SignedTimesheetLine,
  type SignedTimesheetSheet,
} from '@/lib/canonical'
import type { User } from '@/types'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { collectTimesheetPayroll, type TimesheetPayrollLineItem } from '@/lib/timesheets/timesheetPayrollCollector'
import { userTimesheetSelfSigned } from '@/lib/timesheets/timesheetApprovalPolicy'
import { userIdsSharingEmail } from '@/lib/timesheets/timesheetWeekUtils'

/** The draft in the rulebook's sheet shape (the stored fields the rule reads). */
export function signedTimesheetSheetFromDraft(draft: TimesheetDraft): SignedTimesheetSheet {
  return {
    operativeSignedAt: draft.operativeSignedAt ?? null,
    operativeSignedBookings: draft.operativeSignedBookings ?? null,
    managerSignedAt: draft.managerSignedAt ?? null,
    exportedAt: draft.exportedAt ?? null,
    weeklyReportOverride: draft.weeklyReportOverride
      ? {
          approvedAt: draft.weeklyReportOverride.approvedAt,
          lines: draft.weeklyReportOverride.lines as unknown as SignedTimesheetLine[],
        }
      : null,
  }
}

/** The collector's lines in the rulebook's line shape. */
export function signedTimesheetLiveLines(lines: ReadonlyArray<TimesheetPayrollLineItem>): SignedTimesheetLine[] {
  return lines.map((line) => ({
    id: line.id,
    bookingCollection: line.bookingCollection ?? null,
    bookingFingerprint: line.bookingFingerprint ?? null,
    isPayeDay: line.isPayeDay === true,
    bookingCreatedAt: line.bookingCreatedAt ?? null,
    bookingUpdatedAt: line.bookingUpdatedAt ?? null,
  }))
}

/** `signedTimesheetBookingChanges` for one web draft and the period's live payroll lines. */
export function draftBookingChanges(input: {
  draft: TimesheetDraft
  lines: ReadonlyArray<TimesheetPayrollLineItem>
  /** The whole booking archive has arrived (`timesheetSnapshotReady`); nothing reads as changed before. */
  liveLoaded: boolean
  selfSigned: boolean
}): SignedTimesheetBookingChanges {
  return signedTimesheetBookingChanges({
    sheet: signedTimesheetSheetFromDraft(input.draft),
    liveLines: signedTimesheetLiveLines(input.lines),
    liveLoaded: input.liveLoaded,
    selfSigned: input.selfSigned,
  })
}

/**
 * Rulebook 1.47.0 §8: the figures of a reopened (changed, unexported) sheet are the live bookings — its stale signed
 * snapshot is never shown, invoiced or exported. Any other sheet is returned as it is.
 */
export function draftForFigures(draft: TimesheetDraft, change: Pick<SignedTimesheetBookingChanges, 'reopened'> | null | undefined): TimesheetDraft {
  if (!change?.reopened || !draft.weeklyReportOverride) return draft
  return { ...draft, weeklyReportOverride: null }
}

/** What a list needs to price a person's live payroll lines for any period (the collector's inputs). */
export type BookingChangeCatalogue = Omit<Parameters<typeof collectTimesheetPayroll>[0], 'user' | 'periodStart' | 'periodEnd' | 'aliasUserIds'> & {
  users: ReadonlyArray<User>
  /** The whole booking archive has arrived for the organisation. */
  liveLoaded: boolean
}

/**
 * `signedTimesheetBookingChanges` for one person's sheet in one period (list rows, counts, the hub entry). A sheet
 * that nobody has signed is never changed, so the collector runs only for signed sheets.
 */
export function periodBookingChanges(
  catalogue: BookingChangeCatalogue,
  user: User,
  draft: TimesheetDraft | null | undefined,
  period: { start: Date; end: Date }
): SignedTimesheetBookingChanges | null {
  if (!draft || (!draft.operativeSignedAt && !draft.weeklyReportOverride)) return null
  const { users, liveLoaded, ...collector } = catalogue
  if (!liveLoaded) return null
  const payroll = collectTimesheetPayroll({
    ...collector,
    user,
    periodStart: period.start,
    periodEnd: period.end,
    aliasUserIds: userIdsSharingEmail(user, [...users]),
  })
  return draftBookingChanges({ draft, lines: payroll.lineItems, liveLoaded, selfSigned: userTimesheetSelfSigned(user, [...users]) })
}

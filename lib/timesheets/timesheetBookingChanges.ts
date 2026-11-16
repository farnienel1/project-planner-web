/**
 * Rulebook 1.47.0 §8: a signed timesheet reopens when its bookings change. Web only passes its draft, the collector's
 * live payroll lines and the stored booking documents to the rulebook (`signedTimesheetBookingChanges`); no comparison
 * happens here.
 */
import {
  bookingIdsForAccount,
  signedTimesheetBookingChanges,
  signedTimesheetBookingRecord,
  timesheetChangesWithLateExtras,
  timesheetLateExtrasSummary,
  type SignedTimesheetBooking,
  type TimesheetChanges,
  type TimesheetLateExtrasSummary,
  type SignedTimesheetBookingChanges,
  type SignedTimesheetBookingDocument,
  type SignedTimesheetLine,
  type SignedTimesheetSheet,
} from '@/lib/canonical'
import type { Booking, Operative, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { collectTimesheetPayroll, type TimesheetPayrollLineItem } from '@/lib/timesheets/timesheetPayrollCollector'
import { userTimesheetSelfSigned } from '@/lib/timesheets/timesheetApprovalPolicy'
import { userIdsSharingEmail } from '@/lib/timesheets/timesheetWeekUtils'
import { draftEntryFingerprints, timesheetSheetFields } from '@/lib/timesheets/timesheetAdjustments'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

/** The draft in the rulebook's sheet shape (the stored fields the rule reads). */
export function signedTimesheetSheetFromDraft(draft: TimesheetDraft): SignedTimesheetSheet {
  return {
    operativeSignedAt: draft.operativeSignedAt ?? null,
    operativeSignedBookings: draft.operativeSignedBookings ?? null,
    operativeSignedBookingsAt: draft.operativeSignedBookingsAt ?? null,
    operativeSignedBookingsSignedAt: draft.operativeSignedBookingsSignedAt ?? null,
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
    scheduleOptionPlace: line.scheduleOptionPlace === true,
  }))
}

const documentCache = new WeakMap<object, WeakMap<object, Map<string, SignedTimesheetBookingDocument[]>>>()

/**
 * Every stored labour and manager site booking (anyone's) in the rulebook's document shape — what decides whether a
 * signed booking that is no longer on the sheet was deleted, cancelled, moved or given to someone else. Cached per
 * loaded array and zone.
 */
export function signedTimesheetBookingDocuments(
  bookings: ReadonlyArray<Booking>,
  managerSiteBookings: ReadonlyArray<ManagerSiteBooking>,
  timeZone: string | undefined
): SignedTimesheetBookingDocument[] {
  const zone = timeZone ?? organizationZoneOr()
  const byManager = documentCache.get(bookings) ?? new WeakMap<object, Map<string, SignedTimesheetBookingDocument[]>>()
  documentCache.set(bookings, byManager)
  const byZone = byManager.get(managerSiteBookings) ?? new Map<string, SignedTimesheetBookingDocument[]>()
  byManager.set(managerSiteBookings, byZone)
  const hit = byZone.get(zone)
  if (hit) return hit
  const rows: SignedTimesheetBookingDocument[] = [
    ...bookings.map((booking) => ({
      bookingId: booking.id,
      collection: 'bookings',
      dayKey: dayKeyInZone(booking.date, zone),
      timeSlot: booking.timeSlot,
      workStartTime: booking.workStartTime,
      workEndTime: booking.workEndTime,
      isBreakRemoved: booking.isBreakRemoved === true,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
      status: booking.status,
      personId: booking.operativeId,
      projectId: booking.projectId,
    })),
    ...managerSiteBookings.map((booking) => ({
      bookingId: booking.id,
      collection: 'managerSiteBookings',
      dayKey: dayKeyInZone(booking.date, zone),
      timeSlot: booking.timeSlot,
      workStartTime: booking.workStartTime,
      workEndTime: booking.workEndTime,
      isBreakRemoved: booking.isBreakRemoved === true,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
      personId: booking.userId,
      locationType: booking.locationType,
      locationId: booking.locationId ?? '',
      customLocationName: booking.customLocationName ?? '',
    })),
  ]
  byZone.set(zone, rows)
  return rows
}

/** What the person signs (`operativeSignedBookings`), with the booking documents' person ids. */
export function draftSignedBookingRecord(input: {
  lines: ReadonlyArray<TimesheetPayrollLineItem>
  bookings: ReadonlyArray<Booking>
  managerSiteBookings: ReadonlyArray<ManagerSiteBooking>
  timeZone: string | undefined
}): SignedTimesheetBooking[] {
  return signedTimesheetBookingRecord(
    signedTimesheetLiveLines(input.lines),
    signedTimesheetBookingDocuments(input.bookings, input.managerSiteBookings, input.timeZone)
  )
}

/**
 * Second review #325 item 1 (guardrail 1): every id the person's bookings may be stored under — their users id, former
 * invite ids, same-email ids and `operatives` rows on their email (`bookingIdsForAccount`, the collector's own rule).
 */
export function timesheetPersonIds(user: User, users: ReadonlyArray<User>, operatives: ReadonlyArray<Operative>): string[] {
  return bookingIdsForAccount(
    { id: user.id, email: user.email, formerIds: user.formerUserIds ?? [], aliasIds: userIdsSharingEmail(user, [...users]) },
    operatives.map((row) => ({ id: row.id, email: row.email ?? null }))
  )
}

/** `signedTimesheetBookingChanges` for one web draft, the period's live payroll lines and the booking documents. */
export function draftBookingChanges(input: {
  draft: TimesheetDraft
  lines: ReadonlyArray<TimesheetPayrollLineItem>
  /** The booking documents loaded for (at least) the whole period; none = nothing can read as removed. */
  bookings?: ReadonlyArray<Booking> | null
  managerSiteBookings?: ReadonlyArray<ManagerSiteBooking> | null
  timeZone?: string
  /** Every id the person goes by (`timesheetPersonIds`); none = a booking is never read as given to someone else. */
  personIds?: ReadonlyArray<string> | null
  /** The period's bookings have arrived from the server (`timesheetSnapshotReady`); nothing reads as changed before. */
  liveLoaded: boolean
  selfSigned: boolean
}): TimesheetChanges {
  // Rulebook 1.54.0: one answer for the bookings (1.47.0) and late extras (`timesheetChangesWithLateExtras`).
  const bookingChange = signedTimesheetBookingChanges({
    sheet: signedTimesheetSheetFromDraft(input.draft),
    liveLines: signedTimesheetLiveLines(input.lines),
    liveBookings:
      input.bookings && input.managerSiteBookings
        ? signedTimesheetBookingDocuments(input.bookings, input.managerSiteBookings, input.timeZone)
        : null,
    personIds: input.personIds ?? null,
    liveLoaded: input.liveLoaded,
    selfSigned: input.selfSigned,
  })
  return timesheetChangesWithLateExtras(bookingChange, draftLateExtrasSummary(input.draft)) as TimesheetChanges
}

/**
 * Rulebook 1.54.0 §8: where the draft's late extras stand (`timesheetLateExtrasSummary`) — pending ones, and whether
 * the signed snapshot holds exactly the approved ones.
 */
export function draftLateExtrasSummary(draft: TimesheetDraft): TimesheetLateExtrasSummary {
  return timesheetLateExtrasSummary(timesheetSheetFields(draft), {
    entryFingerprints: draftEntryFingerprints(draft),
    exportedAtStored: draft.exportedAtStored === true || Boolean(draft.exportedAt),
  })
}

/**
 * Rulebook 1.47.0 §8: the figures of a reopened (changed, unexported) sheet are the live bookings — its stale signed
 * snapshot is never shown, invoiced or exported. Any other sheet is returned as it is.
 */
export function draftForFigures(
  draft: TimesheetDraft,
  change: (Pick<SignedTimesheetBookingChanges, 'reopened'> & { bookingsChanged?: boolean }) | null | undefined
): TimesheetDraft {
  // 1.54.0: late extras alone never discard the snapshot — its signed figures stand; only approved late extras join it.
  if (!change?.reopened || change.bookingsChanged === false || !draft.weeklyReportOverride) return draft
  return { ...draft, weeklyReportOverride: null }
}

/** What a list needs to price a person's live payroll lines for any period (the collector's inputs). */
export type BookingChangeCatalogue = Omit<Parameters<typeof collectTimesheetPayroll>[0], 'user' | 'periodStart' | 'periodEnd' | 'aliasUserIds'> & {
  users: ReadonlyArray<User>
  /** The bookings have arrived from the server. */
  liveLoaded: boolean
  /**
   * Whether the loaded booking window covers the whole pay run (review #325 item 6: a booking outside the window is
   * not deleted). Missing = the whole archive is loaded.
   */
  coversPeriod?: (period: { start: Date; end: Date }) => boolean
}

/** Whether a store's `coverage` (1.43.0) holds every booking from `startDayKey` on (the listeners have no end bound). */
export function bookingCoverageCoversDay(
  coverage: { organizationId: string; fullHistory: boolean; fromDayKey: string | null } | null | undefined,
  organizationId: string | null | undefined,
  startDayKey: string
): boolean {
  if (!coverage || !organizationId || coverage.organizationId !== organizationId) return false
  if (coverage.fullHistory) return true
  return Boolean(coverage.fromDayKey && coverage.fromDayKey <= startDayKey)
}

const objectIds = new WeakMap<object, number>()
let nextObjectId = 1
/** A stable number per object (or 0 for none), so a cache key changes whenever an input object is replaced. */
function objectId(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const held = objectIds.get(value)
  if (held) return held
  const id = nextObjectId++
  objectIds.set(value, id)
  return id
}

const periodCache = new WeakMap<object, WeakMap<object, WeakMap<object, Map<string, TimesheetChanges | null>>>>()

/**
 * `signedTimesheetBookingChanges` for one person's sheet in one period (list rows, counts, the hub entry). A sheet
 * that nobody has signed is never changed, so the collector runs only for signed sheets, once per draft, period and
 * set of loaded bookings (memoised).
 */
export function periodBookingChanges(
  catalogue: BookingChangeCatalogue,
  user: User,
  draft: TimesheetDraft | null | undefined,
  period: { start: Date; end: Date }
): TimesheetChanges | null {
  if (!draft || (!draft.operativeSignedAt && !draft.weeklyReportOverride && !draft.managerSignedAt)) return null
  const { users, liveLoaded, coversPeriod, ...collector } = catalogue
  // 1.54.0: late extras need no bookings — waiting ones still put the sheet with the line manager.
  if (!liveLoaded || (coversPeriod && !coversPeriod(period))) return timesheetChangesWithLateExtras(null, draftLateExtrasSummary(draft))
  // Memoised per loaded bookings, manager site bookings and draft (each a new object when it changes).
  // Second review nit: every input that decides the lines (schedule options, rate history, working hours, operatives,
  // roster, projects) is part of the key by object identity.
  const key = [
    user.id,
    period.start.getTime(),
    period.end.getTime(),
    collector.timeZone ?? '',
    objectId(users),
    objectId(collector.operatives),
    objectId(collector.projects),
    objectId(collector.smallWorks),
    objectId(collector.scheduleOptions),
    objectId(collector.history),
    objectId(collector.payrollPolicy),
    objectId(collector.payrollPolicyState),
  ].join('|')
  const byManager = periodCache.get(collector.bookings) ?? new WeakMap<object, WeakMap<object, Map<string, TimesheetChanges | null>>>()
  periodCache.set(collector.bookings, byManager)
  const byDraft = byManager.get(collector.managerSiteBookings) ?? new WeakMap<object, Map<string, TimesheetChanges | null>>()
  byManager.set(collector.managerSiteBookings, byDraft)
  const memo = byDraft.get(draft) ?? new Map<string, TimesheetChanges | null>()
  byDraft.set(draft, memo)
  const cached = memo.get(key)
  if (cached !== undefined) return cached
  const payroll = collectTimesheetPayroll({
    ...collector,
    user,
    periodStart: period.start,
    periodEnd: period.end,
    aliasUserIds: userIdsSharingEmail(user, [...users]),
  })
  const change = draftBookingChanges({
    draft,
    lines: payroll.lineItems,
    bookings: collector.bookings,
    managerSiteBookings: collector.managerSiteBookings,
    timeZone: collector.timeZone,
    personIds: timesheetPersonIds(user, users, collector.operatives),
    liveLoaded,
    selfSigned: userTimesheetSelfSigned(user, [...users]),
  })
  memo.set(key, change)
  return change
}

/**
 * Third review #325 item 1: once the signing save has written the record's server time, clear the local "write it as
 * the server time" flag on whatever the draft is now — also when it changed during the save — so a later save never
 * re-stamps `operativeSignedBookingsAt` with a later time (an addition in between would then be missed). Only the
 * draft of that same signature (`operativeSignedBookingsSignedAt`) is cleared; a newer signature keeps its own flag.
 */
export function clearSignedBookingsPending(current: TimesheetDraft, signedAt: Date | null | undefined): TimesheetDraft {
  if (!current.operativeSignedBookingsAtPending || !(signedAt instanceof Date)) return current
  const held = current.operativeSignedBookingsSignedAt
  if (!(held instanceof Date) || held.getTime() !== signedAt.getTime()) return current
  return { ...current, operativeSignedBookingsAtPending: false }
}


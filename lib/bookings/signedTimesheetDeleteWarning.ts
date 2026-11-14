/**
 * Rulebook 1.33.0 §2 (signed timesheets): deleting a labour or manager schedule booking on a day inside one of the
 * booked person's timesheets that is signed by the person or their line manager, or exported, shows
 * `bookingDeleteSignedTimesheetWarning(dayKey, sheets)` (`BOOKING_DELETE_SIGNED_TIMESHEET_WARNING`) and is still
 * allowed; the signed sheet never changes. iOS: `BookingStore.warnIfOnSignedTimesheet` /
 * `ManagerScheduleStore.warnIfOnSignedTimesheet` (shown once, after the delete, titled "Booking deleted").
 *
 * This file only gathers the inputs: who the booking names (`resolveBookingPerson`, then every id they go by,
 * `personIdSet`) and each `settings/timesheet_*` document's pay run (`parsePayrunSnapshotSheet`). The decision is the
 * rulebook's. No Firestore here, so it is unit-tested; the reads are `signedTimesheetDeleteNotice.ts`.
 */

import type { Operative, User } from '@/types'
import {
  bookingDeleteSignedTimesheetWarning,
  parsePayrunSnapshotSheet,
  personIdSet,
  resolveBookingPerson,
  rosterAliasIdsFor,
  timesheetDocumentSubjectId,
  type SignedTimesheetCandidate,
} from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'

/**
 * Every users id the person a booking names goes by: the account `personId` resolves to (a users id, a former invite
 * id, a same-email id or an `operatives` row on their email — `resolveBookingPerson`), then `personIdSet` of that
 * account. A booking that names no account on the roster (a catalogue operative with no login, or a roster not loaded
 * yet) gives just the stored id, so its own sheets are still found. Empty for a blank id.
 */
export function bookedPersonTimesheetUserIds(
  personId: string | null | undefined,
  users: ReadonlyArray<User>,
  operatives: ReadonlyArray<Pick<Operative, 'id' | 'email'>>,
  userIdAliases?: Readonly<Record<string, string>> | null
): string[] {
  const stored = String(personId ?? '').trim()
  if (!stored) return []
  const list = (users || []).filter((user) => user && user.id)
  const resolved = resolveBookingPerson(stored, {
    accounts: list.map((user) => ({
      id: user.id,
      email: user.email,
      formerIds: user.formerUserIds ?? [],
      aliasIds: rosterAliasIdsFor(user.id, userIdAliases),
    })),
    operatives: (operatives || []).map((row) => ({ id: row.id, email: row.email })),
  })
  const account = resolved.accountId ? list.find((user) => user.id === resolved.accountId) : undefined
  if (!account) return [stored]
  const ids = personIdSet(rulebookPerson(account, list), rulebookRoster(list))
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of [...ids, stored]) {
    const value = String(id ?? '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/**
 * The person's `settings` documents as `bookingDeleteSignedTimesheetWarning` takes them: each `timesheet_*` document's
 * stored fields plus its pay run (`startDayKey` / `endDayKey` from `parsePayrunSnapshotSheet`, organisation zone).
 * Anything that is not a readable timesheet is left out.
 */
export function signedTimesheetCandidatesFromDocs(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>,
  timeZone: string
): SignedTimesheetCandidate[] {
  const out: SignedTimesheetCandidate[] = []
  for (const row of docs || []) {
    // A sheet stored without `userId` names its person in its document id (`timesheetDocumentSubjectId`).
    const data = row.data || {}
    const subject = typeof data.userId === 'string' && data.userId.trim() ? null : timesheetDocumentSubjectId(row.id)
    const sheet = parsePayrunSnapshotSheet(row.id, subject ? { ...data, userId: subject } : data, timeZone)
    if (!sheet || !sheet.endDayKey) continue
    out.push({ ...data, startDayKey: sheet.startDayKey, endDayKey: sheet.endDayKey })
  }
  return out
}

/** The warning for deleting a booking on `dayKey` given the person's timesheet documents, or null (the rulebook's). */
export function signedTimesheetDeleteWarningFromDocs(
  dayKey: string,
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>,
  timeZone: string
): string | null {
  return bookingDeleteSignedTimesheetWarning(dayKey, signedTimesheetCandidatesFromDocs(docs, timeZone))
}

/** One booking about to be removed: its stored person id and its organisation-zone day. */
export type SignedTimesheetBookingRef = { personId: string | null | undefined; dayKey: string | null | undefined }

/**
 * The warning for removing several bookings at once (Replace, rulebook 1.41.0 §5 with 1.33.0 §2), or null: for each
 * booking, every users id the person goes by (`bookedPersonTimesheetUserIds`) and their timesheet documents
 * (`loadDocs` — `personTimesheetDocs`, which also finds sheets stored without `userId`), then the rulebook's
 * `bookingDeleteSignedTimesheetWarning`. The same inputs as the delete notice, so Replace and Delete never disagree.
 * A load that fails gives no sheets for that booking (no warning), never an error.
 */
export async function signedTimesheetWarningForBookings(input: {
  bookings: ReadonlyArray<SignedTimesheetBookingRef>
  users: ReadonlyArray<User>
  operatives: ReadonlyArray<Pick<Operative, 'id' | 'email'>>
  userIdAliases?: Readonly<Record<string, string>> | null
  timeZone: string
  loadDocs: (userIds: string[]) => Promise<ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>>
}): Promise<string | null> {
  for (const booking of input.bookings || []) {
    const dayKey = String(booking.dayKey ?? '').trim()
    if (!dayKey) continue
    const ids = bookedPersonTimesheetUserIds(booking.personId, input.users, input.operatives, input.userIdAliases)
    if (ids.length === 0) continue
    let docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }> = []
    try {
      docs = await input.loadDocs(ids)
    } catch {
      docs = []
    }
    const warning = signedTimesheetDeleteWarningFromDocs(dayKey, docs, input.timeZone)
    if (warning) return warning
  }
  return null
}

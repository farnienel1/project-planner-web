/**
 * User Timesheets → Awaiting sign-off / Signed off, and every count of them (rulebook §8, 1.66.0, owner decision 17 Nov:
 * "Awaiting sign-off must show EVERY timesheet waiting for sign-off, however old; both apps must agree exactly").
 *
 * One row per person per pay run, built from the viewer's stored timesheet documents — never from a window of recent
 * pay runs (web 1.58 looked at the last six only) and never once per users document (iOS counted a person with two
 * records twice):
 *   - who: `userTimesheetSubjects` (never the viewer, under any of their ids);
 *   - one person: subjects whose `personIdSet` meet are one person, and a sheet whose `userId` (or, when it has none,
 *     the id in its document id) is any id they go by, without case, is theirs. The apps load sheets by `userId`, so a
 *     sheet stored with no `userId` reaches this rule only when the app already holds it (a known limit, §8);
 *   - which pay runs: the runs the person's stored sheets name (start and end day keys), however old; one sheet per run
 *     (`pickTimesheetRowForPeriod`: exact start+end first, the latest version of a revised sheet, a sheet with
 *     activity — `timesheetSheetHasActivity` — before an empty one);
 *   - PAYE runs: skipped — a person is listed for a run only when they were self-employed on a day of it
 *     (`showsMyTimesheets`);
 *   - the bucket: `timesheetListBucket` (counter-signed unless `timesheetSelfSigned`) with the sheet's change. When the
 *     run is in the booking-change window (the last six pay runs, the same on every screen and both apps) the caller passes
 *     `bookingsChange` (`signedTimesheetBookingChanges` folded with the late extras, `timesheetChangesWithLateExtras`).
 *     For an older run it passes the late extras alone, or none and the change is read here from the stored `data`
 *     (`timesheetLateExtrasSummary`): bookings read as not changed (§8 1.47.0), but a late extra waiting for the line
 *     manager still puts an old sheet in Awaiting (§8 1.54.0).
 *
 * Pure: the apps load the sheets and the roster, and only render these rows.
 */

import { personIdSet, type PersonRosterRow } from './personIds'
import { showsMyTimesheets, type TimesheetPerson } from './peopleDocuments'
import { timesheetSelfSigned, type LeaveSelfBookUser } from './leaveRequests'
import {
  parseTimesheetStatusFields,
  pickTimesheetRowForPeriod,
  timesheetDocumentSubjectId,
  timesheetListBucket,
  type TimesheetListBucket,
  type TimesheetStatusFields,
} from './timesheetPeriod'
import { userTimesheetSubjects, type UserTimesheetMember, type UserTimesheetViewer } from './userTimesheetAccess'
import { timesheetChangesWithLateExtras, timesheetLateExtrasSummary } from './timesheetLateExtras'

/** A roster member as the queue reads it: User Timesheets access, the person-id fields and the employment fields. */
export type UserTimesheetQueueMember = UserTimesheetMember &
  Omit<TimesheetPerson, 'ghost'> &
  Omit<LeaveSelfBookUser, 'role' | 'isActive' | 'employmentType'> & {
    formerUserIds?: ReadonlyArray<string> | null
    sameEmailUserIds?: ReadonlyArray<string> | null
    /**
     * `timesheetSelfSigned(member)` when the app has already worked it out from its own person shape (iOS passes it);
     * missing: worked out here from the member's fields.
     */
    timesheetSelfSigned?: boolean | null
  }

/** One stored `settings/timesheet_*` document (its latest version or any version: revisions are folded here). */
export type UserTimesheetQueueSheet = {
  /** The stored `userId` (any id the person goes by, stored case); blank → read from the document id. */
  userId?: string | null
  /** `weekStartKey` (else the stored `weekStart`) in the organisation zone. */
  startDayKey: string
  /** `weekEndKey` (else `weekEnd`); the caller fills a missing end from its payment run. Missing: the start day. */
  endDayKey?: string | null
  /** `parseTimesheetStatusFields` of the stored document; or pass the stored `data` and it is parsed here. */
  status?: TimesheetStatusFields | null
  data?: Record<string, unknown> | null
  documentId?: string | null
  /**
   * The sheet has a signature, entries, late extras, a signed snapshot or a note (`pickTimesheetRowForPeriod` prefers
   * such a row). Missing: `timesheetSheetHasActivity(data)`.
   */
  hasActivity?: boolean | null
  /**
   * The sheet's `signedTimesheetBookingChanges` folded with its late extras (`timesheetChangesWithLateExtras`) when the
   * caller has the live bookings of its pay run. Null/missing when it has not (an old run whose bookings are not
   * loaded): the bookings then read as not changed (rulebook §8 1.47.0), and the late extras in `data` decide alone.
   */
  bookingsChange?: { reopened?: boolean | null; waitingFor?: 'person' | 'lineManager' | null } | null
}

export type UserTimesheetQueueInput = {
  viewer: UserTimesheetViewer
  members: ReadonlyArray<UserTimesheetQueueMember>
  sheets: ReadonlyArray<UserTimesheetQueueSheet>
  timeZone?: string | null
}

export type UserTimesheetQueueRow = {
  /** `personId|startDayKey|endDayKey` — one row per person and pay run. */
  key: string
  /** The roster member the row opens (the subject whose own id the sheet is filed under, else the person's first). */
  personId: string
  /** The stored `userId` the sheet is filed under (may be a former or same-email id). */
  sheetUserId: string
  startDayKey: string
  endDayKey: string
  documentId: string
  /** Index of the chosen sheet in `input.sheets`. */
  sheetIndex: number
  bucket: TimesheetListBucket
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function idKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sheetOwnerKey(sheet: UserTimesheetQueueSheet): string {
  return idKey(sheet.userId) || idKey(timesheetDocumentSubjectId(sheet.documentId ?? ''))
}

function filled(value: unknown): boolean {
  if (value == null || value === false) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * Rulebook §8 (1.66.0): whether a stored timesheet has anything on it — a person or line-manager signature, an export,
 * price work, expenses, late extras, a signed snapshot (`weeklyReportOverride`) or a note to the manager. One rule for
 * both apps (web `timesheetDraftHasActivity`, iOS `UserTimesheetQueueRulebook`); `pickTimesheetRowForPeriod` prefers a
 * sheet with activity over an empty one for the same pay run.
 */
export function timesheetSheetHasActivity(data: Record<string, unknown> | null | undefined): boolean {
  const sheet = data && typeof data === 'object' ? data : {}
  return [
    'operativeSignedAt',
    'managerSignedAt',
    'exportedAt',
    'expenseEntries',
    'priceWorkEntries',
    'lateExtras',
    'managerNote',
    'weeklyReportOverride',
  ].some((key) => filled(sheet[key]))
}

function sheetEnd(sheet: UserTimesheetQueueSheet): string {
  const end = text(sheet.endDayKey)
  return DAY_KEY.test(end) ? end : text(sheet.startDayKey)
}

/**
 * Every timesheet row the viewer's User Timesheets holds, however old: one per person and pay run, with its bucket
 * (`unsigned`, `awaiting`, `signed` or `exported`). Awaiting sign-off is the `awaiting` rows, Signed off the `signed`
 * rows. Newest pay run first, then roster order.
 */
export function userTimesheetQueue(input: UserTimesheetQueueInput): UserTimesheetQueueRow[] {
  const members = (input?.members ?? []).filter((member) => member && idKey(member.id))
  const sheets = input?.sheets ?? []
  const timeZone = input?.timeZone ?? null
  const viewer = input?.viewer
  if (!viewer) return []

  const subjectIds = new Set(userTimesheetSubjects({ viewer, members }).map((row) => idKey(row.userId)))
  const subjects = members.filter((member) => subjectIds.has(idKey(member.id)))
  if (subjects.length === 0) return []

  // The viewer's own sheets are never listed, under any of their ids.
  const viewerKeys = new Set(
    personIdSet(
      { id: viewer.id, formerUserIds: [...(viewer.formerIds ?? [])], sameEmailUserIds: [...(viewer.aliasIds ?? [])] },
      members as ReadonlyArray<PersonRosterRow>
    ).map(idKey)
  )
  for (const id of [viewer.id, ...(viewer.formerIds ?? []), ...(viewer.aliasIds ?? [])]) if (idKey(id)) viewerKeys.add(idKey(id))

  // Fold subjects into people: two subjects whose id sets meet are one person.
  type Person = { members: UserTimesheetQueueMember[]; keys: Set<string> }
  const people: Person[] = []
  for (const member of subjects) {
    const keys = new Set(personIdSet(member as PersonRosterRow, members as ReadonlyArray<PersonRosterRow>).map(idKey).filter(Boolean))
    keys.add(idKey(member.id))
    for (const key of viewerKeys) keys.delete(key)
    const meeting = people.filter((person) => [...keys].some((key) => person.keys.has(key)))
    const target: Person = meeting[0] ?? { members: [], keys: new Set() }
    if (meeting.length === 0) people.push(target)
    for (const other of meeting.slice(1)) {
      target.members.push(...other.members)
      for (const key of other.keys) target.keys.add(key)
      people.splice(people.indexOf(other), 1)
    }
    target.members.push(member)
    for (const key of keys) target.keys.add(key)
  }

  const rows: Array<UserTimesheetQueueRow & { order: number }> = []
  people.forEach((person, personOrder) => {
    const own = sheets
      .map((sheet, index) => ({ sheet, index }))
      .filter(({ sheet }) => {
        const owner = sheetOwnerKey(sheet)
        return owner && !viewerKeys.has(owner) && person.keys.has(owner) && DAY_KEY.test(text(sheet.startDayKey))
      })
    if (own.length === 0) return
    const candidates = own.map(({ sheet }) => ({
      startDayKey: text(sheet.startDayKey),
      endDayKey: DAY_KEY.test(text(sheet.endDayKey)) ? text(sheet.endDayKey) : null,
      hasActivity: typeof sheet.hasActivity === 'boolean' ? sheet.hasActivity : timesheetSheetHasActivity(sheet.data),
      documentId: text(sheet.documentId) || null,
    }))
    const runs = new Map<string, { startDayKey: string; endDayKey: string }>()
    for (const { sheet } of own) {
      const run = { startDayKey: text(sheet.startDayKey), endDayKey: sheetEnd(sheet) }
      runs.set(`${run.startDayKey}|${run.endDayKey}`, run)
    }
    const picked = new Set<number>()
    for (const run of runs.values()) {
      const at = pickTimesheetRowForPeriod(candidates, run)
      if (at < 0 || picked.has(at)) continue
      picked.add(at)
      const { sheet, index } = own[at]
      const sheetKey = sheetOwnerKey(sheet)
      const member = person.members.find((row) => idKey(row.id) === sheetKey) ?? person.members[0]
      // PAYE for the whole run: no sheet (rulebook §8, 1.11.0).
      if (!showsMyTimesheets(member, run, timeZone)) continue
      const status = sheet.status ?? parseTimesheetStatusFields(sheet.data ?? {})
      const selfSigned =
        typeof member.timesheetSelfSigned === 'boolean' ? member.timesheetSelfSigned : timesheetSelfSigned(member as LeaveSelfBookUser)
      // No booking change from the caller (an old run): the late extras alone, read from the stored sheet (1.54.0).
      const change =
        sheet.bookingsChange ??
        (sheet.data ? timesheetChangesWithLateExtras(null, timesheetLateExtrasSummary(sheet.data, { sheetDocId: text(sheet.documentId) || null })) : null)
      const bucket = timesheetListBucket(status, !selfSigned, change)
      rows.push({
        key: `${member.id}|${run.startDayKey}|${run.endDayKey}`,
        personId: member.id,
        sheetUserId: text(sheet.userId) || timesheetDocumentSubjectId(sheet.documentId ?? ''),
        startDayKey: run.startDayKey,
        endDayKey: run.endDayKey,
        documentId: text(sheet.documentId),
        sheetIndex: index,
        bucket,
        order: personOrder,
      })
    }
  })
  rows.sort((a, b) => (a.startDayKey === b.startDayKey ? a.order - b.order : a.startDayKey < b.startDayKey ? 1 : -1))
  return rows.map(({ order: _order, ...row }) => row)
}

/** The Awaiting sign-off and Signed off counts of `userTimesheetQueue` (the hub tile, the landing cards, the band). */
export function userTimesheetQueueCounts(input: UserTimesheetQueueInput): { awaiting: number; signed: number } {
  const rows = userTimesheetQueue(input)
  return {
    awaiting: rows.filter((row) => row.bucket === 'awaiting').length,
    signed: rows.filter((row) => row.bucket === 'signed').length,
  }
}

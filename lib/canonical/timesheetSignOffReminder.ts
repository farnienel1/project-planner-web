/**
 * Rulebook 1.78.0 §8 / §13 (owner decision 23 Nov, point 4, before launch): a reminder to line managers — and to the
 * admins who review a person with no active line manager — before payday, listing the timesheets of that pay run still
 * waiting for their sign-off.
 *
 *   - When: `timesheetSignOffReminderDue` — the organisation's `invoicing.lineManagerReminderDaysBeforePayday` (1, 2 or
 *     3; default 2, `parseLineManagerReminderDays`) days before each pay run's own payday, at 08:00 in the organisation
 *     zone. It stays due until the start of payday. The pay run and its payday are the shared payment-run rules
 *     (`invoicingPeriod`, `paymentRunPayDate`) in both modes; one entry per pay run, never two.
 *   - Who and what: `timesheetSignOffReminderRecipients` — the pay run's sheets that User Timesheets lists under
 *     Awaiting sign-off (`userTimesheetQueue`, so one row per person, PAYE runs skipped, the latest version of a revised
 *     sheet, late extras waiting for the line manager), and for each one the people `timesheetSubmittedRecipients`
 *     names (the active line managers, else the active admins; never the subject; nobody when self-signed). A sheet a
 *     booking change sent back to the person (1.47.0) is not counted: given the pay run's booking documents
 *     (`bookingsLoaded`), each sheet's `signedTimesheetBookingChanges` is worked out exactly as the apps do, from live
 *     lines built by `timesheetLiveLinesFromBookings`, and folded with its late extras (`timesheetChangesWithLateExtras`).
 *     Without them (a failed read) a sheet is judged on its stored signatures and late extras only.
 *   - The row: `timesheetSignOffReminderNotice` — title, message (singular / plural) and the inbox-only `detail` with
 *     the names; `timesheetSignOffReminderNoticeId` — one row per recipient per pay run, created once.
 *
 * Pure. Written by the `timesheetSignOffReminders` Cloud Function (functions/timesheetSignOffReminder.js); both apps
 * only route the row (`notificationDestination` → `timesheetTeamAwaiting` with the pay run's first day).
 */

import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone, midnightInZone, wallTimeInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { derivedDocumentId } from './derivedIds'
import { invoicingPeriod } from './engine'
import { isAdminOutsideOperativeMode, timesheetSelfSigned, type LeaveSelfBookUser } from './leaveRequests'
import { notificationRecipientAccountId, timesheetSubmittedRecipients, type NotificationRosterMember } from './notificationRecipients'
import {
  DEFAULT_LINE_MANAGER_REMINDER_DAYS,
  LINE_MANAGER_REMINDER_HOUR,
  LINE_MANAGER_REMINDER_MINUTE,
  parseInvoicing,
} from './organizationSettings'
import { isOrganizationSuperAdmin } from './organizationDeletion'
import { formatPaymentRunDay, paymentRunPayDate } from './paymentRuns'
import { organizationLevelFor, organizationSelfManageFlags } from './orgRoster'
import { documentInstantMs, documentOrganizationId } from './peopleDocuments'
import { permissionLevelOf } from './permissionLevels'
import { idKey, personIdSet, rosterMemberFor } from './personIds'
import { signedTimesheetBookingChanges } from './timesheetBookingChanges'
import { timesheetLiveLinesFromBookings, type TimesheetLiveBookingDocument } from './timesheetBookingNotice'
import { timesheetChangesWithLateExtras, timesheetLateExtrasSummary } from './timesheetLateExtras'
import { timesheetDocumentSubjectId } from './timesheetPeriod'
import { userTimesheetQueue, type UserTimesheetQueueMember, type UserTimesheetQueueSheet } from './userTimesheetQueue'

export const TIMESHEET_SIGNOFF_REMINDER_NOTICE_TYPE = 'timesheet_signoff_reminder'
export const TIMESHEET_SIGNOFF_REMINDER_NOTICE_TITLE = 'Timesheets waiting for your sign-off'
/** Rulebook 1.78.0 (owner decision 23 Nov, b): the escalation to every admin the day before payday. */
export const TIMESHEET_SIGNOFF_ESCALATION_NOTICE_TITLE = 'Timesheets not signed off — payday tomorrow'
/** The default days before payday (the organisation chooses 1–3, `invoicing.lineManagerReminderDaysBeforePayday`). */
export const TIMESHEET_SIGNOFF_REMINDER_DAYS_BEFORE_PAYMENT = DEFAULT_LINE_MANAGER_REMINDER_DAYS
export const TIMESHEET_SIGNOFF_REMINDER_HOUR = LINE_MANAGER_REMINDER_HOUR
export const TIMESHEET_SIGNOFF_REMINDER_MINUTE = LINE_MANAGER_REMINDER_MINUTE
/** How far back a pay run's work period may end and still be paid in the next days (a payday up to a month later). */
const LOOKBACK_DAYS = 70
/** Names listed in the inbox-only `detail` before "and N more". */
const DETAIL_NAMES_MAX = 8

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : []
}

function nowMsOf(now: unknown): number | null {
  if (typeof now === 'number' && Number.isFinite(now)) return now
  if (now instanceof Date) return Number.isNaN(now.getTime()) ? null : now.getTime()
  if (typeof now === 'string') {
    const ms = Date.parse(now)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

export type TimesheetSignOffReminderRun = {
  /** The pay run's work period, organisation-zone day keys, both ends included. */
  startDayKey: string
  endDayKey: string
  /** Midnight of `startDayKey` in the organisation zone, epoch ms (the row's `deepLinkWeekStart`). */
  startMs: number
  /** Midnight of the day after `endDayKey` in the organisation zone, epoch ms (the run's bookings end before it). */
  endExclusiveMs: number
  /** The payday (`paymentRunPayDate`). */
  paymentDayKey: string
  /** The day the reminder goes out (payday less the organisation's 1–3 days, or 1 day for the escalation). */
  notifyDayKey: string
  /** 08:00 on `notifyDayKey` in the organisation zone, epoch ms. */
  notifyAtMs: number
}

export type TimesheetSignOffReminderDueInput = {
  /** `organizations/{orgId}.invoicing` as stored, or parsed settings. Missing → never due. */
  invoicing: Record<string, unknown> | null | undefined
  /** The instant the check runs at (epoch ms, Date or ISO string). */
  now: number | Date | string
  timeZone?: string | null
}

/**
 * The pay runs whose sign-off reminder is due at `now`: 08:00 (organisation zone) the organisation's 1–3 days (default
 * 2, `invoicing.lineManagerReminderDaysBeforePayday`) before the payday, up to the start of the payday. Usually none or
 * one; two date-range runs can be due together only when their paydays are that close. Oldest payday first. `due` is
 * whether there is any.
 */
export function timesheetSignOffReminderDue(input: TimesheetSignOffReminderDueInput): {
  due: boolean
  runs: TimesheetSignOffReminderRun[]
} {
  return dueRuns(input, (settings) => settings.lineManagerReminderDaysBeforePayday)
}

/** Days before payday of the admin escalation: the day before payday, 08:00 organisation time. */
export const TIMESHEET_SIGNOFF_ESCALATION_DAYS_BEFORE_PAYMENT = 1

/**
 * Rulebook 1.78.0 (owner decision 23 Nov, b): the escalation to every admin — due at 08:00 organisation time on the day
 * before each pay run's payday (08:00 wall-clock time on that day, `wallTimeInZone`, so a clock change that night does not
 * move it), until the start of payday. Same shape as `timesheetSignOffReminderDue`; one entry per pay
 * run. Independent of the organisation's reminder days (with 1 day both are due together; they are separate rows).
 */
export function timesheetSignOffEscalationDue(input: TimesheetSignOffReminderDueInput): {
  due: boolean
  runs: TimesheetSignOffReminderRun[]
} {
  return dueRuns(input, () => TIMESHEET_SIGNOFF_ESCALATION_DAYS_BEFORE_PAYMENT)
}

function dueRuns(
  input: TimesheetSignOffReminderDueInput,
  daysBefore: (settings: ReturnType<typeof parseInvoicing>) => number
): { due: boolean; runs: TimesheetSignOffReminderRun[] } {
  const raw = input?.invoicing
  const nowMs = nowMsOf(input?.now)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || nowMs == null) return { due: false, runs: [] }
  const timeZone = zoneOrLondon(input.timeZone)
  const settings = parseInvoicing(raw as Record<string, unknown>)
  const offset = daysBefore(settings)
  const today = midnightInZone(new Date(nowMs), timeZone)
  const seen = new Map<string, TimesheetSignOffReminderRun>()
  for (let back = 0; back <= LOOKBACK_DAYS; back += 1) {
    const reference = addDaysInZone(today, -back, timeZone)
    const period = invoicingPeriod({
      referenceIso: reference.toISOString(),
      timeZone,
      paymentRunMode: settings.paymentRunMode,
      ranges: settings.paymentRunDateRanges,
      recurringRunStartDay: settings.recurringRunStartDay,
      recurringRunEndDay: settings.recurringRunEndDay,
    })
    const key = `${period.startDayKey}|${period.endDayKey}`
    if (seen.has(key)) continue
    const paymentDayKey = paymentRunPayDate(settings, period, timeZone)
    if (!paymentDayKey || !DAY_KEY.test(paymentDayKey)) continue
    const payMidnight = dateFromDayKeyInZone(paymentDayKey, timeZone)
    const notify = addDaysInZone(payMidnight, -offset, timeZone)
    const notifyDayKey = dayKeyInZone(notify, timeZone)
    // 08:00 on the wall clock that day (never midnight + 8h, which a clock change that night moves to 07:00 or 09:00).
    const notifyAtMs = wallTimeInZone(notifyDayKey, TIMESHEET_SIGNOFF_REMINDER_HOUR, TIMESHEET_SIGNOFF_REMINDER_MINUTE, timeZone).getTime()
    seen.set(key, {
      startDayKey: period.startDayKey,
      endDayKey: period.endDayKey,
      startMs: dateFromDayKeyInZone(period.startDayKey, timeZone).getTime(),
      endExclusiveMs: addDaysInZone(dateFromDayKeyInZone(period.endDayKey, timeZone), 1, timeZone).getTime(),
      paymentDayKey,
      notifyDayKey,
      notifyAtMs,
    })
  }
  const runs = [...seen.values()]
    .filter((run) => nowMs >= run.notifyAtMs && nowMs < dateFromDayKeyInZone(run.paymentDayKey, timeZone).getTime())
    .sort((a, b) => (a.paymentDayKey === b.paymentDayKey ? (a.startDayKey < b.startDayKey ? -1 : 1) : a.paymentDayKey < b.paymentDayKey ? -1 : 1))
  return { due: runs.length > 0, runs }
}

/** A roster member for the reminder: the recipient rules' row and the User Timesheets queue's row in one. */
export type TimesheetSignOffReminderMember = NotificationRosterMember &
  UserTimesheetQueueMember & {
    /** "First Surname", else the stored name, else the email. */
    displayName: string
  }

/**
 * One `users/{uid}` document as a reminder roster row: the level from `permissionLevelOf` (a person with no level flag
 * reads as manager level, §11 1.23.1), the organisation's Super Admin from `isOrganizationSuperAdmin` (its creator, or
 * `isSuperAdmin` on a users document of this organisation), and the stored line-manager, alias, employment and
 * self-manage fields. Instants may be epoch ms or Timestamp-like values; the stored `organizationId` may be an id, a
 * path or a reference (`documentOrganizationId`).
 *
 * An anchored person (§1, `rosterMembersForOrganization`: a key of the organisation's `members` map, or its creator)
 * whose users document names another company takes their level in THIS organisation (`organizationLevelFor`: the
 * creator, else their membership here, else the `members` role) and their self-manage toggles here
 * (`organizationSelfManageFlags`), never the other company's flags. Pass `membersRole` and, when read, `membership`.
 */
export function timesheetSignOffReminderRosterMember(
  id: string,
  data: Record<string, unknown> | null | undefined,
  org: {
    organizationId: string
    creatorUserId?: string | null
    /** `organizations/{orgId}.members[id]` when listed. */
    membersRole?: unknown
    /** `users/{id}/orgMemberships/{orgId}` when read. */
    membership?: Record<string, unknown> | null
  }
): TimesheetSignOffReminderMember | null {
  const docId = text(id)
  if (!docId || !data || typeof data !== 'object') return null
  const organizationId = documentOrganizationId(data.organizationId) ?? ''
  const home = organizationId !== '' && organizationId.toLowerCase() === text(org.organizationId).toLowerCase()
  const bool = (value: unknown) => (typeof value === 'boolean' ? value : null)
  if (!home) return anchoredMember(docId, data, org)
  const level = permissionLevelOf(data)
  const organizationSuperAdmin = isOrganizationSuperAdmin(
    { id: docId, isSuperAdmin: data.isSuperAdmin === true, organizationId },
    { id: org.organizationId, creatorUserId: org.creatorUserId ?? null }
  )
  const permissions = data.permissions && typeof data.permissions === 'object' ? (data.permissions as Record<string, unknown>) : {}
  return {
    ...sharedMemberFields(docId, data),
    role: {
      isSuperAdmin: organizationSuperAdmin,
      isAdmin: level === 'admin',
      isManager: level === 'manager',
      isOperativeMode: level === 'operative',
    },
    organizationSuperAdmin,
    annualLeaveSelfBook: bool(data.annualLeaveSelfBook),
    timesheetSelfSign: bool(data.timesheetSelfSign),
    operativeMode: bool(data.operativeMode),
    adminAccess: bool(data.adminAccess),
    isSuperAdmin: bool(data.isSuperAdmin),
    permissions: {
      annualLeaveSelfBook: bool(permissions.annualLeaveSelfBook),
      timesheetSelfSign: bool(permissions.timesheetSelfSign),
      operativeMode: bool(permissions.operativeMode),
      adminAccess: bool(permissions.adminAccess),
      isSuperAdmin: bool(permissions.isSuperAdmin),
    },
  } as TimesheetSignOffReminderMember
}

/** The person-id, line-manager, employment and name fields every roster row carries, whatever its level source. */
function sharedMemberFields(docId: string, data: Record<string, unknown>) {
  const firstName = text(data.firstName)
  const surname = text(data.surname) || text(data.lastName)
  const email = text(data.email)
  return {
    id: docId,
    email,
    isActive: data.isActive !== false,
    passwordSet: typeof data.passwordSet === 'boolean' ? data.passwordSet : null,
    ghost: data.ghost === true,
    formerUserIds: textList(data.formerUserIds),
    sameEmailUserIds: textList(data.sameEmailUserIds),
    assignedManagerUserIds: textList(data.assignedManagerUserIds),
    assignedManagerUserId: text(data.assignedManagerUserId) || null,
    hasNoLineManager: data.hasNoLineManager === true,
    employmentType: text(data.employmentType) || null,
    employmentTypeTransitionFrom: text(data.employmentTypeTransitionFrom) || null,
    employmentTypeEffectiveAt: documentInstantMs(data.employmentTypeEffectiveAt),
    displayName: [firstName, surname].filter(Boolean).join(' ') || text(data.displayName) || text(data.name) || email,
  }
}

/** §1 anchored person from another company: level and self-manage toggles in this organisation, never the home ones. */
function anchoredMember(
  docId: string,
  data: Record<string, unknown>,
  org: { organizationId: string; creatorUserId?: string | null; membersRole?: unknown; membership?: Record<string, unknown> | null }
): TimesheetSignOffReminderMember {
  const here = organizationLevelFor({
    organizationId: org.organizationId,
    userId: docId,
    user: data,
    membership: org.membership ?? null,
    membersRole: org.membersRole,
    creatorUserId: org.creatorUserId ?? null,
  })
  const flags = organizationSelfManageFlags({
    organizationId: org.organizationId,
    userId: docId,
    user: data,
    membership: org.membership ?? null,
    creatorUserId: org.creatorUserId ?? null,
  })
  const superAdmin = here.isSuperAdmin === true || flags.superAdmin === true
  const level = here.level
  // §14: deactivated here only by their membership here; their home company's `isActive` never counts.
  const membershipActive = flags.source === 'membership' ? flags.active : true
  const shared = sharedMemberFields(docId, data)
  return {
    ...shared,
    isActive: membershipActive,
    role: { isSuperAdmin: superAdmin, isAdmin: level === 'admin', isManager: level === 'manager', isOperativeMode: level === 'operative' },
    organizationSuperAdmin: superAdmin,
    annualLeaveSelfBook: flags.annualLeaveSelfBook,
    timesheetSelfSign: flags.timesheetSelfSign,
    operativeMode: level === 'operative',
    adminAccess: level === 'admin',
    isSuperAdmin: superAdmin,
    permissions: {
      annualLeaveSelfBook: flags.annualLeaveSelfBook,
      timesheetSelfSign: flags.timesheetSelfSign,
      operativeMode: level === 'operative',
      adminAccess: level === 'admin',
      isSuperAdmin: superAdmin,
    },
  } as TimesheetSignOffReminderMember
}

/** One stored `settings/timesheet_*` document (instants as epoch ms or Timestamp-like values). */
export type TimesheetSignOffReminderSheet = { documentId: string; data: Record<string, unknown> | null | undefined }

export type TimesheetSignOffReminderRecipient = {
  /** The reviewer's account (`notificationRecipientAccountId`). */
  userId: string
  /** Timesheets of the pay run waiting for this reviewer's sign-off. */
  count: number
  /** Their people's names, roster order. */
  names: string[]
  /** The roster member each row opens. */
  personIds: string[]
}

export type TimesheetSignOffReminderRecipientsInput = {
  sheets: ReadonlyArray<TimesheetSignOffReminderSheet>
  /** The organisation's users documents (`timesheetSignOffReminderRosterMember`). */
  roster: ReadonlyArray<TimesheetSignOffReminderMember>
  payRun: { startDayKey: string; endDayKey: string }
  timeZone?: string | null
  /**
   * The pay run's labour and manager site booking documents (any person, organisation-zone day keys, write times) —
   * with `bookingsLoaded: true` each sheet's booking changes are judged as the apps judge them (1.47.0), so a sheet sent
   * back to the person is not counted. Missing, or `bookingsLoaded` not true: stored signatures and late extras only.
   */
  bookings?: ReadonlyArray<TimesheetLiveBookingDocument | null | undefined> | null
  bookingsLoaded?: boolean | null
  /** Tombstones of the pay run's deleted bookings when read (`{ collection, bookingId }`). */
  tombstonedBookingIds?: ReadonlyArray<{ collection?: unknown; bookingId?: unknown } | null | undefined> | null
  /**
   * The organisation's `operatives` rows (`{ id, email, linkedUserId?, userId?, uid? }`): a row on the person's email,
   * or linked to one of their ids, is one of their ids (`bookingIdsForAccount`), so a labour booking filed under it is
   * on their sheet.
   */
  operatives?: ReadonlyArray<{ id?: unknown; email?: unknown; linkedUserId?: unknown; userId?: unknown; uid?: unknown } | null | undefined> | null
}

/**
 * Every id a sheet's person goes by: `personIdSet` over the roster, plus the `operatives` rows on any of their emails or
 * linked to one of their ids (as `bookingIdsForAccount`).
 */
function sheetPersonIds(
  member: TimesheetSignOffReminderMember,
  roster: ReadonlyArray<TimesheetSignOffReminderMember>,
  operatives: TimesheetSignOffReminderRecipientsInput['operatives']
): string[] {
  const ids = personIdSet(member, roster)
  const keys = new Set(ids.map(idKey))
  const emails = new Set(roster.filter((row) => keys.has(idKey(row.id))).map((row) => idKey(row.email)).filter(Boolean))
  for (const row of operatives ?? []) {
    const rowId = text(row?.id)
    if (!rowId || keys.has(idKey(rowId))) continue
    const linked = [row?.linkedUserId, row?.userId, row?.uid].some((value) => keys.has(idKey(value)))
    const email = idKey(row?.email)
    if (linked || (email && emails.has(email))) {
      ids.push(rowId)
      keys.add(idKey(rowId))
    }
  }
  return ids
}

/** The pay run's sheets as the queue reads them (a sheet whose end is not stored takes the pay run's end). */
function runSheets(
  rows: ReadonlyArray<TimesheetSignOffReminderSheet>,
  start: string,
  end: string,
  timeZone: string,
  input?: TimesheetSignOffReminderRecipientsInput,
  roster?: ReadonlyArray<TimesheetSignOffReminderMember>
): UserTimesheetQueueSheet[] {
  const sheets: UserTimesheetQueueSheet[] = []
  const readBookings = input?.bookingsLoaded === true && Array.isArray(input?.bookings) && Boolean(roster?.length)
  const bookings = readBookings ? (input!.bookings as ReadonlyArray<TimesheetLiveBookingDocument | null | undefined>) : []
  const tombstones = input?.tombstonedBookingIds ?? []
  for (const row of rows) {
    const documentId = text(row?.documentId)
    const data = row?.data && typeof row.data === 'object' ? row.data : null
    if (!documentId.startsWith('timesheet_') || !data) continue
    const startDayKey = sheetDayKey(data, 'weekStartKey', 'weekStart', timeZone)
    const endDayKey = sheetDayKey(data, 'weekEndKey', 'weekEnd', timeZone) || end
    if (startDayKey !== start || endDayKey !== end) continue
    const userId = text(data.userId) || null
    const sheet: UserTimesheetQueueSheet = { documentId, data, userId, startDayKey, endDayKey }
    if (readBookings) {
      // 1.78.0 (owner fix 2): judge the sheet's bookings exactly as the apps do (1.47.0), folded with its late extras.
      const member = rosterMemberFor(userId || timesheetDocumentSubjectId(documentId), roster!)
      if (member) {
        const personIds = sheetPersonIds(member, roster!, input?.operatives)
        const liveLines = timesheetLiveLinesFromBookings({
          bookings,
          personIds,
          periodStartDayKey: start,
          periodEndDayKey: end,
          person: member,
          timeZone,
        })
        const bookingChange = signedTimesheetBookingChanges({
          sheet: data,
          liveLines,
          liveLoaded: true,
          selfSigned: timesheetSelfSigned(member as LeaveSelfBookUser),
          liveBookings: bookings,
          tombstonedBookingIds: tombstones,
          personIds,
        })
        sheet.bookingsChange = timesheetChangesWithLateExtras(bookingChange, timesheetLateExtrasSummary(data, { sheetDocId: documentId }))
      }
    }
    sheets.push(sheet)
  }
  return sheets
}

/** The reviewer as User Timesheets sees them: their former ids and every other users document on their email. */
function viewerOf(reviewer: TimesheetSignOffReminderMember, roster: ReadonlyArray<TimesheetSignOffReminderMember>) {
  const email = idKey(reviewer.email)
  const aliasIds = [
    ...(reviewer.sameEmailUserIds ?? []),
    ...(email ? roster.filter((row) => row.id !== reviewer.id && idKey(row.email) === email).map((row) => row.id) : []),
  ]
  return { id: reviewer.id, formerIds: reviewer.formerUserIds ?? [], aliasIds, role: reviewer.role }
}

function sheetDayKey(data: Record<string, unknown>, keyField: string, instantField: string, timeZone: string): string {
  const stored = text(data[keyField])
  if (DAY_KEY.test(stored)) return stored
  const ms = documentInstantMs(data[instantField])
  return ms == null ? '' : dayKeyInZone(new Date(ms), timeZone)
}

/**
 * Who gets the reminder for one pay run, and for how many sheets: for each reviewer, the pay run's rows their User
 * Timesheets lists under Awaiting sign-off (`userTimesheetQueue`) whose person names them in
 * `timesheetSubmittedRecipients` (line managers, else active admins; never the person; self-signed people never).
 * A sheet whose end is not stored takes the pay run's end. With the pay run's bookings (`bookingsLoaded`) a sheet a
 * booking change sent back to the person is not counted (1.47.0, as the apps); without them a sheet counts by its
 * stored signatures and late extras. Recipients in roster order; nobody with a count of 0.
 */
export function timesheetSignOffReminderRecipients(input: TimesheetSignOffReminderRecipientsInput): TimesheetSignOffReminderRecipient[] {
  const timeZone = zoneOrLondon(input?.timeZone)
  const roster = (input?.roster ?? []).filter((member) => member && text(member.id))
  const start = text(input?.payRun?.startDayKey)
  const end = text(input?.payRun?.endDayKey)
  if (!DAY_KEY.test(start) || !DAY_KEY.test(end) || roster.length === 0) return []

  const sheets = runSheets(input?.sheets ?? [], start, end, timeZone, input, roster)
  if (sheets.length === 0) return []

  // Reviewers to ask: every account a sheet's person would notify on submission.
  const byKey = new Map(roster.map((member) => [idKey(member.id), member]))
  // Each person's reviewers, worked out once per run (not once per reviewer).
  const reviewersOf = new Map<string, Set<string>>()
  const reviewerIds = new Set<string>()
  for (const member of roster) {
    const ids = new Set(timesheetSubmittedRecipients(member, roster).map(idKey))
    reviewersOf.set(idKey(member.id), ids)
    for (const id of ids) reviewerIds.add(id)
  }

  const out: TimesheetSignOffReminderRecipient[] = []
  const done = new Set<string>()
  for (const member of roster) {
    const account = notificationRecipientAccountId(member.id, roster)
    if (!account || !reviewerIds.has(idKey(account)) || done.has(idKey(account))) continue
    done.add(idKey(account))
    const reviewer = byKey.get(idKey(account)) ?? member
    const rows = userTimesheetQueue({ viewer: viewerOf(reviewer, roster), members: roster, sheets, timeZone }).filter((row) => row.bucket === 'awaiting' && row.startDayKey === start && row.endDayKey === end)
    const names: string[] = []
    const personIds: string[] = []
    for (const row of rows) {
      const person = byKey.get(idKey(row.personId))
      if (!person) continue
      if (!reviewersOf.get(idKey(person.id))?.has(idKey(account))) continue
      personIds.push(person.id)
      names.push(person.displayName || person.id)
    }
    if (personIds.length > 0) out.push({ userId: account, count: personIds.length, names, personIds })
  }
  return out
}

/**
 * Rulebook 1.78.0 (owner decision 23 Nov, b): who gets the escalation for one pay run — every active admin outside
 * operative mode (the roster's admins, as their signed-in account), each with the run's sheets their User Timesheets
 * lists under Awaiting sign-off (`userTimesheetQueue`: never their own sheet, never a self-signed sheet, PAYE runs
 * skipped), whoever the line manager is — the admin's own reports included. Nobody with nothing waiting.
 */
export function timesheetSignOffEscalationRecipients(input: TimesheetSignOffReminderRecipientsInput): TimesheetSignOffReminderRecipient[] {
  const timeZone = zoneOrLondon(input?.timeZone)
  const roster = (input?.roster ?? []).filter((member) => member && text(member.id))
  const start = text(input?.payRun?.startDayKey)
  const end = text(input?.payRun?.endDayKey)
  if (!DAY_KEY.test(start) || !DAY_KEY.test(end) || roster.length === 0) return []
  const sheets = runSheets(input?.sheets ?? [], start, end, timeZone, input, roster)
  if (sheets.length === 0) return []
  const byKey = new Map(roster.map((member) => [idKey(member.id), member]))
  const out: TimesheetSignOffReminderRecipient[] = []
  const done = new Set<string>()
  for (const member of roster) {
    if (member.isActive === false || !isAdminOutsideOperativeMode(member)) continue
    const account = notificationRecipientAccountId(member.id, roster)
    if (!account || done.has(idKey(account))) continue
    done.add(idKey(account))
    const admin = byKey.get(idKey(account)) ?? member
    const rows = userTimesheetQueue({ viewer: viewerOf(admin, roster), members: roster, sheets, timeZone }).filter(
      (row) => row.bucket === 'awaiting' && row.startDayKey === start && row.endDayKey === end
    )
    const names: string[] = []
    const personIds: string[] = []
    for (const row of rows) {
      const person = byKey.get(idKey(row.personId))
      if (!person) continue
      personIds.push(person.id)
      names.push(person.displayName || person.id)
    }
    if (personIds.length > 0) out.push({ userId: account, count: personIds.length, names, personIds })
  }
  return out
}

/** The escalation row's text: "2 timesheets are still not signed off, payday is tomorrow Fri 28 Nov." */
export function timesheetSignOffEscalationNotice(input: {
  count: number
  paymentDayKey: string
  names?: ReadonlyArray<string> | null
}): { title: string; message: string; detail: string } {
  const count = Math.max(0, Math.floor(Number(input?.count) || 0))
  const payday = DAY_KEY.test(text(input?.paymentDayKey)) ? ` ${formatPaymentRunDay(text(input.paymentDayKey))}` : ''
  const message =
    count === 1
      ? `1 timesheet is still not signed off, payday is tomorrow${payday}.`
      : `${count} timesheets are still not signed off, payday is tomorrow${payday}.`
  return { title: TIMESHEET_SIGNOFF_ESCALATION_NOTICE_TITLE, message, detail: namesDetail(input?.names) }
}

/**
 * The escalation's document id: one per admin per pay run, never the reminder's id
 * (`timesheetSignOffEscalation|{orgId}|{recipient}|{start}|{end}`). The payday is not part of it, so moving the payday
 * inside the window never sends a second escalation (`paymentDayKey` is accepted and ignored).
 */
export function timesheetSignOffEscalationNoticeId(input: {
  organizationId: string
  recipientId: string
  startDayKey: string
  endDayKey: string
  paymentDayKey?: string | null
}): string | null {
  const org = text(input?.organizationId)
  const recipient = idKey(input?.recipientId)
  const start = text(input?.startDayKey)
  const end = text(input?.endDayKey)
  if (!org || !recipient || !DAY_KEY.test(start) || !DAY_KEY.test(end)) return null
  return derivedDocumentId(`timesheetSignOffEscalation|${org}|${recipient}|${start}|${end}`)
}

function namesDetail(list: ReadonlyArray<string> | null | undefined): string {
  const names = (list ?? []).map(text).filter(Boolean)
  const shown = names.slice(0, DETAIL_NAMES_MAX)
  const more = names.length - shown.length
  return shown.length ? `${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}` : ''
}

/** The inbox row's text for one reviewer: "3 timesheets are waiting…" / "1 timesheet is waiting…", names in `detail`. */
export function timesheetSignOffReminderNotice(input: {
  count: number
  paymentDayKey: string
  names?: ReadonlyArray<string> | null
}): { title: string; message: string; detail: string } {
  const count = Math.max(0, Math.floor(Number(input?.count) || 0))
  const payday = DAY_KEY.test(text(input?.paymentDayKey)) ? formatPaymentRunDay(text(input.paymentDayKey)) : ''
  const when = payday ? ` before payday ${payday}` : ' before payday'
  const message =
    count === 1
      ? `1 timesheet is waiting for you to sign off${when}.`
      : `${count} timesheets are waiting for you to sign off${when}.`
  return { title: TIMESHEET_SIGNOFF_REMINDER_NOTICE_TITLE, message, detail: namesDetail(input?.names) }
}

/**
 * The reminder's document id: one row per recipient per pay run (`timesheetSignOffReminder|{orgId}|{recipient, lower
 * case}|{start}|{end}`, `derivedDocumentId`, UUID-shaped, the same on every run). The payday is not part of it, so an
 * admin moving the payday inside the window never sends a second reminder for the same pay run (`paymentDayKey` is
 * accepted and ignored). Null when a part is missing.
 */
export function timesheetSignOffReminderNoticeId(input: {
  organizationId: string
  recipientId: string
  startDayKey: string
  endDayKey: string
  paymentDayKey?: string | null
}): string | null {
  const org = text(input?.organizationId)
  const recipient = idKey(input?.recipientId)
  const start = text(input?.startDayKey)
  const end = text(input?.endDayKey)
  if (!org || !recipient || !DAY_KEY.test(start) || !DAY_KEY.test(end)) return null
  return derivedDocumentId(`timesheetSignOffReminder|${org}|${recipient}|${start}|${end}`)
}

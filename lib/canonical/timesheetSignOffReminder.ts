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
 *     names (the active line managers, else the active admins; never the subject; nobody when self-signed). The server
 *     has no live bookings, so a sheet reopened by a booking change (1.47.0) is judged on its stored signals only: it
 *     reads as it is stored (a person-signed, not counter-signed sheet is Awaiting), never by its bookings.
 *   - The row: `timesheetSignOffReminderNotice` — title, message (singular / plural) and the inbox-only `detail` with
 *     the names; `timesheetSignOffReminderNoticeId` — one row per recipient per pay run, created once.
 *
 * Pure. Written by the `timesheetSignOffReminders` Cloud Function (functions/timesheetSignOffReminder.js); both apps
 * only route the row (`notificationDestination` → `timesheetTeamAwaiting` with the pay run's first day).
 */

import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone, midnightInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { derivedDocumentId } from './derivedIds'
import { invoicingPeriod } from './engine'
import { isAdminOutsideOperativeMode } from './leaveRequests'
import { notificationRecipientAccountId, timesheetSubmittedRecipients, type NotificationRosterMember } from './notificationRecipients'
import {
  DEFAULT_LINE_MANAGER_REMINDER_DAYS,
  LINE_MANAGER_REMINDER_HOUR,
  LINE_MANAGER_REMINDER_MINUTE,
  parseInvoicing,
} from './organizationSettings'
import { isOrganizationSuperAdmin } from './organizationDeletion'
import { formatPaymentRunDay, paymentRunPayDate } from './paymentRuns'
import { documentInstantMs } from './peopleDocuments'
import { permissionLevelOf } from './permissionLevels'
import { idKey } from './personIds'
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
  /** The payday (`paymentRunPayDate`). */
  paymentDayKey: string
  /** The day the reminder goes out (payday − 2 days). */
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
 * The pay runs whose sign-off reminder is due at `now`: 08:00 (organisation zone) two days before the payday, up to
 * the start of the payday. Usually none or one; two date-range runs can be due together only when their paydays are
 * within two days of each other. Oldest payday first. `due` is whether there is any.
 */
export function timesheetSignOffReminderDue(input: TimesheetSignOffReminderDueInput): {
  due: boolean
  runs: TimesheetSignOffReminderRun[]
} {
  return dueRuns(input, (settings) => settings.lineManagerReminderDaysBeforePayday)
}

/** Days before payday of the admin escalation: the day before payday, 08:00 (payday 08:00 less 24 hours). */
export const TIMESHEET_SIGNOFF_ESCALATION_DAYS_BEFORE_PAYMENT = 1

/**
 * Rulebook 1.78.0 (owner decision 23 Nov, b): the escalation to every admin — due at 08:00 organisation time on the day
 * before each pay run's payday (payday 08:00 less 24 hours; in a zone with a clock change that night it is still 08:00
 * local on the day before), until the start of payday. Same shape as `timesheetSignOffReminderDue`; one entry per pay
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
    const notifyAtMs =
      dateFromDayKeyInZone(notifyDayKey, timeZone).getTime() +
      (TIMESHEET_SIGNOFF_REMINDER_HOUR * 60 + TIMESHEET_SIGNOFF_REMINDER_MINUTE) * 60_000
    seen.set(key, {
      startDayKey: period.startDayKey,
      endDayKey: period.endDayKey,
      startMs: dateFromDayKeyInZone(period.startDayKey, timeZone).getTime(),
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
 * One `users/{uid}` document of the organisation as a reminder roster row: the level from `permissionLevelOf` (a
 * person with no level flag reads as manager level, §11 1.23.1), the organisation's Super Admin from
 * `isOrganizationSuperAdmin` (its creator, or `isSuperAdmin` on a users document of this organisation), and the stored
 * line-manager, alias, employment and self-manage fields. Instants may be epoch ms or Timestamp-like values.
 */
export function timesheetSignOffReminderRosterMember(
  id: string,
  data: Record<string, unknown> | null | undefined,
  org: { organizationId: string; creatorUserId?: string | null }
): TimesheetSignOffReminderMember | null {
  const docId = text(id)
  if (!docId || !data || typeof data !== 'object') return null
  const level = permissionLevelOf(data)
  const storedOrg = data.organizationId
  const organizationId =
    typeof storedOrg === 'string'
      ? storedOrg
      : storedOrg && typeof storedOrg === 'object' && typeof (storedOrg as { id?: unknown }).id === 'string'
        ? (storedOrg as { id: string }).id
        : ''
  const organizationSuperAdmin = isOrganizationSuperAdmin(
    { id: docId, isSuperAdmin: data.isSuperAdmin === true, organizationId },
    { id: org.organizationId, creatorUserId: org.creatorUserId ?? null }
  )
  const permissions = data.permissions && typeof data.permissions === 'object' ? (data.permissions as Record<string, unknown>) : {}
  const bool = (value: unknown) => (typeof value === 'boolean' ? value : null)
  const firstName = text(data.firstName)
  const surname = text(data.surname) || text(data.lastName)
  const email = text(data.email)
  const displayName = [firstName, surname].filter(Boolean).join(' ') || text(data.displayName) || text(data.name) || email
  return {
    id: docId,
    email,
    isActive: data.isActive !== false,
    passwordSet: bool(data.passwordSet),
    ghost: data.ghost === true,
    role: {
      isSuperAdmin: organizationSuperAdmin,
      isAdmin: level === 'admin',
      isManager: level === 'manager',
      isOperativeMode: level === 'operative',
    },
    organizationSuperAdmin,
    formerUserIds: textList(data.formerUserIds),
    sameEmailUserIds: textList(data.sameEmailUserIds),
    assignedManagerUserIds: textList(data.assignedManagerUserIds),
    assignedManagerUserId: text(data.assignedManagerUserId) || null,
    hasNoLineManager: data.hasNoLineManager === true,
    employmentType: text(data.employmentType) || null,
    employmentTypeTransitionFrom: text(data.employmentTypeTransitionFrom) || null,
    employmentTypeEffectiveAt: documentInstantMs(data.employmentTypeEffectiveAt),
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
    displayName,
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
}

/** The pay run's sheets as the queue reads them (a sheet whose end is not stored takes the pay run's end). */
function runSheets(
  rows: ReadonlyArray<TimesheetSignOffReminderSheet>,
  start: string,
  end: string,
  timeZone: string
): UserTimesheetQueueSheet[] {
  const sheets: UserTimesheetQueueSheet[] = []
  for (const row of rows) {
    const documentId = text(row?.documentId)
    const data = row?.data && typeof row.data === 'object' ? row.data : null
    if (!documentId.startsWith('timesheet_') || !data) continue
    const startDayKey = sheetDayKey(data, 'weekStartKey', 'weekStart', timeZone)
    const endDayKey = sheetDayKey(data, 'weekEndKey', 'weekEnd', timeZone) || end
    if (startDayKey !== start || endDayKey !== end) continue
    sheets.push({ documentId, data, userId: text(data.userId) || null, startDayKey, endDayKey })
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
 * A sheet whose end is not stored takes the pay run's end. Booking changes are not read (no bookings on the server):
 * a sheet counts by its stored signatures and late extras. Recipients in roster order; nobody with a count of 0.
 */
export function timesheetSignOffReminderRecipients(input: TimesheetSignOffReminderRecipientsInput): TimesheetSignOffReminderRecipient[] {
  const timeZone = zoneOrLondon(input?.timeZone)
  const roster = (input?.roster ?? []).filter((member) => member && text(member.id))
  const start = text(input?.payRun?.startDayKey)
  const end = text(input?.payRun?.endDayKey)
  if (!DAY_KEY.test(start) || !DAY_KEY.test(end) || roster.length === 0) return []

  const sheets = runSheets(input?.sheets ?? [], start, end, timeZone)
  if (sheets.length === 0) return []

  // Reviewers to ask: every account a sheet's person would notify on submission.
  const byKey = new Map(roster.map((member) => [idKey(member.id), member]))
  const reviewerIds = new Set<string>()
  for (const member of roster) {
    for (const id of timesheetSubmittedRecipients(member, roster)) reviewerIds.add(idKey(id))
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
      const recipients = timesheetSubmittedRecipients(person, roster).map(idKey)
      if (!recipients.includes(idKey(account))) continue
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
  const sheets = runSheets(input?.sheets ?? [], start, end, timeZone)
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

/** The escalation's document id: one per admin per pay run, never the reminder's id (`timesheetSignOffEscalation|…`). */
export function timesheetSignOffEscalationNoticeId(input: {
  organizationId: string
  recipientId: string
  startDayKey: string
  endDayKey: string
  paymentDayKey: string
}): string | null {
  const org = text(input?.organizationId)
  const recipient = idKey(input?.recipientId)
  const start = text(input?.startDayKey)
  const end = text(input?.endDayKey)
  const pay = text(input?.paymentDayKey)
  if (!org || !recipient || !DAY_KEY.test(start) || !DAY_KEY.test(end) || !DAY_KEY.test(pay)) return null
  return derivedDocumentId(`timesheetSignOffEscalation|${org}|${recipient}|${start}|${end}|${pay}`)
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
 * case}|{start}|{end}|{payday}`, `derivedDocumentId`, UUID-shaped, the same on every run). Null when a part is missing.
 */
export function timesheetSignOffReminderNoticeId(input: {
  organizationId: string
  recipientId: string
  startDayKey: string
  endDayKey: string
  paymentDayKey: string
}): string | null {
  const org = text(input?.organizationId)
  const recipient = idKey(input?.recipientId)
  const start = text(input?.startDayKey)
  const end = text(input?.endDayKey)
  const pay = text(input?.paymentDayKey)
  if (!org || !recipient || !DAY_KEY.test(start) || !DAY_KEY.test(end) || !DAY_KEY.test(pay)) return null
  return derivedDocumentId(`timesheetSignOffReminder|${org}|${recipient}|${start}|${end}|${pay}`)
}

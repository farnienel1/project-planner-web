/**
 * Annual-leave request documents, decisions and who approves them.
 *
 * Document: `organizations/{orgId}/holidayBookings/{id}`. One document per request: a run of
 * calendar-consecutive days with the same time slot (`holidayRequestRanges`) is ONE record covering
 * `startDate`–`endDate`, so approving or cancelling it is one write. The slot (FULL DAY / AM / PM)
 * applies to every day in the range. Readers still accept older one-document-per-day records.
 *
 * Which days a record takes from the allowance (`leaveRecordDayKeys`): a single-day record is that
 * day. A multi-day record is every day in the range except Saturday, Sunday and the organisation's
 * bank holidays (`nonWorkingDayKeys`).
 *
 * Decision (`holidayDecisionWriteFields`): status approved / rejected, the approver uid in
 * `approvedByUserId`, and an optional `decisionNote` (trimmed; blank clears it). Each app adds
 * `approvedAt` and `updatedAt` as server timestamps plus `writeMetadataFields`.
 *
 * Approvers (`leaveApproverIds`): every current line manager of the requester
 * (`lineManagerIds(user, roster)`: `assignedManagerUserIds`, else the legacy `assignedManagerUserId`, only
 * active roster members, never the requester under any of their ids). No line manager, `hasNoLineManager`,
 * or none of them still active in the roster → every active admin and super admin outside operative mode
 * (never "any manager"). The requester never approves their own request.
 */

import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { eachDayKey, isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import type { StaffAccountRole } from './staffAccess'
import { idKey, personIdSet, rosterMemberActive, rosterMemberFor, type PersonRosterRow } from './personIds'

export const HOLIDAY_TIME_SLOTS = ['FULL DAY', 'AM', 'PM'] as const
export type HolidayTimeSlotValue = (typeof HOLIDAY_TIME_SLOTS)[number]
export const HOLIDAY_STATUSES = ['pending', 'approved', 'rejected'] as const
export type HolidayStatusValue = (typeof HOLIDAY_STATUSES)[number]

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The stored slot value. AM (`AM`, `A.M.`, `MORNING`) and PM (`PM`, `P.M.`, `AFTERNOON`), any case;
 * anything else is a full day.
 */
export function normalizeHolidayTimeSlot(value: unknown): HolidayTimeSlotValue {
  const raw = text(value).toUpperCase().replace(/_/g, ' ')
  if (raw === 'AM' || raw === 'A.M.' || raw === 'MORNING') return 'AM'
  if (raw === 'PM' || raw === 'P.M.' || raw === 'AFTERNOON') return 'PM'
  return 'FULL DAY'
}

/** Stored status words each app has written, by the status they mean (lower case, `_`/`-` read as a space). */
export const HOLIDAY_STATUS_SYNONYMS: Readonly<Record<HolidayStatusValue, readonly string[]>> = {
  pending: ['pending', 'requested', 'awaiting', 'awaiting approval', 'submitted'],
  approved: ['approved', 'approve', 'accepted', 'confirmed'],
  rejected: ['rejected', 'declined', 'denied', 'cancelled', 'canceled'],
}

/**
 * The leave status. Synonyms (`HOLIDAY_STATUS_SYNONYMS`) map to pending / approved / rejected, so
 * "declined" and "cancelled" are rejected and "requested" is pending. Missing status is approved
 * (older records); an unknown word is approved too (the default both apps already had).
 */
export function normalizeHolidayStatus(value: unknown): HolidayStatusValue {
  const raw = text(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (!raw) return 'approved'
  for (const status of HOLIDAY_STATUSES) {
    if (HOLIDAY_STATUS_SYNONYMS[status].includes(raw)) return status
  }
  return 'approved'
}

/** `decisionNote` as written by either app: trimmed text, or null when missing or blank. */
export function parseHolidayDecisionNote(value: unknown): string | null {
  const note = text(value)
  return note ? note : null
}

/**
 * The day keys a leave record takes from the allowance and shows on timesheets.
 * Single-day record → that day. Multi-day record → each day except weekends and `nonWorkingDayKeys`.
 */
export function leaveRecordDayKeys(
  record: { startDayKey: string; endDayKey?: string | null },
  timeZone?: string | null,
  nonWorkingDayKeys?: ReadonlyArray<string> | null
): string[] {
  const zone = zoneOrLondon(timeZone)
  const start = text(record.startDayKey)
  if (!DAY_KEY.test(start)) return []
  const endRaw = text(record.endDayKey)
  const end = DAY_KEY.test(endRaw) && endRaw >= start ? endRaw : start
  if (end === start) return [start]
  const skip = new Set((nonWorkingDayKeys || []).map(text))
  return eachDayKey(start, end, zone).filter((key) => {
    const iso = isoWeekdayOfDayKey(key, zone)
    return iso !== 6 && iso !== 7 && !skip.has(key)
  })
}

/**
 * 1.9.0 (§7, §9): how many leave days a record covers inside a range (both day keys, inclusive): its
 * `leaveRecordDayKeys` (a single-day record counts its day; a multi-day record skips weekends and the given
 * non-working days) that fall in the range, each 1 for a full day and 0.5 for AM / PM. The Weekly Report and every
 * leave counter use this, never a per-platform day loop.
 */
export function leaveDaysInRange(
  record: { startDayKey: string; endDayKey?: string | null; timeSlot?: string | null },
  range: { startDayKey: string; endDayKey: string },
  timeZone?: string | null,
  nonWorkingDayKeys?: ReadonlyArray<string> | null
): number {
  const from = text(range?.startDayKey)
  const to = text(range?.endDayKey)
  if (!DAY_KEY.test(from) || !DAY_KEY.test(to) || to < from) return 0
  const each = normalizeHolidayTimeSlot(record?.timeSlot) === 'FULL DAY' ? 1 : 0.5
  const days = leaveRecordDayKeys(record, timeZone, nonWorkingDayKeys).filter((key) => key >= from && key <= to)
  return Math.round(days.length * each * 100) / 100
}

export type HolidayRequestPick = { dayKey: string; timeSlot?: string | null }
export type HolidayRequestRange = { startDayKey: string; endDayKey: string; timeSlot: HolidayTimeSlotValue }

/**
 * Picked days → one range per request: calendar-consecutive days with the same slot join.
 * A gap (weekend, bank holiday, unpicked day) or a different slot starts a new request.
 */
export function holidayRequestRanges(
  picks: ReadonlyArray<HolidayRequestPick>,
  timeZone?: string | null
): HolidayRequestRange[] {
  const zone = zoneOrLondon(timeZone)
  const bySlot = new Map<string, HolidayTimeSlotValue>()
  for (const pick of picks || []) {
    const key = text(pick?.dayKey)
    if (!DAY_KEY.test(key) || bySlot.has(key)) continue
    bySlot.set(key, normalizeHolidayTimeSlot(pick.timeSlot))
  }
  const keys = Array.from(bySlot.keys()).sort()
  const ranges: HolidayRequestRange[] = []
  for (const key of keys) {
    const slot = bySlot.get(key) as HolidayTimeSlotValue
    const last = ranges[ranges.length - 1]
    if (last && last.timeSlot === slot) {
      const next = dayKeyInZone(addDaysInZone(dateFromDayKeyInZone(last.endDayKey, zone), 1, zone), zone)
      if (next === key) {
        last.endDayKey = key
        continue
      }
    }
    ranges.push({ startDayKey: key, endDayKey: key, timeSlot: slot })
  }
  return ranges
}

export type HolidayRequestWriteInput = {
  id: string
  organizationId: string
  userId?: string | null
  operativeId?: string | null
  startDayKey: string
  endDayKey?: string | null
  timeSlot?: string | null
  /** `pending` for a request, `approved` when the person self-books or a manager books it. */
  status?: string | null
  /** The approver when the record is saved approved. */
  approvedByUserId?: string | null
  timeZone?: string | null
}

export type HolidayRequestWriteFields = {
  id: string
  organizationId: string
  userId: string | null
  operativeId: string | null
  /** Write `startDate` as a Timestamp of this instant (organisation-zone midnight of the first day). */
  startDateMs: number
  /** Write `endDate` as a Timestamp of this instant (organisation-zone midnight of the last day). */
  endDateMs: number
  startDayKey: string
  endDayKey: string
  status: HolidayStatusValue
  timeSlot: HolidayTimeSlotValue
  approvedByUserId: string | null
  cancellationRequestedByUserId: null
  decisionNote: null
}

/**
 * Fields for a new leave request document (one per `holidayRequestRanges` range). The app writes
 * `startDate` / `endDate` as Timestamps from the `…Ms` values, `cancellationRequestedAt: null`,
 * `createdAt`, `updatedAt`, `approvedAt` (when approved) and `writeMetadataFields`.
 * Null when the id, organisation, person or first day is missing.
 */
export function holidayRequestWriteFields(input: HolidayRequestWriteInput): HolidayRequestWriteFields | null {
  const zone = zoneOrLondon(input.timeZone)
  const id = text(input.id)
  const organizationId = text(input.organizationId)
  const userId = text(input.userId) || null
  const operativeId = text(input.operativeId) || null
  const startDayKey = text(input.startDayKey)
  if (!id || !organizationId || (!userId && !operativeId) || !DAY_KEY.test(startDayKey)) return null
  const endRaw = text(input.endDayKey)
  const endDayKey = DAY_KEY.test(endRaw) && endRaw >= startDayKey ? endRaw : startDayKey
  const status = normalizeHolidayStatus(input.status || 'pending')
  return {
    id,
    organizationId,
    userId,
    operativeId,
    startDateMs: dateFromDayKeyInZone(startDayKey, zone).getTime(),
    endDateMs: dateFromDayKeyInZone(endDayKey, zone).getTime(),
    startDayKey,
    endDayKey,
    status,
    timeSlot: normalizeHolidayTimeSlot(input.timeSlot),
    approvedByUserId: status === 'approved' ? text(input.approvedByUserId) || null : null,
    cancellationRequestedByUserId: null,
    decisionNote: null,
  }
}

export type HolidayDecisionWriteFields = {
  status: 'approved' | 'rejected'
  approvedByUserId: string
  decisionNote: string | null
}

/** Approve or decline. Null when the status is not approved / rejected or there is no approver. */
export function holidayDecisionWriteFields(input: {
  status: unknown
  approverUid: unknown
  decisionNote?: unknown
}): HolidayDecisionWriteFields | null {
  const raw = text(input.status).toLowerCase()
  const status = raw === 'approved' ? 'approved' : raw === 'rejected' || raw === 'declined' ? 'rejected' : null
  const approver = text(input.approverUid)
  if (!status || !approver) return null
  return { status, approvedByUserId: approver, decisionNote: parseHolidayDecisionNote(input.decisionNote) }
}

export type LeaveRequester = {
  id?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  assignedManagerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserId?: string | null
  hasNoLineManager?: boolean | null
}

export type LeaveApproverMember = {
  id: string
  /** Missing counts as active. */
  isActive?: boolean | null
  role: StaffAccountRole
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
}

type LineManagerRosterMember = Omit<PersonRosterRow, 'role'> & { role?: StaffAccountRole | string | null }

/**
 * The person's line managers: `assignedManagerUserIds`, else the legacy single id; empty when
 * `hasNoLineManager`. Never the person under any of their ids (`personIdSet`: id, `formerUserIds`,
 * `sameEmailUserIds`, same-email roster rows). With a non-empty `roster`, only managers who are on it and
 * active count, and an id the roster knows only as an alias (an old invite id) is returned as that roster
 * row's id. Order kept, de-duplicated without case.
 */
export function lineManagerIds(
  user: LeaveRequester | null | undefined,
  roster?: ReadonlyArray<LineManagerRosterMember> | null
): string[] {
  if (!user || user.hasNoLineManager === true) return []
  const listed = (user.assignedManagerUserIds || []).map(text).filter(Boolean)
  const ids = listed.length > 0 ? listed : [text(user.assignedManagerUserId)].filter(Boolean)
  const members = (roster || []).filter((member) => member && text(member.id)) as PersonRosterRow[]
  const self = new Set(personIdSet(user, members).map(idKey))
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    let resolved = id
    if (members.length > 0) {
      const member = rosterMemberFor(id, members)
      if (!member || !rosterMemberActive(member)) continue
      resolved = text(member.id)
    }
    if (self.has(idKey(id)) || self.has(idKey(resolved))) continue
    if (seen.has(idKey(resolved))) continue
    seen.add(idKey(resolved))
    out.push(resolved)
  }
  return out
}

/** Whether `lineManagerIds(user, roster)` names anyone: a current active line manager other than the person. */
export function hasActiveLineManager(
  user: LeaveRequester | null | undefined,
  roster?: ReadonlyArray<LineManagerRosterMember> | null
): boolean {
  return lineManagerIds(user, roster).length > 0
}

/** Who approves this person's leave and timesheets (see file header). */
export function leaveApproverIds(
  user: LeaveRequester | null | undefined,
  roster: ReadonlyArray<LeaveApproverMember> | null | undefined
): string[] {
  const members = (roster || []).filter((member) => member && text(member.id))
  const managers = lineManagerIds(user, members)
  if (managers.length > 0) return managers
  const self = new Set(personIdSet(user, members).map(idKey))
  const seen = new Set<string>()
  return members
    .filter((member) => {
      const key = idKey(member.id)
      if (!rosterMemberActive(member) || !isAdminOutsideOperativeMode(member) || self.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((member) => text(member.id))
}

/** Inbox type both apps write when someone asks for leave. */
export const HOLIDAY_REQUEST_SUBMITTED_TYPE = 'holiday_request_submitted'

// MARK: - Self-manage toggles and the line-manager requirement (rulebook §8, §9, §11; 1.28.0)

/**
 * The fields the self-approval and line-manager rules read from `users/{uid}` (or a roster row). Each flag counts
 * at the top level or inside `permissions` (the same test as firestore.rules `staffFlag`). `role` is the stored
 * string (`admin`, `manager`, `operative`, `super_admin`) or the resolved `StaffAccountRole`.
 */
export type LeaveSelfBookUser = LeaveRequester & {
  annualLeaveSelfBook?: boolean | null
  /** 1.28.0: admins only — their own signature completes their timesheet (`timesheetSelfSigned`). */
  timesheetSelfSign?: boolean | null
  operativeMode?: boolean | null
  adminAccess?: boolean | null
  isSuperAdmin?: boolean | null
  role?: string | StaffAccountRole | null
  /** `users/{uid}.employmentType` as stored (`paye` | `self_employed`; missing is self-employed). */
  employmentType?: string | null
  /**
   * 1.28.0: whether this person is the Super Admin of the organisation being worked in
   * (`isOrganizationSuperAdmin(viewer, org)` in organizationDeletion.ts: its creator, or `isSuperAdmin` on a users document of that organisation). When given
   * it decides alone; the stored `isSuperAdmin` flag is used only when it is missing.
   */
  organizationSuperAdmin?: boolean | null
  permissions?: {
    annualLeaveSelfBook?: boolean | null
    timesheetSelfSign?: boolean | null
    operativeMode?: boolean | null
    adminAccess?: boolean | null
    isSuperAdmin?: boolean | null
  } | null
  /** Missing counts as active. An inactive person needs no line manager. */
  isActive?: boolean | null
  /** Kept for older callers; annual leave switched off no longer exempts anyone (timesheets still need approval). */
  annualLeaveEnabled?: boolean | null
}

type FlagKey = 'annualLeaveSelfBook' | 'timesheetSelfSign' | 'operativeMode' | 'adminAccess' | 'isSuperAdmin'

function flagOn(user: LeaveSelfBookUser | null | undefined, key: FlagKey): boolean {
  if (!user) return false
  return user[key] === true || user.permissions?.[key] === true
}

function roleObject(role: unknown): StaffAccountRole | null {
  if (!role || typeof role !== 'object') return null
  return role as StaffAccountRole
}

function roleText(role: unknown): string {
  return text(role).toLowerCase().replace(/[\s-]/g, '_')
}

/** Operative mode: the `operativeMode` flag, the `operative` role, or a resolved role in operative mode. */
function inOperativeMode(user: LeaveSelfBookUser | null | undefined): boolean {
  if (!user) return false
  // 1.11.0: an admin has no operative mode.
  if (isAdminOutsideOperativeMode(user)) return false
  const role = roleObject(user.role)
  if (role?.isOperativeMode === true) return true
  return flagOn(user, 'operativeMode') || roleText(user.role) === 'operative'
}

/**
 * Admin or super admin: `isSuperAdmin` / `adminAccess` (top level or `permissions`), the `admin` / `super_admin`
 * role, or a resolved role with `isAdmin` / `isSuperAdmin`. Same people as firestore.rules `adminLikeUser`. 1.11.0
 * (owner decisions round 3): an admin has no operative mode — a stored `operativeMode` flag on an admin is ignored
 * (`effectivePermissions` reads it off), so the name keeps its meaning for every admin. A resolved role whose
 * `isOperativeMode` is set without an admin flag is not an admin.
 */
export function isAdminOutsideOperativeMode(user: LeaveSelfBookUser | null | undefined): boolean {
  if (!user) return false
  const role = roleObject(user.role)
  if (role) return role.isAdmin === true || role.isSuperAdmin === true
  const named = roleText(user.role)
  return (
    flagOn(user, 'isSuperAdmin') ||
    flagOn(user, 'adminAccess') ||
    named === 'admin' ||
    named === 'super_admin' ||
    named === 'superadmin'
  )
}

/**
 * The Super Admin (1.28.0): `isSuperAdmin` (top level or `permissions`), the `super_admin` role, or a resolved role with
 * `isSuperAdmin`. Apps pass the organisation creator with `isSuperAdmin` set (firestore.rules: the creator, or a users
 * document of this organisation that is super admin). Both self-manage toggles read on and locked for them.
 */
export function isSuperAdminAccount(user: LeaveSelfBookUser | null | undefined): boolean {
  if (!user) return false
  if (typeof user.organizationSuperAdmin === 'boolean') return user.organizationSuperAdmin
  const role = roleObject(user.role)
  if (role?.isSuperAdmin === true) return true
  const named = roleText(user.role)
  return flagOn(user, 'isSuperAdmin') || named === 'super_admin' || named === 'superadmin'
}

/** PAYE now (`employmentType` as stored is `paye`): no My Timesheets, so the timesheet self-sign toggle does not apply. */
export function isPayeAccount(user: LeaveSelfBookUser | null | undefined): boolean {
  return text(user?.employmentType).toLowerCase() === 'paye'
}

/**
 * The two self-manage toggles in effect (rulebook §8, §9; 1.28.0):
 *   - `annualLeaveSelfBook` (Annual Leave Management): the stored flag outside operative mode (admins and managers);
 *     always on for the Super Admin.
 *   - `timesheetSelfSign` (Timesheet self-sign): admins only — the stored flag for an admin, always on for the Super
 *     Admin, always off for a manager or operative (a demoted admin's stored value is kept underneath and reads again
 *     after a promotion).
 *   - `timesheetApplies`: false for a PAYE person (no My Timesheets); the toggle is then shown greyed out.
 *   - `satisfied`: an admin with Annual Leave Management on AND (Timesheet self-sign on OR PAYE) — the only way an
 *     admin may have no line manager. Never true for a manager or operative.
 * The two toggles are independent of the line manager: either may be on while the admin has one.
 */
export function selfManageToggles(user: LeaveSelfBookUser | null | undefined): {
  annualLeaveSelfBook: boolean
  timesheetSelfSign: boolean
  timesheetApplies: boolean
  superAdmin: boolean
  satisfied: boolean
} {
  // The creator of the organisation is its admin and Super Admin whatever else is stored (`organizationLevelFor`).
  const admin = isAdminOutsideOperativeMode(user) || user?.organizationSuperAdmin === true
  const superAdmin = admin && isSuperAdminAccount(user)
  const annualLeaveSelfBook = !!user && !inOperativeMode(user) && (superAdmin || flagOn(user, 'annualLeaveSelfBook'))
  const timesheetSelfSign = admin && (superAdmin || flagOn(user, 'timesheetSelfSign'))
  const timesheetApplies = !isPayeAccount(user)
  const satisfied = admin && annualLeaveSelfBook && (timesheetSelfSign || !timesheetApplies)
  return { annualLeaveSelfBook, timesheetSelfSign, timesheetApplies, superAdmin, satisfied }
}

/**
 * Whether this person must have an active line manager (rulebook §8, 1.28.0): every operative and every manager, and
 * every admin whose self-manage toggles are not satisfied (`selfManageToggles(user).satisfied`: Annual Leave
 * Management on and Timesheet self-sign on, or PAYE). The Super Admin never needs one (both toggles always on). An
 * inactive person (`isActive === false`) is not checked.
 */
export function lineManagerRequired(user: LeaveSelfBookUser | null | undefined): boolean {
  if (!user || user.isActive === false) return false
  return !selfManageToggles(user).satisfied
}

/**
 * Self-signed timesheets (rulebook §8, 1.28.0): an admin with Timesheet self-sign on, or the Super Admin — whether or
 * not they have a line manager. Their signature completes the sheet — no note to the manager, no "pending manager
 * signature", and the owner writes `weeklyReportOverride` (`timesheetOwnerWriteFields` with
 * `subjectHasLineManager: !timesheetSelfSigned(...)`). Everyone else (an admin with the toggle off included, line
 * manager or not) waits for their line manager, or the admins (`leaveApproverIds`). Before 1.28.0 having no line
 * manager self-signed an admin; it no longer does. `roster` is kept for older callers and not read.
 */
export function timesheetSelfSigned(
  user: LeaveSelfBookUser | null | undefined,
  _roster?: ReadonlyArray<LineManagerRosterMember> | null
): boolean {
  return selfManageToggles(user).timesheetSelfSign
}

/**
 * Whether this person's own annual leave saves approved (rulebook §9, 1.28.0): the `annualLeaveSelfBook` permission
 * outside operative mode, or the Super Admin. Having no line manager never self-books anyone (before 1.28.0 it did for
 * an admin). Everyone else sends a pending request to `leaveApproverIds`. Same test as firestore.rules
 * `hbCallerSelfBooks`. `roster` is kept for older callers and not read.
 */
export function canSelfBookAnnualLeave(
  user: LeaveSelfBookUser | null | undefined,
  _roster?: ReadonlyArray<LineManagerRosterMember> | null
): boolean {
  return selfManageToggles(user).annualLeaveSelfBook
}

/** The leave submit button when the leave saves approved (`canSelfBookAnnualLeave` true). */
export const LEAVE_SUBMIT_LABEL = 'Submit'
/** The leave submit button when the leave is a pending request. */
export const LEAVE_SUBMIT_REQUEST_LABEL = 'Submit request'

/** "Submit" for someone whose leave saves approved, else "Submit request". */
export function leaveSubmitLabel(
  user: LeaveSelfBookUser | null | undefined,
  roster?: ReadonlyArray<LineManagerRosterMember> | null
): string {
  return canSelfBookAnnualLeave(user, roster) ? LEAVE_SUBMIT_LABEL : LEAVE_SUBMIT_REQUEST_LABEL
}

/** Shown by Manage Users (both apps) when it refuses a manager's or operative's save by `lineManagerRequiredError`. */
export const LINE_MANAGER_REQUIRED_MESSAGE = "Set a line manager — this person's timesheets and annual leave need approval."
/** 1.28.0: an admin (not PAYE) with no line manager and a self-manage toggle off. */
export const ADMIN_LINE_MANAGER_REQUIRED_MESSAGE =
  'Set a line manager, or turn on both Annual Leave Management and Timesheet self-sign — this person\'s timesheets and annual leave need approval.'
/** 1.28.0: a PAYE admin (no timesheets) with no line manager and Annual Leave Management off. */
export const PAYE_ADMIN_LINE_MANAGER_REQUIRED_MESSAGE =
  'Set a line manager, or turn on Annual Leave Management — this person\'s annual leave needs approval.'

/**
 * Manage Users save check (rulebook §8, §11). When `lineManagerRequired(user)` and the person has no active line
 * manager other than themself (`hasActiveLineManager(user, roster)` false, `hasNoLineManager` counts as none),
 * returns the message for who they are: a manager or operative `LINE_MANAGER_REQUIRED_MESSAGE`; an admin
 * `ADMIN_LINE_MANAGER_REQUIRED_MESSAGE` (set a line manager or turn on both self-manage toggles), or for a PAYE admin
 * `PAYE_ADMIN_LINE_MANAGER_REQUIRED_MESSAGE`. Otherwise null. Pass the user as it will be saved.
 */
export function lineManagerRequiredError(
  user: LeaveSelfBookUser | null | undefined,
  roster?: ReadonlyArray<LineManagerRosterMember> | null
): string | null {
  if (!lineManagerRequired(user)) return null
  if (hasActiveLineManager(user, roster)) return null
  if (!isAdminOutsideOperativeMode(user)) return LINE_MANAGER_REQUIRED_MESSAGE
  return isPayeAccount(user) ? PAYE_ADMIN_LINE_MANAGER_REQUIRED_MESSAGE : ADMIN_LINE_MANAGER_REQUIRED_MESSAGE
}

/**
 * Ids of roster people saved before the line-manager requirement who now fail `lineManagerRequiredError`:
 * the admins' one-off clean-up list (Data health), including (1.28.0) admins with no line manager whose self-manage
 * toggles are not satisfied. Their requests are not stranded meanwhile — `leaveApproverIds` still sends them to every
 * other active admin, the Super Admin included (who is always satisfied). Roster order is kept.
 */
export function usersMissingLineManager(
  roster: ReadonlyArray<LeaveSelfBookUser & { id: string }> | null | undefined
): string[] {
  const members = (roster || []).filter((member) => member && text(member.id))
  return members
    .filter((member) => lineManagerRequiredError(member, members as LineManagerRosterMember[]) != null)
    .map((member) => text(member.id))
}

// MARK: - Who decides a request (rulebook §9)

export type LeaveDecisionViewer = { id?: string | null; role: StaffAccountRole }

/** A roster person: approver flags plus their own line-manager fields. */
export type LeaveRosterMember = LeaveApproverMember & LeaveRequester

/**
 * Whether `viewer` may approve or decline `requester`'s leave (and accept or refuse a cancellation).
 * Never their own request under any of their ids (`personIdSet`), admins included. An admin or super admin not in operative mode may decide any
 * request in the organisation. Anyone else only when they are in `leaveApproverIds(requester, roster)`.
 */
export function canDecideLeave(
  viewer: LeaveDecisionViewer | null | undefined,
  requester: LeaveRequester | null | undefined,
  roster: ReadonlyArray<LeaveApproverMember> | null | undefined
): boolean {
  const me = text(viewer?.id).toLowerCase()
  if (!viewer || !me) return false
  if (me === text(requester?.id).toLowerCase()) return false
  if (personIdSet(requester, roster).some((id) => idKey(id) === me)) return false
  const role = viewer.role
  if (role && !role.isOperativeMode && (role.isAdmin || role.isSuperAdmin)) return true
  return leaveApproverIds(requester, roster).some((id) => id.toLowerCase() === me)
}

export type LeaveQueueRequest = {
  userId?: string | null
  operativeId?: string | null
  status?: unknown
  cancellationRequestedAt?: unknown
  cancellationRequestedByUserId?: unknown
}

function cancellationRequested(request: LeaveQueueRequest): boolean {
  const at = request.cancellationRequestedAt
  if (at != null && at !== '' && at !== false) return true
  return text(request.cancellationRequestedByUserId) !== ''
}

/**
 * The requests waiting for this viewer's decision, in input order: pending requests and approved leave with a
 * cancellation request, filtered with `canDecideLeave`. The requester is the roster person whose id matches the
 * request's `userId` (else `operativeId`), ids compared without case; a requester not on the roster has no line
 * manager, so only admins see it.
 */
export function leaveDecisionQueue<T extends LeaveQueueRequest>(
  viewer: LeaveDecisionViewer | null | undefined,
  requests: ReadonlyArray<T> | null | undefined,
  roster: ReadonlyArray<LeaveRosterMember> | null | undefined
): T[] {
  const members = (roster || []).filter((member) => member && text(member.id))
  const byId = new Map(members.map((member) => [text(member.id).toLowerCase(), member]))
  return (requests || []).filter((request) => {
    if (!request) return false
    const status = normalizeHolidayStatus(request.status)
    const waiting = status === 'pending' || (status === 'approved' && cancellationRequested(request))
    if (!waiting) return false
    const ids = [text(request.userId), text(request.operativeId)].filter(Boolean)
    if (ids.length === 0) return false
    const member = ids.map((id) => byId.get(id.toLowerCase())).find(Boolean)
    const requester: LeaveRequester = member ?? { id: ids[0] }
    return canDecideLeave(viewer, requester, members)
  })
}

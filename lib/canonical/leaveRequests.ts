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
 * (`assignedManagerUserIds`, else the legacy `assignedManagerUserId`). No line manager,
 * `hasNoLineManager`, or none of them still active in the roster → every active admin and
 * super admin. The requester never approves their own request.
 */

import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { eachDayKey, isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import type { StaffAccountRole } from './staffAccess'

export const HOLIDAY_TIME_SLOTS = ['FULL DAY', 'AM', 'PM'] as const
export type HolidayTimeSlotValue = (typeof HOLIDAY_TIME_SLOTS)[number]
export const HOLIDAY_STATUSES = ['pending', 'approved', 'rejected'] as const
export type HolidayStatusValue = (typeof HOLIDAY_STATUSES)[number]

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** The stored slot value. Anything other than AM / PM is a full day. */
export function normalizeHolidayTimeSlot(value: unknown): HolidayTimeSlotValue {
  const raw = text(value).toUpperCase().replace(/_/g, ' ')
  if (raw === 'AM') return 'AM'
  if (raw === 'PM') return 'PM'
  return 'FULL DAY'
}

/** Missing status is approved (older records). Unknown values are approved. */
export function normalizeHolidayStatus(value: unknown): HolidayStatusValue {
  const raw = text(value).toLowerCase()
  if (raw === 'pending' || raw === 'rejected' || raw === 'approved') return raw
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
  assignedManagerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserId?: string | null
  hasNoLineManager?: boolean | null
}

export type LeaveApproverMember = {
  id: string
  /** Missing counts as active. */
  isActive?: boolean | null
  role: StaffAccountRole
}

/** `assignedManagerUserIds`, else the legacy single id. Empty when `hasNoLineManager`. */
export function lineManagerIds(user: LeaveRequester | null | undefined): string[] {
  if (!user || user.hasNoLineManager === true) return []
  const listed = (user.assignedManagerUserIds || []).map(text).filter(Boolean)
  const ids = listed.length > 0 ? listed : [text(user.assignedManagerUserId)].filter(Boolean)
  return Array.from(new Set(ids))
}

/** Who approves this person's leave (see file header). */
export function leaveApproverIds(
  user: LeaveRequester | null | undefined,
  roster: ReadonlyArray<LeaveApproverMember> | null | undefined
): string[] {
  const members = (roster || []).filter((member) => member && text(member.id))
  const self = text(user?.id)
  const active = (member: LeaveApproverMember) => member.isActive !== false
  const byId = new Map(members.map((member) => [text(member.id), member]))
  const managers = lineManagerIds(user).filter((id) => {
    if (id === self) return false
    if (members.length === 0) return true
    const member = byId.get(id)
    return Boolean(member && active(member))
  })
  if (managers.length > 0) return managers
  return members
    .filter(
      (member) =>
        active(member) &&
        !member.role.isOperativeMode &&
        (member.role.isSuperAdmin || member.role.isAdmin) &&
        text(member.id) !== self
    )
    .map((member) => text(member.id))
}

/** Inbox type both apps write when someone asks for leave. */
export const HOLIDAY_REQUEST_SUBMITTED_TYPE = 'holiday_request_submitted'

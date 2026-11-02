/**
 * Reading `organizations/{orgId}/holidayBookings/{id}` documents (rulebook §9, §1 "Document readers").
 *
 * Every platform reads a leave document only through `parseHolidayDocument`; no app keeps its own
 * parser. Before 1.5.0 web and iOS each read these documents differently (different keys, status
 * words, id rules and day conversion), so the same record fed `unbookedLabourRows` different inputs.
 *
 * Keys accepted (the union of what either app ever read; first non-empty wins, in this order):
 *   start          startDate, start_date, start, from, dateFrom, holidayStart, date
 *   end            endDate, end_date, end, to, dateTo, holidayEnd (missing → the start day)
 *   userId         userId, user_id, uid, userID, linkedUserId, employeeUserId, then nested
 *                  user.{id, uid, userId, userID}
 *   operativeId    operativeId, operative_id, operativeID — kept as stored, never dropped for not
 *                  being a UUID
 *   status         status, holidayStatus, approvalStatus → `normalizeHolidayStatus` (synonyms;
 *                  missing or unknown → approved)
 *   timeSlot       timeSlot, slot, halfDay → `normalizeHolidayTimeSlot`
 *   decisionNote   decisionNote, note → `parseHolidayDecisionNote`
 *   approvedBy     approvedByUserId, approvedBy
 *
 * The record id is the document id (the path is the identity; a stored `id` field is ignored).
 * Ids keep their stored case. Dates (Firestore Timestamp `{seconds, nanoseconds}` / `{_seconds}`,
 * an object with `toDate()`, Date, epoch number, ISO date-time string) become day keys in the
 * organisation zone. A calendar-date string (`YYYY-MM-DD`, `YYYY/MM/DD`, `DD/MM/YYYY`,
 * `DD-MM-YYYY`) is that calendar day as written. An epoch number above 10 000 000 000 is
 * milliseconds, otherwise seconds; zero or negative is unreadable. A reversed range is swapped.
 *
 * The parsed record is the `LabourHoliday` input of `unbookedLabourRows` and the `LeaveRecord`
 * input of leave coverage as it stands (`labourHolidayInput` names that hand-over), so both apps
 * feed warnings and Daily Overview the parsed day keys and never recompute them.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import {
  normalizeHolidayStatus,
  normalizeHolidayTimeSlot,
  parseHolidayDecisionNote,
  type HolidayStatusValue,
  type HolidayTimeSlotValue,
} from './leaveRequests'
import type { LabourHoliday } from './warningRows'

export const HOLIDAY_DOCUMENT_KEYS = {
  start: ['startDate', 'start_date', 'start', 'from', 'dateFrom', 'holidayStart', 'date'],
  end: ['endDate', 'end_date', 'end', 'to', 'dateTo', 'holidayEnd'],
  userId: ['userId', 'user_id', 'uid', 'userID', 'linkedUserId', 'employeeUserId'],
  nestedUserId: ['id', 'uid', 'userId', 'userID'],
  operativeId: ['operativeId', 'operative_id', 'operativeID'],
  status: ['status', 'holidayStatus', 'approvalStatus'],
  timeSlot: ['timeSlot', 'slot', 'halfDay'],
  decisionNote: ['decisionNote', 'note'],
  approvedByUserId: ['approvedByUserId', 'approvedBy'],
} as const

export type HolidayDocument = {
  /** The Firestore document id, stored case. */
  id: string
  userId: string | null
  operativeId: string | null
  /** Organisation-zone day keys, start ≤ end. */
  startDayKey: string
  endDayKey: string
  timeSlot: HolidayTimeSlotValue
  status: HolidayStatusValue
  /** `status === 'approved'`. A pending cancellation request is still approved leave. */
  approved: boolean
  approvedByUserId: string | null
  cancellationRequested: boolean
  cancellationRequestedByUserId: string | null
  decisionNote: string | null
  /** Stored `organizationId`, when the document has one. */
  organizationId?: string
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstText(row: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = text(row[key])
    if (value) return value
  }
  return ''
}

function validCalendarDay(year: number, month: number, day: number): string {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function epochMs(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  return value > 10_000_000_000 ? value : value * 1000
}

/**
 * One stored leave date as an organisation-zone day key, or '' when unreadable.
 * See the file header for the accepted shapes.
 */
export function holidayDocumentDayKey(raw: unknown, timeZone?: string | null): string {
  const zone = zoneOrLondon(timeZone)
  if (raw == null || raw === '') return ''
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? '' : dayKeyInZone(raw, zone)
  if (typeof raw === 'number') {
    const ms = epochMs(raw)
    return ms == null ? '' : dayKeyInZone(new Date(ms), zone)
  }
  if (typeof raw === 'string') {
    const value = raw.trim()
    if (!value) return ''
    let match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
    if (match) return validCalendarDay(Number(match[1]), Number(match[2]), Number(match[3]))
    match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (match) return validCalendarDay(Number(match[3]), Number(match[2]), Number(match[1]))
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? '' : dayKeyInZone(new Date(ms), zone)
  }
  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown> & { toDate?: unknown }
    const seconds =
      typeof row.seconds === 'number' ? row.seconds : typeof row._seconds === 'number' ? row._seconds : null
    if (seconds != null && Number.isFinite(seconds)) {
      const nanos =
        typeof row.nanoseconds === 'number' ? row.nanoseconds : typeof row._nanoseconds === 'number' ? row._nanoseconds : 0
      return dayKeyInZone(new Date(seconds * 1000 + Math.floor((Number(nanos) || 0) / 1e6)), zone)
    }
    if (typeof row.toDate === 'function') {
      try {
        const date = (row.toDate as () => unknown)()
        if (date instanceof Date && !Number.isNaN(date.getTime())) return dayKeyInZone(date, zone)
      } catch {
        return ''
      }
    }
  }
  return ''
}

function firstDayKey(row: Record<string, unknown>, keys: readonly string[], zone: string): string {
  for (const key of keys) {
    const dayKey = holidayDocumentDayKey(row[key], zone)
    if (dayKey) return dayKey
  }
  return ''
}

function hasValue(value: unknown): boolean {
  if (value == null || value === false || value === '') return false
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

/**
 * Read one `holidayBookings` document. Null when it has no readable start date (or no document id).
 * Never throws.
 */
export function parseHolidayDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  timeZone?: string | null
): HolidayDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = data && typeof data === 'object' ? data : {}
  const zone = zoneOrLondon(timeZone)

  const start = firstDayKey(row, HOLIDAY_DOCUMENT_KEYS.start, zone)
  if (!start || !DAY_KEY.test(start)) return null
  const end = firstDayKey(row, HOLIDAY_DOCUMENT_KEYS.end, zone) || start
  const [startDayKey, endDayKey] = end < start ? [end, start] : [start, end]

  let userId = firstText(row, HOLIDAY_DOCUMENT_KEYS.userId)
  if (!userId && row.user && typeof row.user === 'object') {
    userId = firstText(row.user as Record<string, unknown>, HOLIDAY_DOCUMENT_KEYS.nestedUserId)
  }
  const operativeId = firstText(row, HOLIDAY_DOCUMENT_KEYS.operativeId)
  const status = normalizeHolidayStatus(firstText(row, HOLIDAY_DOCUMENT_KEYS.status))
  const cancellationRequestedByUserId = text(row.cancellationRequestedByUserId)
  const organizationId = text(row.organizationId)

  const parsed: HolidayDocument = {
    id,
    userId: userId || null,
    operativeId: operativeId || null,
    startDayKey,
    endDayKey,
    timeSlot: normalizeHolidayTimeSlot(firstText(row, HOLIDAY_DOCUMENT_KEYS.timeSlot)),
    status,
    approved: status === 'approved',
    approvedByUserId: firstText(row, HOLIDAY_DOCUMENT_KEYS.approvedByUserId) || null,
    cancellationRequested: hasValue(row.cancellationRequestedAt),
    cancellationRequestedByUserId: cancellationRequestedByUserId || null,
    decisionNote: parseHolidayDecisionNote(firstText(row, HOLIDAY_DOCUMENT_KEYS.decisionNote)),
  }
  if (organizationId) parsed.organizationId = organizationId
  return parsed
}

/** `parseHolidayDocument` over a list of `{ id, data }`, dropping unreadable documents. */
export function parseHolidayDocuments(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>,
  timeZone?: string | null
): HolidayDocument[] {
  const out: HolidayDocument[] = []
  for (const entry of docs || []) {
    const parsed = parseHolidayDocument(entry?.id, entry?.data, timeZone)
    if (parsed) out.push(parsed)
  }
  return out
}

/**
 * The `unbookedLabourRows` / Daily Overview / leave coverage holiday input from a parsed record:
 * the parsed ids and organisation-zone day keys, unchanged. Apps never recompute these days.
 */
export function labourHolidayInput(
  record: Pick<HolidayDocument, 'id' | 'userId' | 'operativeId' | 'startDayKey' | 'endDayKey' | 'timeSlot' | 'approved'>
): LabourHoliday & { id: string; timeSlot: HolidayTimeSlotValue } {
  return {
    id: record.id,
    userId: record.userId,
    operativeId: record.operativeId,
    startDayKey: record.startDayKey,
    endDayKey: record.endDayKey,
    timeSlot: record.timeSlot,
    approved: record.approved,
  }
}

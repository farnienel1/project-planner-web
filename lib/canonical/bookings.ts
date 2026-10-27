/**
 * Operative bookings: how a stored document is read, the one write shape,
 * what deleting a person or a job does to their bookings, and how a booking
 * whose job is gone is shown. Web and iOS both call these; neither keeps its
 * own status list, slot list, parser or delete rule.
 *
 * Reading accepts the legacy spellings web has always recovered and reports
 * each one in `repairs`, so Data Health can list rows that need re-saving.
 * Dates cross the bridge as milliseconds; each app converts its own Timestamp
 * type before calling and back after.
 */

import { dayKeyInZone, partsInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { formatClockMinutes, namedSlotKind, parseClockMinutes } from './engine'

export const BOOKING_STATUSES = ['Confirmed', 'Tentative', 'Cancelled', 'Completed'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_TIME_SLOTS = ['AM', 'PM', 'FULL DAY', 'Evening', 'Overtime', 'CUSTOM_HOURS'] as const
export type BookingTimeSlot = (typeof BOOKING_TIME_SLOTS)[number]

/** Shown wherever a booking's job no longer exists. */
export const ORPHAN_BOOKING_LABEL = 'Deleted job'

const STATUS_ALIASES: Record<string, BookingStatus> = {
  confirmed: 'Confirmed',
  tentative: 'Tentative',
  pending: 'Tentative',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  completed: 'Completed',
}

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export type BookingRepair =
  | 'status_alias'
  | 'slot_missing_full_day'
  | 'slot_alias'
  | 'operative_id_alias'
  | 'project_id_alias'
  | 'booked_by_missing'
  | 'date_not_timestamp'

/**
 * Early organisation setup wrote rows with this document id in jobs, clients and bookings. They are not
 * real records: no list shows them and no save writes them back.
 */
export const LEGACY_PLACEHOLDER_DOCUMENT_ID = 'INITIAL-PLACEHOLDER'

export function isLegacyPlaceholderDocumentId(id: string | null | undefined): boolean {
  return (id || '').trim().toUpperCase() === LEGACY_PLACEHOLDER_DOCUMENT_ID
}

export type BookingParseError =
  | 'legacy_placeholder'
  | 'missing_operative_id'
  | 'missing_project_id'
  | 'missing_date'
  | 'bad_status'
  | 'bad_time_slot'

export type CanonicalBooking = {
  id: string
  operativeId: string
  projectId: string
  dateMs: number
  timeSlot: BookingTimeSlot
  status: BookingStatus
  bookedBy: string
  notes: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved: boolean
  otMultiplierOverride?: number
  bookingGroupId?: string
  createdAtMs?: number
  updatedAtMs?: number
  /** False for an id iOS cannot hold in a Swift UUID (for example a Firebase user id). */
  operativeIdIsUuid: boolean
  projectIdIsUuid: boolean
}

export type BookingParseResult =
  | { ok: true; booking: CanonicalBooking; repairs: BookingRepair[] }
  | { ok: false; errors: BookingParseError[] }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function isBookingUuid(value: unknown): boolean {
  return UUID_PATTERN.test(text(value))
}

/** Canonical status, or null. Exact spellings and the legacy aliases both read. */
export function normalizeBookingStatus(raw: unknown): BookingStatus | null {
  const value = text(raw)
  if (!value) return null
  if ((BOOKING_STATUSES as readonly string[]).includes(value)) return value as BookingStatus
  return STATUS_ALIASES[value.toLowerCase()] ?? null
}

/** Canonical slot, or null. FULL_DAY, MORNING, AFTERNOON, CUSTOM and any case read. */
export function normalizeBookingTimeSlot(raw: unknown): BookingTimeSlot | null {
  const value = text(raw)
  if (!value) return null
  if ((BOOKING_TIME_SLOTS as readonly string[]).includes(value)) return value as BookingTimeSlot
  const compact = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase()
  if (compact === 'FULL DAY' || compact === 'FULLDAY') return 'FULL DAY'
  if (compact === 'CUSTOM' || compact === 'CUSTOM HOURS' || compact === 'CUSTOMHOURS') return 'CUSTOM_HOURS'
  if (compact === 'AM' || compact === 'MORNING') return 'AM'
  if (compact === 'PM' || compact === 'AFTERNOON') return 'PM'
  if (compact === 'EVENING') return 'Evening'
  if (compact === 'OVERTIME') return 'Overtime'
  return null
}

/**
 * Milliseconds from { seconds, nanoseconds }, { _seconds, _nanoseconds },
 * a millisecond number, or an ISO string. Null when none of those.
 */
export function bookingDateMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime()
  if (typeof raw === 'string') {
    const ms = Date.parse(raw.trim())
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    const seconds = finiteNumber(row.seconds) ?? finiteNumber(row._seconds)
    if (seconds == null) return null
    const nanos = finiteNumber(row.nanoseconds) ?? finiteNumber(row._nanoseconds) ?? 0
    return seconds * 1000 + Math.floor(nanos / 1e6)
  }
  return null
}

function isTimestampShape(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const row = raw as Record<string, unknown>
  return finiteNumber(row.seconds) != null || finiteNumber(row._seconds) != null
}

/**
 * "HH:mm" from "7:30", "07:30:00", "7:30 PM", or a stored instant (Timestamp
 * shape, Date or milliseconds) read in the organisation zone. Undefined when unreadable.
 */
export function bookingClock(raw: unknown, timeZone?: string | null): string | undefined {
  if (raw != null && typeof raw !== 'string') {
    const ms = bookingDateMs(raw)
    if (ms == null) return undefined
    const parts = partsInZone(new Date(ms), zoneOrLondon(timeZone))
    return formatClockMinutes(parts.h * 60 + parts.min)
  }
  const value = text(raw)
  if (!value) return undefined
  const ampm = value.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)$/i)
  if (ampm) {
    let hours = Number(ampm[1])
    const minutes = Number(ampm[2] || '0')
    const pm = ampm[3].toUpperCase() === 'PM'
    if (hours === 12) hours = pm ? 12 : 0
    else if (pm) hours += 12
    if (hours > 23 || minutes > 59) return undefined
    return formatClockMinutes(hours * 60 + minutes)
  }
  const withSeconds = value.match(/^(\d{1,2}:\d{2})(?::\d{2})?$/)
  const minutes = withSeconds ? parseClockMinutes(withSeconds[1]) : null
  return minutes == null ? undefined : formatClockMinutes(minutes)
}

/** Read one stored booking document. Never throws. */
export function parseBookingDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null }
): BookingParseResult {
  if (isLegacyPlaceholderDocumentId(docId)) return { ok: false, errors: ['legacy_placeholder'] }
  const row = data && typeof data === 'object' ? data : {}
  const repairs: BookingRepair[] = []
  const errors: BookingParseError[] = []

  let operativeId = text(row.operativeId)
  if (!operativeId && text(row.operativeID)) {
    operativeId = text(row.operativeID)
    repairs.push('operative_id_alias')
  }
  let projectId = text(row.projectId)
  if (!projectId && text(row.projectID)) {
    projectId = text(row.projectID)
    repairs.push('project_id_alias')
  }
  const dateMs = bookingDateMs(row.date)
  if (dateMs != null && !isTimestampShape(row.date)) repairs.push('date_not_timestamp')

  const rawStatus = text(row.status)
  const status = normalizeBookingStatus(row.status)
  if (status && status !== rawStatus) repairs.push('status_alias')

  const rawSlot = text(row.timeSlot)
  let timeSlot = normalizeBookingTimeSlot(row.timeSlot)
  if (!rawSlot) {
    timeSlot = 'FULL DAY'
    repairs.push('slot_missing_full_day')
  } else if (timeSlot && timeSlot !== rawSlot) {
    repairs.push('slot_alias')
  }

  const bookedBy = text(row.bookedBy)
  if (!bookedBy) repairs.push('booked_by_missing')

  if (!operativeId) errors.push('missing_operative_id')
  if (!projectId) errors.push('missing_project_id')
  if (dateMs == null) errors.push('missing_date')
  if (!status) errors.push('bad_status')
  if (!timeSlot) errors.push('bad_time_slot')
  if (errors.length > 0 || dateMs == null || !status || !timeSlot) return { ok: false, errors }

  const booking: CanonicalBooking = {
    id: text(docId),
    operativeId,
    projectId,
    dateMs,
    timeSlot,
    status,
    bookedBy,
    notes: text(row.notes),
    isBreakRemoved: row.isBreakRemoved === true,
    operativeIdIsUuid: isBookingUuid(operativeId),
    projectIdIsUuid: isBookingUuid(projectId),
  }
  const workStartTime = bookingClock(row.workStartTime, options?.timeZone)
  const workEndTime = bookingClock(row.workEndTime, options?.timeZone)
  const otMultiplierOverride = finiteNumber(row.otMultiplierOverride)
  const bookingGroupId = text(row.bookingGroupId)
  const createdAtMs = bookingDateMs(row.createdAt)
  const updatedAtMs = bookingDateMs(row.updatedAt)
  if (workStartTime) booking.workStartTime = workStartTime
  if (workEndTime) booking.workEndTime = workEndTime
  if (otMultiplierOverride != null) booking.otMultiplierOverride = otMultiplierOverride
  if (bookingGroupId) booking.bookingGroupId = bookingGroupId
  if (createdAtMs != null) booking.createdAtMs = createdAtMs
  if (updatedAtMs != null) booking.updatedAtMs = updatedAtMs
  return { ok: true, booking, repairs }
}

export type CanonicalBookingInput = {
  id: string
  operativeId: string
  projectId: string
  dateMs: number
  timeSlot: string
  status: string
  bookedBy: string
  notes?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
  otMultiplierOverride?: number | null
  bookingGroupId?: string | null
  createdAtMs: number
  updatedAtMs: number
}

export type BookingWriteResult =
  | { ok: true; fields: Record<string, string | number | boolean> }
  | { ok: false; errors: Array<BookingParseError | 'missing_id' | 'missing_booked_by'> }

/**
 * The one stored shape. Canonical status and slot spellings, trimmed ids,
 * HH:mm clocks. `dateMs`, `createdAtMs` and `updatedAtMs` come back as
 * `date`, `createdAt` and `updatedAt` numbers; each app writes them as its
 * Timestamp type. Optional fields are left out when empty.
 */
export function bookingWriteFields(input: CanonicalBookingInput): BookingWriteResult {
  const errors: Array<BookingParseError | 'missing_id' | 'missing_booked_by'> = []
  const id = text(input.id)
  const operativeId = text(input.operativeId)
  const projectId = text(input.projectId)
  const bookedBy = text(input.bookedBy)
  const status = normalizeBookingStatus(input.status)
  const timeSlot = normalizeBookingTimeSlot(input.timeSlot)
  const dateMs = finiteNumber(input.dateMs)
  if (!id) errors.push('missing_id')
  if (!operativeId) errors.push('missing_operative_id')
  if (!projectId) errors.push('missing_project_id')
  if (dateMs == null) errors.push('missing_date')
  if (!timeSlot) errors.push('bad_time_slot')
  if (!bookedBy) errors.push('missing_booked_by')
  if (!status) errors.push('bad_status')
  if (errors.length > 0 || dateMs == null || !status || !timeSlot) return { ok: false, errors }
  const fields: Record<string, string | number | boolean> = {
    id,
    operativeId,
    projectId,
    date: dateMs,
    timeSlot,
    bookedBy,
    notes: text(input.notes),
    status,
    isBreakRemoved: input.isBreakRemoved === true,
    createdAt: finiteNumber(input.createdAtMs) ?? dateMs,
    updatedAt: finiteNumber(input.updatedAtMs) ?? dateMs,
  }
  const workStartTime = bookingClock(input.workStartTime)
  const workEndTime = bookingClock(input.workEndTime)
  const otMultiplierOverride = finiteNumber(input.otMultiplierOverride)
  const bookingGroupId = text(input.bookingGroupId)
  if (workStartTime) fields.workStartTime = workStartTime
  if (workEndTime) fields.workEndTime = workEndTime
  if (otMultiplierOverride != null) fields.otMultiplierOverride = otMultiplierOverride
  if (bookingGroupId) fields.bookingGroupId = bookingGroupId
  return { ok: true, fields }
}

function todayKey(nowIso: string, timeZone?: string | null): string {
  const zone = zoneOrLondon(timeZone)
  const now = new Date(nowIso)
  return dayKeyInZone(Number.isNaN(now.getTime()) ? new Date() : now, zone)
}

function onOrAfterToday(dateMs: number, today: string, timeZone?: string | null): boolean {
  if (!Number.isFinite(dateMs)) return false
  return dayKeyInZone(new Date(dateMs), zoneOrLondon(timeZone)) >= today
}

/**
 * Bookings to remove when a person is deleted: those on any of the person's
 * ids (user id and operative ids) dated today or later in the organisation
 * zone. Past bookings stay as history. Names are never matched.
 * Deactivating a person removes nothing.
 */
export function bookingsToRemoveOnOperativeDelete(input: {
  bookings: ReadonlyArray<{ id: string; operativeId: string; dateMs: number }>
  operativeIds: readonly string[]
  nowIso: string
  timeZone?: string | null
}): string[] {
  const ids = new Set(input.operativeIds.map((id) => text(id).toUpperCase()).filter(Boolean))
  if (ids.size === 0) return []
  const today = todayKey(input.nowIso, input.timeZone)
  return input.bookings
    .filter((row) => ids.has(text(row.operativeId).toUpperCase()) && onOrAfterToday(row.dateMs, today, input.timeZone))
    .map((row) => row.id)
}

/**
 * Bookings to remove when a job is deleted: that job's bookings dated today
 * or later. Past bookings stay and show as ORPHAN_BOOKING_LABEL.
 */
export function bookingsToRemoveOnProjectDelete(input: {
  bookings: ReadonlyArray<{ id: string; projectId: string; dateMs: number }>
  projectId: string
  nowIso: string
  timeZone?: string | null
}): string[] {
  const projectId = text(input.projectId).toUpperCase()
  if (!projectId) return []
  const today = todayKey(input.nowIso, input.timeZone)
  return input.bookings
    .filter((row) => text(row.projectId).toUpperCase() === projectId && onOrAfterToday(row.dateMs, today, input.timeZone))
    .map((row) => row.id)
}

/** 'deleted_job' when the booking's job is not in the live projects and small works. */
export function bookingJobState(
  projectId: string,
  liveProjectIds: ReadonlySet<string> | readonly string[]
): 'live' | 'deleted_job' {
  const id = text(projectId).toUpperCase()
  if (!id) return 'deleted_job'
  const ids = Array.isArray(liveProjectIds) ? liveProjectIds : Array.from(liveProjectIds as ReadonlySet<string>)
  return ids.some((row) => text(row).toUpperCase() === id) ? 'live' : 'deleted_job'
}

/** Job name to show for a booking: the live name, or ORPHAN_BOOKING_LABEL. */
export function bookingJobLabel(projectName: string | null | undefined): string {
  return text(projectName) || ORPHAN_BOOKING_LABEL
}

export type BookingHealthKind = 'refused' | 'repaired' | 'missing_operative' | 'missing_job' | 'ios_cannot_read'

export type BookingHealthRow = { id: string; kind: BookingHealthKind; detail: string }

/**
 * Admin Data Health: every booking document the parser refuses or repairs,
 * every booking whose person or job no longer exists, and every id iOS
 * cannot hold. One row per problem.
 */
export function bookingHealthRows(input: {
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>
  operativeIds: readonly string[]
  userIds: readonly string[]
  projectIds: readonly string[]
}): BookingHealthRow[] {
  const people = new Set([...input.operativeIds, ...input.userIds].map((id) => text(id).toUpperCase()).filter(Boolean))
  const jobs = new Set(input.projectIds.map((id) => text(id).toUpperCase()).filter(Boolean))
  const rows: BookingHealthRow[] = []
  for (const doc of input.docs) {
    const parsed = parseBookingDocument(doc.id, doc.data)
    if (!parsed.ok) {
      rows.push({ id: doc.id, kind: 'refused', detail: parsed.errors.join(', ') })
      continue
    }
    const booking = parsed.booking
    if (parsed.repairs.length > 0) rows.push({ id: doc.id, kind: 'repaired', detail: parsed.repairs.join(', ') })
    if (!people.has(booking.operativeId.toUpperCase())) {
      rows.push({ id: doc.id, kind: 'missing_operative', detail: booking.operativeId })
    }
    if (!jobs.has(booking.projectId.toUpperCase())) {
      rows.push({ id: doc.id, kind: 'missing_job', detail: booking.projectId })
    }
    if (!booking.operativeIdIsUuid || !booking.projectIdIsUuid) {
      rows.push({
        id: doc.id,
        kind: 'ios_cannot_read',
        detail: !booking.operativeIdIsUuid ? `operativeId ${booking.operativeId}` : `projectId ${booking.projectId}`,
      })
    }
  }
  return rows
}

// --- Manager site bookings -------------------------------------------------

export const MANAGER_TIME_SLOTS = ['AM', 'PM', 'FULL_DAY', 'CUSTOM_HOURS'] as const
export type ManagerBookingTimeSlot = (typeof MANAGER_TIME_SLOTS)[number]

export const MANAGER_LOCATION_TYPES = [
  'project',
  'small_work',
  'office',
  'working_from_home',
  'site_survey',
  'custom',
] as const
export type ManagerBookingLocationType = (typeof MANAGER_LOCATION_TYPES)[number]

/** `FULL_DAY`, `AM`, `PM` or `CUSTOM_HOURS` from any stored spelling; null when it is not a manager slot. */
export function normalizeManagerBookingTimeSlot(raw: unknown): ManagerBookingTimeSlot | null {
  const value = text(raw)
  if (!value) return null
  if ((MANAGER_TIME_SLOTS as readonly string[]).includes(value)) return value as ManagerBookingTimeSlot
  switch (namedSlotKind(value)) {
    case 'FULL_DAY':
      return 'FULL_DAY'
    case 'AM':
      return 'AM'
    case 'PM':
      return 'PM'
    case 'CUSTOM':
      return 'CUSTOM_HOURS'
    default:
      return null
  }
}

export type CanonicalManagerSiteBooking = {
  id: string
  userId: string
  dateMs: number
  timeSlot: ManagerBookingTimeSlot
  locationType: ManagerBookingLocationType
  locationId?: string
  customLocationName?: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved: boolean
  bookingGroupId?: string
  createdAtMs?: number
  updatedAtMs?: number
}

export type ManagerSiteBookingParseResult =
  | { ok: true; booking: CanonicalManagerSiteBooking; repairs: string[] }
  | { ok: false; errors: string[] }

/**
 * Reads `organizations/{orgId}/managerSiteBookings/{id}`. userId, a readable date and a manager
 * slot are required. A missing or unknown locationType is read as `project` (reported in repairs),
 * so web and iOS keep the same rows.
 */
export function parseManagerSiteBookingDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null }
): ManagerSiteBookingParseResult {
  if (isLegacyPlaceholderDocumentId(docId)) return { ok: false, errors: ['legacy_placeholder'] }
  const row = data && typeof data === 'object' ? data : {}
  const errors: string[] = []
  const repairs: string[] = []
  const userId = text(row.userId)
  const dateMs = bookingDateMs(row.date)
  if (dateMs != null && !isTimestampShape(row.date)) repairs.push('date_not_timestamp')
  const timeSlot = normalizeManagerBookingTimeSlot(row.timeSlot)
  if (timeSlot && timeSlot !== text(row.timeSlot)) repairs.push('slot_alias')
  if (!userId) errors.push('missing_user_id')
  if (dateMs == null) errors.push('missing_date')
  if (!timeSlot) errors.push('bad_time_slot')
  if (errors.length > 0 || dateMs == null || !timeSlot) return { ok: false, errors }

  const rawLocation = text(row.locationType)
  let locationType: ManagerBookingLocationType = 'project'
  if ((MANAGER_LOCATION_TYPES as readonly string[]).includes(rawLocation)) {
    locationType = rawLocation as ManagerBookingLocationType
  } else {
    repairs.push(rawLocation ? 'location_type_unknown' : 'location_type_missing')
  }

  const booking: CanonicalManagerSiteBooking = {
    id: text(docId),
    userId,
    dateMs,
    timeSlot,
    locationType,
    isBreakRemoved: row.isBreakRemoved === true,
  }
  const locationId = text(row.locationId)
  const customLocationName = text(row.customLocationName)
  const workStartTime = bookingClock(row.workStartTime, options?.timeZone)
  const workEndTime = bookingClock(row.workEndTime, options?.timeZone)
  const bookingGroupId = text(row.bookingGroupId)
  const createdAtMs = bookingDateMs(row.createdAt)
  const updatedAtMs = bookingDateMs(row.updatedAt)
  if (locationId) booking.locationId = locationId
  if (customLocationName) booking.customLocationName = customLocationName
  if (workStartTime) booking.workStartTime = workStartTime
  if (workEndTime) booking.workEndTime = workEndTime
  if (bookingGroupId) booking.bookingGroupId = bookingGroupId
  if (createdAtMs != null) booking.createdAtMs = createdAtMs
  if (updatedAtMs != null) booking.updatedAtMs = updatedAtMs
  return { ok: true, booking, repairs }
}

/**
 * Reading and writing the work collections (rulebook §1 "Document readers" / "Partial writes only", §2, §8).
 *
 * 1.7.0: anything booked, changed, cancelled, requested or signed reads and writes the same on every
 * platform. Before this file web and iOS each parsed these documents their own way:
 *   - `projects` / `smallWorks`: iOS saved with a full `setData` (no merge) and read ids through Swift `UUID`,
 *     so a non-UUID job, client or manager id was randomised or dropped; web merge-set the whole job and
 *     re-stamped `createdAt` when the form had none.
 *   - `subcontractorBookings`: web created them with a random lower-case id and no `id`, `status` or
 *     `isBreakRemoved` field, and iOS required all three, so web bookings were invisible on iOS.
 *   - timesheet `expenseEntries` / `priceWorkEntries`: iOS dropped an entry whose id is not a UUID and web gave
 *     an entry with no id a new random id on every read, so `extraEntryReviews[entryId]` could never match it.
 *   - `settings/deadlines_*`: web dropped non-UUID ids; the `settings/deadlineAssignments` map was written by
 *     iOS as a literal dotted field name through a merge-set.
 *   - `bookings`: web rewrote the whole booking on every edit.
 *
 * Readers are pure, JSON in / JSON out, `(docId, data, options?)`, and never throw. Instants come back as epoch
 * milliseconds (`…Ms`) and organisation-zone day keys (`…DayKey`), read with `documentInstantMs` (§1). Ids are
 * kept in their stored case; an id that is not a UUID is kept. Writes return `{ set, remove }`
 * (`documentWriteFields`, 1.6.0): a field the stored copy lacks is never deleted.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import {
  isLegacyPlaceholderDocumentId,
  normalizeBookingStatus,
  normalizeBookingTimeSlot,
  bookingClock,
  isBookingUuid,
  type BookingStatus,
  type BookingTimeSlot,
} from './bookings'
import { zoneOrLondon } from './dayKeys'
import {
  documentBool,
  documentInstantMs,
  documentNumber,
  documentWriteFields,
  type DocumentWriteFields,
} from './peopleDocuments'
import { derivedDocumentId, derivedRowId } from './derivedIds'
import { normalizeDocumentId } from './scheduleSources'
import { timesheetEntryDecision, type TimesheetEntryDecision, type TimesheetEntryDecisionSource } from './timesheetEntryReviews'

// MARK: - Value readers

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function rawText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function firstText(row: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = text(row[key])
    if (value) return value
  }
  return ''
}

function optionalText(value: unknown): string | null {
  return text(value) || null
}

function dayKeyOf(ms: number | null, zone: string): string | null {
  return ms == null ? null : dayKeyInZone(new Date(ms), zone)
}

/** Non-empty trimmed strings in stored case, de-duplicated without case. Objects with `id` / `contactId` count. */
function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    let id = ''
    if (typeof item === 'string') id = item.trim()
    else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      id = text(record.id) || text(record.contactId)
    }
    const key = normalizeDocumentId(id)
    if (!id || seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

function nameList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    let name = ''
    if (typeof item === 'string') name = item.trim()
    else if (item && typeof item === 'object') name = text((item as Record<string, unknown>).name)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

const WRITE_CREATE_ONLY = ['id', 'createdAt', 'organizationId'] as const

// MARK: - Jobs (projects and small works)

export type JobKind = 'project' | 'smallWork'
export const JOB_COLLECTIONS = { project: 'projects', smallWork: 'smallWorks' } as const

export type JobClientDocument = {
  /** Stored `client.id` (else top-level `clientId`), else `jobClientId` when the job names a client, else ''. */
  id: string
  /** False when the id was derived (1.8.0); the next job save may write it. */
  idStored: boolean
  name: string
  email: string | null
  phone: string | null
}

/**
 * The client id of a job stored with a client name but no client id (1.8.0): `derivedRowId(job doc id, 'client', 0,
 * [lower-case name])` — the same on every platform and read (iOS minted a random one, web read '').
 */
export function jobClientId(jobDocId: unknown, clientName: unknown): string {
  const name = text(clientName).toLowerCase()
  return name ? derivedRowId(jobDocId, 'client', 0, [name]) : ''
}

/**
 * The stored id of the job a key names (1.8.0): `key` compared without case against the job document ids. Deadline
 * assignment keys are the job id upper-cased (`deadlineProjectKey`), and caches or older rows may hold another case;
 * every lookup by job key maps back to the job's stored document id with this. Null when no job matches.
 */
export function storedJobIdForKey(key: unknown, jobIds: ReadonlyArray<string> | null | undefined): string | null {
  const wanted = normalizeDocumentId(key)
  if (!wanted) return null
  for (const id of jobIds || []) if (normalizeDocumentId(id) === wanted) return text(id)
  return null
}

export type JobDocument = {
  /** The document id, in stored case. */
  id: string
  kind: JobKind
  collection: 'projects' | 'smallWorks'
  jobNumber: string
  siteName: string
  addressLine1: string
  addressLine2: string | null
  townCity: string
  postcode: string
  /** Stored one-line address; built from the address lines when only they are stored. */
  siteAddress: string
  client: JobClientDocument
  startMs: number | null
  startDayKey: string | null
  endMs: number | null
  endDayKey: string | null
  jobType: string
  customJobType: string | null
  /** Legacy manager name (`manager`). */
  managerName: string | null
  managerId: string | null
  managerIds: string[]
  isLive: boolean
  description: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  usesMapPinForLocation: boolean
  hiddenManagerUserIds: string[]
  hiddenOperativeUserIds: string[]
  status: string | null
  organizationId: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
}

export type ParseJobDocumentOptions = {
  kind?: JobKind | 'projects' | 'smallWorks' | null
  timeZone?: string | null
}

function jobKind(raw: ParseJobDocumentOptions['kind']): JobKind {
  return raw === 'smallWork' || raw === 'smallWorks' ? 'smallWork' : 'project'
}

/**
 * Reads `projects/{id}` or `smallWorks/{id}`. Null for the legacy `INITIAL-PLACEHOLDER` document or a blank id.
 * Start day: `startDate`, else `createdAt`; end day: `endDate`, else the start. `isLive` is true unless stored
 * false. Manager ids: `managerIds`, else `[managerId]`; `managerId` falls back to the first of `managerIds`.
 * The client is the nested `client` map with its id in stored case (never a fresh id).
 */
export function parseJobDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: ParseJobDocumentOptions | null
): JobDocument | null {
  const id = text(docId)
  if (!id || isLegacyPlaceholderDocumentId(id)) return null
  const row = record(data)
  const zone = zoneOrLondon(options?.timeZone)
  const kind = jobKind(options?.kind)
  const clientRow = record(row.client)
  const managerIdsStored = idList(row.managerIds)
  const managerIdStored = text(row.managerId)
  const managerIds = managerIdsStored.length > 0 ? managerIdsStored : managerIdStored ? [managerIdStored] : []
  const startMs = documentInstantMs(row.startDate) ?? documentInstantMs(row.createdAt)
  const endMs = documentInstantMs(row.endDate) ?? startMs
  const addressLine1 = text(row.addressLine1)
  const addressLine2 = optionalText(row.addressLine2)
  const townCity = text(row.townCity)
  const postcode = text(row.postcode)
  const siteAddress =
    text(row.siteAddress) || [addressLine1, addressLine2, townCity, postcode].filter(Boolean).join(', ')
  const managerName = text(row.manager)
  return {
    id,
    kind,
    collection: JOB_COLLECTIONS[kind],
    jobNumber: text(row.jobNumber),
    siteName: text(row.siteName),
    addressLine1,
    addressLine2,
    townCity,
    postcode,
    siteAddress,
    client: {
      id: text(clientRow.id) || text(row.clientId) || jobClientId(id, clientRow.name),
      idStored: Boolean(text(clientRow.id) || text(row.clientId)),
      name: text(clientRow.name),
      email: optionalText(clientRow.email),
      phone: optionalText(clientRow.phone),
    },
    startMs,
    startDayKey: dayKeyOf(startMs, zone),
    endMs,
    endDayKey: dayKeyOf(endMs, zone),
    jobType: text(row.jobType),
    customJobType: optionalText(row.customJobType),
    managerName: managerName && managerName.toLowerCase() !== 'custom' ? managerName : null,
    managerId: managerIdStored || managerIds[0] || null,
    managerIds,
    isLive: documentBool(row.isLive) !== false,
    description: optionalText(row.description),
    notes: optionalText(row.notes),
    latitude: documentNumber(row.latitude),
    longitude: documentNumber(row.longitude),
    usesMapPinForLocation: documentBool(row.usesMapPinForLocation) === true,
    hiddenManagerUserIds: idList(row.hiddenManagerUserIds),
    hiddenOperativeUserIds: idList(row.hiddenOperativeUserIds),
    status: optionalText(row.status),
    organizationId: optionalText(row.organizationId),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

/** `parseJobDocument` for `projects/{id}`. */
export function parseProjectDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): JobDocument | null {
  return parseJobDocument(docId, data, { kind: 'project', timeZone: options?.timeZone })
}

/** `parseJobDocument` for `smallWorks/{id}`. */
export function parseSmallWorkDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): JobDocument | null {
  return parseJobDocument(docId, data, { kind: 'smallWork', timeZone: options?.timeZone })
}

/** The primary manager with the list; the address lines with the one-line address; the map pin with its flag. */
export const JOB_MANAGER_WRITE_GROUP = ['managerId', 'managerIds'] as const
export const JOB_ADDRESS_WRITE_GROUP = ['addressLine1', 'addressLine2', 'townCity', 'postcode', 'siteAddress'] as const
export const JOB_PIN_WRITE_GROUP = ['latitude', 'longitude', 'usesMapPinForLocation'] as const

/**
 * Partial update of `projects/{id}` / `smallWorks/{id}` (§1). `id`, `createdAt` and `organizationId` are never
 * rewritten; the manager ids, the address and the map pin are each written as a group. A new job (`before` null)
 * writes every non-null field.
 */
export function jobWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [JOB_MANAGER_WRITE_GROUP, JOB_ADDRESS_WRITE_GROUP, JOB_PIN_WRITE_GROUP],
    createOnly: WRITE_CREATE_ONLY,
  })
}

// MARK: - Bookings (partial update)

/** The slot and its clock times are one choice. */
export const BOOKING_SLOT_WRITE_GROUP = ['timeSlot', 'workStartTime', 'workEndTime', 'isBreakRemoved'] as const

/**
 * Partial update of an existing `bookings/{id}` (§1, §2): `next` is the `bookingWriteFields` shape (each app's
 * Timestamps in place of the millisecond numbers, null to remove an optional field). Only changed fields are
 * written; the slot and its clock times go together; `id`, `createdAt`, `organizationId` and `bookedBy` (who made
 * the booking) are never rewritten. An edit never creates the booking: when the stored document is gone it was
 * deleted elsewhere and the edit is refused (`bookingReplayRefusedIsFinal`, §2).
 */
export function bookingUpdateWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  if (!before) return { set: {}, remove: [] }
  return documentWriteFields(before, next, {
    together: [BOOKING_SLOT_WRITE_GROUP],
    createOnly: [...WRITE_CREATE_ONLY, 'bookedBy'],
  })
}

/** A manager site booking's place: the kind with its id or custom name, written together (1.9.0). */
export const MANAGER_SITE_BOOKING_LOCATION_WRITE_GROUP = ['locationType', 'locationId', 'customLocationName'] as const

/**
 * 1.9.0 (§1, §2): partial update of an existing `managerSiteBookings/{id}` — only changed fields; the slot with its
 * clock times and break, and the location kind with its id / custom name, each go together; `id`, `createdAt` and
 * `organizationId` are never rewritten. A missing stored document writes nothing (the edit is refused, never turned
 * into a create — `editOfMissingDocumentIsRefused`). Before 1.9.0 web saved an edit as a whole-document merge-set
 * that re-stamped `createdAt`.
 */
export function managerSiteBookingUpdateWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  if (!before) return { set: {}, remove: [] }
  return documentWriteFields(before, next, {
    together: [BOOKING_SLOT_WRITE_GROUP, MANAGER_SITE_BOOKING_LOCATION_WRITE_GROUP],
    createOnly: [...WRITE_CREATE_ONLY],
  })
}

// MARK: - Subcontractor bookings

export const SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS = {
  subcontractorId: ['subcontractorId', 'subContractorId', 'subcontractorID'],
  projectId: ['projectId', 'projectID'],
  bookedContactIds: ['bookedContactIds', 'contactIds', 'bookedContacts', 'operativeIds'],
  bookedOperativeNames: ['bookedOperativeNames', 'operativeNames', 'bookedNames', 'contactNames'],
} as const

export type SubcontractorBookingDocument = {
  /** The document id, in stored case (a stored `id` field never replaces it). */
  id: string
  subcontractorId: string
  projectId: string
  dateMs: number
  dayKey: string
  timeSlot: BookingTimeSlot
  workStartTime: string | null
  workEndTime: string | null
  isBreakRemoved: boolean
  bookedBy: string
  status: BookingStatus
  /** Firm contacts on site; empty means general attendance for the firm. */
  bookedContactIds: string[]
  bookedOperativeNames: string[]
  createdAtMs: number | null
  updatedAtMs: number | null
  /** False when an id is not a UUID (older iOS builds cannot hold it). */
  idsAreUuid: boolean
}

function firstPresent(row: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key]
  }
  return undefined
}

/**
 * Reads `subcontractorBookings/{id}` as either app writes it. Null for the placeholder, or when the firm, the job
 * or the date is missing, or a stored status or slot is unreadable. Missing status is Confirmed; missing slot is
 * FULL DAY; `bookedBy` may be blank. The date is an organisation-zone day key.
 */
export function parseSubcontractorBookingDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): SubcontractorBookingDocument | null {
  const id = text(docId)
  if (!id || isLegacyPlaceholderDocumentId(id)) return null
  const row = record(data)
  const zone = zoneOrLondon(options?.timeZone)
  const subcontractorId = firstText(row, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.subcontractorId)
  const projectId = firstText(row, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.projectId)
  const dateMs = documentInstantMs(row.date)
  if (!subcontractorId || !projectId || dateMs == null) return null
  const rawStatus = text(row.status)
  const status = rawStatus ? normalizeBookingStatus(rawStatus) : 'Confirmed'
  const rawSlot = text(row.timeSlot)
  const timeSlot = rawSlot ? normalizeBookingTimeSlot(rawSlot) : 'FULL DAY'
  if (!status || !timeSlot) return null
  const bookedContactIds = idList(firstPresent(row, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.bookedContactIds))
  return {
    id,
    subcontractorId,
    projectId,
    dateMs,
    dayKey: dayKeyInZone(new Date(dateMs), zone),
    timeSlot,
    workStartTime: bookingClock(row.workStartTime, zone) ?? null,
    workEndTime: bookingClock(row.workEndTime, zone) ?? null,
    isBreakRemoved: documentBool(row.isBreakRemoved) === true,
    bookedBy: text(row.bookedBy),
    status,
    bookedContactIds,
    bookedOperativeNames: nameList(firstPresent(row, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.bookedOperativeNames)),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedAtMs: documentInstantMs(row.updatedAt),
    idsAreUuid: [id, subcontractorId, projectId, ...bookedContactIds].every((value) => isBookingUuid(value)),
  }
}

export type SubcontractorBookingCreateInput = {
  id: string
  subcontractorId: string
  projectId: string
  dateMs: number
  timeSlot: string
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
  bookedBy: string
  status?: string | null
  bookedContactIds?: readonly string[] | null
  bookedOperativeNames?: readonly string[] | null
  createdAtMs: number
}

export type SubcontractorBookingCreateResult =
  | { ok: true; fields: Record<string, string | number | boolean | string[]> }
  | {
      ok: false
      errors: Array<'missing_id' | 'missing_subcontractor_id' | 'missing_project_id' | 'missing_date' | 'bad_time_slot' | 'bad_status'>
    }

/**
 * The stored shape of a new subcontractor booking, written at `subcontractorBookings/{id}` with the same `id` in
 * the document (both apps). Status defaults to Confirmed; `isBreakRemoved` is always written; `workStartTime` /
 * `workEndTime` are written whenever given as a readable clock, for any slot (as iOS writes them; the reader uses
 * them only for a custom slot); `bookedContactIds` and `bookedOperativeNames` are always written (empty = general
 * attendance). `date`, `createdAt` and `updatedAt` are milliseconds; each app writes its Timestamp type.
 */
export function subcontractorBookingCreateFields(input: SubcontractorBookingCreateInput): SubcontractorBookingCreateResult {
  const errors: Extract<SubcontractorBookingCreateResult, { ok: false }>['errors'] = []
  const id = text(input?.id)
  const subcontractorId = text(input?.subcontractorId)
  const projectId = text(input?.projectId)
  const dateMs = typeof input?.dateMs === 'number' && Number.isFinite(input.dateMs) ? input.dateMs : null
  const timeSlot = normalizeBookingTimeSlot(input?.timeSlot)
  const status = text(input?.status) ? normalizeBookingStatus(input?.status) : 'Confirmed'
  if (!id) errors.push('missing_id')
  if (!subcontractorId) errors.push('missing_subcontractor_id')
  if (!projectId) errors.push('missing_project_id')
  if (dateMs == null) errors.push('missing_date')
  if (!timeSlot) errors.push('bad_time_slot')
  if (!status) errors.push('bad_status')
  if (errors.length > 0 || dateMs == null || !timeSlot || !status) return { ok: false, errors }
  const createdAtMs = typeof input.createdAtMs === 'number' && Number.isFinite(input.createdAtMs) ? input.createdAtMs : dateMs
  const fields: Record<string, string | number | boolean | string[]> = {
    id,
    subcontractorId,
    projectId,
    date: dateMs,
    timeSlot,
    isBreakRemoved: input.isBreakRemoved === true,
    bookedBy: text(input.bookedBy),
    status,
    bookedContactIds: idList(input.bookedContactIds ?? []),
    bookedOperativeNames: nameList(input.bookedOperativeNames ?? []),
    createdAt: createdAtMs,
    updatedAt: createdAtMs,
  }
  const start = bookingClock(input.workStartTime)
  const end = bookingClock(input.workEndTime)
  if (start) fields.workStartTime = start
  if (end) fields.workEndTime = end
  return { ok: true, fields }
}

/** The firm's people on site: the contact ids with their names. */
export const SUBCONTRACTOR_BOOKING_PEOPLE_WRITE_GROUP = ['bookedContactIds', 'bookedOperativeNames'] as const

/**
 * Partial update of an existing `subcontractorBookings/{id}` (§1). The slot and its times, and the contact ids
 * with their names, are each written together. `id`, `createdAt`, `organizationId` and `bookedBy` are never
 * rewritten. With no stored document nothing is written (an edit never re-creates a deleted booking).
 */
export function subcontractorBookingWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  if (!before) return { set: {}, remove: [] }
  return documentWriteFields(before, next, {
    together: [BOOKING_SLOT_WRITE_GROUP, SUBCONTRACTOR_BOOKING_PEOPLE_WRITE_GROUP],
    createOnly: [...WRITE_CREATE_ONLY, 'bookedBy'],
  })
}

// MARK: - Timesheet price work and expense entries

export type TimesheetEntryKind = 'expense' | 'priceWork'

const ENTRY_ARRAY_FIELD: Record<TimesheetEntryKind, 'expenseEntries' | 'priceWorkEntries'> = {
  expense: 'expenseEntries',
  priceWork: 'priceWorkEntries',
}

/**
 * The id of an entry stored without one: a UUID-shaped, upper-case id derived from the sheet id, the array, the
 * entry's position and its content — the same on every platform and every read, never random. A stored id always
 * wins (kept in its stored case, UUID or not). Saving the sheet writes the derived id onto the entry.
 */
export function timesheetEntryId(
  sheetDocId: string,
  kind: TimesheetEntryKind,
  index: number,
  entry: Record<string, unknown> | null | undefined
): string {
  const row = record(entry)
  const stored = text(row.id)
  if (stored) return stored
  const when = documentInstantMs(kind === 'expense' ? row.date : row.startDate)
  const source = [
    text(sheetDocId),
    ENTRY_ARRAY_FIELD[kind],
    String(Math.max(0, Math.floor(Number(index) || 0))),
    rawText(row.title),
    String(documentNumber(row.amount) ?? 0),
    when == null ? '' : String(when),
  ].join('|')
  return derivedDocumentId(source)
}

type TimesheetEntryBase = {
  /** Stored id, or `timesheetEntryId` when the entry has none. */
  id: string
  /** False when the id was derived (not stored yet). */
  idStored: boolean
  title: string
  details: string
  jobNumber: string
  amount: number
  /** The decision in effect (`timesheetEntryDecision`, looked up by `id`). */
  managerDecision: TimesheetEntryDecision
  managerRevisedAmount: number | null
  decisionSource: TimesheetEntryDecisionSource
}

export type TimesheetExpenseEntryDocument = TimesheetEntryBase & {
  dateMs: number | null
  dayKey: string | null
  receiptName: string | null
}

export type TimesheetPriceWorkEntryDocument = TimesheetEntryBase & {
  agreedManagerName: string
  startMs: number | null
  startDayKey: string | null
  endMs: number | null
  endDayKey: string | null
}

export type TimesheetEntriesDocument = {
  expenseEntries: TimesheetExpenseEntryDocument[]
  priceWorkEntries: TimesheetPriceWorkEntryDocument[]
}

function entryBase(
  sheetDocId: string,
  sheet: Record<string, unknown>,
  kind: TimesheetEntryKind,
  index: number,
  row: Record<string, unknown>
): TimesheetEntryBase | null {
  const title = text(row.title)
  if (!title) return null
  const id = timesheetEntryId(sheetDocId, kind, index, row)
  const amount = documentNumber(row.amount) ?? 0
  const decision = timesheetEntryDecision(sheet, { ...row, id, amount })
  return {
    id,
    idStored: Boolean(text(row.id)),
    title,
    details: rawText(row.details),
    jobNumber: text(row.jobNumber),
    amount,
    managerDecision: decision.decision,
    managerRevisedAmount: decision.revisedAmount,
    decisionSource: decision.source,
  }
}

/**
 * Reads the price work and expense entries of a timesheet document (`settings/timesheet_*`). Every entry with a
 * title is kept, whatever its id: a stored id is kept in its stored case and an entry with no id gets
 * `timesheetEntryId`. The decision in effect is `timesheetEntryDecision` for that id, so a review stored in
 * `extraEntryReviews` under it (any letter case) is found. Dates come back as milliseconds and organisation-zone
 * day keys (null when missing).
 */
export function parseTimesheetEntries(
  sheetDocId: string,
  sheet: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): TimesheetEntriesDocument {
  const data = record(sheet)
  const zone = zoneOrLondon(options?.timeZone)
  const expenseEntries: TimesheetExpenseEntryDocument[] = []
  const priceWorkEntries: TimesheetPriceWorkEntryDocument[] = []
  const expenses = Array.isArray(data.expenseEntries) ? data.expenseEntries : []
  expenses.forEach((raw, index) => {
    const row = record(raw)
    const base = entryBase(sheetDocId, data, 'expense', index, row)
    if (!base) return
    const dateMs = documentInstantMs(row.date)
    expenseEntries.push({
      ...base,
      dateMs,
      dayKey: dayKeyOf(dateMs, zone),
      receiptName: optionalText(row.receiptName),
    })
  })
  const priceWork = Array.isArray(data.priceWorkEntries) ? data.priceWorkEntries : []
  priceWork.forEach((raw, index) => {
    const row = record(raw)
    const base = entryBase(sheetDocId, data, 'priceWork', index, row)
    if (!base) return
    const startMs = documentInstantMs(row.startDate) ?? documentInstantMs(row.date)
    const endMs = documentInstantMs(row.endDate)
    priceWorkEntries.push({
      ...base,
      agreedManagerName: text(row.agreedManagerName) || 'Manager',
      startMs,
      startDayKey: dayKeyOf(startMs, zone),
      endMs,
      endDayKey: dayKeyOf(endMs, zone),
    })
  })
  return { expenseEntries, priceWorkEntries }
}

// MARK: - Deadlines

export const DEADLINE_ASSIGNMENTS_DOCUMENT_ID = 'deadlineAssignments'
export const DEADLINE_STATUSES = ['notStarted', 'inProgress', 'blocked', 'complete'] as const
export type DeadlineStatusToken = (typeof DEADLINE_STATUSES)[number]

/**
 * The stored key for a job in deadline documents: the job id trimmed and upper-cased. This is the key both apps
 * have always written (`settings/deadlines_{projects|smallWorks}_{KEY}` and `deadlineAssignments.projects.{KEY}`),
 * so it is kept; lookups compare without case.
 */
export function deadlineProjectKey(projectId: unknown): string {
  return text(projectId).toUpperCase()
}

/** `deadlines_projects_{KEY}` or `deadlines_smallWorks_{KEY}`. */
export function deadlinesDocumentId(projectId: unknown, isSmallWorks: boolean): string {
  return `deadlines_${isSmallWorks ? 'smallWorks' : 'projects'}_${deadlineProjectKey(projectId)}`
}

export type DeadlineChangeDocument = {
  id: string
  atMs: number | null
  author: string
  /** `created`, `rescheduled`, `progress`, `status`, `note`, `completed`, `assigned`, `fileAttached`, `siteAuditAttached`. */
  type: string
  dueMs: number | null
  fromMs: number | null
  toMs: number | null
  reason: string | null
  progress: number | null
  status: DeadlineStatusToken | null
  note: string | null
  completedOnMs: number | null
  assignedTo: string | null
  name: string | null
}

export type DeadlineItemDocument = {
  /** Stored id, in stored case (UUID or not). */
  id: string
  title: string
  location: string | null
  trade: string | null
  detail: string | null
  startMs: number | null
  startDayKey: string | null
  dueMs: number | null
  dueDayKey: string | null
  completedAtMs: number | null
  assignees: string[]
  assigneeUserIds: string[]
  company: string | null
  status: DeadlineStatusToken
  progress: number
  isCritical: boolean
  dependsOn: string[]
  blockedReason: string | null
  reminderDaysBefore: number | null
  originalDueMs: number | null
  history: DeadlineChangeDocument[]
  contextKind: string
  projectId: string
  createdByUserId: string
  fileURL: string | null
  fileName: string | null
  siteAuditId: string | null
  siteAuditTitle: string | null
}

export type DeadlineDocument = {
  id: string
  collection: 'projects' | 'smallWorks' | null
  /** From the document, else the document id, in stored case. */
  projectId: string
  items: DeadlineItemDocument[]
  updatedAtMs: number | null
}

function deadlineStatus(raw: unknown): DeadlineStatusToken {
  const value = text(raw)
  return (DEADLINE_STATUSES as readonly string[]).includes(value) ? (value as DeadlineStatusToken) : 'notStarted'
}

const DEADLINE_CHANGE_TYPES = [
  'created',
  'rescheduled',
  'progress',
  'status',
  'note',
  'completed',
  'assigned',
  'fileAttached',
  'siteAuditAttached',
]

function parseDeadlineChange(raw: unknown): DeadlineChangeDocument | null {
  const row = record(raw)
  const id = text(row.id)
  if (!id) return null
  const storedType = text(row.type) || 'note'
  const known = DEADLINE_CHANGE_TYPES.includes(storedType)
  const type = known ? storedType : 'note'
  const progress = documentNumber(row.progress)
  return {
    id,
    atMs: documentInstantMs(row.at),
    author: text(row.author),
    type,
    dueMs: documentInstantMs(row.due),
    fromMs: documentInstantMs(row.from),
    toMs: documentInstantMs(row.to),
    reason: optionalText(row.reason),
    progress: progress == null ? null : Math.round(progress),
    status: text(row.status) ? deadlineStatus(row.status) : null,
    note: known ? optionalText(row.note) : storedType,
    completedOnMs: documentInstantMs(row.completedOn),
    assignedTo: optionalText(row.assignedTo),
    name: optionalText(row.name),
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()) : []
}

/** One item of a `settings/deadlines_*` document's `items` array. Null without an id. */
export function parseDeadlineItem(
  raw: unknown,
  options?: { projectId?: string | null; timeZone?: string | null } | null
): DeadlineItemDocument | null {
  const row = record(raw)
  const id = text(row.id)
  if (!id) return null
  const zone = zoneOrLondon(options?.timeZone)
  const startMs = documentInstantMs(row.start)
  const dueMs = documentInstantMs(row.due)
  const reminder = documentNumber(row.reminderDaysBefore)
  const history = Array.isArray(row.history)
    ? row.history.map(parseDeadlineChange).filter((change): change is DeadlineChangeDocument => change !== null)
    : []
  return {
    id,
    title: text(row.title) || 'Untitled deadline',
    location: optionalText(row.location),
    trade: optionalText(row.trade),
    detail: optionalText(row.detail),
    startMs,
    startDayKey: dayKeyOf(startMs, zone),
    dueMs,
    dueDayKey: dayKeyOf(dueMs, zone),
    completedAtMs: documentInstantMs(row.completedAt),
    assignees: stringList(row.assignees),
    assigneeUserIds: idList(row.assigneeUserIds),
    company: optionalText(row.company),
    status: deadlineStatus(row.status),
    progress: documentNumber(row.progress) ?? 0,
    isCritical: documentBool(row.isCritical) === true,
    dependsOn: idList(row.dependsOn),
    blockedReason: optionalText(row.blockedReason),
    reminderDaysBefore: reminder == null ? null : Math.round(reminder),
    originalDueMs: documentInstantMs(row.originalDue),
    history,
    contextKind: text(row.contextKind) || 'Project',
    projectId: text(row.projectId) || text(options?.projectId),
    createdByUserId: text(row.createdByUserId),
    fileURL: optionalText(row.fileURL),
    fileName: optionalText(row.fileName),
    siteAuditId: optionalText(row.siteAuditId),
    siteAuditTitle: optionalText(row.siteAuditTitle),
  }
}

/**
 * Reads `settings/deadlines_{projects|smallWorks}_{KEY}`. Items keep their stored ids (UUID or not); an item with
 * no id is skipped. Items are ordered by due day (missing last), then id.
 */
export function parseDeadlineDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { projectId?: string | null; timeZone?: string | null } | null
): DeadlineDocument {
  const id = text(docId)
  const row = record(data)
  const match = /^deadlines_(projects|smallWorks)_(.+)$/.exec(id)
  const projectId = text(row.projectId) || text(options?.projectId) || (match ? match[2] : '')
  const items = (Array.isArray(row.items) ? row.items : [])
    .map((item) => parseDeadlineItem(item, { projectId, timeZone: options?.timeZone }))
    .filter((item): item is DeadlineItemDocument => item !== null)
    .sort((a, b) => {
      const left = a.dueMs ?? Number.MAX_SAFE_INTEGER
      const right = b.dueMs ?? Number.MAX_SAFE_INTEGER
      return left - right || a.id.localeCompare(b.id)
    })
  return {
    id,
    collection: match ? (match[1] as 'projects' | 'smallWorks') : null,
    projectId,
    items,
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

/**
 * Reads `settings/deadlineAssignments`: job key → assignee ids. A field stored literally as `projects.{KEY}`
 * (older iOS merge-set) is read too; the nested `projects` map wins for the same key.
 */
export function parseDeadlineAssignments(data: Record<string, unknown> | null | undefined): Record<string, string[]> {
  const row = record(data)
  const out: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('projects.')) continue
    const projectKey = key.slice('projects.'.length).trim()
    if (projectKey && Array.isArray(value)) out[projectKey] = idList(value)
  }
  for (const [key, value] of Object.entries(record(row.projects))) {
    if (key.trim() && Array.isArray(value)) out[key.trim()] = idList(value)
  }
  return out
}

/**
 * Job keys (as stored) whose assignees include any of the person's ids, compared without case. With `jobIds` (the job
 * list's document ids) each key is mapped back to the job's stored id (`storedJobIdForKey`) and keys naming no job
 * are left out (1.8.0).
 */
export function deadlineAssignedProjectIds(
  data: Record<string, unknown> | null | undefined,
  personIds: readonly string[] | string,
  jobIds?: ReadonlyArray<string> | null
): string[] {
  const ids = new Set((Array.isArray(personIds) ? personIds : [personIds]).map(normalizeDocumentId).filter(Boolean))
  if (ids.size === 0) return []
  return Object.entries(parseDeadlineAssignments(data))
    .filter(([, assignees]) => assignees.some((id) => ids.has(normalizeDocumentId(id))))
    .map(([key]) => (jobIds ? storedJobIdForKey(key, jobIds) : key))
    .filter((key): key is string => Boolean(key))
    .filter((key, index, all) => all.indexOf(key) === index)
    .sort()
}

export type DeadlineAssignmentWriteFields = {
  /** Field path segments for a partial update (`update` / `updateData` with a FieldPath), never a merge-set. */
  fieldPath: [string, string]
  /** The assignee ids: de-duplicated without case, stored case, sorted. */
  value: string[]
  /** The whole document when it does not exist yet (create only). */
  createFields: { projects: Record<string, string[]> }
}

/**
 * The write for one job's assignees in `settings/deadlineAssignments` (§1 "Partial writes only"). The job key is
 * `deadlineProjectKey`. Apps update the one map entry with a field path (`['projects', KEY]`) as a partial update,
 * and create the document with `createFields` only when it is missing. A merge-set with a dotted key is never
 * used — it stores a literal field named `projects.{KEY}`. Null without a job id.
 */
export function deadlineAssignmentWriteFields(input: {
  projectId: string
  assigneeUserIds: readonly string[] | null | undefined
}): DeadlineAssignmentWriteFields | null {
  const key = deadlineProjectKey(input?.projectId)
  if (!key) return null
  const value = idList(input.assigneeUserIds ?? []).sort((a, b) => a.localeCompare(b))
  return { fieldPath: ['projects', key], value, createFields: { projects: { [key]: value } } }
}

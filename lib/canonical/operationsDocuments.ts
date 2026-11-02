/**
 * Reading and writing the operations collections (rulebook §1 "Document readers" / "Partial writes only", 1.8.0).
 *
 * Covers job material lines (`materials`), the material catalogue (`materialCatalogue`), quote / order send records
 * (`materialSendRecords`), `wholesalers`, `siteAudits`, project tasks (`tasks`), `settings/jobTypes`,
 * `settings/tradeTypeInventory` and the `operativeProfiles` pay mirror. Before 1.8.0 each app parsed them its own way:
 *   - `materials`: iOS dropped a line whose id, project id or unit was not what Swift expected (non-UUID ids, a
 *     numeric-string quantity, a lower-case unit) and stored `date` as device midnight; web defaulted a missing date
 *     to "now". iOS saved a line with a full `setData`, so a field web wrote (and iOS does not know) was deleted.
 *   - `materialCatalogue`: web "replace all" deleted every item and rewrote the list; iOS read ids through `UUID`.
 *   - `materialSendRecords`: iOS dropped a record (or a line in it) whose ids were not UUIDs or whose unit was unknown.
 *   - `wholesalers`: iOS dropped a firm with no `updatedAt` and a contact with a non-UUID id.
 *   - `siteAudits`: iOS dropped audits with a non-UUID id / project id or an unknown type; web re-stamped
 *     `createdAt` on every save and dropped `imageCapturedAt` from items.
 *   - `tasks`: both apps saved a whole task with `setData` (no merge); iOS dropped a task with a non-UUID project id
 *     or an unknown status and minted a random id for an item stored without one; web did the same for items.
 *
 * Readers are pure, JSON in / JSON out, `(docId, data, options?)`, and never throw. Instants come back as epoch
 * milliseconds (`…Ms`, `documentInstantMs`) and organisation-zone day keys (`…DayKey`). The record id is the
 * document id in stored case; a row in an array stored without an id gets a `derivedRowId` (the same on every
 * platform and read; the next save writes it). Writes return `{ set, remove }` (`documentWriteFields`): a field the
 * stored copy lacks is never deleted, and `create-only` fields are never rewritten.
 */

import { dayKeyInZone, dateFromDayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { derivedRowId } from './derivedIds'
import { materialOrderIncludesDeliveryRequired } from './materialDelivery'
import {
  documentBool,
  documentInstantMs,
  documentNumber,
  documentOrganizationId,
  documentWriteFields,
  PAY_WRITE_GROUP,
  type DocumentWriteFields,
} from './peopleDocuments'
import { readStoredRates, type PayBasis } from './payRate'
import { normalizeDocumentId } from './scheduleSources'

// MARK: - Value readers

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown): string | null {
  return text(value) || null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
}

/** Non-empty trimmed strings in stored case, de-duplicated without case. */
function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    const id = typeof item === 'string' ? item.trim() : typeof item === 'number' ? String(item) : ''
    const key = normalizeDocumentId(id)
    if (!id || seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

function dayKeyOf(ms: number | null, zone: string): string | null {
  return ms == null ? null : dayKeyInZone(new Date(ms), zone)
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** A stored day: a `YYYY-MM-DD` string is that day; an instant is its organisation-zone day. */
function storedDayKey(raw: unknown, zone: string): string | null {
  const value = text(raw)
  if (DAY_KEY.test(value)) return value
  return dayKeyOf(documentInstantMs(raw), zone)
}

/** Blank text → null (so a save removes the stored field), otherwise trimmed text. `undefined` stays undefined. */
function blankToNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  return text(value) || null
}

const CREATE_ONLY = ['id', 'createdAt', 'organizationId'] as const

/** Epoch ms of midnight of `dayKey` in the organisation zone (what a day-only field stores). Null for a bad key. */
export function organizationDayStartMs(dayKey: unknown, timeZone?: string | null): number | null {
  const key = text(dayKey)
  if (!DAY_KEY.test(key)) return null
  const ms = dateFromDayKeyInZone(key, zoneOrLondon(timeZone)).getTime()
  return Number.isFinite(ms) ? ms : null
}

// MARK: - Materials (job material lines)

export const MATERIAL_WORKFLOW_STATUSES = ['draft', 'sentForQuote', 'ordered'] as const
export type MaterialWorkflowStatus = (typeof MATERIAL_WORKFLOW_STATUSES)[number]

export const MATERIAL_UNITS = ['Number', 'Box', 'Length', 'Drum', 'Pallet'] as const
export type MaterialUnitToken = (typeof MATERIAL_UNITS)[number]

export const MATERIAL_LENGTH_UNITS = ['M', 'MM'] as const
export type MaterialLengthUnitToken = (typeof MATERIAL_LENGTH_UNITS)[number]

/** Status words either app wrote, read as one of `MATERIAL_WORKFLOW_STATUSES`. Unknown or missing → draft. */
export const MATERIAL_STATUS_SYNONYMS: Readonly<Record<string, MaterialWorkflowStatus>> = {
  draft: 'draft',
  new: 'draft',
  pending: 'draft',
  sentforquote: 'sentForQuote',
  quote: 'sentForQuote',
  quoted: 'sentForQuote',
  quoterequested: 'sentForQuote',
  sent: 'sentForQuote',
  ordered: 'ordered',
  order: 'ordered',
  orderplaced: 'ordered',
}

export function normalizeMaterialWorkflowStatus(raw: unknown): MaterialWorkflowStatus {
  const compact = text(raw).replace(/[\s_\-]+/g, '').toLowerCase()
  return MATERIAL_STATUS_SYNONYMS[compact] ?? 'draft'
}

/** A unit as one of `MATERIAL_UNITS`, ignoring case (iOS dropped "number"). Unknown or missing → Number. */
export function normalizeMaterialUnit(raw: unknown): MaterialUnitToken {
  const token = text(raw).toLowerCase()
  return MATERIAL_UNITS.find((unit) => unit.toLowerCase() === token) ?? 'Number'
}

/** `M` / `MM` ignoring case, else null. */
export function normalizeMaterialLengthUnit(raw: unknown): MaterialLengthUnitToken | null {
  const token = text(raw).toUpperCase()
  return token === 'M' || token === 'MM' ? token : null
}

/** `Quote` / `Order` (the stored words), from either app's spelling. Null when neither. */
export function normalizeMaterialRequestType(raw: unknown): 'Quote' | 'Order' | null {
  const token = text(raw).toLowerCase()
  if (token === 'order' || token === 'ordered') return 'Order'
  if (token === 'quote' || token === 'sentforquote') return 'Quote'
  return null
}

function materialLength(row: Record<string, unknown>): string | null {
  const length = text(row.length) || text(row.sizeOrLength)
  if (length) return length
  const pack = documentNumber(row.packSize)
  return pack == null ? null : String(pack)
}

function materialQuantity(raw: unknown): number {
  const n = documentNumber(raw)
  return n != null && n >= 0 ? n : 1
}

export type MaterialLineDocument = {
  /** Document id, stored case (a non-UUID id is kept). */
  id: string
  projectId: string
  quantity: number
  unit: MaterialUnitToken
  /** `material`, else `name`. */
  material: string
  addedBy: string
  addedByUserId: string | null
  addedAtMs: number | null
  editedBy: string | null
  editedByUserId: string | null
  editedAtMs: number | null
  /** The materials day: stored `dayKey`, else the organisation-zone day of `date`. Null when neither is readable. */
  dayKey: string | null
  dateMs: number | null
  status: MaterialWorkflowStatus
  catalogueItemId: string | null
  brand: string | null
  productCode: string | null
  category: string | null
  size: string | null
  /** `length`, else `sizeOrLength`, else `packSize`. */
  length: string | null
  lengthUnit: MaterialLengthUnitToken | null
  websiteURL: string | null
  notes: string | null
  lastSentAtMs: number | null
  lastSentRequestType: 'Quote' | 'Order' | null
  createdAtMs: number | null
  updatedAtMs: number | null
}

/**
 * Read one `organizations/{orgId}/materials/{id}` line. Null without a document id, a project id or a material name.
 * A line with an odd quantity, unit or status is kept (quantity 1, Number, draft), never dropped.
 */
export function parseMaterialLineDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): MaterialLineDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const projectId = text(row.projectId)
  const material = text(row.material) || text(row.name)
  if (!projectId || !material) return null
  const zone = zoneOrLondon(options?.timeZone)
  const dateMs = documentInstantMs(row.date)
  const lengthValue = materialLength(row)
  return {
    id,
    projectId,
    quantity: materialQuantity(row.quantity),
    unit: normalizeMaterialUnit(row.unit),
    material,
    addedBy: text(row.addedBy),
    addedByUserId: optionalText(row.addedByUserId),
    addedAtMs: documentInstantMs(row.addedAt) ?? documentInstantMs(row.createdAt),
    editedBy: optionalText(row.editedBy),
    editedByUserId: optionalText(row.editedByUserId),
    editedAtMs: documentInstantMs(row.editedAt),
    dayKey: DAY_KEY.test(text(row.dayKey)) ? text(row.dayKey) : storedDayKey(row.date, zone),
    dateMs,
    status: normalizeMaterialWorkflowStatus(row.status),
    catalogueItemId: optionalText(row.catalogueItemId),
    brand: optionalText(row.brand),
    productCode: optionalText(row.productCode),
    category: optionalText(row.category),
    size: optionalText(row.size),
    length: lengthValue,
    lengthUnit: lengthValue ? normalizeMaterialLengthUnit(row.lengthUnit) : null,
    websiteURL: optionalText(row.websiteURL),
    notes: optionalText(row.notes),
    lastSentAtMs: documentInstantMs(row.lastSentAt),
    lastSentRequestType: normalizeMaterialRequestType(row.lastSentRequestType),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

/** `parseMaterialLineDocument` over `{ id, data }` rows (unreadable rows dropped), sorted by day then name. */
export function parseMaterialListDocuments(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>,
  options?: { timeZone?: string | null } | null
): MaterialLineDocument[] {
  const out: MaterialLineDocument[] = []
  for (const entry of docs || []) {
    const parsed = parseMaterialLineDocument(entry?.id, entry?.data, options)
    if (parsed) out.push(parsed)
  }
  return out.sort(
    (a, b) => (a.dayKey ?? '').localeCompare(b.dayKey ?? '') || a.material.localeCompare(b.material) || a.id.localeCompare(b.id)
  )
}

export type MaterialLineFieldsInput = {
  id: string
  projectId: string
  quantity: number
  unit: unknown
  material: string
  /** The materials day, `YYYY-MM-DD` in the organisation zone. */
  dayKey: string
  status?: unknown
  addedBy?: string | null
  addedByUserId?: string | null
  /** Instants are passed through as given (an app passes its SDK Timestamp). */
  addedAt?: unknown
  editedBy?: string | null
  editedByUserId?: string | null
  editedAt?: unknown
  catalogueItemId?: string | null
  brand?: string | null
  productCode?: string | null
  category?: string | null
  size?: string | null
  length?: string | null
  lengthUnit?: unknown
  websiteURL?: string | null
  notes?: string | null
}

/**
 * The stored shape of a material line, the same on every platform. `date` is the epoch ms of organisation-zone
 * midnight of `dayKey` (the app turns it into a Timestamp) and `dayKey` is stored too, so no device midnight is ever
 * read back as a day. `material` and `name` carry the same text; `length` and `sizeOrLength` the same length (older
 * builds read `sizeOrLength`). Blank optional fields are null (a partial save removes them).
 */
export function materialLineFields(input: MaterialLineFieldsInput, timeZone?: string | null): Record<string, unknown> {
  const material = text(input?.material)
  const length = text(input?.length)
  const out: Record<string, unknown> = {
    id: text(input?.id),
    projectId: text(input?.projectId),
    quantity: materialQuantity(input?.quantity),
    unit: normalizeMaterialUnit(input?.unit),
    material,
    name: material,
    dayKey: text(input?.dayKey),
    date: organizationDayStartMs(input?.dayKey, timeZone),
    status: normalizeMaterialWorkflowStatus(input?.status),
    catalogueItemId: blankToNull(input?.catalogueItemId),
    brand: blankToNull(input?.brand),
    productCode: blankToNull(input?.productCode),
    category: blankToNull(input?.category),
    size: blankToNull(input?.size),
    length: length || null,
    sizeOrLength: length || null,
    lengthUnit: length ? normalizeMaterialLengthUnit(input?.lengthUnit) : null,
    websiteURL: blankToNull(input?.websiteURL),
    notes: blankToNull(input?.notes),
  }
  if (input?.addedBy !== undefined) out.addedBy = text(input.addedBy)
  if (input?.addedByUserId !== undefined) out.addedByUserId = blankToNull(input.addedByUserId)
  if (input?.addedAt !== undefined) out.addedAt = input.addedAt
  if (input?.editedBy !== undefined) out.editedBy = blankToNull(input.editedBy)
  if (input?.editedByUserId !== undefined) out.editedByUserId = blankToNull(input.editedByUserId)
  if (input?.editedAt !== undefined) out.editedAt = input.editedAt
  return out
}

export const MATERIAL_LENGTH_WRITE_GROUP = ['length', 'sizeOrLength', 'lengthUnit'] as const
export const MATERIAL_NAME_WRITE_GROUP = ['material', 'name'] as const
export const MATERIAL_DAY_WRITE_GROUP = ['dayKey', 'date'] as const

/**
 * Partial update of `materials/{id}` (§1): only changed fields; the name pair, the length trio and the day pair are
 * each written together. `id`, `createdAt`, `organizationId`, `addedAt`, `addedBy` and `addedByUserId` are never
 * rewritten (claiming a legacy line's owner is its own one-field write). With `before` null the line is created.
 */
export function materialLineWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [MATERIAL_LENGTH_WRITE_GROUP, MATERIAL_NAME_WRITE_GROUP, MATERIAL_DAY_WRITE_GROUP],
    createOnly: [...CREATE_ONLY, 'addedAt', 'addedBy', 'addedByUserId'],
  })
}

/**
 * The status a line takes when it is sent: `Order` → ordered; `Quote` → sentForQuote, except a line already ordered
 * stays ordered (never downgraded). Both apps write `{ status, lastSentRequestType }` with this plus the app's
 * `lastSentAt` as one partial update.
 */
export function materialSendStatusWriteFields(
  currentStatus: unknown,
  requestType: unknown
): { status: MaterialWorkflowStatus; lastSentRequestType: 'Quote' | 'Order' } {
  const type = normalizeMaterialRequestType(requestType) ?? 'Quote'
  const current = normalizeMaterialWorkflowStatus(currentStatus)
  if (type === 'Order') return { status: 'ordered', lastSentRequestType: 'Order' }
  return { status: current === 'ordered' ? 'ordered' : 'sentForQuote', lastSentRequestType: 'Quote' }
}

// MARK: - Material catalogue

export type MaterialCatalogueDocument = {
  /** Document id, stored case. */
  id: string
  name: string
  /** Missing → "Custom" (web; iOS showed blank). */
  brand: string
  productCode: string | null
  defaultUnit: MaterialUnitToken
  size: string | null
  length: string | null
  lengthUnit: MaterialLengthUnitToken | null
  /** Missing → "Other". */
  category: string
  createdAtMs: number | null
  createdByUserId: string
  createdByName: string
  updatedAtMs: number | null
}

/** Read one `organizations/{orgId}/materialCatalogue/{id}`. Null without a document id or a name. */
export function parseMaterialCatalogueDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): MaterialCatalogueDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const name = text(row.name)
  if (!name) return null
  const length = materialLength(row)
  return {
    id,
    name,
    brand: text(row.brand) || 'Custom',
    productCode: optionalText(row.productCode),
    defaultUnit: normalizeMaterialUnit(row.defaultUnit),
    size: optionalText(row.size),
    length,
    lengthUnit: length ? normalizeMaterialLengthUnit(row.lengthUnit) : null,
    category: text(row.category) || 'Other',
    createdAtMs: documentInstantMs(row.createdAt),
    createdByUserId: text(row.createdByUserId),
    createdByName: text(row.createdByName),
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

export type MaterialCatalogueItemInput = {
  id: string
  name: string
  brand?: string | null
  productCode?: string | null
  defaultUnit?: unknown
  size?: string | null
  length?: string | null
  lengthUnit?: unknown
  category?: string | null
  createdAt?: unknown
  createdByUserId?: string | null
  createdByName?: string | null
}

/** The stored shape of a catalogue item on every platform (blank optionals null; `length` mirrored to `sizeOrLength`). */
export function materialCatalogueItemFields(item: MaterialCatalogueItemInput): Record<string, unknown> {
  const length = text(item?.length)
  const out: Record<string, unknown> = {
    id: text(item?.id),
    name: text(item?.name),
    brand: text(item?.brand) || 'Custom',
    defaultUnit: normalizeMaterialUnit(item?.defaultUnit),
    category: text(item?.category) || 'Other',
    productCode: blankToNull(item?.productCode) ?? null,
    size: blankToNull(item?.size) ?? null,
    length: length || null,
    sizeOrLength: length || null,
    lengthUnit: length ? normalizeMaterialLengthUnit(item?.lengthUnit) : null,
  }
  if (item?.createdAt !== undefined) out.createdAt = item.createdAt
  if (item?.createdByUserId !== undefined) out.createdByUserId = text(item.createdByUserId)
  if (item?.createdByName !== undefined) out.createdByName = text(item.createdByName)
  return out
}

/** Partial update of one `materialCatalogue/{id}`; creator fields and `createdAt` are never rewritten. */
export function materialCatalogueItemWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [MATERIAL_LENGTH_WRITE_GROUP],
    createOnly: [...CREATE_ONLY, 'createdByUserId', 'createdByName'],
  })
}

export type CatalogueItemWrite = { id: string; create: boolean; set: Record<string, unknown>; remove: string[] }

/**
 * Saving the material catalogue as a list (import, "replace all"): which items to write and which to delete. Never
 * delete-all and rewrite. Each item is a partial write of what changed (`materialCatalogueItemWriteFields`); an
 * unchanged item is not written. A stored item missing from `next` is deleted only when `stored` came from a
 * successful load (`loaded: true`) and `next` is not empty — an empty or failed load never deletes the catalogue.
 * Ids match without case.
 */
export function materialCatalogueWrites(input: {
  stored: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>
  next: ReadonlyArray<MaterialCatalogueItemInput>
  loaded: boolean
}): { write: CatalogueItemWrite[]; remove: string[] } {
  const storedByKey = new Map<string, { id: string; data: Record<string, unknown> }>()
  for (const entry of input?.stored || []) {
    const id = text(entry?.id)
    if (id) storedByKey.set(normalizeDocumentId(id), { id, data: record(entry?.data) })
  }
  const nextKeys = new Set<string>()
  const write: CatalogueItemWrite[] = []
  for (const item of input?.next || []) {
    const id = text(item?.id)
    if (!id || !text(item?.name)) continue
    const key = normalizeDocumentId(id)
    if (nextKeys.has(key)) continue
    nextKeys.add(key)
    const stored = storedByKey.get(key)
    const fields = materialCatalogueItemFields({ ...item, id: stored?.id ?? id })
    const result = materialCatalogueItemWriteFields(stored ? stored.data : null, fields)
    if (Object.keys(result.set).length > 0 || result.remove.length > 0) {
      write.push({ id: stored?.id ?? id, create: !stored, ...result })
    }
  }
  const remove =
    input?.loaded === true && nextKeys.size > 0
      ? [...storedByKey.entries()].filter(([key]) => !nextKeys.has(key)).map(([, entry]) => entry.id)
      : []
  return { write, remove }
}

// MARK: - Material send records

export type MaterialSendRecipientDocument = { name: string; email: string; wholesalerName: string | null }
export type MaterialSendLineDocument = {
  /** Stored case (a non-UUID id is kept). */
  materialId: string
  name: string
  quantity: number
  unit: MaterialUnitToken
  brand: string | null
  productCode: string | null
  lengthDisplay: string | null
}

export type MaterialSendRecordDocument = {
  id: string
  projectId: string
  requestType: 'quote' | 'order'
  sentAtMs: number
  materialsDayKey: string | null
  materialsDateMs: number | null
  /** Only on an order (`materialOrderIncludesDeliveryRequired`); a quote never carries one. */
  deliveryRequiredAtMs: number | null
  sentBy: string
  recipients: MaterialSendRecipientDocument[]
  lines: MaterialSendLineDocument[]
}

/**
 * Read one `organizations/{orgId}/materialSendRecords/{id}`. Null without a document id, a project id or a readable
 * `sentAt`. A line without a material id or name is dropped; a recipient without an email is dropped.
 */
export function parseMaterialSendRecordDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): MaterialSendRecordDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const projectId = text(row.projectId)
  const sentAtMs = documentInstantMs(row.sentAt)
  if (!projectId || sentAtMs == null) return null
  const zone = zoneOrLondon(options?.timeZone)
  const requestType = normalizeMaterialRequestType(row.requestType) === 'Order' ? 'order' : 'quote'
  const materialsDateMs = documentInstantMs(row.materialsDate)
  const recipients: MaterialSendRecipientDocument[] = []
  for (const entry of rows(row.recipients)) {
    const email = text(entry.email)
    if (!email) continue
    recipients.push({ name: text(entry.name), email, wholesalerName: optionalText(entry.wholesalerName) })
  }
  const lines: MaterialSendLineDocument[] = []
  for (const entry of rows(row.lines)) {
    const materialId = text(entry.materialId)
    const name = text(entry.name)
    if (!materialId || !name) continue
    lines.push({
      materialId,
      name,
      quantity: materialQuantity(entry.quantity),
      unit: normalizeMaterialUnit(entry.unit),
      brand: optionalText(entry.brand),
      productCode: optionalText(entry.productCode),
      lengthDisplay: optionalText(entry.lengthDisplay),
    })
  }
  return {
    id,
    projectId,
    requestType,
    sentAtMs,
    materialsDayKey: storedDayKey(row.materialsDate, zone),
    materialsDateMs,
    deliveryRequiredAtMs: materialOrderIncludesDeliveryRequired(requestType)
      ? documentInstantMs(row.deliveryRequiredAt)
      : null,
    sentBy: text(row.sentBy),
    recipients,
    lines,
  }
}

/**
 * The stored shape of a new send record (records are written once; only admins update or delete them). `requestType`
 * is stored `Quote` / `Order`; `deliveryRequiredAt` only on an order; line optionals are left out when blank.
 * Instants (`sentAt`, `materialsDate`, `deliveryRequiredAt`) pass through as given.
 */
export function materialSendRecordCreateFields(input: {
  id: string
  projectId: string
  requestType: unknown
  sentAt: unknown
  sentBy: string
  materialsDate?: unknown
  deliveryRequiredAt?: unknown
  recipients: ReadonlyArray<{ name?: string | null; email?: string | null; wholesalerName?: string | null }>
  lines: ReadonlyArray<{
    materialId: string
    name: string
    quantity: unknown
    unit: unknown
    brand?: string | null
    productCode?: string | null
    lengthDisplay?: string | null
  }>
}): Record<string, unknown> {
  const requestType = normalizeMaterialRequestType(input?.requestType) ?? 'Quote'
  const out: Record<string, unknown> = {
    id: text(input?.id),
    projectId: text(input?.projectId),
    requestType,
    sentAt: input?.sentAt,
    sentBy: text(input?.sentBy),
    recipients: (input?.recipients || [])
      .filter((entry) => text(entry?.email))
      .map((entry) => {
        const recipient: Record<string, unknown> = { name: text(entry.name), email: text(entry.email) }
        if (text(entry.wholesalerName)) recipient.wholesalerName = text(entry.wholesalerName)
        return recipient
      }),
    lines: (input?.lines || [])
      .filter((line) => text(line?.materialId) && text(line?.name))
      .map((line) => {
        const out: Record<string, unknown> = {
          materialId: text(line.materialId),
          name: text(line.name),
          quantity: materialQuantity(line.quantity),
          unit: normalizeMaterialUnit(line.unit),
        }
        if (text(line.brand)) out.brand = text(line.brand)
        if (text(line.productCode)) out.productCode = text(line.productCode)
        if (text(line.lengthDisplay)) out.lengthDisplay = text(line.lengthDisplay)
        return out
      }),
  }
  if (input?.materialsDate != null) out.materialsDate = input.materialsDate
  if (requestType === 'Order' && input?.deliveryRequiredAt != null) out.deliveryRequiredAt = input.deliveryRequiredAt
  return out
}

// MARK: - Wholesalers

export type WholesalerContactDocument = {
  /** Stored id (stored case), else `wholesalerContactId`. */
  id: string
  idStored: boolean
  name: string
  email: string
  phone: string | null
  isPrimary: boolean
  createdAtMs: number | null
}

export type WholesalerDocument = {
  id: string
  name: string
  address: string | null
  trade: string | null
  accountNumber: string | null
  /** The stored primary contact when it is one of the contacts, else the first contact flagged, else the first. */
  primaryContactId: string | null
  contacts: WholesalerContactDocument[]
  createdAtMs: number | null
  /** `updatedAt`, else `createdAt`. */
  updatedAtMs: number | null
}

/** The id of a wholesaler contact stored without one: `derivedRowId(firm id, 'contacts', index, [name, email])`. */
export function wholesalerContactId(firmDocId: unknown, index: number, contact: Record<string, unknown> | null | undefined): string {
  const row = record(contact)
  return derivedRowId(firmDocId, 'contacts', index, [text(row.name), text(row.email).toLowerCase()])
}

/**
 * Read one `organizations/{orgId}/wholesalers/{id}`. Null without a document id or a name. A contact needs a name
 * or an email; exactly one contact is primary when there are any (`primaryContactId` wins, then the stored flag,
 * then the first).
 */
export function parseWholesalerDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): WholesalerDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const name = text(row.name)
  if (!name) return null
  const contacts: WholesalerContactDocument[] = []
  for (const [index, entry] of (Array.isArray(row.contacts) ? row.contacts : []).entries()) {
    const contact = record(entry)
    const contactName = text(contact.name)
    const email = text(contact.email)
    if (!contactName && !email) continue
    const storedId = text(contact.id)
    contacts.push({
      id: storedId || wholesalerContactId(id, index, contact),
      idStored: Boolean(storedId),
      name: contactName,
      email,
      phone: optionalText(contact.phone),
      isPrimary: documentBool(contact.isPrimary) === true,
      createdAtMs: documentInstantMs(contact.createdAt),
    })
  }
  const storedPrimary = text(row.primaryContactId)
  const primary =
    contacts.find((contact) => storedPrimary && normalizeDocumentId(contact.id) === normalizeDocumentId(storedPrimary)) ??
    contacts.find((contact) => contact.isPrimary) ??
    contacts[0]
  for (const contact of contacts) contact.isPrimary = contact === primary
  const createdAtMs = documentInstantMs(row.createdAt)
  return {
    id,
    name,
    address: optionalText(row.address),
    trade: optionalText(row.trade),
    accountNumber: optionalText(row.accountNumber),
    primaryContactId: primary ? primary.id : null,
    contacts,
    createdAtMs,
    updatedAtMs: documentInstantMs(row.updatedAt) ?? createdAtMs,
  }
}

export const WHOLESALER_CONTACTS_WRITE_GROUP = ['contacts', 'primaryContactId'] as const

/** Partial update of `wholesalers/{id}` (§1): the contacts list and the primary contact are written together. */
export function wholesalerWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, { together: [WHOLESALER_CONTACTS_WRITE_GROUP], createOnly: CREATE_ONLY })
}

// MARK: - Site audits

export type SiteAuditItemDocument = {
  /** Stored id, else `derivedRowId(audit id, 'items', index, [title, location])`. */
  id: string
  idStored: boolean
  title: string
  location: string
  assignee: string
  comments: string
  annotations: string
  imageURL: string | null
  imageCapturedAtMs: number | null
  createdAtMs: number | null
}

export type SiteAuditDocument = {
  id: string
  projectId: string
  projectJobNumber: string
  projectName: string
  /** Stored type text (iOS `SiteAuditType` raw value), never dropped when unknown. */
  type: string
  customTitle: string
  authorName: string
  dateMs: number | null
  dayKey: string | null
  createdAtMs: number | null
  createdByUserId: string
  /** Missing → true. */
  visibleToOperatives: boolean
  items: SiteAuditItemDocument[]
  organizationId: string | null
  updatedAtMs: number | null
}

/**
 * Read one `organizations/{orgId}/siteAudits/{id}`. Null without a document id, a project id or a type. An item
 * needs a title; an item without an id gets a derived one.
 */
export function parseSiteAuditDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): SiteAuditDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const projectId = text(row.projectId)
  const type = text(row.type)
  if (!projectId || !type) return null
  const zone = zoneOrLondon(options?.timeZone)
  const items: SiteAuditItemDocument[] = []
  for (const [index, entry] of (Array.isArray(row.items) ? row.items : []).entries()) {
    const item = record(entry)
    const title = text(item.title)
    if (!title) continue
    const storedId = text(item.id)
    items.push({
      id: storedId || derivedRowId(id, 'items', index, [title, text(item.location)]),
      idStored: Boolean(storedId),
      title,
      location: text(item.location),
      assignee: text(item.assignee),
      comments: text(item.comments),
      annotations: text(item.annotations),
      imageURL: optionalText(item.imageURL),
      imageCapturedAtMs: documentInstantMs(item.imageCapturedAt),
      createdAtMs: documentInstantMs(item.createdAt),
    })
  }
  const dateMs = documentInstantMs(row.date)
  return {
    id,
    projectId,
    projectJobNumber: text(row.projectJobNumber),
    projectName: text(row.projectName),
    type,
    customTitle: text(row.customTitle),
    authorName: text(row.authorName),
    dateMs,
    dayKey: storedDayKey(row.date, zone),
    createdAtMs: documentInstantMs(row.createdAt) ?? dateMs,
    createdByUserId: text(row.createdByUserId),
    visibleToOperatives: documentBool(row.visibleToOperatives) ?? true,
    items,
    organizationId: documentOrganizationId(row.organizationId),
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

/**
 * Partial update of `siteAudits/{id}` (§1). `createdAt`, `createdByUserId` and `organizationId` are never rewritten
 * (web re-stamped `createdAt` on every save). The items list is one field: callers merge each item onto its stored
 * row with `mergeStoredRows` first, so a field the other app writes (`imageCapturedAt`) is kept.
 */
export function siteAuditWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, { createOnly: [...CREATE_ONLY, 'createdByUserId'] })
}

/**
 * Array rows to write over stored rows: each next row is laid over the stored row with the same id (ids compare
 * without case), so keys this app does not know are kept; a `null` / `undefined` value in a next row leaves the
 * stored key alone. Order and membership follow `next`.
 */
export function mergeStoredRows(
  stored: unknown,
  next: ReadonlyArray<Record<string, unknown>>
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>()
  for (const row of rows(stored)) {
    const key = normalizeDocumentId(row.id)
    if (key) byId.set(key, row)
  }
  return (next || []).map((row) => {
    const base = byId.get(normalizeDocumentId(row?.id)) ?? {}
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(row || {})) {
      if (value !== undefined && value !== null) out[key] = value
    }
    return out
  })
}

// MARK: - Project tasks

export const PROJECT_TASK_STATUSES = ['To Do', 'In Progress', 'Completed'] as const
export type ProjectTaskStatusToken = (typeof PROJECT_TASK_STATUSES)[number]
export const PROJECT_TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const
export type ProjectTaskPriorityToken = (typeof PROJECT_TASK_PRIORITIES)[number]

const TASK_STATUS_SYNONYMS: Readonly<Record<string, ProjectTaskStatusToken>> = {
  todo: 'To Do',
  open: 'To Do',
  new: 'To Do',
  pending: 'To Do',
  notstarted: 'To Do',
  inprogress: 'In Progress',
  started: 'In Progress',
  doing: 'In Progress',
  completed: 'Completed',
  complete: 'Completed',
  done: 'Completed',
  closed: 'Completed',
}

/** A stored task status as one of `PROJECT_TASK_STATUSES` (any case, spaces / underscores ignored). Unknown → To Do. */
export function normalizeProjectTaskStatus(raw: unknown): ProjectTaskStatusToken {
  const compact = text(raw).replace(/[\s_\-]+/g, '').toLowerCase()
  return TASK_STATUS_SYNONYMS[compact] ?? 'To Do'
}

/** A stored priority as one of `PROJECT_TASK_PRIORITIES` (any case). Unknown → Normal. */
export function normalizeProjectTaskPriority(raw: unknown): ProjectTaskPriorityToken {
  const token = text(raw).toLowerCase()
  return PROJECT_TASK_PRIORITIES.find((priority) => priority.toLowerCase() === token) ?? 'Normal'
}

export type TaskItemDocument = { id: string; idStored: boolean; title: string; description: string | null }

export type TaskDocument = {
  /** Document id, stored case. */
  id: string
  projectId: string
  title: string
  details: string | null
  createdBy: string
  status: ProjectTaskStatusToken
  priority: ProjectTaskPriorityToken
  /** Stored case; non-UUID ids are kept. */
  assignedOperativeId: string | null
  assignedManagerId: string | null
  assignedOperativeIds: string[]
  assignedManagerIds: string[]
  dueDateMs: number | null
  dueDayKey: string | null
  completedBy: string | null
  completedAtMs: number | null
  completionNotes: string | null
  completionImages: string[]
  /** URLs; a stored `{ url }` row gives its url. */
  completionFiles: string[]
  attachedImageURLs: string[]
  attachedFileURL: string | null
  attachedFileName: string | null
  attachedSiteAuditId: string | null
  attachedSiteAuditTitle: string | null
  items: TaskItemDocument[]
  completedItemIds: string[]
  organizationId: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
}

function urlList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const url = typeof item === 'string' ? item.trim() : text(record(item).url) || text(record(item).downloadURL)
    if (url) out.push(url)
  }
  return out
}

/**
 * Read one `organizations/{orgId}/tasks/{id}`. Null without a document id or a title. A task with no project id, a
 * non-UUID id or an unknown status is kept (status To Do). An item stored without an id gets
 * `derivedRowId(task id, 'items', index, [title])`, so `completedItemIds` keeps matching it.
 */
export function parseTaskDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): TaskDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const title = text(row.title)
  if (!title) return null
  const zone = zoneOrLondon(options?.timeZone)
  const items: TaskItemDocument[] = []
  for (const [index, entry] of (Array.isArray(row.items) ? row.items : []).entries()) {
    const item = record(entry)
    const itemTitle = text(item.title)
    if (!itemTitle) continue
    const storedId = text(item.id)
    items.push({
      id: storedId || derivedRowId(id, 'items', index, [itemTitle]),
      idStored: Boolean(storedId),
      title: itemTitle,
      description: optionalText(item.description),
    })
  }
  const dueDateMs = documentInstantMs(row.dueDate)
  const createdAtMs = documentInstantMs(row.createdAt)
  return {
    id,
    projectId: text(row.projectId),
    title,
    details: optionalText(row.details),
    createdBy: text(row.createdBy),
    status: normalizeProjectTaskStatus(row.status),
    priority: normalizeProjectTaskPriority(row.priority),
    assignedOperativeId: optionalText(row.assignedOperativeId),
    assignedManagerId: optionalText(row.assignedManagerId),
    assignedOperativeIds: idList(row.assignedOperativeIds),
    assignedManagerIds: idList(row.assignedManagerIds),
    dueDateMs,
    dueDayKey: storedDayKey(row.dueDate, zone),
    completedBy: optionalText(row.completedBy),
    completedAtMs: documentInstantMs(row.completedAt),
    completionNotes: optionalText(row.completionNotes),
    completionImages: urlList(row.completionImages),
    completionFiles: urlList(row.completionFiles),
    attachedImageURLs: urlList(row.attachedImageURLs),
    attachedFileURL: optionalText(row.attachedFileURL),
    attachedFileName: optionalText(row.attachedFileName),
    attachedSiteAuditId: optionalText(row.attachedSiteAuditId),
    attachedSiteAuditTitle: optionalText(row.attachedSiteAuditTitle),
    items,
    completedItemIds: idList(row.completedItemIds),
    organizationId: documentOrganizationId(row.organizationId),
    createdAtMs,
    updatedAtMs: documentInstantMs(row.updatedAt) ?? createdAtMs,
  }
}

export type TaskFieldsInput = {
  id: string
  projectId: string
  title: string
  details?: string | null
  createdBy?: string | null
  status?: unknown
  priority?: unknown
  assignedOperativeId?: string | null
  assignedManagerId?: string | null
  assignedOperativeIds?: ReadonlyArray<string> | null
  assignedManagerIds?: ReadonlyArray<string> | null
  /** Instants pass through as given; null clears. */
  dueDate?: unknown
  completedBy?: string | null
  completedAt?: unknown
  completionNotes?: string | null
  completionImages?: ReadonlyArray<string> | null
  completionFiles?: ReadonlyArray<string> | null
  attachedImageURLs?: ReadonlyArray<string> | null
  attachedFileURL?: string | null
  attachedFileName?: string | null
  attachedSiteAuditId?: string | null
  attachedSiteAuditTitle?: string | null
  items?: ReadonlyArray<{ id: string; title: string; description?: string | null }> | null
  completedItemIds?: ReadonlyArray<string> | null
  createdAt?: unknown
  organizationId?: string | null
}

function listOrNull(value: ReadonlyArray<string> | null | undefined): string[] | null {
  const list = (value || []).map((item) => text(item)).filter(Boolean)
  return list.length > 0 ? list : null
}

/**
 * The stored shape of a task on every platform: canonical status and priority, ids in stored case, blank optionals
 * and empty lists null (a partial save removes them), items `{ id, title, description }`.
 */
export function taskFields(input: TaskFieldsInput): Record<string, unknown> {
  const items = (input?.items || [])
    .filter((item) => text(item?.id) && text(item?.title))
    .map((item) => ({ id: text(item.id), title: text(item.title), description: text(item.description) }))
  const out: Record<string, unknown> = {
    id: text(input?.id),
    projectId: text(input?.projectId),
    title: text(input?.title),
    details: text(input?.details),
    status: normalizeProjectTaskStatus(input?.status),
    priority: normalizeProjectTaskPriority(input?.priority),
    assignedOperativeId: blankToNull(input?.assignedOperativeId) ?? null,
    assignedManagerId: blankToNull(input?.assignedManagerId) ?? null,
    assignedOperativeIds: listOrNull(input?.assignedOperativeIds),
    assignedManagerIds: listOrNull(input?.assignedManagerIds),
    dueDate: input?.dueDate ?? null,
    completedBy: blankToNull(input?.completedBy) ?? null,
    completedAt: input?.completedAt ?? null,
    completionNotes: blankToNull(input?.completionNotes) ?? null,
    completionImages: listOrNull(input?.completionImages),
    completionFiles: listOrNull(input?.completionFiles),
    attachedImageURLs: listOrNull(input?.attachedImageURLs),
    attachedFileURL: blankToNull(input?.attachedFileURL) ?? null,
    attachedFileName: blankToNull(input?.attachedFileName) ?? null,
    attachedSiteAuditId: blankToNull(input?.attachedSiteAuditId) ?? null,
    attachedSiteAuditTitle: blankToNull(input?.attachedSiteAuditTitle) ?? null,
    items: items.length > 0 ? items : null,
    completedItemIds: listOrNull(input?.completedItemIds),
  }
  if (input?.createdBy !== undefined) out.createdBy = text(input.createdBy)
  if (input?.createdAt !== undefined) out.createdAt = input.createdAt
  if (input?.organizationId !== undefined) out.organizationId = text(input.organizationId) || null
  return out
}

export const TASK_OPERATIVE_WRITE_GROUP = ['assignedOperativeId', 'assignedOperativeIds'] as const
export const TASK_MANAGER_WRITE_GROUP = ['assignedManagerId', 'assignedManagerIds'] as const
export const TASK_COMPLETION_WRITE_GROUP = ['completedBy', 'completedAt'] as const
export const TASK_ITEMS_WRITE_GROUP = ['items', 'completedItemIds'] as const

/**
 * Partial update of `tasks/{id}` (§1): never a whole-task `setData`. Assignee id and list, completion by and at, and
 * items with completed item ids are each written together. `id`, `createdAt`, `createdBy` and `organizationId` are
 * never rewritten.
 */
export function taskWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [TASK_OPERATIVE_WRITE_GROUP, TASK_MANAGER_WRITE_GROUP, TASK_COMPLETION_WRITE_GROUP, TASK_ITEMS_WRITE_GROUP],
    createOnly: [...CREATE_ONLY, 'createdBy'],
  })
}

// MARK: - settings/jobTypes

export const JOB_TYPES_DOCUMENT_ID = 'jobTypes'
/** The iOS `JobType` raw values. */
export const DEFAULT_JOB_TYPE_NAMES = ['CAT A', 'CAT B', 'Small Works', 'Maintenance'] as const
/** Always re-seeded when missing: the iOS names plus Decarbonisation (a custom type an organisation already used). */
export const RESTORED_JOB_TYPE_NAMES = [...DEFAULT_JOB_TYPE_NAMES, 'Decarbonisation'] as const

const JOB_TYPE_ALIASES: Readonly<Record<string, string>> = {
  cata: 'CAT A',
  categorya: 'CAT A',
  catafitout: 'CAT A',
  catafit: 'CAT A',
  catb: 'CAT B',
  categoryb: 'CAT B',
  catbfitout: 'CAT B',
  smallworks: 'Small Works',
  smallwork: 'Small Works',
  maintenance: 'Maintenance',
  decarbonisation: 'Decarbonisation',
  decarbonization: 'Decarbonisation',
}

/** One job type name as both apps store it: enum spellings (`catA`, `small_works`) map to the iOS raw value. */
export function canonicalJobTypeName(name: unknown): string {
  const raw = typeof name === 'string' ? name : ''
  const compact = raw.replace(/[\s_\-]+/g, '').toLowerCase()
  return JOB_TYPE_ALIASES[compact] || raw.trim()
}

/** A job type held as a string, or a `{ name }` / `{ rawValue }` map. '' when neither. */
export function stringFromJobTypeField(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  const row = record(value)
  return text(row.name) || text(row.rawValue)
}

function uniqueSortedNames(names: ReadonlyArray<string>): string[] {
  const seen = new Map<string, string>()
  for (const name of names) {
    const trimmed = text(name)
    if (trimmed && !seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * A stored job type list (`settings/jobTypes.jobTypes`, or the organisation's `jobTypes` / `settings.jobTypes`): an
 * array of strings or `{ name }` maps, a comma-separated string, or a map of names. Canonical names, de-duplicated
 * without case, sorted.
 */
export function coerceJobTypeList(raw: unknown): string[] {
  let values: unknown[] = []
  if (Array.isArray(raw)) values = raw
  else if (typeof raw === 'string') values = raw.split(',')
  else if (raw && typeof raw === 'object') values = Object.values(raw as Record<string, unknown>)
  return uniqueSortedNames(values.map((item) => canonicalJobTypeName(stringFromJobTypeField(item))))
}

/** Read `settings/jobTypes` (and, as a fallback source, the organisation document's `jobTypes`). */
export function parseJobTypesDocument(
  data: Record<string, unknown> | null | undefined,
  organization?: Record<string, unknown> | null
): { jobTypes: string[] } {
  const org = record(organization)
  const nested = record(org.settings).jobTypes
  return {
    jobTypes: uniqueSortedNames([...coerceJobTypeList(record(data).jobTypes), ...coerceJobTypeList(org.jobTypes ?? nested)]),
  }
}

/** The stored list joined with names recovered from live jobs and the restored defaults. */
export function mergeJobTypeCatalogues(stored: ReadonlyArray<string>, recovered: ReadonlyArray<string>): string[] {
  return uniqueSortedNames([...stored, ...recovered, ...RESTORED_JOB_TYPE_NAMES].map(canonicalJobTypeName))
}

/**
 * Saving `settings/jobTypes`: `{ set: { jobTypes } }` with canonical, de-duplicated, sorted names — a field update of
 * `jobTypes` only (never a whole-document overwrite). Null when the list is empty (an empty list never replaces the
 * catalogue) or unchanged from `stored`. The app creates the document with `organizationId` when it is missing.
 */
export function jobTypesWriteFields(
  stored: ReadonlyArray<string> | null | undefined,
  next: ReadonlyArray<string>
): { set: { jobTypes: string[] } } | null {
  const names = uniqueSortedNames((next || []).map(canonicalJobTypeName))
  if (names.length === 0) return null
  const before = uniqueSortedNames((stored || []).map(canonicalJobTypeName))
  if (before.length === names.length && before.every((name, index) => name === names[index])) return null
  return { set: { jobTypes: names } }
}

// MARK: - settings/tradeTypeInventory

export const TRADE_TYPE_INVENTORY_DOCUMENT_ID = 'tradeTypeInventory'

/** Read `settings/tradeTypeInventory.trades`: trimmed, de-duplicated without case, in stored order. */
export function parseTradeTypeInventory(data: Record<string, unknown> | null | undefined): { trades: string[] } {
  const seen = new Set<string>()
  const trades: string[] = []
  for (const trade of textList(record(data).trades)) {
    if (seen.has(trade.toLowerCase())) continue
    seen.add(trade.toLowerCase())
    trades.push(trade)
  }
  return { trades }
}

/**
 * Adding trades to the inventory: the stored list plus each incoming trade not already there (ignoring case), in
 * order. Never removes a trade. Null when nothing is new (no write). The app writes `{ trades }` as a merge.
 */
export function tradeTypeInventoryWriteFields(
  stored: Record<string, unknown> | null | undefined,
  incoming: ReadonlyArray<string>
): { set: { trades: string[] } } | null {
  const trades = parseTradeTypeInventory(stored).trades
  const seen = new Set(trades.map((trade) => trade.toLowerCase()))
  let added = false
  for (const trade of incoming || []) {
    const name = text(trade)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    trades.push(name)
    added = true
  }
  return added ? { set: { trades } } : null
}

// MARK: - operativeProfiles (pay mirror)

export type OperativeProfileDocument = {
  /** `userId`, else the document id (stored case). */
  userId: string
  documentId: string
  assignedManagerUserId: string | null
  assignedManagerUserIds: string[]
  payBasis: PayBasis | null
  dayRate: number | null
  hourlyRate: number | null
  updatedAtMs: number | null
}

/**
 * Read one `organizations/{orgId}/operativeProfiles/{userId}` mirror (§8). It is never read over `users/{uid}`; it is
 * only a fallback for a person whose users document the viewer cannot read. Rates follow `readStoredRates` (an
 * hourly mirror stays hourly; iOS read `dayRate` only).
 */
export function parseOperativeProfileDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): OperativeProfileDocument | null {
  const documentId = text(docId)
  if (!documentId) return null
  const row = record(data)
  const managers = idList(row.assignedManagerUserIds)
  const single = text(row.assignedManagerUserId)
  if (single && !managers.some((id) => normalizeDocumentId(id) === normalizeDocumentId(single))) managers.unshift(single)
  const pay = readStoredRates({
    payBasis: text(row.payBasis).toLowerCase() || null,
    dayRate: documentNumber(row.dayRate),
    hourlyRate: documentNumber(row.hourlyRate),
  })
  return {
    userId: text(row.userId) || documentId,
    documentId,
    assignedManagerUserId: managers[0] ?? null,
    assignedManagerUserIds: managers,
    payBasis: pay.payBasis,
    dayRate: pay.payBasis === 'day' ? pay.dayRate : null,
    hourlyRate: pay.payBasis === 'hourly' ? pay.hourlyRate : null,
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

/** Partial update of the `operativeProfiles` mirror: pay basis with both rates, manager id with the list, together. */
export function operativeProfileWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [PAY_WRITE_GROUP, ['assignedManagerUserId', 'assignedManagerUserIds']],
    createOnly: ['userId', 'createdAt'],
  })
}


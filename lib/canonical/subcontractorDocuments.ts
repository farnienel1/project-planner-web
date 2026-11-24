/**
 * Rulebook 1.80.0 (owner decision 24 Nov, option (a)): a subcontractor's **insurance** and **RAMS** documents.
 *
 * Staff — admins, and managers with the Sub Contractors permission (`canManageSubcontractors`) — upload them on the
 * subcontractor's page, each with an optional expiry date. Subcontractors have no login and upload nothing.
 *
 * Stored on the firm's own document `organizations/{orgId}/subcontractors/{id}`:
 *   `documents: { insurance: Entry[], rams: Entry[] }`, each entry
 *   `{ id, path, name, contentType, sizeBytes, uploadedAtMs, uploadedBy, expiresOn }` (`expiresOn` a `YYYY-MM-DD`
 *   organisation-zone day key or null). Files live at
 *   `organizations/{orgId}/subcontractors/{subId}/documents/{uid}_{ms}.{ext}` (§24 object names, Storage: staff only).
 *
 * Writes are field-path updates of one list (`documents.insurance` / `documents.rams`) built from the STORED document
 * in a transaction, so an entry someone else added meanwhile is kept and a firm save (`subcontractorWriteFields`)
 * never carries the lists. Pure, JSON in / JSON out.
 */

import { derivedRowId } from './derivedIds'
import { holidayDocumentDayKey } from './holidayDocument'
import { calendarDaysBetween } from './dueDates'
import { documentInstantMs } from './peopleDocuments'
import { effectivePermissions, permissionLevelOf } from './permissionLevels'
import { normalizeDocumentId } from './scheduleSources'

export const SUBCONTRACTOR_DOCUMENT_KINDS = ['insurance', 'rams'] as const
export type SubcontractorDocumentKind = (typeof SUBCONTRACTOR_DOCUMENT_KINDS)[number]

export const SUBCONTRACTOR_DOCUMENT_LABELS: Readonly<Record<SubcontractorDocumentKind, string>> = {
  insurance: 'Insurance',
  rams: 'RAMS',
}

/** At most this many files per kind on one subcontractor. */
export const SUBCONTRACTOR_DOCUMENTS_MAX_PER_KIND = 20

/** "Expires in N days" turns amber at this many days or fewer (a calendar month, as qualification expiry). */
export const SUBCONTRACTOR_DOCUMENT_EXPIRING_SOON_DAYS = 30

export const SUBCONTRACTOR_DOCUMENTS_EMPTY_TEXT = 'No documents uploaded yet.'
export const SUBCONTRACTOR_DOCUMENT_EXPIRY_LABEL = 'Expiry date (optional)'
export const SUBCONTRACTOR_DOCUMENT_EXPIRY_INVALID_MESSAGE = 'Enter the expiry date as a date, or leave it empty.'
export const SUBCONTRACTOR_DOCUMENTS_FULL_MESSAGE = `A subcontractor can hold up to ${SUBCONTRACTOR_DOCUMENTS_MAX_PER_KIND} documents of each kind. Remove an old one first.`

export type SubcontractorDocumentEntry = {
  /** Stored id (stored case), else a derived id (never random). */
  id: string
  /** Storage path inside the firm's own documents folder. */
  path: string
  name: string
  contentType: string
  sizeBytes: number | null
  uploadedAtMs: number | null
  /** Uploader's users id. */
  uploadedBy: string
  /** `YYYY-MM-DD` (organisation zone) or null. */
  expiresOn: string | null
}

export type SubcontractorDocuments = Record<SubcontractorDocumentKind, SubcontractorDocumentEntry[]>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function validDayKey(value: string): boolean {
  if (!DAY_KEY.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function isSubcontractorDocumentKind(value: unknown): value is SubcontractorDocumentKind {
  return typeof value === 'string' && (SUBCONTRACTOR_DOCUMENT_KINDS as readonly string[]).includes(value)
}

/**
 * Who uploads, edits and removes subcontractor documents — the people who may add and manage subcontractor records
 * today: admins and super admins (outside operative mode — an admin has none), and managers with both the manager
 * flag and the Sub Contractors permission in effect (`effectivePermissions`). Operatives never. Same test as web
 * `canManageSubcontractors` (which now calls this).
 */
export function canManageSubcontractors(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const level = permissionLevelOf(user)
  if (level === 'operative') return false
  if (level === 'admin') return true
  const flags = effectivePermissions(user, level)
  return flags.manager === true && flags.subContractors === true
}

/** The Storage folder of one firm's documents. Null without an organisation or firm id, or with a `/` in one. */
export function subcontractorDocumentsFolder(organizationId: unknown, subcontractorId: unknown): string | null {
  const org = text(organizationId)
  const sub = text(subcontractorId)
  if (!org || !sub || org.includes('/') || sub.includes('/')) return null
  return `organizations/${org}/subcontractors/${sub}/documents`
}

/** A new upload's Storage path: `{folder}/{uid}_{unixMs}.{ext}` (§24). Null when any part cannot be a path. */
export function subcontractorDocumentStoragePath(input: {
  organizationId: unknown
  subcontractorId: unknown
  uid: unknown
  unixMs: number
  extension?: string | null
}): string | null {
  const folder = subcontractorDocumentsFolder(input.organizationId, input.subcontractorId)
  const uid = text(input.uid)
  if (!folder || !uid || !/^[A-Za-z0-9-]+$/.test(uid)) return null
  const ms = Math.floor(Number(input.unixMs))
  if (!Number.isFinite(ms) || ms < 0) return null
  const ext = text(input.extension).toLowerCase().replace(/^\.+/, '').replace(/[^a-z0-9]/g, '')
  return ext ? `${folder}/${uid}_${ms}.${ext}` : `${folder}/${uid}_${ms}`
}

/** Whether a stored path is a file directly inside this firm's documents folder (ids compared without case). */
export function subcontractorDocumentPathBelongsTo(path: unknown, organizationId: unknown, subcontractorId: unknown): boolean {
  const value = text(path)
  if (!value || value.includes('..') || value.includes('//')) return false
  const parts = value.split('/')
  if (parts.length !== 6) return false
  if (parts[0] !== 'organizations' || parts[2] !== 'subcontractors' || parts[4] !== 'documents' || !parts[5]) return false
  const org = text(organizationId)
  if (org && normalizeDocumentId(parts[1]) !== normalizeDocumentId(org)) return false
  return normalizeDocumentId(parts[3]) === normalizeDocumentId(subcontractorId)
}

/** An expiry as typed or stored: '' / null → null; a valid `YYYY-MM-DD` → itself; any other value → undefined (invalid). */
export function normalizeSubcontractorDocumentExpiry(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  const raw = text(value)
  if (!raw) return null
  return validDayKey(raw) ? raw : undefined
}

/** The refusal message for an expiry that is not a date, else null. */
export function subcontractorDocumentExpiryError(value: unknown): string | null {
  return normalizeSubcontractorDocumentExpiry(value) === undefined ? SUBCONTRACTOR_DOCUMENT_EXPIRY_INVALID_MESSAGE : null
}

function parseEntry(
  entry: unknown,
  index: number,
  kind: SubcontractorDocumentKind,
  subcontractorId: string,
  organizationId: string | null
): SubcontractorDocumentEntry | null {
  const row = record(entry)
  const path = text(row.path) || text(row.storagePath)
  if (!subcontractorDocumentPathBelongsTo(path, organizationId, subcontractorId)) return null
  const name = text(row.name) || path.split('/').pop() || 'Document'
  const size = Number(row.sizeBytes)
  const expiry = normalizeSubcontractorDocumentExpiry(row.expiresOn)
  return {
    id: text(row.id) || derivedRowId(subcontractorId, `documents.${kind}`, index, [path]),
    path,
    name,
    contentType: text(row.contentType),
    sizeBytes: Number.isFinite(size) && size >= 0 ? size : null,
    uploadedAtMs: documentInstantMs(row.uploadedAtMs ?? row.uploadedAt),
    uploadedBy: text(row.uploadedBy),
    // A stored expiry that is not a date reads as none (never drops the row).
    expiresOn: expiry ?? null,
  }
}

/**
 * Read a firm's documents. Every entry must point at a file inside this firm's own documents folder (a URL, another
 * firm's or organisation's file, or junk is dropped); an entry with no id gets a derived id. A document stored before
 * 1.80.0 (no `documents`) reads as two empty lists.
 */
export function parseSubcontractorDocuments(
  subcontractorId: unknown,
  data: Record<string, unknown> | null | undefined,
  options?: { organizationId?: string | null } | null
): SubcontractorDocuments {
  const id = text(subcontractorId)
  const out: SubcontractorDocuments = { insurance: [], rams: [] }
  if (!id) return out
  const documents = record(record(data).documents)
  const org = text(options?.organizationId) || text(record(data).organizationId) || null
  for (const kind of SUBCONTRACTOR_DOCUMENT_KINDS) {
    const list = Array.isArray(documents[kind]) ? (documents[kind] as unknown[]) : []
    const seen = new Set<string>()
    list.forEach((entry, index) => {
      const parsed = parseEntry(entry, index, kind, id, org)
      if (!parsed || seen.has(parsed.path)) return
      seen.add(parsed.path)
      out[kind].push(parsed)
    })
  }
  return out
}

function storedList(stored: Record<string, unknown> | null | undefined, kind: SubcontractorDocumentKind): unknown[] {
  const list = record(record(stored).documents)[kind]
  return Array.isArray(list) ? [...list] : []
}

/** The field path one kind's list is written under (`documents.insurance` / `documents.rams`). */
export function subcontractorDocumentsFieldPath(kind: SubcontractorDocumentKind): string {
  return `documents.${kind}`
}

export type SubcontractorDocumentWrite = { fieldPath: string; value: unknown[] }

/**
 * Linking an uploaded file (from the STORED firm document, in a transaction). `set` is null when nothing changes:
 * the file is already on the list (`alreadyLinked`: a first attempt committed — never delete the file), the list is
 * full (`refused`: the uploader deletes the file again), or the entry is not valid (`invalid`). Stored entries are
 * kept exactly as stored.
 */
export function subcontractorDocumentAddWriteFields(
  stored: Record<string, unknown> | null | undefined,
  input: {
    kind: SubcontractorDocumentKind
    subcontractorId: string
    organizationId: string
    entry: {
      id?: string | null
      path: string
      name: string
      contentType?: string | null
      sizeBytes?: number | null
      uploadedAtMs: number
      uploadedBy: string
      expiresOn?: string | null
    }
  }
): { set: SubcontractorDocumentWrite | null; outcome: 'added' | 'alreadyLinked' | 'refused' | 'invalid' } {
  if (!isSubcontractorDocumentKind(input.kind)) return { set: null, outcome: 'invalid' }
  const path = text(input.entry?.path)
  if (!subcontractorDocumentPathBelongsTo(path, input.organizationId, input.subcontractorId)) return { set: null, outcome: 'invalid' }
  const expiry = normalizeSubcontractorDocumentExpiry(input.entry.expiresOn)
  if (expiry === undefined) return { set: null, outcome: 'invalid' }
  const uploadedBy = text(input.entry.uploadedBy)
  if (!uploadedBy) return { set: null, outcome: 'invalid' }
  const list = storedList(stored, input.kind)
  if (list.some((row) => (text(record(row).path) || text(record(row).storagePath)) === path)) {
    return { set: null, outcome: 'alreadyLinked' }
  }
  if (list.length >= SUBCONTRACTOR_DOCUMENTS_MAX_PER_KIND) return { set: null, outcome: 'refused' }
  const size = Number(input.entry.sizeBytes)
  const uploadedAtMs = Math.floor(Number(input.entry.uploadedAtMs))
  const entry: Record<string, unknown> = {
    id: text(input.entry.id) || derivedRowId(input.subcontractorId, `documents.${input.kind}`, list.length, [path]),
    path,
    name: text(input.entry.name) || path.split('/').pop() || 'Document',
    contentType: text(input.entry.contentType),
    sizeBytes: Number.isFinite(size) && size >= 0 ? size : null,
    uploadedAtMs: Number.isFinite(uploadedAtMs) ? uploadedAtMs : null,
    uploadedBy,
    expiresOn: expiry,
  }
  return { set: { fieldPath: subcontractorDocumentsFieldPath(input.kind), value: [...list, entry] }, outcome: 'added' }
}

function entryMatches(row: unknown, kind: SubcontractorDocumentKind, subcontractorId: string, index: number, entryId: string): boolean {
  const line = record(row)
  const stored = text(line.id)
  const path = text(line.path) || text(line.storagePath)
  const id = stored || derivedRowId(subcontractorId, `documents.${kind}`, index, [path])
  return normalizeDocumentId(id) === normalizeDocumentId(entryId)
}

/**
 * Removing one document from the list (from the stored firm document). `removed` is the stored entry (null when it is
 * already gone, then `set` is null). Deleting the Storage object is a separate step that only runs when
 * `fileDeletePermission` allows it (§24: the uploader inside the undo window, or an admin); otherwise the file is kept.
 */
export function subcontractorDocumentRemoveWriteFields(
  stored: Record<string, unknown> | null | undefined,
  input: { kind: SubcontractorDocumentKind; subcontractorId: string; entryId: string }
): { set: SubcontractorDocumentWrite | null; removedPath: string | null } {
  if (!isSubcontractorDocumentKind(input.kind)) return { set: null, removedPath: null }
  const list = storedList(stored, input.kind)
  const index = list.findIndex((row, i) => entryMatches(row, input.kind, text(input.subcontractorId), i, text(input.entryId)))
  if (index < 0) return { set: null, removedPath: null }
  const line = record(list[index])
  const removedPath = text(line.path) || text(line.storagePath) || null
  const next = list.filter((_, i) => i !== index)
  return { set: { fieldPath: subcontractorDocumentsFieldPath(input.kind), value: next }, removedPath }
}

/** Changing one document's expiry (null clears it). `set` is null when unchanged, gone, or the date is invalid. */
export function subcontractorDocumentExpiryWriteFields(
  stored: Record<string, unknown> | null | undefined,
  input: { kind: SubcontractorDocumentKind; subcontractorId: string; entryId: string; expiresOn: unknown }
): { set: SubcontractorDocumentWrite | null; outcome: 'changed' | 'unchanged' | 'missing' | 'invalid' } {
  if (!isSubcontractorDocumentKind(input.kind)) return { set: null, outcome: 'invalid' }
  const expiry = normalizeSubcontractorDocumentExpiry(input.expiresOn)
  if (expiry === undefined) return { set: null, outcome: 'invalid' }
  const list = storedList(stored, input.kind)
  const index = list.findIndex((row, i) => entryMatches(row, input.kind, text(input.subcontractorId), i, text(input.entryId)))
  if (index < 0) return { set: null, outcome: 'missing' }
  const line = record(list[index])
  const current = normalizeSubcontractorDocumentExpiry(line.expiresOn) ?? null
  if (current === expiry) return { set: null, outcome: 'unchanged' }
  const next = [...list]
  next[index] = { ...line, expiresOn: expiry }
  return { set: { fieldPath: subcontractorDocumentsFieldPath(input.kind), value: next }, outcome: 'changed' }
}

export type SubcontractorDocumentExpiryState = {
  state: 'none' | 'expired' | 'expiresToday' | 'expiringSoon' | 'valid'
  /** Days from today (organisation zone) to the expiry day; negative once expired; null with no expiry. */
  daysLeft: number | null
  label: string
}

/** "Expires 3 Mar 2027" style date text for a day key (no zone shift: a day key is already the organisation's day). */
export function subcontractorDocumentExpiryDateText(dayKey: string): string {
  if (!validDayKey(dayKey)) return ''
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d))
  )
}

/**
 * Where a document's expiry stands on today's organisation-zone day: no expiry "No expiry"; before today "Expired";
 * today "Expires today"; within `SUBCONTRACTOR_DOCUMENT_EXPIRING_SOON_DAYS` "Expires in N days" (amber); later
 * "Expires 3 Mar 2027". The expiry day itself still counts as valid.
 */
export function subcontractorDocumentExpiryState(
  expiresOn: unknown,
  nowMs: number,
  timeZone?: string | null
): SubcontractorDocumentExpiryState {
  const expiry = normalizeSubcontractorDocumentExpiry(expiresOn)
  if (!expiry) return { state: 'none', daysLeft: null, label: 'No expiry' }
  const today = holidayDocumentDayKey(Number.isFinite(nowMs) ? nowMs : Date.now(), timeZone)
  const daysLeft = calendarDaysBetween(today, expiry)
  if (daysLeft < 0) return { state: 'expired', daysLeft, label: 'Expired' }
  if (daysLeft === 0) return { state: 'expiresToday', daysLeft, label: 'Expires today' }
  if (daysLeft <= SUBCONTRACTOR_DOCUMENT_EXPIRING_SOON_DAYS) {
    return { state: 'expiringSoon', daysLeft, label: `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` }
  }
  return { state: 'valid', daysLeft, label: `Expires ${subcontractorDocumentExpiryDateText(expiry)}` }
}

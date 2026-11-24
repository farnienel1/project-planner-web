/**
 * Rulebook 1.83.0 §31 (owner decisions 24 Nov: build now, lean; admins only; removed files recoverable for 30 days):
 * the organisation's **insurance & accreditations** — Settings › Organisation › Compliance › Insurance & accreditations.
 *
 * One document per organisation, `organizations/{orgId}/orgCompliance/documents` (`orgComplianceDocumentPath`), read
 * and written by admins of that organisation only (firestore.rules; never through the organisation catch-all read):
 *   `documents: { insurance: Entry[], trade: Entry[], quality: Entry[] }`, each entry
 *   `{ id, docType, title, issuer, reference, coverAmount, expiresOn, path, fileName, contentType, sizeBytes,
 *      uploadedAtMs, uploadedBy, updatedAtMs, updatedBy }`.
 * Files live at `organizations/{orgId}/compliance/{uid}_{ms}.{ext}` (§24 object names; Storage: admins only).
 *
 * Writes are one section's list, built from the STORED document in a transaction (the pattern of the 1.80.0
 * subcontractor documents), so an entry added on another device meanwhile is kept. Pure, JSON in / JSON out.
 */

import { hasAccess } from './billingAccess'
import { derivedRowId } from './derivedIds'
import { organizationDeletionState } from './organizationDeletion'
import { calendarDaysBetween } from './dueDates'
import { holidayDocumentDayKey } from './holidayDocument'
import { formatMoney } from './money'
import { documentInstantMs } from './peopleDocuments'
import { permissionLevelOf } from './permissionLevels'
import { normalizeDocumentId } from './scheduleSources'
import { organizationLevelFor } from './orgRoster'
import { subcontractorDocumentExpiryDateText } from './subcontractorDocuments'

export const ORG_COMPLIANCE_COLLECTION = 'orgCompliance'
export const ORG_COMPLIANCE_DOCUMENT_ID = 'documents'

export const ORG_COMPLIANCE_SECTION_KEYS = ['insurance', 'trade', 'quality'] as const
export type OrgComplianceSectionKey = (typeof ORG_COMPLIANCE_SECTION_KEYS)[number]

export type OrgComplianceDocumentType = { key: string; label: string; short: string }

export type OrgComplianceSection = {
  key: OrgComplianceSectionKey
  title: string
  helper: string
  issuerLabel: string
  referenceLabel: string
  /** Only insurance has a cover amount (limit of indemnity). */
  coverLabel: string | null
  emptyTitle: string
  emptyBody: string
  documentTypes: readonly OrgComplianceDocumentType[]
}

/** The three sections, in page order (owner brief §6, lean subset). */
export const ORG_COMPLIANCE_SECTIONS: readonly OrgComplianceSection[] = [
  {
    key: 'insurance',
    title: 'PI & PL insurance',
    helper: 'Public liability, professional indemnity and employer’s liability',
    issuerLabel: 'Insurer',
    referenceLabel: 'Policy number',
    coverLabel: 'Limit of indemnity',
    emptyTitle: 'No insurance certificates yet',
    emptyBody: 'Upload your PL and PI certificates so they’re ready to send.',
    documentTypes: [
      { key: 'public_liability', label: 'Public liability', short: 'PL' },
      { key: 'professional_indemnity', label: 'Professional indemnity', short: 'PI' },
      { key: 'employers_liability', label: 'Employer’s liability', short: 'EL' },
      { key: 'contractors_all_risks', label: 'Contractor’s all risks', short: 'CAR' },
      { key: 'other_insurance', label: 'Other insurance', short: 'Other' },
    ],
  },
  {
    key: 'trade',
    title: 'Trade-specific accreditations',
    helper: 'e.g. NICEIC, NAPIT, ECA, Gas Safe, F-Gas, BESA',
    issuerLabel: 'Scheme or body',
    referenceLabel: 'Registration number',
    coverLabel: null,
    emptyTitle: 'No trade accreditations yet',
    emptyBody: 'Upload scheme certificates such as NICEIC, Gas Safe or F-Gas.',
    documentTypes: [
      { key: 'niceic', label: 'NICEIC Approved Contractor', short: 'NICEIC' },
      { key: 'napit', label: 'NAPIT registration', short: 'NAPIT' },
      { key: 'eca', label: 'ECA membership', short: 'ECA' },
      { key: 'gas_safe', label: 'Gas Safe registration', short: 'Gas Safe' },
      { key: 'f_gas', label: 'F-Gas company certificate', short: 'F-Gas' },
      { key: 'besa', label: 'BESA membership', short: 'BESA' },
      { key: 'other_trade', label: 'Other accreditation', short: 'Other' },
    ],
  },
  {
    key: 'quality',
    title: 'Quality, information & process management',
    helper: 'ISO 9001, ISO 14001, ISO 27001, ISO 45001',
    issuerLabel: 'Certification body',
    referenceLabel: 'Certificate number',
    coverLabel: null,
    emptyTitle: 'No quality certificates yet',
    emptyBody: 'Upload ISO 9001, ISO 27001 or similar certificates.',
    documentTypes: [
      { key: 'iso_9001', label: 'ISO 9001 – Quality management', short: 'ISO 9001' },
      { key: 'iso_14001', label: 'ISO 14001 – Environmental management', short: 'ISO 14001' },
      { key: 'iso_27001', label: 'ISO 27001 – Information security', short: 'ISO 27001' },
      { key: 'iso_45001', label: 'ISO 45001 – Health & safety management', short: 'ISO 45001' },
      { key: 'other_quality', label: 'Other certificate', short: 'Other' },
    ],
  },
]

export const ORG_COMPLIANCE_PAGE_TITLE = 'Insurance & accreditations'
export const ORG_COMPLIANCE_PAGE_SUBTITLE = 'Your organisation’s certificates, ready to view and share.'
export const ORG_COMPLIANCE_HUB_GROUP = 'Compliance'
export const ORG_COMPLIANCE_EXPIRING_SOON_DAYS = 30
export const ORG_COMPLIANCE_MAX_YEARS_AHEAD = 10
export const ORG_COMPLIANCE_MAX_PER_SECTION = 50
export const ORG_COMPLIANCE_FIELD_LIMITS = { title: 120, issuer: 120, reference: 60 } as const
export const ORG_COMPLIANCE_COVER_MAX = 1_000_000_000

export const ORG_COMPLIANCE_LABELS = {
  docType: 'Document type',
  title: 'Name',
  titlePlaceholder: 'e.g. Public liability 2026–27',
  expiryToggle: 'Has an expiry date',
  expiry: 'Expiry date',
  expiryHelper: `Optional. Shows as expiring ${ORG_COMPLIANCE_EXPIRING_SOON_DAYS} days before.`,
  upload: 'Upload',
  view: 'View',
  replace: 'Replace file',
  edit: 'Edit details',
  remove: 'Remove',
  save: 'Save',
  cancel: 'Cancel',
  replaceHelper:
    'The new file replaces the current one. Update the expiry date if it’s changed. The old file can be recovered for 30 days.',
  removeConfirm: 'Remove this document? The file can be recovered for 30 days by asking support.',
} as const

export const ORG_COMPLIANCE_MESSAGES = {
  noAccess: 'Only an admin can open insurance & accreditations.',
  sectionFull: `A section can hold up to ${ORG_COMPLIANCE_MAX_PER_SECTION} documents. Remove an old one first.`,
  missing: 'This document was removed on another device.',
  docType: 'Choose a document type.',
  title: 'Enter a name.',
  titleLong: `Name can be up to ${ORG_COMPLIANCE_FIELD_LIMITS.title} characters.`,
  issuerLong: `This can be up to ${ORG_COMPLIANCE_FIELD_LIMITS.issuer} characters.`,
  referenceLong: `This can be up to ${ORG_COMPLIANCE_FIELD_LIMITS.reference} characters.`,
  cover: 'Enter the cover as a whole amount, or leave it empty.',
  expiry: 'Enter the expiry date as a date, or turn off “Has an expiry date”.',
  expiryFar: `The expiry date can be at most ${ORG_COMPLIANCE_MAX_YEARS_AHEAD} years ahead.`,
} as const

export type OrgComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'no_expiry'
export type OrgComplianceTone = 'green' | 'amber' | 'red' | 'grey'

/** Display order inside a section: things needing action first. */
export const ORG_COMPLIANCE_STATUS_ORDER: readonly OrgComplianceStatus[] = ['expired', 'expiring_soon', 'valid', 'no_expiry']

export type OrgComplianceEntry = {
  id: string
  section: OrgComplianceSectionKey
  docType: string
  title: string
  issuer: string
  reference: string
  /** Whole units of the organisation currency; insurance only; null when not given. */
  coverAmount: number | null
  /** `YYYY-MM-DD` organisation-zone day key (the last valid day), or null. */
  expiresOn: string | null
  path: string
  fileName: string
  contentType: string
  sizeBytes: number | null
  uploadedAtMs: number | null
  uploadedBy: string
  updatedAtMs: number | null
  updatedBy: string
}

export type OrgComplianceDocuments = Record<OrgComplianceSectionKey, OrgComplianceEntry[]>

export type OrgComplianceDetails = {
  docType: unknown
  title: unknown
  issuer?: unknown
  reference?: unknown
  coverAmount?: unknown
  expiresOn?: unknown
}

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

function graphemeLength(value: string): number {
  return Array.from(value).length
}

export function isOrgComplianceSectionKey(value: unknown): value is OrgComplianceSectionKey {
  return typeof value === 'string' && (ORG_COMPLIANCE_SECTION_KEYS as readonly string[]).includes(value)
}

export function orgComplianceSection(key: unknown): OrgComplianceSection | null {
  return ORG_COMPLIANCE_SECTIONS.find((section) => section.key === key) ?? null
}

/** The type's label ("Public liability"), else the stored key, else "Document". */
export function orgComplianceDocTypeLabel(section: unknown, docType: unknown): string {
  const type = orgComplianceSection(section)?.documentTypes.find((t) => t.key === docType)
  return type?.label ?? (text(docType) || 'Document')
}

/**
 * Who sees and changes the organisation's insurance & accreditations: admins and super admins of the organisation
 * (`permissionLevelOf` = admin; an admin has no operative mode). Managers and operatives never. The same people the
 * security rules let read and write the document (`orgAdminEither`) and the Storage folder (`orgFileAdmin`).
 */
export function canManageOrganizationCompliance(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  return permissionLevelOf(user) === 'admin'
}

/** An organisation id these paths accept (security review of #441): letters, digits, `_` and `-`, 1–128 characters. */
export const ORG_COMPLIANCE_ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/** The organisation id, or null when it cannot be one (so no path is ever built from `..`, `%2F` or a query). */
export function orgComplianceOrganizationId(organizationId: unknown): string | null {
  const org = text(organizationId)
  return ORG_COMPLIANCE_ORG_ID_PATTERN.test(org) ? org : null
}

/** `organizations/{orgId}/orgCompliance/documents`, or null for an unusable id. */
export function orgComplianceDocumentPath(organizationId: unknown): string | null {
  const org = orgComplianceOrganizationId(organizationId)
  if (!org) return null
  return `organizations/${encodeURIComponent(org)}/${ORG_COMPLIANCE_COLLECTION}/${ORG_COMPLIANCE_DOCUMENT_ID}`
}

/** The Storage folder `organizations/{orgId}/compliance`, or null. */
export function orgComplianceFolder(organizationId: unknown): string | null {
  const org = orgComplianceOrganizationId(organizationId)
  if (!org) return null
  return `organizations/${encodeURIComponent(org)}/compliance`
}

/** A new upload's Storage path `{folder}/{uid}_{unixMs}.{ext}` (§24). Null when a part cannot be a path. */
export function orgComplianceStoragePath(input: {
  organizationId: unknown
  uid: unknown
  unixMs: number
  extension?: string | null
}): string | null {
  const folder = orgComplianceFolder(input.organizationId)
  const uid = text(input.uid)
  if (!folder || !uid || !/^[A-Za-z0-9-]+$/.test(uid)) return null
  const ms = Math.floor(Number(input.unixMs))
  if (!Number.isFinite(ms) || ms < 0) return null
  const ext = text(input.extension).toLowerCase().replace(/^\.+/, '').replace(/[^a-z0-9]/g, '')
  return ext ? `${folder}/${uid}_${ms}.${ext}` : `${folder}/${uid}_${ms}`
}

/** Whether a stored path is a file directly in this organisation's compliance folder (org id without case). */
export function orgCompliancePathBelongsTo(path: unknown, organizationId: unknown): boolean {
  const value = text(path)
  if (!value || value.includes('..') || value.includes('//')) return false
  const parts = value.split('/')
  if (parts.length !== 4 || parts[0] !== 'organizations' || parts[2] !== 'compliance' || !parts[3]) return false
  if (!ORG_COMPLIANCE_ORG_ID_PATTERN.test(parts[1])) return false
  const org = text(organizationId)
  return !org || normalizeDocumentId(parts[1]) === normalizeDocumentId(org)
}

/** An expiry as typed or stored: '' / null → null; a valid `YYYY-MM-DD` → itself; anything else → undefined. */
export function normalizeOrgComplianceExpiry(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  const raw = text(value)
  if (!raw) return null
  return validDayKey(raw) ? raw : undefined
}

/** A cover as typed or stored: '' / null → null; a whole number 0…1,000,000,000 → itself; anything else → undefined. */
export function normalizeOrgComplianceCover(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const raw = value.replace(/[£$€,\s]/g, '')
    if (!raw) return null
    if (!/^\d+$/.test(raw)) return undefined
    value = Number(raw)
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > ORG_COMPLIANCE_COVER_MAX) return undefined
  return value
}

/**
 * The first problem with a document's details (in form order), else null. `todayKey` is today in the organisation
 * zone; past expiry dates are allowed, at most `ORG_COMPLIANCE_MAX_YEARS_AHEAD` years ahead. Only insurance takes a
 * cover. Lengths are counted in characters.
 */
export function orgComplianceDetailsError(section: unknown, details: OrgComplianceDetails, todayKey: string): string | null {
  const sec = orgComplianceSection(section)
  if (!sec) return ORG_COMPLIANCE_MESSAGES.docType
  if (!sec.documentTypes.some((t) => t.key === details.docType)) return ORG_COMPLIANCE_MESSAGES.docType
  const title = text(details.title)
  if (!title) return ORG_COMPLIANCE_MESSAGES.title
  if (graphemeLength(title) > ORG_COMPLIANCE_FIELD_LIMITS.title) return ORG_COMPLIANCE_MESSAGES.titleLong
  if (graphemeLength(text(details.issuer)) > ORG_COMPLIANCE_FIELD_LIMITS.issuer) return ORG_COMPLIANCE_MESSAGES.issuerLong
  if (graphemeLength(text(details.reference)) > ORG_COMPLIANCE_FIELD_LIMITS.reference) return ORG_COMPLIANCE_MESSAGES.referenceLong
  if (sec.coverLabel && normalizeOrgComplianceCover(details.coverAmount) === undefined) return ORG_COMPLIANCE_MESSAGES.cover
  const expiry = normalizeOrgComplianceExpiry(details.expiresOn)
  if (expiry === undefined) return ORG_COMPLIANCE_MESSAGES.expiry
  if (expiry && validDayKey(todayKey)) {
    const limit = `${Number(todayKey.slice(0, 4)) + ORG_COMPLIANCE_MAX_YEARS_AHEAD}${todayKey.slice(4)}`
    if (expiry > limit) return ORG_COMPLIANCE_MESSAGES.expiryFar
  }
  return null
}

function cleanDetails(section: OrgComplianceSection, details: OrgComplianceDetails) {
  return {
    docType: text(details.docType),
    title: text(details.title),
    issuer: text(details.issuer),
    reference: text(details.reference),
    coverAmount: section.coverLabel ? (normalizeOrgComplianceCover(details.coverAmount) ?? null) : null,
    expiresOn: normalizeOrgComplianceExpiry(details.expiresOn) ?? null,
  }
}

function parseEntry(entry: unknown, index: number, section: OrgComplianceSection, organizationId: string | null): OrgComplianceEntry | null {
  const row = record(entry)
  const path = text(row.path)
  if (!orgCompliancePathBelongsTo(path, organizationId)) return null
  const size = Number(row.sizeBytes)
  const cover = section.coverLabel ? normalizeOrgComplianceCover(row.coverAmount) : null
  const docType = text(row.docType) || section.documentTypes[section.documentTypes.length - 1].key
  return {
    id: text(row.id) || derivedRowId(organizationId ?? '', `documents.${section.key}`, index, [path]),
    section: section.key,
    docType,
    title: text(row.title) || orgComplianceDocTypeLabel(section.key, docType),
    issuer: text(row.issuer),
    reference: text(row.reference),
    coverAmount: cover ?? null,
    // A stored expiry that is not a date reads as none (never drops the row).
    expiresOn: normalizeOrgComplianceExpiry(row.expiresOn) ?? null,
    path,
    fileName: text(row.fileName) || path.split('/').pop() || 'Document',
    contentType: text(row.contentType),
    sizeBytes: Number.isFinite(size) && size >= 0 ? size : null,
    uploadedAtMs: documentInstantMs(row.uploadedAtMs),
    uploadedBy: text(row.uploadedBy),
    updatedAtMs: documentInstantMs(row.updatedAtMs),
    updatedBy: text(row.updatedBy),
  }
}

/**
 * Read the organisation's documents. Every entry must point at a file in this organisation's compliance folder (a
 * URL, another organisation's file or junk is dropped; a duplicate path once); an unknown type or a missing name is
 * read as the section's "Other" / the type's label, never dropped. A missing document reads as three empty lists.
 */
export function parseOrgComplianceDocuments(
  data: Record<string, unknown> | null | undefined,
  options?: { organizationId?: string | null } | null
): OrgComplianceDocuments {
  const out: OrgComplianceDocuments = { insurance: [], trade: [], quality: [] }
  const documents = record(record(data).documents)
  const org = text(options?.organizationId) || null
  for (const section of ORG_COMPLIANCE_SECTIONS) {
    const list = Array.isArray(documents[section.key]) ? (documents[section.key] as unknown[]) : []
    const seen = new Set<string>()
    list.forEach((entry, index) => {
      const parsed = parseEntry(entry, index, section, org)
      if (!parsed || seen.has(parsed.path)) return
      seen.add(parsed.path)
      out[section.key].push(parsed)
    })
  }
  return out
}

export type OrgComplianceWrite = { section: OrgComplianceSectionKey; value: Record<string, unknown>[] }

function storedList(stored: Record<string, unknown> | null | undefined, section: OrgComplianceSectionKey): Record<string, unknown>[] {
  const list = record(record(stored).documents)[section]
  return Array.isArray(list) ? list.map((row) => record(row)) : []
}

function indexOfEntry(list: Record<string, unknown>[], section: OrgComplianceSectionKey, organizationId: string, entryId: string): number {
  return list.findIndex((row, i) => {
    const id = text(row.id) || derivedRowId(organizationId, `documents.${section}`, i, [text(row.path)])
    return normalizeDocumentId(id) === normalizeDocumentId(entryId)
  })
}

export type OrgComplianceFileInput = {
  path: string
  fileName: string
  contentType?: string | null
  sizeBytes?: number | null
  uploadedAtMs: number
  uploadedBy: string
}

function fileFields(file: OrgComplianceFileInput) {
  const size = Number(file.sizeBytes)
  const at = Math.floor(Number(file.uploadedAtMs))
  return {
    path: text(file.path),
    fileName: text(file.fileName) || text(file.path).split('/').pop() || 'Document',
    contentType: text(file.contentType),
    sizeBytes: Number.isFinite(size) && size >= 0 ? size : null,
    uploadedAtMs: Number.isFinite(at) ? at : null,
    uploadedBy: text(file.uploadedBy),
  }
}

/**
 * Add an uploaded document (from the STORED document, in a transaction). `alreadyLinked`: a first attempt committed —
 * never delete that file; `refused`: the section is full (the uploader deletes the file again); `invalid`: the
 * details, path or uploader are not valid (`error` says which detail).
 */
export function orgComplianceAddWriteFields(
  stored: Record<string, unknown> | null | undefined,
  input: {
    section: OrgComplianceSectionKey
    organizationId: string
    todayKey: string
    details: OrgComplianceDetails
    file: OrgComplianceFileInput
    id?: string | null
  }
): { set: OrgComplianceWrite | null; outcome: 'added' | 'alreadyLinked' | 'refused' | 'invalid'; error: string | null } {
  const section = orgComplianceSection(input.section)
  if (!section) return { set: null, outcome: 'invalid', error: ORG_COMPLIANCE_MESSAGES.docType }
  const error = orgComplianceDetailsError(section.key, input.details, input.todayKey)
  if (error) return { set: null, outcome: 'invalid', error }
  const file = fileFields(input.file)
  if (!orgCompliancePathBelongsTo(file.path, input.organizationId) || !file.uploadedBy) return { set: null, outcome: 'invalid', error: null }
  const list = storedList(stored, section.key)
  if (list.some((row) => text(row.path) === file.path)) return { set: null, outcome: 'alreadyLinked', error: null }
  if (list.length >= ORG_COMPLIANCE_MAX_PER_SECTION) return { set: null, outcome: 'refused', error: ORG_COMPLIANCE_MESSAGES.sectionFull }
  const entry = {
    id: text(input.id) || derivedRowId(input.organizationId, `documents.${section.key}`, list.length, [file.path]),
    ...cleanDetails(section, input.details),
    ...file,
    updatedAtMs: file.uploadedAtMs,
    updatedBy: file.uploadedBy,
  }
  return { set: { section: section.key, value: [...list, entry] }, outcome: 'added', error: null }
}

/** Edit one document's details (stored fields kept). `set` null when unchanged, missing or invalid. */
export function orgComplianceUpdateWriteFields(
  stored: Record<string, unknown> | null | undefined,
  input: {
    section: OrgComplianceSectionKey
    organizationId: string
    entryId: string
    todayKey: string
    details: OrgComplianceDetails
    updatedAtMs: number
    updatedBy: string
  }
): { set: OrgComplianceWrite | null; outcome: 'changed' | 'unchanged' | 'missing' | 'invalid'; error: string | null } {
  const section = orgComplianceSection(input.section)
  if (!section) return { set: null, outcome: 'invalid', error: ORG_COMPLIANCE_MESSAGES.docType }
  const error = orgComplianceDetailsError(section.key, input.details, input.todayKey)
  if (error) return { set: null, outcome: 'invalid', error }
  const list = storedList(stored, section.key)
  const index = indexOfEntry(list, section.key, input.organizationId, input.entryId)
  if (index < 0) return { set: null, outcome: 'missing', error: ORG_COMPLIANCE_MESSAGES.missing }
  const line = list[index]
  const next = cleanDetails(section, input.details)
  const current = cleanDetails(section, line as OrgComplianceDetails)
  if (JSON.stringify(current) === JSON.stringify(next)) return { set: null, outcome: 'unchanged', error: null }
  const value = [...list]
  value[index] = { ...line, ...next, updatedAtMs: Math.floor(Number(input.updatedAtMs)) || null, updatedBy: text(input.updatedBy) }
  return { set: { section: section.key, value }, outcome: 'changed', error: null }
}

/**
 * Replace one document's file (a renewal), with its details as edited in the same form. The entry keeps its id;
 * `replacedPath` is the old file, which the app deletes (admins: kept 30 days by the bucket's soft delete, §24).
 */
export function orgComplianceReplaceWriteFields(
  stored: Record<string, unknown> | null | undefined,
  input: {
    section: OrgComplianceSectionKey
    organizationId: string
    entryId: string
    todayKey: string
    details: OrgComplianceDetails
    file: OrgComplianceFileInput
  }
): { set: OrgComplianceWrite | null; outcome: 'replaced' | 'alreadyLinked' | 'missing' | 'invalid'; replacedPath: string | null; error: string | null } {
  const section = orgComplianceSection(input.section)
  if (!section) return { set: null, outcome: 'invalid', replacedPath: null, error: ORG_COMPLIANCE_MESSAGES.docType }
  const error = orgComplianceDetailsError(section.key, input.details, input.todayKey)
  if (error) return { set: null, outcome: 'invalid', replacedPath: null, error }
  const file = fileFields(input.file)
  if (!orgCompliancePathBelongsTo(file.path, input.organizationId) || !file.uploadedBy) {
    return { set: null, outcome: 'invalid', replacedPath: null, error: null }
  }
  const list = storedList(stored, section.key)
  const index = indexOfEntry(list, section.key, input.organizationId, input.entryId)
  if (index < 0) return { set: null, outcome: 'missing', replacedPath: null, error: ORG_COMPLIANCE_MESSAGES.missing }
  const line = list[index]
  if (text(line.path) === file.path) return { set: null, outcome: 'alreadyLinked', replacedPath: null, error: null }
  const value = [...list]
  // A stored entry without an id keeps its derived id from now on (written onto it).
  const id = text(line.id) || derivedRowId(input.organizationId, `documents.${section.key}`, index, [text(line.path)])
  value[index] = { ...line, id, ...cleanDetails(section, input.details), ...file, updatedAtMs: file.uploadedAtMs, updatedBy: file.uploadedBy }
  return { set: { section: section.key, value }, outcome: 'replaced', replacedPath: text(line.path) || null, error: null }
}

/** Remove one document from its section. `removedPath` is its file (null when already gone; then `set` is null). */
export function orgComplianceRemoveWriteFields(
  stored: Record<string, unknown> | null | undefined,
  input: { section: OrgComplianceSectionKey; organizationId: string; entryId: string }
): { set: OrgComplianceWrite | null; removedPath: string | null } {
  if (!isOrgComplianceSectionKey(input.section)) return { set: null, removedPath: null }
  const list = storedList(stored, input.section)
  const index = indexOfEntry(list, input.section, input.organizationId, input.entryId)
  if (index < 0) return { set: null, removedPath: null }
  return {
    set: { section: input.section, value: list.filter((_, i) => i !== index) },
    removedPath: text(list[index].path) || null,
  }
}

/**
 * The merge-set payload of one write: `{ documents: { [section]: list } }` (a nested map, never a dotted key, so it
 * works whether or not the document exists yet). The app adds `updatedAt` and write metadata.
 */
export function orgComplianceMergePayload(write: OrgComplianceWrite): Record<string, unknown> {
  return { documents: { [write.section]: write.value } }
}

export type OrgComplianceExpiryStatus = {
  status: OrgComplianceStatus
  tone: OrgComplianceTone
  /** Days from today (organisation zone) to the expiry day; negative once expired; null with no expiry. */
  daysToExpiry: number | null
  label: string
}

/** Today's organisation-zone day key. */
export function orgComplianceTodayKey(nowMs: number, timeZone?: string | null): string {
  return holidayDocumentDayKey(Number.isFinite(nowMs) ? nowMs : Date.now(), timeZone)
}

/**
 * The one status rule (brief §5): no expiry → "No expiry date" (grey); before today → "Expired 3 Oct 2026" (red);
 * within `ORG_COMPLIANCE_EXPIRING_SOON_DAYS` → "20 days left · 14 Dec 2026" / "1 day left · …" / "Expires today"
 * (amber); later → "Valid to 31 Mar 2027" (green). The expiry date is the last valid day.
 */
export function orgComplianceExpiryStatus(expiresOn: unknown, todayKey: string): OrgComplianceExpiryStatus {
  const expiry = normalizeOrgComplianceExpiry(expiresOn)
  if (!expiry || !validDayKey(todayKey)) return { status: 'no_expiry', tone: 'grey', daysToExpiry: null, label: 'No expiry date' }
  const days = calendarDaysBetween(todayKey, expiry)
  const date = subcontractorDocumentExpiryDateText(expiry)
  if (days < 0) return { status: 'expired', tone: 'red', daysToExpiry: days, label: `Expired ${date}` }
  if (days <= ORG_COMPLIANCE_EXPIRING_SOON_DAYS) {
    const label = days === 0 ? 'Expires today' : days === 1 ? `1 day left · ${date}` : `${days} days left · ${date}`
    return { status: 'expiring_soon', tone: 'amber', daysToExpiry: days, label }
  }
  return { status: 'valid', tone: 'green', daysToExpiry: days, label: `Valid to ${date}` }
}

/** A section's entries in display order: expired, expiring soon, valid, no expiry; then expiry date; then name. */
export function orgComplianceSortedEntries(entries: readonly OrgComplianceEntry[], todayKey: string): OrgComplianceEntry[] {
  const rank = (entry: OrgComplianceEntry) => ORG_COMPLIANCE_STATUS_ORDER.indexOf(orgComplianceExpiryStatus(entry.expiresOn, todayKey).status)
  return [...entries].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.expiresOn ?? '').localeCompare(b.expiresOn ?? '') ||
      a.title.localeCompare(b.title, 'en-GB', { sensitivity: 'base' })
  )
}

export type OrgComplianceCounts = { total: number; expiringSoon: number; expired: number; attention: number }

export function orgComplianceCounts(documents: OrgComplianceDocuments | null | undefined, todayKey: string): OrgComplianceCounts {
  const counts: OrgComplianceCounts = { total: 0, expiringSoon: 0, expired: 0, attention: 0 }
  for (const key of ORG_COMPLIANCE_SECTION_KEYS) {
    for (const entry of documents?.[key] ?? []) {
      counts.total += 1
      const status = orgComplianceExpiryStatus(entry.expiresOn, todayKey).status
      if (status === 'expiring_soon') counts.expiringSoon += 1
      if (status === 'expired') counts.expired += 1
    }
  }
  counts.attention = counts.expiringSoon + counts.expired
  return counts
}

/** The hub row's subtitle: "PI, PL, trade and ISO certificates" / "6 documents" / "6 documents · 2 need attention". */
export function orgComplianceHubSubtitle(counts: OrgComplianceCounts | null | undefined): string {
  const total = counts?.total ?? 0
  if (!total) return 'PI, PL, trade and ISO certificates'
  const docs = `${total} document${total === 1 ? '' : 's'}`
  const attention = counts?.attention ?? 0
  return attention ? `${docs} · ${attention} need${attention === 1 ? 's' : ''} attention` : docs
}

/** Cover in the organisation currency, whole units ("£10,000,000"); '' when none. */
export function orgComplianceCoverText(amount: number | null | undefined, currency: unknown): string {
  return typeof amount === 'number' && Number.isFinite(amount) ? formatMoney(amount, currency, { decimals: 0 }) : ''
}

// ── One stored file name (review of #441: both apps store the same name) ─────────────────────────────────────────

/**
 * The file name stored on an entry: the picked file's name with its extension changed to the stored object's (a
 * photo redrawn to JPEG, "Site.heic" → "Site.jpg"; `jpeg` and `jpg` count as one), trimmed and without path parts;
 * the object name when nothing was picked. At most 200 characters.
 */
export function orgComplianceFileName(pickedName: unknown, storedPath: unknown): string {
  const objectName = text(storedPath).split('/').pop() || 'Document'
  const picked = text(pickedName).split(/[\\/]/).pop()?.trim() ?? ''
  if (!picked) return objectName
  const ext = (name: string) => {
    const dot = name.lastIndexOf('.')
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  }
  const storedExt = ext(objectName)
  const ownExt = ext(picked)
  const norm = (e: string) => (e === 'jpeg' ? 'jpg' : e)
  let name = picked
  if (storedExt && norm(ownExt) !== norm(storedExt)) {
    const base = ownExt ? picked.slice(0, picked.length - ownExt.length - 1) : picked
    name = `${base}.${storedExt}`
  }
  return Array.from(name).slice(0, 200).join('')
}

// ── Expiry reminder (Home card for admins) ──────────────────────────────────────────────────────────────────────

export type OrgComplianceReminder = { count: number; expired: number; expiringSoon: number; title: string; detail: string }

/**
 * The admins' Home reminder from `orgComplianceCounts` (the one status rule): null when nothing is expired or expiring
 * within `ORG_COMPLIANCE_EXPIRING_SOON_DAYS`; else "2 certificates need attention" / "1 expired · 1 expiring within
 * 30 days".
 */
export function orgComplianceReminder(counts: OrgComplianceCounts | null | undefined): OrgComplianceReminder | null {
  const expired = counts?.expired ?? 0
  const expiringSoon = counts?.expiringSoon ?? 0
  const count = expired + expiringSoon
  if (!count) return null
  const parts = [
    expired ? `${expired} expired` : '',
    expiringSoon ? `${expiringSoon} expiring within ${ORG_COMPLIANCE_EXPIRING_SOON_DAYS} days` : '',
  ].filter(Boolean)
  return {
    count,
    expired,
    expiringSoon,
    title: `${count} insurance or accreditation certificate${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`,
    detail: parts.join(' · '),
  }
}

// ── Zip download of selected documents ──────────────────────────────────────────────────────────────────────────

export const ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS = 50
/** A zip is built on the device, so its total size is capped (security review of #441): 200 MB. */
export const ORG_COMPLIANCE_ZIP_MAX_BYTES = 200 * 1024 * 1024
export const ORG_COMPLIANCE_ZIP_TOO_LARGE_MESSAGE = 'These documents are too large for one zip (200 MB). Choose fewer.'

/**
 * One file name per selected entry inside a zip, in the order given: the stored file name made safe for a zip (no
 * path parts or control characters), a second entry with the same name gets " (2)" before its extension.
 */
export function orgComplianceZipEntryNames(entries: readonly { fileName: string; title?: string }[]): string[] {
  const used = new Set<string>()
  return entries.map((entry) => {
    const raw = text(entry.fileName) || text(entry.title) || 'Document'
    const safe = raw.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_').replace(/^\.+/, '_').slice(0, 150) || 'Document'
    const dot = safe.lastIndexOf('.')
    const base = dot > 0 ? safe.slice(0, dot) : safe
    const ext = dot > 0 ? safe.slice(dot) : ''
    let name = safe
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${base} (${n})${ext}`
    used.add(name.toLowerCase())
    return name
  })
}

/** "Insurance-and-accreditations-2026-11-24.zip". */
export function orgComplianceZipFileName(todayKey: string): string {
  return `Insurance-and-accreditations-${validDayKey(todayKey) ? todayKey : 'documents'}.zip`
}

// ── Share links (7 days, public read-only page) ─────────────────────────────────────────────────────────────────

export const ORG_COMPLIANCE_SHARE_LINK_DAYS = 7
export const ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS = 20
/** Top-level, server-only (no security rule: default deny). The document id is the sha256 of the token. */
export const ORG_COMPLIANCE_SHARE_LINKS_COLLECTION = 'complianceShareLinks'
/** Top-level, server-only audit rows: link created, revoked, opened, file opened. */
export const ORG_COMPLIANCE_AUDIT_COLLECTION = 'complianceAudit'
/** How long a signed file link from a share page lasts. */
export const ORG_COMPLIANCE_SIGNED_URL_SECONDS = 60

export const ORG_COMPLIANCE_SHARE_MESSAGES = {
  none: 'Choose at least one document to share.',
  tooMany: `Share up to ${ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS} documents in one link.`,
  gone: 'This link has expired or been turned off. Ask the company for a new one.',
  helper: `Anyone with the link can view and download the chosen documents for ${ORG_COMPLIANCE_SHARE_LINK_DAYS} days, or until you turn the link off.`,
} as const

export type OrgComplianceDocumentRef = { section: OrgComplianceSectionKey; id: string }

/** `insurance:abc` → a ref (null when unusable). */
export function parseOrgComplianceDocumentRef(value: unknown): OrgComplianceDocumentRef | null {
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    if (isOrgComplianceSectionKey(row.section) && text(row.id) && !text(row.id).includes('/')) return { section: row.section, id: text(row.id) }
    return null
  }
  const raw = text(value)
  const at = raw.indexOf(':')
  if (at < 0) return null
  const section = raw.slice(0, at)
  const id = raw.slice(at + 1)
  return isOrgComplianceSectionKey(section) && id && !id.includes('/') && id.length <= 200 ? { section, id } : null
}

export function orgComplianceDocumentRefKey(ref: OrgComplianceDocumentRef): string {
  return `${ref.section}:${ref.id}`
}

function findEntry(documents: OrgComplianceDocuments, ref: OrgComplianceDocumentRef): OrgComplianceEntry | null {
  return documents[ref.section].find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(ref.id)) ?? null
}

/**
 * The documents a new link may share: each ref must name a stored entry (refs to removed documents are dropped), once,
 * 1–`ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS`. `error` when none is left or too many were asked for.
 */
export function orgComplianceShareSelection(
  documents: OrgComplianceDocuments,
  refs: readonly unknown[]
): { refs: OrgComplianceDocumentRef[]; error: string | null } {
  if (refs.length > ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS) return { refs: [], error: ORG_COMPLIANCE_SHARE_MESSAGES.tooMany }
  const out: OrgComplianceDocumentRef[] = []
  const seen = new Set<string>()
  for (const value of refs) {
    const ref = parseOrgComplianceDocumentRef(value)
    const entry = ref ? findEntry(documents, ref) : null
    if (!ref || !entry) continue
    const key = orgComplianceDocumentRefKey({ section: ref.section, id: entry.id })
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ section: ref.section, id: entry.id })
  }
  return { refs: out, error: out.length ? null : ORG_COMPLIANCE_SHARE_MESSAGES.none }
}

export type OrgComplianceShareLink = {
  id: string
  organizationId: string
  documents: OrgComplianceDocumentRef[]
  createdBy: string
  createdAtMs: number | null
  expiresAtMs: number | null
  revokedAtMs: number | null
  openCount: number
  lastOpenedAtMs: number | null
}

/** Reads a `complianceShareLinks` document (server side). Never throws. */
export function parseOrgComplianceShareLink(id: unknown, data: Record<string, unknown> | null | undefined): OrgComplianceShareLink | null {
  const row = record(data)
  const org = text(row.organizationId)
  if (!text(id) || !org) return null
  const docs = Array.isArray(row.documents) ? row.documents.map(parseOrgComplianceDocumentRef).filter((r): r is OrgComplianceDocumentRef => r !== null) : []
  // Stored as epoch milliseconds by the server; a Timestamp or ISO string reads too.
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : documentInstantMs(value))
  return {
    id: text(id),
    organizationId: org,
    documents: docs,
    createdBy: text(row.createdBy),
    createdAtMs: num(row.createdAtMs),
    expiresAtMs: num(row.expiresAtMs),
    revokedAtMs: num(row.revokedAtMs),
    openCount: Number.isFinite(Number(row.openCount)) ? Math.max(0, Math.floor(Number(row.openCount))) : 0,
    lastOpenedAtMs: num(row.lastOpenedAtMs),
  }
}

/** `active` until `expiresAtMs` and while not revoked; a link with no expiry is never active. */
export function orgComplianceShareLinkState(link: OrgComplianceShareLink | null, nowMs: number): 'active' | 'expired' | 'revoked' {
  if (!link || link.expiresAtMs == null) return 'expired'
  if (link.revokedAtMs != null) return 'revoked'
  return nowMs < link.expiresAtMs ? 'active' : 'expired'
}

/** The stored fields of a new link (the server adds nothing else; the id is sha256 of the token). */
export function orgComplianceShareLinkCreateFields(input: {
  organizationId: string
  documents: readonly OrgComplianceDocumentRef[]
  createdBy: string
  nowMs: number
}): Record<string, unknown> {
  const expiresAtMs = input.nowMs + ORG_COMPLIANCE_SHARE_LINK_DAYS * 24 * 60 * 60 * 1000
  return {
    organizationId: input.organizationId,
    documents: input.documents.map(orgComplianceDocumentRefKey),
    createdBy: input.createdBy,
    createdAtMs: input.nowMs,
    expiresAtMs,
    revokedAtMs: null,
    openCount: 0,
    lastOpenedAtMs: null,
  }
}

/** The public share page's path for a token. */
export function orgComplianceSharePath(token: string): string {
  return `/shared/compliance/${encodeURIComponent(token)}`
}

export type OrgCompliancePublicDocument = {
  key: string
  sectionTitle: string
  typeLabel: string
  title: string
  issuer: string
  issuerLabel: string
  reference: string
  referenceLabel: string
  cover: string
  coverLabel: string | null
  statusLabel: string
  tone: OrgComplianceTone
  contentType: string
}

/**
 * What the public share page shows: only the linked documents still stored, with their own fields — never who
 * uploaded or changed them, never a storage path. Status by the same rule as the app (`orgComplianceExpiryStatus`).
 */
export function orgCompliancePublicDocuments(
  documents: OrgComplianceDocuments,
  refs: readonly OrgComplianceDocumentRef[],
  todayKey: string,
  currency: unknown
): OrgCompliancePublicDocument[] {
  const out: OrgCompliancePublicDocument[] = []
  for (const ref of refs) {
    const entry = findEntry(documents, ref)
    const section = orgComplianceSection(ref.section)
    if (!entry || !section) continue
    const status = orgComplianceExpiryStatus(entry.expiresOn, todayKey)
    out.push({
      key: orgComplianceDocumentRefKey({ section: section.key, id: entry.id }),
      sectionTitle: section.title,
      typeLabel: orgComplianceDocTypeLabel(section.key, entry.docType),
      title: entry.title,
      issuer: entry.issuer,
      issuerLabel: section.issuerLabel,
      reference: entry.reference,
      referenceLabel: section.referenceLabel,
      cover: section.coverLabel ? orgComplianceCoverText(entry.coverAmount, currency) : '',
      coverLabel: section.coverLabel,
      statusLabel: status.label,
      tone: status.tone,
      contentType: entry.contentType,
    })
  }
  return out
}

/** The stored entry a share link's file key names, only when the link shares it (server side). */
export function orgComplianceSharedEntry(
  documents: OrgComplianceDocuments,
  link: OrgComplianceShareLink,
  key: unknown
): OrgComplianceEntry | null {
  const ref = parseOrgComplianceDocumentRef(key)
  if (!ref) return null
  const shared = link.documents.some(
    (item) => item.section === ref.section && normalizeDocumentId(item.id) === normalizeDocumentId(ref.id)
  )
  return shared ? findEntry(documents, ref) : null
}

/**
 * Whether any stored entry's file is `path` (review of #441, the §22 `alreadyLinked` pattern): after a failed save the
 * app re-reads the document from the server and deletes the file it just uploaded only when this is false — a save
 * that committed while the app saw an error never loses its file.
 */
export function orgCompliancePathLinked(stored: Record<string, unknown> | null | undefined, path: unknown): boolean {
  const target = text(path)
  if (!target) return false
  const documents = record(record(stored).documents)
  return ORG_COMPLIANCE_SECTION_KEYS.some((key) => {
    const list = documents[key]
    return Array.isArray(list) && list.some((row) => text(record(row).path) === target)
  })
}

/**
 * Whether a share link of this organisation may still be opened: not scheduled for deletion or erased (§20) and the
 * subscription open (§19: `hasAccess`, and the `billing.accessOpen` / `accessClosesAt` the security rules read).
 */
export function orgComplianceShareOpen(org: unknown, nowMs: number): boolean {
  if (!org || typeof org !== 'object') return false
  if (organizationDeletionState(org, nowMs).state !== 'active') return false
  const raw = (org as Record<string, unknown>).billing
  const billing = record(raw)
  // Missing billing is open (trials and companies created before billing), as `hasAccess`.
  if (raw && typeof raw === 'object' && !hasAccess(billing as Parameters<typeof hasAccess>[0], nowMs)) return false
  if (billing.accessOpen === false) return false
  const closes = documentInstantMs(billing.accessClosesAt)
  return !(closes != null && nowMs >= closes)
}

/**
 * Whether the admin who made a share link is still an active admin of the organisation (security review of #441,
 * owner to confirm): a link stops working when its creator stops being an admin or is deactivated, as if they had
 * turned it off. Their level in this organisation is `organizationLevelFor` (the users document of this
 * organisation, else their membership here, else the `members` role; the creator always admin); deactivated is the
 * users document of this organisation `isActive: false` or the membership `accountActive` (else `isActive`) false.
 */
export function orgComplianceShareCreatorActive(input: {
  organizationId: string
  createdBy: string
  organization?: Record<string, unknown> | null
  user?: Record<string, unknown> | null
  membership?: Record<string, unknown> | null
}): boolean {
  const uid = text(input.createdBy)
  const org = record(input.organization)
  if (!uid || !input.organization) return false
  const members = record(org.members)
  const level = organizationLevelFor({
    organizationId: input.organizationId,
    userId: uid,
    user: input.user ?? null,
    membership: input.membership ?? null,
    membersRole: members[uid],
    creatorUserId: text(org.creatorUserId) || null,
  })
  if (level.level !== 'admin') return false
  const user = input.user ? record(input.user) : null
  if (user && text(user.organizationId).toLowerCase() === text(input.organizationId).toLowerCase() && user.isActive === false) return false
  const membership = input.membership ? record(input.membership) : null
  if (membership) {
    const active = 'accountActive' in membership ? membership.accountActive : membership.isActive
    if (active === false) return false
  }
  return true
}

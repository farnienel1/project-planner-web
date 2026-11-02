/**
 * Reading and writing the record collections (rulebook §1, §5, §13, 1.8.0): health & safety (toolbox talks, issues,
 * signatures, RAMS, other documents), variations and their tracker, inbox notifications, and `warningResolutions`.
 *
 * Before 1.8.0:
 *   - Health & safety: web stored an issue as `complete` / `scheduled`, iOS only knew `awaiting` / `completed`, so a
 *     finished web issue read as awaiting on iOS. Both apps saved the whole document's arrays, so two people signing
 *     at once lost one signature (last write wins), and a web save dropped iOS-only fields (`ramsDocumentId`,
 *     `reviewDate`, `attachedDocTitles`, `issuableToClient`, `ownerOrganizationId`).
 *   - Variations: both apps minted a random id for a labour, material or evidence line stored without one on every
 *     read; web dropped lines iOS kept; renumbering rewrote whole rows.
 *   - Notifications: the iOS enum lacked `variation` / `variation_renumbered` (and drops any type it does not know),
 *     and read `relatedId` only when it was a UUID.
 *   - `warningResolutions`: older iOS builds stored manager-clash keys with the day as epoch seconds and material
 *     cut-off keys with an epoch; only iOS knew how to read and migrate them.
 *
 * Readers are pure, JSON in / JSON out, never throw; ids keep their stored case.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { derivedRowId } from './derivedIds'
import {
  DEVICE_PUSH_NOTIFICATION_TYPES,
  notificationDestination,
  type NotificationDestination,
} from './notificationPreferences'
import { NOTIFICATION_CATALOG } from './notificationRecipients'
import {
  documentBool,
  documentInstantMs,
  documentNumber,
  documentOrganizationId,
  documentWriteFields,
  type DocumentWriteFields,
} from './peopleDocuments'
import {
  normalizeDocumentId,
  warningResolutionWriteFields,
  type WarningResolutionStatus,
  type WarningResolutionWrite,
} from './scheduleSources'
import type { AccountKind } from './userProfile'
import { deadlineProjectKey } from './workDocumentReaders'

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

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

function idList(value: unknown): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of textList(value)) {
    const key = normalizeDocumentId(id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

function dayKeyOf(ms: number | null, zone: string): string | null {
  return ms == null ? null : dayKeyInZone(new Date(ms), zone)
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

// MARK: - Health & safety

export const HS_ISSUE_STATUSES = ['awaiting', 'scheduled', 'complete'] as const
export type HSIssueStatus = (typeof HS_ISSUE_STATUSES)[number]
export const HS_SIGNATURE_STATUSES = ['pending', 'signed'] as const
export type HSSignatureStatus = (typeof HS_SIGNATURE_STATUSES)[number]

/**
 * The value written for an issue status. A finished issue is stored `completed` — the word every iOS build reads
 * (older web builds read it too) — never `complete`. `awaiting` and `scheduled` are stored as they are (an older iOS
 * build reads `scheduled` as awaiting).
 */
export const HS_ISSUE_STATUS_STORED: Readonly<Record<HSIssueStatus, string>> = {
  awaiting: 'awaiting',
  scheduled: 'scheduled',
  complete: 'completed',
}

/** complete / completed / signed / done → complete; scheduled → scheduled; anything else → awaiting. */
export function normalizeHSIssueStatus(raw: unknown): HSIssueStatus {
  const value = text(raw).toLowerCase()
  if (value === 'complete' || value === 'completed' || value === 'signed' || value === 'done') return 'complete'
  if (value === 'scheduled' || value === 'schedule') return 'scheduled'
  return 'awaiting'
}

/** signed / complete / completed → signed; anything else → pending. */
export function normalizeHSSignatureStatus(raw: unknown): HSSignatureStatus {
  const value = text(raw).toLowerCase()
  return value === 'signed' || value === 'complete' || value === 'completed' ? 'signed' : 'pending'
}

export type HSTalkDocument = {
  id: string
  referenceCode: string | null
  title: string
  category: string
  isGeneral: boolean
  trades: string[]
  purpose: string
  keyPoints: string[]
  source: string
  status: 'draft' | 'approved'
  version: number
  ownerOrganizationId: string | null
  fileURL: string | null
  updatedAtMs: number | null
}

export type HSIssueDocument = {
  id: string
  projectId: string
  talkId: string
  weekCommencingMs: number | null
  weekCommencingDayKey: string | null
  issuedByUserId: string
  issuedAtMs: number | null
  publishAtMs: number | null
  recipientUserIds: string[]
  status: HSIssueStatus
  ramsDocumentId: string | null
}

export type HSSignatureDocument = {
  id: string
  issueId: string
  userId: string
  status: HSSignatureStatus
  readConfirmed: boolean
  signatureImageBase64: string | null
  signedAtMs: number | null
  reminderSentAtMs: number | null
}

export type HSRamsDocumentRow = {
  id: string
  title: string
  trade: string
  version: number
  status: string
  uploadedAtMs: number | null
  fileURL: string | null
  fileName: string | null
  reviewDateMs: number | null
  attachedDocTitles: string[]
}

export type HSOtherDocumentRow = {
  id: string
  title: string
  trade: string | null
  category: string
  uploadedAtMs: number | null
  fileURL: string | null
  fileName: string | null
  issuableToClient: boolean
}

export type HealthSafetyDocument = {
  talks: HSTalkDocument[]
  issues: HSIssueDocument[]
  /** One per issue and person (`healthSafetySignatureKey`), from the `signatures` array and `signatureRecords`. */
  signatures: HSSignatureDocument[]
  ramsDocuments: HSRamsDocumentRow[]
  otherDocuments: HSOtherDocumentRow[]
  updatedAtMs: number | null
}

/**
 * The settings document of a job's health & safety data: `healthSafety_{projects|smallWorks}_{KEY}`, KEY the job's
 * stored document id upper-cased (`deadlineProjectKey`, the same key rule as `deadlinesDocumentId`; what iOS has
 * always written). Never built by parsing the id as a UUID, so a non-UUID job id works.
 */
export function healthSafetyDocumentId(jobId: unknown, isSmallWorks: boolean): string {
  return `healthSafety_${isSmallWorks ? 'smallWorks' : 'projects'}_${deadlineProjectKey(jobId)}`
}

/**
 * Settings document ids to read for a job's health & safety data, written first: `healthSafetyDocumentId`, then the
 * stored-case id older web builds wrote when it differs. Readers merge them (`foldHealthSafetySignatures` keeps every
 * signature); writers write `healthSafetyDocumentId`.
 */
export function healthSafetyDocumentIds(jobId: unknown, isSmallWorks: boolean): string[] {
  const shared = healthSafetyDocumentId(jobId, isSmallWorks)
  const stored = `healthSafety_${isSmallWorks ? 'smallWorks' : 'projects'}_${text(jobId)}`
  return stored === shared || !text(jobId) ? [shared] : [shared, stored]
}

/** Field holding one map entry per signer (1.8.0): `signatureRecords.{healthSafetySignatureKey}`. */
export const HS_SIGNATURE_RECORDS_FIELD = 'signatureRecords'

/**
 * The key of one person's signature on one issue: `{issueId}__{userId}`, both lower case, with any character a
 * Firestore field name segment should not carry replaced by `_`. Two signers never share a key, so concurrent
 * signatures never overwrite each other.
 */
export function healthSafetySignatureKey(issueId: unknown, userId: unknown): string {
  const clean = (value: unknown) => normalizeDocumentId(value).replace(/[^a-z0-9\-]/g, '_')
  const issue = clean(issueId)
  const user = clean(userId)
  return issue && user ? `${issue}__${user}` : ''
}

function parseTalk(row: Record<string, unknown>): HSTalkDocument | null {
  const id = text(row.id) || text(row.referenceCode) || text(row.ref)
  if (!id) return null
  const trades = textList(row.trades)
  return {
    id,
    referenceCode: optionalText(row.referenceCode) ?? optionalText(row.ref),
    title: text(row.title),
    category: text(row.category) || 'general',
    isGeneral: documentBool(row.isGeneral) ?? trades.length === 0,
    trades,
    purpose: text(row.purpose),
    keyPoints: textList(row.keyPoints),
    source: text(row.source) || 'library',
    status: text(row.status).toLowerCase() === 'draft' ? 'draft' : 'approved',
    version: documentNumber(row.version) ?? 1,
    ownerOrganizationId: optionalText(row.ownerOrganizationId),
    fileURL: optionalText(row.fileURL),
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

function parseIssue(row: Record<string, unknown>, projectId: string, zone: string): HSIssueDocument | null {
  const id = text(row.id)
  if (!id) return null
  const weekCommencingMs = documentInstantMs(row.weekCommencing)
  return {
    id,
    projectId: text(row.projectId) || projectId,
    talkId: text(row.talkId),
    weekCommencingMs,
    weekCommencingDayKey: DAY_KEY.test(text(row.weekCommencing)) ? text(row.weekCommencing) : dayKeyOf(weekCommencingMs, zone),
    issuedByUserId: text(row.issuedByUserId),
    issuedAtMs: documentInstantMs(row.issuedAt),
    publishAtMs: documentInstantMs(row.publishAt),
    recipientUserIds: idList(row.recipientUserIds),
    status: normalizeHSIssueStatus(row.status),
    ramsDocumentId: optionalText(row.ramsDocumentId),
  }
}

function parseSignature(row: Record<string, unknown>): HSSignatureDocument | null {
  const issueId = text(row.issueId)
  const userId = text(row.userId)
  if (!issueId || !userId) return null
  return {
    id: text(row.id) || healthSafetySignatureKey(issueId, userId),
    issueId,
    userId,
    status: normalizeHSSignatureStatus(row.status),
    readConfirmed: documentBool(row.readConfirmed) === true,
    signatureImageBase64: optionalText(row.signatureImageBase64),
    signedAtMs: documentInstantMs(row.signedAt),
    reminderSentAtMs: documentInstantMs(row.reminderSentAt),
  }
}

/** Two copies of one person's signature: a signed copy wins; otherwise the later one; keep any image either has. */
function richerSignature(a: HSSignatureDocument, b: HSSignatureDocument): HSSignatureDocument {
  let winner: HSSignatureDocument
  if (a.status === 'signed' && b.status !== 'signed') winner = a
  else if (b.status === 'signed' && a.status !== 'signed') winner = b
  else {
    const at = a.signedAtMs ?? a.reminderSentAtMs ?? 0
    const bt = b.signedAtMs ?? b.reminderSentAtMs ?? 0
    winner = bt >= at ? b : a
  }
  const other = winner === a ? b : a
  return {
    ...winner,
    id: a.id || b.id,
    readConfirmed: winner.readConfirmed || (winner.status === 'signed' && other.readConfirmed),
    signatureImageBase64: winner.signatureImageBase64 ?? other.signatureImageBase64,
    signedAtMs: winner.signedAtMs ?? other.signedAtMs,
    reminderSentAtMs: Math.max(winner.reminderSentAtMs ?? 0, other.reminderSentAtMs ?? 0) || null,
  }
}

/**
 * Fold signature rows (from any number of copies) to one per issue and person, `richerSignature` deciding. The id
 * of the first row seen is kept.
 */
export function foldHealthSafetySignatures(
  signatures: ReadonlyArray<HSSignatureDocument>
): HSSignatureDocument[] {
  const byKey = new Map<string, HSSignatureDocument>()
  for (const signature of signatures || []) {
    const key = healthSafetySignatureKey(signature.issueId, signature.userId)
    if (!key) continue
    const existing = byKey.get(key)
    byKey.set(key, existing ? { ...richerSignature(existing, signature), id: existing.id } : signature)
  }
  return [...byKey.values()].sort((a, b) => (b.signedAtMs ?? 0) - (a.signedAtMs ?? 0))
}

/**
 * Read one health & safety document (`settings/healthSafety_{projects|smallWorks}_{jobId}`, and the web copy at
 * `{projects|smallWorks}/{jobId}/healthSafety/data`). Rows keep their stored ids; an issue keeps an unknown status as
 * awaiting; signatures come from the `signatures` array and the per-signer `signatureRecords` map, folded to one per
 * issue and person (a signed copy always wins). Never throws.
 */
export function parseHealthSafetyDocument(
  data: Record<string, unknown> | null | undefined,
  options?: { projectId?: string | null; timeZone?: string | null } | null
): HealthSafetyDocument {
  const row = record(data)
  const zone = zoneOrLondon(options?.timeZone)
  const projectId = text(options?.projectId)
  const signatures: HSSignatureDocument[] = []
  for (const entry of rows(row.signatures)) {
    const parsed = parseSignature(entry)
    if (parsed) signatures.push(parsed)
  }
  for (const entry of Object.values(record(row[HS_SIGNATURE_RECORDS_FIELD]))) {
    const parsed = parseSignature(record(entry))
    if (parsed) signatures.push(parsed)
  }
  const byUploaded = <T extends { uploadedAtMs: number | null }>(list: T[]) =>
    list.sort((a, b) => (b.uploadedAtMs ?? 0) - (a.uploadedAtMs ?? 0))
  return {
    talks: rows(row.talks).map(parseTalk).filter((talk): talk is HSTalkDocument => talk !== null),
    issues: rows(row.issues)
      .map((entry) => parseIssue(entry, projectId, zone))
      .filter((issue): issue is HSIssueDocument => issue !== null)
      .sort((a, b) => (b.issuedAtMs ?? 0) - (a.issuedAtMs ?? 0)),
    signatures: foldHealthSafetySignatures(signatures),
    ramsDocuments: byUploaded(
      rows(row.ramsDocuments)
        .filter((entry) => text(entry.id))
        .map((entry) => ({
          id: text(entry.id),
          title: text(entry.title) || 'Untitled RAMS',
          trade: text(entry.trade) || 'General',
          version: documentNumber(entry.version) ?? 1,
          status: text(entry.status) || 'live',
          uploadedAtMs: documentInstantMs(entry.uploadedAt),
          fileURL: optionalText(entry.fileURL),
          fileName: optionalText(entry.fileName),
          reviewDateMs: documentInstantMs(entry.reviewDate),
          attachedDocTitles: textList(entry.attachedDocTitles),
        }))
    ),
    otherDocuments: byUploaded(
      rows(row.otherDocuments)
        .filter((entry) => text(entry.id))
        .map((entry) => ({
          id: text(entry.id),
          title: text(entry.title) || 'Untitled H&S doc',
          trade: optionalText(entry.trade),
          category: text(entry.category) || 'trade',
          uploadedAtMs: documentInstantMs(entry.uploadedAt),
          fileURL: optionalText(entry.fileURL),
          fileName: optionalText(entry.fileName),
          issuableToClient: documentBool(entry.issuableToClient) === true,
        }))
    ),
    updatedAtMs: documentInstantMs(row.updatedAt),
  }
}

/** The status an issue takes from its signatures: complete when every recipient signed; a complete issue with an unsigned row is awaiting again. Scheduled stays scheduled. */
export function healthSafetyIssueStatus(
  issue: Pick<HSIssueDocument, 'id' | 'status' | 'recipientUserIds'>,
  signatures: ReadonlyArray<Pick<HSSignatureDocument, 'issueId' | 'userId' | 'status'>>
): HSIssueStatus {
  const own = (signatures || []).filter((row) => normalizeDocumentId(row.issueId) === normalizeDocumentId(issue.id))
  const signed = new Set(own.filter((row) => row.status === 'signed').map((row) => normalizeDocumentId(row.userId)))
  const wanted = new Set([
    ...(issue.recipientUserIds || []).map(normalizeDocumentId),
    ...own.map((row) => normalizeDocumentId(row.userId)),
  ])
  wanted.delete('')
  if (wanted.size > 0 && [...wanted].every((id) => signed.has(id))) return 'complete'
  return issue.status === 'scheduled' ? 'scheduled' : 'awaiting'
}

export type HealthSafetySignatureWrite = {
  /** Field path segments of the per-signer entry: `['signatureRecords', key]` (a field-path update, never a merge-set). */
  fieldPath: [string, string]
  /** The signature row stored at that path (instants pass through as given). */
  value: Record<string, unknown>
  /** The same row, for an `arrayUnion` onto `signatures` so builds that read only the array see it. */
  arrayRow: Record<string, unknown>
}

/**
 * One person signing (or being reminded on) one issue (§1, 1.8.0). Written as a field-path update of
 * `signatureRecords.{key}` (plus an `arrayUnion` of the row onto `signatures` for older builds) in one `update` — never
 * by rewriting the `signatures` array. Concurrent signers write different keys, and a whole-document merge-save from
 * an older build never names `signatureRecords`, so it cannot remove a signature. Null without an issue or user id.
 */
export function healthSafetySignatureWriteFields(input: {
  issueId: unknown
  userId: unknown
  /** Stored id of the pending row, when there is one (kept so tracking screens match it). */
  signatureId?: unknown
  status?: unknown
  readConfirmed?: boolean
  signatureImageBase64?: string | null
  signedAt?: unknown
  reminderSentAt?: unknown
}): HealthSafetySignatureWrite | null {
  const issueId = text(input?.issueId)
  const userId = text(input?.userId)
  const key = healthSafetySignatureKey(issueId, userId)
  if (!key) return null
  const status = normalizeHSSignatureStatus(input?.status ?? 'signed')
  const value: Record<string, unknown> = {
    id: text(input?.signatureId) || key,
    issueId,
    userId,
    status,
    readConfirmed: input?.readConfirmed ?? status === 'signed',
  }
  if (text(input?.signatureImageBase64)) value.signatureImageBase64 = text(input?.signatureImageBase64)
  if (input?.signedAt != null) value.signedAt = input.signedAt
  if (input?.reminderSentAt != null) value.reminderSentAt = input.reminderSentAt
  return { fieldPath: [HS_SIGNATURE_RECORDS_FIELD, key], value, arrayRow: { ...value } }
}

export const HEALTH_SAFETY_ARRAY_FIELDS = ['talks', 'issues', 'signatures', 'ramsDocuments', 'otherDocuments'] as const

/**
 * A whole-list health & safety save (issuing a talk, adding a document): `{ set, remove }` for the five arrays only.
 * Each next row is laid over its stored row by id, so fields the other app writes are kept; an issue status is
 * written as `HS_ISSUE_STATUS_STORED`; an empty list never replaces a stored non-empty one (an empty or failed load);
 * an unchanged array is not written; `signatureRecords` is never touched (signing uses
 * `healthSafetySignatureWriteFields`). The app adds `updatedAt`.
 */
export function healthSafetyDocumentWriteFields(
  stored: Record<string, unknown> | null | undefined,
  next: Partial<Record<(typeof HEALTH_SAFETY_ARRAY_FIELDS)[number], ReadonlyArray<Record<string, unknown>>>>
): DocumentWriteFields {
  const before = record(stored)
  const out: Record<string, unknown> = {}
  for (const field of HEALTH_SAFETY_ARRAY_FIELDS) {
    const list = next?.[field]
    if (!Array.isArray(list)) continue
    const storedRows = rows(before[field])
    if (list.length === 0 && storedRows.length > 0) continue
    const byId = new Map<string, Record<string, unknown>>()
    for (const row of storedRows) {
      const key = normalizeDocumentId(row.id)
      if (key) byId.set(key, row)
    }
    out[field] = list.map((row) => {
      const merged: Record<string, unknown> = { ...(byId.get(normalizeDocumentId(row?.id)) ?? {}) }
      for (const [key, value] of Object.entries(row || {})) if (value !== undefined) merged[key] = value
      if (field === 'issues') merged.status = HS_ISSUE_STATUS_STORED[normalizeHSIssueStatus(merged.status)]
      if (field === 'signatures') merged.status = normalizeHSSignatureStatus(merged.status)
      return merged
    })
  }
  return documentWriteFields(stored ? before : null, out)
}

// MARK: - Variations

export const VARIATION_STATUS_TOKENS = ['open', 'submitted', 'closed'] as const
export type VariationStatusToken = (typeof VARIATION_STATUS_TOKENS)[number]

/** open / submitted / closed (any case; `sent` → submitted, `complete(d)` / `done` → closed). Unknown → open. */
export function normalizeVariationStatus(raw: unknown): VariationStatusToken {
  const value = text(raw).toLowerCase()
  if (value === 'submitted' || value === 'sent') return 'submitted'
  if (value === 'closed' || value === 'complete' || value === 'completed' || value === 'done') return 'closed'
  return 'open'
}

export type VariationLabourLineDocument = { id: string; idStored: boolean; trade: string; hours: number }
export type VariationMaterialLineDocument = { id: string; idStored: boolean; name: string; quantity: string }
export type VariationEvidenceDocument = {
  id: string
  idStored: boolean
  fileName: string
  contentType: string
  sizeBytes: number
  storagePath: string
  downloadURL: string
  uploadedByUid: string
  uploadedAtMs: number | null
}

export type VariationDocument = {
  /** The document id (or, in a settings log, the item's `id`), stored case. */
  id: string
  orgId: string
  parentType: 'project' | 'smallWork'
  parentId: string
  parentName: string
  origin: 'app' | 'tracker'
  voNumber: string
  sequence: number
  voNumberLocked: boolean
  numberHistory: Array<{ from: string; to: string; atMs: number | null; byUid: string }>
  heading: string
  description: string
  status: VariationStatusToken
  labour: VariationLabourLineDocument[]
  materials: VariationMaterialLineDocument[]
  evidence: VariationEvidenceDocument[]
  /** Recomputed from the lines (the stored counters are ignored when they disagree). */
  totalLabourHours: number
  materialLineCount: number
  evidenceCount: number
  createdByUid: string
  createdByName: string
  createdAtMs: number | null
  updatedByUid: string
  updatedAtMs: number | null
  statusHistory: Array<{ status: string; byUid: string; byName: string; atMs: number | null }>
  submittedAtMs: number | null
  closedAtMs: number | null
  isDeleted: boolean
}

/** The id of a variation line stored without one: `derivedRowId(variation id, array, index, content)`. */
export function variationLineId(
  variationId: unknown,
  kind: 'labour' | 'materials' | 'evidence',
  index: number,
  row: Record<string, unknown> | null | undefined
): string {
  const line = record(row)
  const content =
    kind === 'labour'
      ? [text(line.trade), String(documentNumber(line.hours) ?? 0)]
      : kind === 'materials'
        ? [text(line.name), text(line.quantity)]
        : [text(line.storagePath), text(line.downloadURL), text(line.fileName)]
  return derivedRowId(variationId, kind, index, content)
}

/**
 * Read one variation (`variations/{id}`, a `settings/variationItem_{id}` document, or one entry of a settings log's
 * `items`). Null without an id. Lines with any content are kept (a labour line with a trade or hours, a material with
 * a name or quantity, evidence with a storage path or URL); a line without an id gets `variationLineId`. Counters
 * are recomputed from the lines.
 */
export function parseVariationDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): VariationDocument | null {
  const row = record(data)
  const id = text(docId) || text(row.id)
  if (!id) return null
  const labour: VariationLabourLineDocument[] = []
  for (const [index, entry] of (Array.isArray(row.labour) ? row.labour : []).entries()) {
    const line = record(entry)
    const trade = text(line.trade)
    const hours = documentNumber(line.hours) ?? 0
    if (!trade && !hours) continue
    labour.push({ id: text(line.id) || variationLineId(id, 'labour', index, line), idStored: Boolean(text(line.id)), trade, hours })
  }
  const materials: VariationMaterialLineDocument[] = []
  for (const [index, entry] of (Array.isArray(row.materials) ? row.materials : []).entries()) {
    const line = record(entry)
    const name = text(line.name)
    const quantity = typeof line.quantity === 'number' ? String(line.quantity) : text(line.quantity)
    if (!name && !quantity) continue
    materials.push({ id: text(line.id) || variationLineId(id, 'materials', index, line), idStored: Boolean(text(line.id)), name, quantity })
  }
  const evidence: VariationEvidenceDocument[] = []
  for (const [index, entry] of (Array.isArray(row.evidence) ? row.evidence : []).entries()) {
    const line = record(entry)
    const storagePath = text(line.storagePath)
    const downloadURL = text(line.downloadURL)
    if (!storagePath && !downloadURL) continue
    evidence.push({
      id: text(line.id) || variationLineId(id, 'evidence', index, line),
      idStored: Boolean(text(line.id)),
      fileName: text(line.fileName) || 'file',
      contentType: text(line.contentType),
      sizeBytes: documentNumber(line.sizeBytes) ?? 0,
      storagePath,
      downloadURL,
      uploadedByUid: text(line.uploadedByUid),
      uploadedAtMs: documentInstantMs(line.uploadedAt),
    })
  }
  const totalLabourHours = Math.round(labour.reduce((sum, line) => sum + (Number.isFinite(line.hours) ? line.hours : 0), 0) * 100) / 100
  return {
    id,
    orgId: documentOrganizationId(row.orgId) ?? documentOrganizationId(row.organizationId) ?? '',
    parentType: text(row.parentType) === 'smallWork' ? 'smallWork' : 'project',
    parentId: text(row.parentId),
    parentName: text(row.parentName),
    origin: text(row.origin) === 'tracker' ? 'tracker' : 'app',
    voNumber: text(row.voNumber),
    sequence: Math.trunc(documentNumber(row.sequence) ?? 0),
    voNumberLocked: documentBool(row.voNumberLocked) === true,
    numberHistory: rows(row.numberHistory).map((entry) => ({
      from: text(entry.from),
      to: text(entry.to),
      atMs: documentInstantMs(entry.at),
      byUid: text(entry.byUid),
    })),
    heading: text(row.heading),
    description: typeof row.description === 'string' ? row.description : '',
    status: normalizeVariationStatus(row.status),
    labour,
    materials,
    evidence,
    totalLabourHours,
    materialLineCount: materials.length,
    evidenceCount: evidence.length,
    createdByUid: text(row.createdByUid),
    createdByName: text(row.createdByName),
    createdAtMs: documentInstantMs(row.createdAt),
    updatedByUid: text(row.updatedByUid),
    updatedAtMs: documentInstantMs(row.updatedAt),
    statusHistory: rows(row.statusHistory).map((entry) => ({
      status: text(entry.status),
      byUid: text(entry.byUid),
      byName: text(entry.byName),
      atMs: documentInstantMs(entry.at),
    })),
    submittedAtMs: documentInstantMs(row.submittedAt),
    closedAtMs: documentInstantMs(row.closedAt),
    isDeleted: documentBool(row.isDeleted) === true,
  }
}

export const VARIATION_LABOUR_WRITE_GROUP = ['labour', 'totalLabourHours'] as const
export const VARIATION_MATERIALS_WRITE_GROUP = ['materials', 'materialLineCount'] as const
export const VARIATION_EVIDENCE_WRITE_GROUP = ['evidence', 'evidenceCount'] as const
export const VARIATION_STATUS_WRITE_GROUP = ['status', 'statusHistory', 'voNumberLocked', 'submittedAt', 'closedAt'] as const
export const VARIATION_NUMBER_WRITE_GROUP = ['voNumber', 'sequence', 'numberHistory'] as const

/**
 * Partial update of a variation (`variations/{id}` and its `settings/variationItem_{id}` copy) (§1): only changed
 * fields; each line list with its counter, the status with its history, lock and stamps, and the number with its
 * sequence and history are written together. `id`, `orgId`, `organizationId`, `createdAt`, `createdByUid`,
 * `createdByName`, `origin`, `parentId` and `parentType` are never rewritten.
 */
export function variationWriteFields(
  before: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): DocumentWriteFields {
  return documentWriteFields(before, next, {
    together: [
      VARIATION_LABOUR_WRITE_GROUP,
      VARIATION_MATERIALS_WRITE_GROUP,
      VARIATION_EVIDENCE_WRITE_GROUP,
      VARIATION_STATUS_WRITE_GROUP,
      VARIATION_NUMBER_WRITE_GROUP,
    ],
    createOnly: ['id', 'orgId', 'organizationId', 'createdAt', 'createdByUid', 'createdByName', 'origin', 'parentId', 'parentType'],
  })
}

/**
 * One row of a renumbering (the tracker's `applyNumbering`): the fields to update on that variation. `sequence` only
 * when it changes; `voNumber` with `numberHistory` (stored history plus one `{ from, to, at, byUid }` entry) only when
 * the number changes. A locked number (submitted / closed under `lockSubmitted`) is never changed. Null when nothing
 * changes. `at` passes through as given.
 */
export function variationRenumberWriteFields(input: {
  stored: Record<string, unknown> | null | undefined
  to: unknown
  sequence: unknown
  at: unknown
  byUid: unknown
  /** `resequenceAll` may change a locked number; `lockSubmitted` (default) may not. */
  numberingMode?: unknown
}): { set: Record<string, unknown> } | null {
  const row = record(input?.stored)
  const from = text(row.voNumber)
  const to = text(input?.to)
  const sequence = Math.trunc(documentNumber(input?.sequence) ?? NaN)
  const locked = documentBool(row.voNumberLocked) === true && text(input?.numberingMode) !== 'resequenceAll'
  const set: Record<string, unknown> = {}
  if (Number.isFinite(sequence) && sequence !== Math.trunc(documentNumber(row.sequence) ?? NaN)) set.sequence = sequence
  if (to && to !== from && !locked) {
    set.voNumber = to
    set.numberHistory = [
      ...(Array.isArray(row.numberHistory) ? row.numberHistory : []),
      { from, to, at: input?.at, byUid: text(input?.byUid) },
    ]
  }
  return Object.keys(set).length > 0 ? { set } : null
}

export type VariationTrackerDocument = {
  parentId: string
  parentType: 'project' | 'smallWork'
  enabled: boolean
  enabledAtMs: number | null
  enabledByUid: string | null
  numberingMode: 'lockSubmitted' | 'resequenceAll'
  prefix: string
  padding: number
  version: number
  lockedByUid: string | null
  lockedByName: string | null
  lockedAtMs: number | null
}

/** Read `variationTrackers/{parentId}`. A missing document is a disabled tracker (`VO-`, padding 3, version 0). */
export function parseVariationTrackerDocument(
  parentId: string,
  data: Record<string, unknown> | null | undefined
): VariationTrackerDocument {
  const row = record(data)
  const padding = Math.trunc(documentNumber(row.padding) ?? 3)
  return {
    parentId: text(parentId) || text(row.parentId),
    parentType: text(row.parentType) === 'smallWork' ? 'smallWork' : 'project',
    enabled: documentBool(row.enabled) === true,
    enabledAtMs: documentInstantMs(row.enabledAt),
    enabledByUid: optionalText(row.enabledByUid),
    numberingMode: text(row.numberingMode) === 'resequenceAll' ? 'resequenceAll' : 'lockSubmitted',
    prefix: text(row.prefix) || 'VO-',
    padding: padding >= 1 && padding <= 6 ? padding : 3,
    version: Math.trunc(documentNumber(row.version) ?? 0),
    lockedByUid: optionalText(row.lockedByUid),
    lockedByName: optionalText(row.lockedByName),
    lockedAtMs: documentInstantMs(row.lockedAt),
  }
}

// MARK: - Notifications

/** Legacy types still stored by older iOS builds (no push, no toggle). */
export const LEGACY_NOTIFICATION_TYPES = ['material_added'] as const

/**
 * Every notification type the rulebook knows: the §13 catalogue, the device-push allow-list and the legacy types.
 * An app's type list (the iOS enum) must accept every one of these; a type outside it is still kept as text.
 */
export const KNOWN_NOTIFICATION_TYPES: ReadonlyArray<string> = Array.from(
  new Set<string>([
    ...NOTIFICATION_CATALOG.map((row) => row.type),
    ...DEVICE_PUSH_NOTIFICATION_TYPES,
    ...LEGACY_NOTIFICATION_TYPES,
  ])
).sort()

export function isKnownNotificationType(type: unknown): boolean {
  const key = text(type)
  return Boolean(key) && KNOWN_NOTIFICATION_TYPES.includes(key)
}

export type NotificationDocument = {
  /** Document id, stored case (a non-UUID id is kept). */
  id: string
  organizationId: string | null
  /** As stored (trimmed). An unknown type is kept, never dropped. */
  type: string
  /** In `KNOWN_NOTIFICATION_TYPES`. */
  known: boolean
  title: string
  message: string
  userId: string | null
  actorUserId: string | null
  /** As stored, any shape (a UUID, a day key, a Firebase uid, a job id). */
  relatedId: string | null
  isRead: boolean
  readAtMs: number | null
  createdAtMs: number | null
  requiresPermission: string | null
  deepLinkUserId: string | null
  deepLinkWeekStartMs: number | null
  /** Stored `dayKey`, else `relatedId` when it is a day key. */
  dayKey: string | null
  catalogue: 'projects' | 'smallWorks' | null
  /** `notificationDestination` for `options.role`; null when no role was passed. */
  destination: NotificationDestination | null
}

/**
 * Read one inbox row `organizations/{orgId}/notifications/{id}` (§13). Null only without a document id or a type.
 * Title, message, read state and `createdAt` default (empty, unread, null) instead of dropping the row.
 */
export function parseNotificationDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null; role?: AccountKind | null; organizationId?: string | null } | null
): NotificationDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const type = text(row.type)
  if (!type) return null
  const relatedId = optionalText(row.relatedId) ?? (typeof row.relatedId === 'number' ? String(row.relatedId) : null)
  const storedDay = text(row.dayKey)
  const dayKey = DAY_KEY.test(storedDay) ? storedDay : relatedId && DAY_KEY.test(relatedId) ? relatedId : null
  const catalogue = text(row.catalogue) === 'projects' || text(row.catalogue) === 'smallWorks' ? (text(row.catalogue) as 'projects' | 'smallWorks') : null
  const deepLinkUserId = optionalText(row.deepLinkUserId)
  return {
    id,
    organizationId: documentOrganizationId(row.organizationId) ?? optionalText(options?.organizationId),
    type,
    known: isKnownNotificationType(type),
    title: text(row.title),
    message: text(row.message),
    userId: optionalText(row.userId),
    actorUserId: optionalText(row.actorUserId),
    relatedId,
    isRead: documentBool(row.isRead) === true,
    readAtMs: documentInstantMs(row.readAt),
    createdAtMs: documentInstantMs(row.createdAt),
    requiresPermission: optionalText(row.requiresPermission),
    deepLinkUserId,
    deepLinkWeekStartMs: documentInstantMs(row.deepLinkWeekStart),
    dayKey,
    catalogue,
    destination: options?.role
      ? notificationDestination({ type, relatedId, dayKey, catalogue, role: options.role, deepLinkUserId })
      : null,
  }
}

/** Marking a row read: `{ isRead: true }` only (never rewrites the row). Null when it is already read. */
export function notificationReadWriteFields(stored: Record<string, unknown> | null | undefined): { set: { isRead: true } } | null {
  return documentBool(record(stored).isRead) === true ? null : { set: { isRead: true } }
}

// MARK: - warningResolutions

export type WarningResolutionDocument = {
  /** Document id, stored case. */
  id: string
  /** The shared key (`sharedWarningResolutionKey` of the stored `resolutionKey`, else the id). */
  resolutionKey: string
  /** The key as stored. */
  storedKey: string
  /** True when the stored key is an older form that `sharedWarningResolutionKey` rewrote. */
  isLegacyKey: boolean
  status: WarningResolutionStatus | null
  resolvedByUserId: string | null
  resolvedAtMs: number | null
}

/**
 * The shared form of a stored resolution key. Older iOS builds wrote the day as epoch seconds:
 * `mgr-clash-{user}-{seconds}-{i}` → `mgr-clash-{user}-{YYYY-MM-DD}-{i}` (`managerClashGroups`), and
 * `materials-{projectId}-{seconds}` → `materials-{projectId}-{YYYY-MM-DD}` (`materialCutOffWarningRows`), the day in
 * the organisation zone. Every other key is returned as stored. `op-clash-…` keys cannot be rewritten from the key
 * alone (they need the booking pair); `warningResolutionMigrationWrites` takes them from the warning rows.
 */
export function sharedWarningResolutionKey(key: unknown, timeZone?: string | null): string {
  const raw = text(key)
  const zone = zoneOrLondon(timeZone)
  const toDay = (seconds: string) => {
    const value = Number(seconds)
    if (!Number.isFinite(value) || value <= 0) return null
    return dayKeyInZone(new Date(value > 10_000_000_000 ? value : value * 1000), zone)
  }
  const manager = /^(mgr-clash-.+)-(\d{9,}(?:\.\d+)?)-(\d+)$/.exec(raw)
  if (manager) {
    const day = toDay(manager[2])
    return day ? `${manager[1]}-${day}-${manager[3]}` : raw
  }
  const materials = /^(materials-.+)-(\d{9,}(?:\.\d+)?)$/.exec(raw)
  if (materials) {
    const day = toDay(materials[2])
    return day ? `${materials[1]}-${day}` : raw
  }
  return raw
}

/** Read one `warningResolutions/{key}` document. Null without a document id. */
export function parseWarningResolutionDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): WarningResolutionDocument | null {
  const id = text(docId)
  if (!id) return null
  const row = record(data)
  const storedKey = text(row.resolutionKey) || id
  const resolutionKey = sharedWarningResolutionKey(storedKey, options?.timeZone)
  const status = text(row.status).toLowerCase()
  return {
    id,
    resolutionKey,
    storedKey,
    isLegacyKey: resolutionKey !== storedKey,
    status: status === 'approved' || status === 'dismissed' ? status : null,
    resolvedByUserId: optionalText(row.resolvedByUserId),
    resolvedAtMs: documentInstantMs(row.resolvedAt),
  }
}

/**
 * Records for `resolvedWarningKeys` / `approvedWarningKeys` with every key in its shared form, so a legacy key hides
 * the same warning on every platform before it is migrated.
 */
export function warningResolutionRecords(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>,
  timeZone?: string | null
): Array<{ id: string; resolutionKey: string; status: string }> {
  const out: Array<{ id: string; resolutionKey: string; status: string }> = []
  for (const entry of docs || []) {
    const parsed = parseWarningResolutionDocument(entry?.id, entry?.data, { timeZone })
    if (parsed?.status) out.push({ id: parsed.id, resolutionKey: parsed.resolutionKey, status: parsed.status })
  }
  return out
}

/**
 * D3 legacy key migration as writes (§5): for each stored record whose key is a legacy form, and for each shared key
 * whose older forms (`legacyKeyForms[sharedKey]`, from the warning rows — e.g. `op-clash-{uuid}-{epoch}-{i}`) are
 * resolved, the `warningResolutions` document to write under the shared key — unless the shared key is already
 * resolved. Approved beats dismissed. Old documents are left as they are (harmless; readers map them). Staff only
 * (the security rules check); idempotent; never deletes. A clash row's approval should also write its
 * `acceptedBookingClashes` pair (`clashApprovalWrites`) when the caller has the booking ids.
 */
export function warningResolutionMigrationWrites(input: {
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }>
  legacyKeyForms?: Readonly<Record<string, ReadonlyArray<string>>> | null
  resolvedByUserId: unknown
  timeZone?: string | null
}): WarningResolutionWrite[] {
  const parsed = (input?.docs || [])
    .map((entry) => parseWarningResolutionDocument(entry?.id, entry?.data, { timeZone: input?.timeZone }))
    .filter((row): row is WarningResolutionDocument => Boolean(row?.status))
  const sharedResolved = new Set(parsed.filter((row) => !row.isLegacyKey).map((row) => normalizeDocumentId(row.resolutionKey)))
  const storedStatus = new Map<string, WarningResolutionStatus>()
  for (const row of parsed) {
    const key = normalizeDocumentId(row.storedKey)
    if (storedStatus.get(key) !== 'approved') storedStatus.set(key, row.status as WarningResolutionStatus)
  }
  const wanted = new Map<string, { key: string; status: WarningResolutionStatus }>()
  const want = (key: string, status: WarningResolutionStatus) => {
    const norm = normalizeDocumentId(key)
    if (!norm || sharedResolved.has(norm)) return
    const existing = wanted.get(norm)
    if (!existing || (existing.status === 'dismissed' && status === 'approved')) wanted.set(norm, { key, status })
  }
  for (const row of parsed) if (row.isLegacyKey) want(row.resolutionKey, row.status as WarningResolutionStatus)
  for (const [sharedKey, forms] of Object.entries(input?.legacyKeyForms || {})) {
    let status: WarningResolutionStatus | null = null
    for (const form of forms || []) {
      const found = storedStatus.get(normalizeDocumentId(form))
      if (found === 'approved') status = 'approved'
      else if (found === 'dismissed' && !status) status = 'dismissed'
    }
    if (status) want(sharedKey, status)
  }
  const writes: WarningResolutionWrite[] = []
  for (const { key, status } of wanted.values()) {
    const write = warningResolutionWriteFields({ resolutionKey: key, status, resolvedByUserId: input?.resolvedByUserId })
    if (write) writes.push(write)
  }
  return writes.sort((a, b) => a.documentId.localeCompare(b.documentId))
}

/**
 * Claim evidence (rulebook 1.30.0 §26; 1.45.0 §8): a file, photo or frozen personal site audit copy a person attaches
 * to a PAYE price work or expense item (§26) or, from 1.45.0 (owner decision 14 Nov), to a price work or expense entry
 * on their own timesheet (§8). One shape and one Storage folder for both: the person's own claim folder,
 * `organizations/{orgId}/payeClaims/{userId}/{uid}_{ms}.{ext}` (§24 object names), read by the person, their active
 * line managers and active admins of the organisation — exactly the people who review a timesheet — so no new Storage
 * rule is needed.
 *
 * Moved out of `payeClaims.ts` in 1.45.0 (same names, same behaviour) so the timesheet entry reader
 * (`parseTimesheetEntries`) reads evidence without importing the PAYE module.
 */

import { fileDeletePermission, storedFileKind, storedFileObjectName } from './storedFiles'

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Storage folder of claim evidence: `organizations/{orgId}/payeClaims/{userId}/{uid}_{ms}.{ext}`. */
export const PAYE_CLAIM_EVIDENCE_FOLDER = 'payeClaims'

export const EXPENSE_EVIDENCE_REQUIRED_MESSAGE = 'Add at least one piece of evidence (a file, photo or personal site audit).'
export const PAYE_CLAIM_EVIDENCE_LIMIT_MESSAGE = 'Up to 20 pieces of evidence.'
export const PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE = 'Evidence must be uploaded to your own claim folder.'

/** A piece of evidence the PDF cannot draw (not a JPEG, PNG or PDF), listed with this note instead. */
export const PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE = 'This file type cannot be shown in the PDF. Open it in the app.'
export const PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE = 'This file could not be read when the report was made. Open it in the app.'

export const PAYE_CLAIM_EVIDENCE_MAX = 20
/** The longest stored evidence name. */
export const CLAIM_EVIDENCE_NAME_MAX = 200

export type PayeClaimEvidenceKind = 'file' | 'photo' | 'personalSiteAudit'
export const PAYE_CLAIM_EVIDENCE_KINDS: ReadonlyArray<PayeClaimEvidenceKind> = ['file', 'photo', 'personalSiteAudit']

/** One piece of evidence: the Storage path in the person's claim folder, a display name and its kind. */
export type PayeClaimEvidence = {
  path: string
  name: string
  kind: PayeClaimEvidenceKind
  /** MIME type as uploaded (`image/jpeg`, `application/pdf`, …); empty when unknown. */
  contentType: string
  /** For a personal site audit copy: the audit it was frozen from (the copy never changes after). */
  auditId: string | null
}

// MARK: - Paths, readers and writers

/**
 * The Storage path of a new piece of claim evidence: `organizations/{orgId}/payeClaims/{userId}/{uid}_{ms}.{ext}`
 * (§24 object name, `storedFileObjectName`). Only the person uploads into their own folder (`userId` is their uid), so
 * the uploader in the name is the person. Null when an id is unusable.
 */
export function payeClaimEvidencePath(input: {
  organizationId: string
  userId: string
  unixMs: number
  extension?: string | null
}): string | null {
  const org = text(input.organizationId)
  const user = text(input.userId)
  if (!org || !user || org.includes('/') || user.includes('/')) return null
  const name = storedFileObjectName({ uid: user, unixMs: input.unixMs, extension: input.extension })
  return name ? `organizations/${org}/${PAYE_CLAIM_EVIDENCE_FOLDER}/${user}/${name}` : null
}

/** True when `path` is a claim evidence file of `userId` in `organizationId` (case-sensitive uid, as Storage is). */
export function payeClaimEvidencePathBelongsTo(path: unknown, organizationId: unknown, userId: unknown): boolean {
  const parsed = storedFileKind(text(path))
  if (!parsed || parsed.kind !== 'paye_claim_evidence') return false
  return parsed.organizationId === text(organizationId) && parsed.ownerUserId === text(userId)
}

function evidenceKind(value: unknown): PayeClaimEvidenceKind {
  const raw = text(value)
  return raw === 'photo' || raw === 'personalSiteAudit' ? raw : 'file'
}

/**
 * Reads a stored `evidence` list; order is kept. Never throws. Given an owner (1.30.0 review), only entries whose path
 * is a claim evidence file in that person's own folder are kept (`payeClaimEvidencePathBelongsTo`; also the
 * organisation when given) — another person's file, a personal site audit photo, a URL or junk is dropped, so a viewer
 * never opens it. 1.45.0: `userIds` names further ids that are the same person (a timesheet's subject under its stored
 * `userId` and the id its document is filed under). Without an owner (an older caller) entries without a path are
 * dropped.
 */
export function parsePayeClaimEvidence(
  value: unknown,
  owner?: { userId?: unknown; userIds?: ReadonlyArray<unknown> | null; organizationId?: unknown } | null
): PayeClaimEvidence[] {
  const list = Array.isArray(value) ? value : []
  const out: PayeClaimEvidence[] = []
  const owners = new Set([text(owner?.userId), ...(owner?.userIds || []).map(text)].filter(Boolean))
  const organizationId = text(owner?.organizationId)
  for (const raw of list) {
    const row = record(raw)
    const path = text(row.path)
    if (!path) continue
    if (owner) {
      const parsed = storedFileKind(path)
      if (!parsed || parsed.kind !== 'paye_claim_evidence' || !parsed.ownerUserId || !owners.has(parsed.ownerUserId)) continue
      if (organizationId && parsed.organizationId !== organizationId) continue
    }
    out.push({
      path,
      name: text(row.name) || path.split('/').pop() || 'Evidence',
      kind: evidenceKind(row.kind),
      contentType: text(row.contentType),
      auditId: text(row.auditId) || null,
    })
  }
  return out
}

/** The stored shape of one evidence entry (no empty optional fields). */
export function payeClaimEvidenceWriteFields(entry: Partial<PayeClaimEvidence>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    path: text(entry.path),
    name: text(entry.name).slice(0, CLAIM_EVIDENCE_NAME_MAX) || text(entry.path).split('/').pop() || 'Evidence',
    kind: evidenceKind(entry.kind),
  }
  if (text(entry.contentType)) out.contentType = text(entry.contentType)
  if (text(entry.auditId)) out.auditId = text(entry.auditId)
  return out
}

/** Whether the report PDF can draw this evidence as a page: `image` (JPEG / PNG), `pdf` (pages appended) or `listed`. */
export function payeClaimEvidenceDrawAs(entry: Pick<PayeClaimEvidence, 'contentType' | 'path' | 'name'>): 'image' | 'pdf' | 'listed' {
  const type = text(entry.contentType).toLowerCase()
  const name = `${text(entry.name)} ${text(entry.path)}`.toLowerCase()
  if (type === 'application/pdf' || /\.pdf(\s|$)/.test(name)) return 'pdf'
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/pjpeg' || type === 'image/png') return 'image'
  if (!type && /\.(jpe?g|png)(\s|$)/.test(name)) return 'image'
  return 'listed'
}

/**
 * Which of the person's own claim evidence files are deleted, not kept (§24, 1.30.0 review): only those the person
 * uploaded within the undo window (`fileDeletePermission` as the uploader — `uploader_undo`). Used when an add or edit
 * fails after its uploads (so no orphaned copy is left where line managers and admins can read it) and when the person
 * removes an item, an entry or one piece of evidence; every other file is kept for recovery (`FILE_KEPT_ON_REMOVE_COPY`).
 */
export function payeClaimEvidenceToDelete(
  evidence: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null | undefined,
  input: { organizationId: string; viewerUserId: string; nowMs: number; uploadedAtMs?: Record<string, number | null | undefined> | null }
): string[] {
  const out: string[] = []
  for (const entry of evidence || []) {
    const path = text(entry?.path)
    if (!path || !payeClaimEvidencePathBelongsTo(path, input.organizationId, input.viewerUserId) || out.includes(path)) continue
    const permission = fileDeletePermission({
      storagePath: path,
      organizationId: input.organizationId,
      viewerUserId: input.viewerUserId,
      viewerRole: null as never,
      nowMs: input.nowMs,
      uploadedAtMs: input.uploadedAtMs?.[path] ?? null,
    })
    if (permission.allowed && permission.reason === 'uploader_undo') out.push(path)
  }
  return out
}

// MARK: - 1.45.0: attach controls, edits and counts (timesheet entries and PAYE items alike)

/** Web and iOS attach controls (owner decision 14 Nov, laid out like the Tasks picker). Web has no camera control. */
export const CLAIM_EVIDENCE_ADD_PHOTO_LABEL = 'Add photo'
export const CLAIM_EVIDENCE_ADD_SITE_AUDIT_LABEL = 'Add site audit'
export const CLAIM_EVIDENCE_ADD_FILE_LABEL = 'Add file'
/** iOS only: the camera, and the photo library (iOS shows these two in place of `CLAIM_EVIDENCE_ADD_PHOTO_LABEL`). */
export const CLAIM_EVIDENCE_TAKE_PHOTO_LABEL = 'Take photo'
export const CLAIM_EVIDENCE_CHOOSE_PHOTO_LABEL = 'Choose photo'
export const CLAIM_EVIDENCE_HEADING = 'Evidence'
export const CLAIM_EVIDENCE_NONE_TEXT = 'No evidence'
/** Under the attach controls. */
export const CLAIM_EVIDENCE_HELP_TEXT = 'Photos and PDFs up to 10MB.'
/** Under the site audit picker: what is attached and who sees it. */
export const CLAIM_EVIDENCE_SITE_AUDIT_NOTE = 'A frozen copy (PDF) is attached; your line managers and admins see the copy, never your list.'
/** Shown for an older timesheet expense that stored only a receipt name (no file was ever uploaded). */
export const CLAIM_EVIDENCE_LEGACY_RECEIPT_NOTE = 'Receipt noted before files were stored — no file to open'

/**
 * "1 piece of evidence" / "3 pieces of evidence"; '' for none. One wording for list rows, review rows and the weekly
 * report on both apps.
 */
export function claimEvidenceCountText(count: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (n === 0) return ''
  return n === 1 ? '1 piece of evidence' : `${n} pieces of evidence`
}

/** The entries of `before` whose path is no longer in `after` (an edit removed them, or the item or entry went). */
export function claimEvidenceRemoved<T extends Pick<PayeClaimEvidence, 'path'>>(
  before: ReadonlyArray<T> | null | undefined,
  after: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null | undefined
): T[] {
  const kept = new Set((after || []).map((entry) => text(entry?.path)).filter(Boolean))
  const out: T[] = []
  const seen = new Set<string>()
  for (const entry of before || []) {
    const path = text(entry?.path)
    if (!path || kept.has(path) || seen.has(path)) continue
    seen.add(path)
    out.push(entry)
  }
  return out
}

/** True when two evidence lists hold the same files in the same order (by path). A change to it is an edit. */
export function claimEvidenceSameList(
  a: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null | undefined,
  b: ReadonlyArray<Pick<PayeClaimEvidence, 'path'>> | null | undefined
): boolean {
  const left = (a || []).map((entry) => text(entry?.path))
  const right = (b || []).map((entry) => text(entry?.path))
  return left.length === right.length && left.every((path, index) => path === right[index])
}

/**
 * Null when an evidence list may be saved, else the message: with `required`, at least one
 * (`EXPENSE_EVIDENCE_REQUIRED_MESSAGE`); at most `PAYE_CLAIM_EVIDENCE_MAX` (20) entries; given `organizationId` and
 * `ownerUserIds`, each a claim evidence file in one of those people's own folders (`PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE`).
 */
export function claimEvidenceListError(
  evidence: ReadonlyArray<Partial<PayeClaimEvidence>> | null | undefined,
  context: { organizationId?: unknown; ownerUserIds?: ReadonlyArray<unknown> | null; required?: boolean }
): string | null {
  const list = evidence || []
  if (context.required && list.length === 0) return EXPENSE_EVIDENCE_REQUIRED_MESSAGE
  if (list.length > PAYE_CLAIM_EVIDENCE_MAX) return PAYE_CLAIM_EVIDENCE_LIMIT_MESSAGE
  const owners = (context.ownerUserIds || []).map(text).filter(Boolean)
  if (context.organizationId != null && owners.length > 0) {
    for (const entry of list) {
      if (!owners.some((owner) => payeClaimEvidencePathBelongsTo(entry?.path, context.organizationId, owner))) {
        return PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE
      }
    }
  }
  return null
}

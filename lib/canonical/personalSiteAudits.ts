/**
 * Personal site audits (rulebook §26, 1.30.0, owner decisions 4 Nov; spec "Personal site audits").
 *
 * Site audits get a **Personal** section below Projects and Small works, with **Create Personal Site Audit**. A personal
 * audit is not linked to any job: its job number and job name are free text and print on the audit. It is visible
 * **only to the person who made it** — no admin, manager or line manager reads it (security rules: owner only, both
 * Firestore `personalSiteAudits/{id}` and Storage `personalSiteAudits/{ownerUserId}/…`).
 *
 * When the person attaches one as evidence to an expense or price work (`payeClaims.ts`), the app builds a frozen PDF
 * copy from `personalSiteAuditPdfRows` and uploads it into the person's claim folder (`payeClaimEvidencePath`), with
 * `personalSiteAuditEvidence` as the evidence entry. Their line managers and admins see that copy with the claim and
 * never the private list; later edits to the audit never change the copy.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { formatPaymentRunDay } from './paymentRuns'
import { documentInstantMs } from './peopleDocuments'
import { storedFileKind, storedFileObjectName } from './storedFiles'
import type { PayeClaimEvidence } from './payeClaims'

export const PERSONAL_SITE_AUDITS_COLLECTION = 'personalSiteAudits'
export const PERSONAL_SITE_AUDIT_SECTION_LABEL = 'Personal'
export const PERSONAL_SITE_AUDIT_CREATE_LABEL = 'Create Personal Site Audit'
export const PERSONAL_SITE_AUDIT_PRIVATE_NOTE = 'Only you can see your personal site audits.'
export const PERSONAL_SITE_AUDIT_JOB_NAME_MESSAGE = 'Enter a job name.'
export const PERSONAL_SITE_AUDIT_ITEMS_MESSAGE = 'Add at least one photo.'
export const PERSONAL_SITE_AUDIT_ITEM_TITLE_MESSAGE = 'Each photo needs a title before the audit can be saved.'
export const PERSONAL_SITE_AUDIT_DATE_MESSAGE = 'Enter a valid audit date.'
export const PERSONAL_SITE_AUDIT_ITEMS_MAX = 100
/**
 * The privacy policy sentence (owner's text) both apps carry: personal site audits are private to their creator; a
 * copy attached to an expense or price work is visible to that person's line managers and admins.
 */
export const PERSONAL_SITE_AUDIT_PRIVACY_NOTICE =
  'Personal site audits are private to the person who created them. A copy attached to an expense or price work item is visible to that person’s line managers and admins, and is kept for recovery if the item is later removed.'

export type PersonalSiteAuditItem = {
  id: string
  title: string
  location: string
  comments: string
  assignee: string
  annotations: string
  /** Storage path in the owner's folder (`personalSiteAuditImagePath`); never a public download URL. */
  imagePath: string
  takenAtMs: number | null
}

export type PersonalSiteAudit = {
  id: string
  ownerUserId: string
  jobNumber: string
  jobName: string
  type: string
  customTitle: string
  date: string
  authorName: string
  items: PersonalSiteAuditItem[]
  createdAtMs: number | null
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function isDayKey(value: string): boolean {
  if (!DAY_KEY.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/**
 * The Storage path of a new personal audit photo: `organizations/{orgId}/personalSiteAudits/{ownerUserId}/{auditId}/
 * {uid}_{ms}.{ext}` (§24 object name). Null when an id is unusable.
 */
export function personalSiteAuditImagePath(input: {
  organizationId: string
  ownerUserId: string
  auditId: string
  unixMs: number
  extension?: string | null
}): string | null {
  const parts = [text(input.organizationId), text(input.ownerUserId), text(input.auditId)]
  if (parts.some((part) => !part || part.includes('/'))) return null
  const name = storedFileObjectName({ uid: parts[1], unixMs: input.unixMs, extension: input.extension })
  return name ? `organizations/${parts[0]}/${PERSONAL_SITE_AUDITS_COLLECTION}/${parts[1]}/${parts[2]}/${name}` : null
}

/** Only the owner sees a personal site audit (uids compare exactly, as Auth uids are case-sensitive). */
export function canViewPersonalSiteAudit(viewerUserId: unknown, audit: Pick<PersonalSiteAudit, 'ownerUserId'> | null | undefined): boolean {
  const viewer = text(viewerUserId)
  return Boolean(viewer) && text(audit?.ownerUserId) === viewer
}

export type PersonalSiteAuditDraft = {
  jobNumber?: unknown
  jobName?: unknown
  type?: unknown
  customTitle?: unknown
  date?: unknown
  authorName?: unknown
  items?: ReadonlyArray<Partial<Omit<PersonalSiteAuditItem, 'takenAtMs'>> & { takenAtMs?: unknown }> | null
}

/** Null when the audit can be saved, else the first message: a job name, a valid date, 1–100 photos, each with a title and a photo in the owner's folder. */
export function personalSiteAuditValidationError(
  draft: PersonalSiteAuditDraft,
  context?: { organizationId?: string | null; ownerUserId?: string | null } | null
): string | null {
  if (!text(draft.jobName)) return PERSONAL_SITE_AUDIT_JOB_NAME_MESSAGE
  if (!isDayKey(text(draft.date))) return PERSONAL_SITE_AUDIT_DATE_MESSAGE
  const items = draft.items || []
  if (items.length === 0 || items.length > PERSONAL_SITE_AUDIT_ITEMS_MAX) return PERSONAL_SITE_AUDIT_ITEMS_MESSAGE
  for (const item of items) {
    if (!text(item.title)) return PERSONAL_SITE_AUDIT_ITEM_TITLE_MESSAGE
    if (context?.organizationId && context.ownerUserId) {
      const parsed = storedFileKind(text(item.imagePath))
      if (
        !parsed ||
        parsed.kind !== 'personal_site_audit' ||
        parsed.organizationId !== text(context.organizationId) ||
        parsed.ownerUserId !== text(context.ownerUserId)
      ) {
        return PERSONAL_SITE_AUDIT_ITEMS_MESSAGE
      }
    }
  }
  return null
}

/**
 * The fields of a new `personalSiteAudits/{id}` document (a create by the owner; the app adds `createdAt` as server
 * time and the write metadata). Null when `personalSiteAuditValidationError` refuses the draft.
 */
export function personalSiteAuditWriteFields(input: {
  ownerUserId: string
  draft: PersonalSiteAuditDraft
  organizationId?: string | null
}): Record<string, unknown> | null {
  const owner = text(input.ownerUserId)
  if (!owner) return null
  if (personalSiteAuditValidationError(input.draft, { organizationId: input.organizationId, ownerUserId: owner })) return null
  const items = (input.draft.items || []).map((item, index) => {
    const out: Record<string, unknown> = {
      id: text(item.id) || `item-${index + 1}`,
      title: text(item.title).slice(0, 200),
      imagePath: text(item.imagePath),
    }
    for (const key of ['location', 'comments', 'assignee', 'annotations'] as const) {
      const value = text(item[key]).slice(0, 2000)
      if (value) out[key] = value
    }
    const taken = documentInstantMs(item.takenAtMs)
    if (taken != null) out.takenAtMs = taken
    return out
  })
  return {
    ownerUserId: owner,
    jobNumber: text(input.draft.jobNumber).slice(0, 60),
    jobName: text(input.draft.jobName).slice(0, 200),
    type: text(input.draft.type).slice(0, 60) || 'General',
    customTitle: text(input.draft.customTitle).slice(0, 200),
    date: text(input.draft.date),
    authorName: text(input.draft.authorName).slice(0, 200),
    items,
  }
}

/** Reads `personalSiteAudits/{id}`. Items keep their order; an item without an id gets `item-{n}`. Never throws. */
export function parsePersonalSiteAuditDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  options?: { timeZone?: string | null } | null
): PersonalSiteAudit {
  const row = record(data)
  const zone = zoneOrLondon(options?.timeZone)
  const rawDate = text(row.date)
  const dateMs = isDayKey(rawDate) ? null : documentInstantMs(row.date)
  const items = (Array.isArray(row.items) ? row.items : []).map((raw, index) => {
    const r = record(raw)
    return {
      id: text(r.id) || `item-${index + 1}`,
      title: text(r.title),
      location: text(r.location),
      comments: text(r.comments),
      assignee: text(r.assignee),
      annotations: text(r.annotations),
      imagePath: text(r.imagePath),
      takenAtMs: documentInstantMs(r.takenAtMs ?? r.createdAt),
    }
  })
  return {
    id: text(docId),
    ownerUserId: text(row.ownerUserId),
    jobNumber: text(row.jobNumber),
    jobName: text(row.jobName),
    type: text(row.type) || 'General',
    customTitle: text(row.customTitle),
    date: isDayKey(rawDate) ? rawDate : dateMs != null ? dayKeyInZone(new Date(dateMs), zone) : '',
    authorName: text(row.authorName),
    items,
    createdAtMs: documentInstantMs(row.createdAt),
  }
}

/** "Site audit · J-1042 Riverside Flats · 4 Nov" — the evidence name and the list title. */
export function personalSiteAuditTitle(audit: Pick<PersonalSiteAudit, 'jobNumber' | 'jobName' | 'customTitle' | 'type' | 'date'>): string {
  const job = [text(audit.jobNumber), text(audit.jobName)].filter(Boolean).join(' ')
  return [text(audit.customTitle) || `Site audit (${text(audit.type) || 'General'})`, job, audit.date ? formatPaymentRunDay(audit.date) : '']
    .filter(Boolean)
    .join(' · ')
}

/**
 * The text of the frozen PDF copy: the title, the job number and name (free text, printed as entered), the author and
 * date, then one block per item (its title, when it was taken, location, assignee, notes) with the photo's path.
 */
export function personalSiteAuditPdfRows(
  audit: PersonalSiteAudit,
  options?: { timeZone?: string | null } | null
): {
  title: string
  lines: string[]
  items: Array<{ heading: string; lines: string[]; imagePath: string }>
} {
  const zone = zoneOrLondon(options?.timeZone)
  return {
    title: text(audit.customTitle) || `Personal site audit · ${text(audit.type) || 'General'}`,
    lines: [
      `Job number: ${text(audit.jobNumber) || '—'}`,
      `Job name: ${text(audit.jobName) || '—'}`,
      `Author: ${text(audit.authorName) || '—'}`,
      `Date: ${audit.date ? formatPaymentRunDay(audit.date) : '—'}`,
      `Items: ${audit.items.length}`,
    ],
    items: audit.items.map((item, index) => ({
      heading: `${index + 1}. ${item.title}`,
      lines: [
        item.takenAtMs != null ? `Taken ${dayKeyInZone(new Date(item.takenAtMs), zone)}` : '',
        item.location ? `Location: ${item.location}` : '',
        item.assignee ? `Assignee: ${item.assignee}` : '',
        item.comments,
        item.annotations,
      ].filter(Boolean),
      imagePath: item.imagePath,
    })),
  }
}

/** The evidence entry for a frozen copy of `audit` uploaded at `path` (a PDF in the person's claim folder). */
export function personalSiteAuditEvidence(audit: Pick<PersonalSiteAudit, 'id' | 'jobNumber' | 'jobName' | 'customTitle' | 'type' | 'date'>, path: string): PayeClaimEvidence {
  return {
    path: text(path),
    name: personalSiteAuditTitle(audit),
    kind: 'personalSiteAudit',
    contentType: 'application/pdf',
    auditId: text(audit.id) || null,
  }
}

/** The owner's audits, newest first (date, then created time). Audits of anyone else are dropped. */
export function personalSiteAuditsFor<T extends Pick<PersonalSiteAudit, 'ownerUserId' | 'date' | 'createdAtMs' | 'id'>>(
  audits: ReadonlyArray<T> | null | undefined,
  viewerUserId: unknown
): T[] {
  return (audits || [])
    .filter((audit) => canViewPersonalSiteAudit(viewerUserId, audit))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || a.id.localeCompare(b.id))
}

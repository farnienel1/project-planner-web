/** User-uploaded file reports. Root collection `contentReports` — not org-scoped documents. */

import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'

export const CONTENT_REPORTS_COLLECTION = 'contentReports'

export const CONTENT_REPORT_LINK_LABEL = 'Report a problem with this file'

export const CONTENT_REPORT_REASONS = ['copyright', 'personal_data', 'offensive', 'other'] as const
export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number]

export const CONTENT_REPORT_REASON_LABELS: Record<ContentReportReason, string> = {
  copyright: 'Copyright',
  personal_data: 'Personal data',
  offensive: 'Offensive',
  other: 'Other',
}

export const CONTENT_REPORT_DETAILS_MAX = 500
export const CONTENT_REPORT_STATUS_OPEN = 'open'

const FILE_URL_MAX = 2000
const FILE_NAME_MAX = 160
const ORG_NAME_MAX = 160
const SOURCE_MAX = 40
const ORG_ID_MAX = 80

export type ContentReportInput = {
  orgId?: unknown
  orgName?: unknown
  reason?: unknown
  details?: unknown
  fileUrl?: unknown
  storagePath?: unknown
  fileName?: unknown
  source?: unknown
}

export type ContentReportPayload = {
  orgId: string
  orgName: string
  reason: ContentReportReason
  details: string
  fileUrl: string
  storagePath: string
  fileName: string
  source: string
  reportedByUid: string
  reporterEmail: string
  status: typeof CONTENT_REPORT_STATUS_OPEN
}

export type ContentReportRow = {
  id: string
  orgId: string
  orgName: string
  reason: string
  details: string
  fileUrl: string
  storagePath: string
  fileName: string
  source: string
  reportedByUid: string
  reporterEmail: string
  status: string
  createdAt: Date | null
}

export function isContentReportReason(value: unknown): value is ContentReportReason {
  return typeof value === 'string' && (CONTENT_REPORT_REASONS as readonly string[]).includes(value)
}

export function isReportableFileRef(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  return !lower.startsWith('blob:') && !lower.startsWith('data:')
}

function capped(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/** Storage object path from a download URL, gs:// URL, or already-stored path. Empty when it cannot be parsed. */
export function parseStoragePathFromUrl(value: string): string {
  const raw = value.trim()
  if (!raw || !isReportableFileRef(raw)) return ''

  if (raw.startsWith('gs://')) {
    const withoutScheme = raw.replace(/^gs:\/\/[^/]+\//, '')
    return decodePath(withoutScheme.split('?')[0].split('#')[0])
  }

  try {
    const url = new URL(raw)
    const firebaseObject = url.pathname.match(/\/(?:v0\/)?b\/[^/]+\/o\/(.+)$/)
    if (firebaseObject?.[1]) return decodePath(firebaseObject[1])
    if (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com')) {
      const parts = url.pathname.replace(/^\/+/, '').split('/')
      const start = url.hostname === 'storage.googleapis.com' ? 1 : 0
      if (parts.length > start) return decodePath(parts.slice(start).join('/'))
    }
    return ''
  } catch {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return ''
    return decodePath(raw.replace(/^\/+/, '').split('?')[0].split('#')[0])
  }
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

export function parseContentReportInput(
  input: ContentReportInput,
  reporter: { uid: string; email?: string | null }
): { ok: true; value: ContentReportPayload } | { ok: false; error: string } {
  const uid = reporter.uid.trim()
  if (!uid) return { ok: false, error: 'Sign in required' }

  const orgId = capped(input.orgId, ORG_ID_MAX)
  if (!orgId) return { ok: false, error: 'organisation is required' }

  if (!isContentReportReason(input.reason)) {
    return { ok: false, error: 'Choose a reason.' }
  }

  const details = capped(input.details, CONTENT_REPORT_DETAILS_MAX)
  if (input.reason === 'other' && !details) {
    return { ok: false, error: 'Describe the problem.' }
  }

  const fileUrl = capped(input.fileUrl, FILE_URL_MAX)
  if (!fileUrl || !isReportableFileRef(fileUrl)) {
    return { ok: false, error: 'A file is required.' }
  }

  const providedPath = capped(input.storagePath, FILE_URL_MAX)
  const storagePath = providedPath && isReportableFileRef(providedPath)
    ? parseStoragePathFromUrl(providedPath) || providedPath
    : parseStoragePathFromUrl(fileUrl)

  return {
    ok: true,
    value: {
      orgId,
      orgName: capped(input.orgName, ORG_NAME_MAX),
      reason: input.reason,
      details,
      fileUrl,
      storagePath,
      fileName: capped(input.fileName, FILE_NAME_MAX),
      source: capped(input.source, SOURCE_MAX),
      reportedByUid: uid,
      reporterEmail: (reporter.email || '').trim().toLowerCase().slice(0, 254),
      status: CONTENT_REPORT_STATUS_OPEN,
    },
  }
}

export function contentReportFirestoreFields(payload: ContentReportPayload): Record<string, string> {
  return {
    orgId: payload.orgId,
    orgName: payload.orgName,
    reportedByUid: payload.reportedByUid,
    reporterEmail: payload.reporterEmail,
    reason: payload.reason,
    details: payload.details,
    fileUrl: payload.fileUrl,
    storagePath: payload.storagePath,
    fileName: payload.fileName,
    source: payload.source,
    status: payload.status,
  }
}

export function contentReportMessage(payload: ContentReportPayload): { subject: string; html: string } {
  const org = payload.orgName.trim() || 'Organisation'
  const reason = CONTENT_REPORT_REASON_LABELS[payload.reason]
  return {
    subject: sanitizeEmailHeader(`File report — ${reason} — ${org}`, 180),
    html: [
      '<p>A user reported a problem with a file stored in Project Planner.</p>',
      line('Organisation', `${org} (${payload.orgId})`),
      line('Reason', reason),
      line('Storage path', payload.storagePath || '—'),
      line('File', payload.fileName || payload.fileUrl),
      line('Source', payload.source || '—'),
      line('Reporter', `${payload.reporterEmail || '—'} (${payload.reportedByUid})`),
      line('Details', payload.details || '—'),
    ].join('\n'),
  }
}

export function parseContentReportRow(id: string, data: Record<string, unknown>): ContentReportRow {
  return {
    id,
    orgId: stringField(data.orgId),
    orgName: stringField(data.orgName),
    reason: stringField(data.reason),
    details: stringField(data.details),
    fileUrl: stringField(data.fileUrl),
    storagePath: stringField(data.storagePath),
    fileName: stringField(data.fileName),
    source: stringField(data.source),
    reportedByUid: stringField(data.reportedByUid),
    reporterEmail: stringField(data.reporterEmail),
    status: stringField(data.status) || CONTENT_REPORT_STATUS_OPEN,
    createdAt: asDate(data.createdAt),
  }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      const date = toDate.call(value)
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function line(label: string, value: string): string {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || '—')}</p>`
}

/**
 * "Report a problem with this file". Anyone in the organisation can report a
 * file another person uploaded; admins and super admins review the queue.
 *
 * A report lives at organizations/{orgId}/fileReports/{reportId} (uppercase
 * UUID). It stores the Storage path, never the download URL, because that URL
 * carries an access token. Callers add `createdAt` (server timestamp) to the
 * fields returned here; Firestore rules require it to equal the request time.
 */

import type { StaffAccountRole } from './staffAccess'

export const FILE_REPORT_REASONS = [
  'copyright',
  'personal_data',
  'offensive',
  'wrong_file',
  'other',
] as const
export type FileReportReason = (typeof FILE_REPORT_REASONS)[number]

/** Where the reported file is shown. */
export const FILE_REPORT_SURFACES = [
  'site_audit',
  'task_attachment',
  'health_safety',
  'deadline',
  'variation_evidence',
  'qualification_certificate',
] as const
export type FileReportSurface = (typeof FILE_REPORT_SURFACES)[number]

export const FILE_REPORT_STATUSES = ['open', 'reviewed', 'removed'] as const
export type FileReportStatus = (typeof FILE_REPORT_STATUSES)[number]

export const FILE_REPORT_DETAILS_MAX = 1000
export const FILE_REPORT_FILE_NAME_MAX = 200

export const FILE_REPORT_LINK_LABEL = 'Report a problem with this file'
export const FILE_REPORT_SENT_COPY = 'Thanks — an admin will review this.'

const REASON_COPY: Record<FileReportReason, string> = {
  copyright: 'Copyright or someone else’s work',
  personal_data: 'Personal information that should not be shared',
  offensive: 'Offensive or inappropriate',
  wrong_file: 'Wrong file or wrong job',
  other: 'Something else',
}

const STATUS_COPY: Record<FileReportStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed — no action',
  removed: 'File removed',
}

function trimmed(value: unknown): string {
  return String(value ?? '').trim()
}

export function fileReportCollectionPath(organizationId: string): string {
  return `organizations/${trimmed(organizationId)}/fileReports`
}

export function isFileReportReason(value: unknown): value is FileReportReason {
  return (FILE_REPORT_REASONS as readonly string[]).includes(trimmed(value))
}

export function isFileReportSurface(value: unknown): value is FileReportSurface {
  return (FILE_REPORT_SURFACES as readonly string[]).includes(trimmed(value))
}

export function fileReportReasonCopy(reason: unknown): string {
  return isFileReportReason(reason) ? REASON_COPY[trimmed(reason) as FileReportReason] : REASON_COPY.other
}

export function fileReportStatusCopy(status: unknown): string {
  const value = trimmed(status) as FileReportStatus
  return (FILE_REPORT_STATUSES as readonly string[]).includes(value) ? STATUS_COPY[value] : STATUS_COPY.open
}

/**
 * Storage object path from a Firebase download URL, a storage.googleapis.com
 * URL, a gs:// URL, or a bare path. Null when it is none of those.
 */
export function fileReportStoragePath(fileRef: string | null | undefined): string | null {
  const raw = trimmed(fileRef)
  if (!raw) return null
  if (raw.startsWith('gs://')) {
    const rest = raw.slice('gs://'.length)
    const slash = rest.indexOf('/')
    return slash > 0 && slash < rest.length - 1 ? rest.slice(slash + 1) : null
  }
  if (/^https?:\/\//i.test(raw)) {
    const firebase = raw.match(/\/v0\/b\/[^/]+\/o\/([^?#]+)/)
    if (firebase) {
      try {
        return decodeURIComponent(firebase[1])
      } catch {
        return null
      }
    }
    const gcs = raw.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/([^?#]+)/i)
    if (gcs) {
      try {
        return decodeURIComponent(gcs[1])
      } catch {
        return null
      }
    }
    return null
  }
  if (raw.includes('://') || raw.startsWith('/')) return null
  return raw
}

/** Last path segment, for the review list when no file name was stored. */
export function fileReportFileName(storagePath: string | null | undefined): string {
  const path = trimmed(storagePath)
  const last = path.split('/').pop() || ''
  return last.slice(0, FILE_REPORT_FILE_NAME_MAX)
}

export type FileReportInput = {
  organizationId: string
  storagePath: string
  surface: string
  parentId: string
  reason: string
  reportedByUserId: string
  details?: string | null
  fileName?: string | null
}

export type FileReportWriteResult =
  | { ok: true; fields: Record<string, string> }
  | { ok: false; error: 'missing_organization' | 'missing_user' | 'bad_path' | 'bad_surface' | 'missing_parent' | 'bad_reason' }

/**
 * Fields for a new report. The path must sit under this organisation's
 * Storage folder. Details are trimmed and capped. Status always starts open.
 */
export function fileReportWriteFields(input: FileReportInput): FileReportWriteResult {
  const organizationId = trimmed(input.organizationId)
  const reportedByUserId = trimmed(input.reportedByUserId)
  const storagePath = trimmed(input.storagePath)
  const surface = trimmed(input.surface)
  const parentId = trimmed(input.parentId)
  const reason = trimmed(input.reason)
  if (!organizationId) return { ok: false, error: 'missing_organization' }
  if (!reportedByUserId) return { ok: false, error: 'missing_user' }
  if (!storagePath.startsWith(`organizations/${organizationId}/`) || storagePath.includes('..')) {
    return { ok: false, error: 'bad_path' }
  }
  if (!isFileReportSurface(surface)) return { ok: false, error: 'bad_surface' }
  if (!parentId) return { ok: false, error: 'missing_parent' }
  if (!isFileReportReason(reason)) return { ok: false, error: 'bad_reason' }
  const fileName = (trimmed(input.fileName) || fileReportFileName(storagePath)).slice(0, FILE_REPORT_FILE_NAME_MAX)
  return {
    ok: true,
    fields: {
      organizationId,
      storagePath,
      surface,
      parentId,
      fileName,
      reason,
      details: trimmed(input.details).slice(0, FILE_REPORT_DETAILS_MAX),
      reportedByUserId,
      status: 'open',
    },
  }
}

/** Fields an admin writes when closing a report. */
export function fileReportReviewWriteFields(input: {
  status: string
  reviewedByUserId: string
}): Record<string, string> | null {
  const status = trimmed(input.status)
  const reviewedByUserId = trimmed(input.reviewedByUserId)
  if (status !== 'reviewed' && status !== 'removed') return null
  if (!reviewedByUserId) return null
  return { status, reviewedByUserId }
}

/** Admins and super admins review reports. Managers and operatives only file them. */
export function canReviewFileReports(role: StaffAccountRole): boolean {
  if (role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin
}

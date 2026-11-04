/**
 * Rulebook 1.25.0 §24: uploaded files are never lost.
 *
 * Who may delete (or overwrite) a Storage object the apps uploaded, which
 * family a Storage path belongs to, who uploaded it, and the object name every
 * new upload gets so a replacement never overwrites the file it replaces.
 *
 * `storage.rules` enforces the same rule on the server; screens call
 * `fileDeletePermission` only to decide whether to offer (or attempt) the
 * delete. Plain data only: each app resolves the viewer's account flags
 * (`StaffAccountRole`) and passes them in.
 */

import type { StaffAccountRole } from './staffAccess'

/**
 * How long after an upload its uploader may still delete or overwrite it
 * (retry of a failed upload, removing a file that failed to link). Storage
 * rules use the same number against the object's server `timeCreated`.
 */
export const FILE_UNDO_WINDOW_MINUTES = 15
export const FILE_UNDO_WINDOW_MS = FILE_UNDO_WINDOW_MINUTES * 60 * 1000

/** Shown when a file is removed from a record but the Storage object is kept. */
export const FILE_KEPT_ON_REMOVE_COPY = 'Removed from this list. The file itself is kept so an admin can restore it.'

/**
 * Rulebook §24 (1.27.0, owner decision 5): how long a deleted or replaced file is kept for recovery — the Storage
 * bucket's soft-delete retention, set by the platform owner (Deploy notes 1.27.0). Also the period an erased
 * company's files are kept after the §20 eraser runs.
 */
export const FILE_RECOVERY_RETENTION_DAYS = 30

/**
 * The sentence both apps' privacy policy (Retention) and data processing agreement (Deletion and Return) carry, word
 * for word (web `lib/legal/customerLegalPack.ts`, iOS `CustomerLegalPack.swift`).
 */
export const DELETED_DATA_RETENTION_NOTICE =
  'A deleted company can be restored for 30 days, after which its data is erased. Deleted files, including the files of an erased company, are kept for up to 30 days so they can be recovered, then permanently removed.'

export const STORED_FILE_KINDS = [
  'profile_photo',
  'company_logo',
  'timesheet_export',
  'qualification_certificate',
  'variation_evidence',
  'site_audit_photo',
  'task_attachment',
  'health_safety',
  // 1.30.0 (§26): PAYE price work / expense evidence, and personal site audit photos (owner only).
  'paye_claim_evidence',
  'personal_site_audit',
] as const
export type StoredFileKind = (typeof STORED_FILE_KINDS)[number]

export type StoredFilePath = {
  kind: StoredFileKind
  organizationId: string
  /** Last path segment. */
  objectName: string
  /**
   * Profile photo: the person the photo belongs to (from the path). 1.30.0: claim evidence and personal site audit
   * files: the person whose folder it is. Otherwise null.
   */
  ownerUserId: string | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Which family a Storage object path belongs to, in the same order as
 * `storage.rules`. Null for a path outside `organizations/{orgId}/…` or a
 * prefix the rules do not allow (those are refused for everyone).
 */
export function storedFileKind(storagePath: string | null | undefined): StoredFilePath | null {
  const path = text(storagePath)
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('//')) return null
  const parts = path.split('/')
  if (parts.length < 4 || parts[0] !== 'organizations' || !parts[1]) return null
  const organizationId = parts[1]
  const objectName = parts[parts.length - 1]
  if (!objectName) return null
  const rest = parts.slice(2)
  const base = { organizationId, objectName, ownerUserId: null as string | null }
  if (rest.length === 3 && rest[0] === 'userProfiles' && rest[2] === 'profile.jpg' && rest[1]) {
    return { ...base, kind: 'profile_photo', ownerUserId: rest[1] }
  }
  if (rest.length === 3 && rest[0] === 'branding' && rest[1] === 'company_logo') return { ...base, kind: 'company_logo' }
  if (rest.length === 2 && rest[0] === 'timesheetExports') return { ...base, kind: 'timesheet_export' }
  if (rest.length === 6 && rest[0] === 'operatives' && rest[2] === 'qualifications' && rest[4] === 'certificates') {
    return { ...base, kind: 'qualification_certificate' }
  }
  if (rest.length === 4 && rest[0] === 'healthSafety' && (rest[2] === 'variations' || rest[2] === 'variationEvidence')) {
    return { ...base, kind: 'variation_evidence' }
  }
  if (rest.length === 3 && rest[0] === 'variations') return { ...base, kind: 'variation_evidence' }
  if (rest.length >= 2 && rest[0] === 'siteAudits') return { ...base, kind: 'site_audit_photo' }
  if (rest.length >= 2 && rest[0] === 'tasks') return { ...base, kind: 'task_attachment' }
  if (rest.length >= 2 && rest[0] === 'healthSafety') return { ...base, kind: 'health_safety' }
  if (rest.length === 3 && rest[0] === 'payeClaims' && rest[1]) return { ...base, kind: 'paye_claim_evidence', ownerUserId: rest[1] }
  if (rest.length >= 3 && rest[0] === 'personalSiteAudits' && rest[1]) return { ...base, kind: 'personal_site_audit', ownerUserId: rest[1] }
  return null
}

const UID_PATTERN = /^[A-Za-z0-9-]+$/

/**
 * The object name every new upload gets: `{uid}_{unixMilliseconds}.{ext}`
 * (no extension → `{uid}_{unixMilliseconds}`). The original file name is
 * never copied in, and each upload is a new object, so a replacement (a new
 * certificate, a new RAMS) never overwrites the file it replaces and every
 * stored link keeps working. Null when the uid cannot be part of a name
 * (empty, or anything but letters, digits and "-").
 */
export function storedFileObjectName(input: { uid: string; unixMs: number; extension?: string | null }): string | null {
  const uid = text(input.uid)
  if (!uid || !UID_PATTERN.test(uid)) return null
  const ms = Math.floor(Number(input.unixMs))
  if (!Number.isFinite(ms) || ms < 0) return null
  const ext = text(input.extension).toLowerCase().replace(/^\.+/, '').replace(/[^a-z0-9]/g, '')
  return ext ? `${uid}_${ms}.${ext}` : `${uid}_${ms}`
}

/**
 * Who uploaded an object and when, read from its name (`storedFileObjectName`).
 * Profile photos are owned by the person in the path; their upload time is unknown.
 * Null for a name that does not follow the pattern (older uploads, timesheet exports).
 */
export function storedFileUploader(
  storagePath: string | null | undefined
): { uploaderUserId: string; uploadedAtMs: number | null } | null {
  const parsed = storedFileKind(storagePath)
  if (!parsed) return null
  if (parsed.kind === 'profile_photo') return parsed.ownerUserId ? { uploaderUserId: parsed.ownerUserId, uploadedAtMs: null } : null
  if (parsed.kind === 'timesheet_export') return null
  const match = parsed.objectName.match(/^([A-Za-z0-9-]+)_([0-9]{1,16})(?:\.[A-Za-z0-9]+)?$/)
  if (!match) return null
  return { uploaderUserId: match[1], uploadedAtMs: Number(match[2]) }
}

export type FileDeleteReason =
  | 'admin'
  | 'own_profile_photo'
  | 'uploader_undo'
  | 'undo_expired'
  | 'not_uploader'
  | 'admin_only'
  | 'owner_only'
  | 'other_organization'
  | 'unknown_path'
  | 'signed_out'

export type FileDeletePermission = {
  allowed: boolean
  reason: FileDeleteReason
  /** When the uploader's undo window ends (ms), when one applies. */
  undoEndsAtMs: number | null
}

export type FileDeleteInput = {
  storagePath: string
  /** The organisation open in the app. A path in another organisation is never deletable. */
  organizationId: string
  viewerUserId: string
  viewerRole: StaffAccountRole
  nowMs: number
  /** Server upload time when the app has it (metadata `timeCreated`); otherwise the time in the object name. */
  uploadedAtMs?: number | null
}

/** Admins and super admins outside operative mode. */
function isFileAdmin(role: StaffAccountRole): boolean {
  if (!role || role.isOperativeMode) return false
  return role.isSuperAdmin === true || role.isAdmin === true
}

/**
 * Whether the viewer may delete this Storage object outright (rulebook §24).
 * - An admin or super admin outside operative mode of that organisation: yes.
 * - A profile photo: also the person it belongs to.
 * - Company logos and timesheet exports: admins only.
 * - Every other file: also its uploader, within `FILE_UNDO_WINDOW_MINUTES` of the upload.
 * - Nobody else, ever. Removing a file from a record without this permission
 *   unlinks it and keeps the object (`FILE_KEPT_ON_REMOVE_COPY`).
 * Overwriting an existing object follows the same rule without the admin
 * case (only the uploader's undo window, or a person's own profile photo).
 */
export function fileDeletePermission(input: FileDeleteInput): FileDeletePermission {
  const viewer = text(input.viewerUserId)
  const deny = (reason: FileDeleteReason, undoEndsAtMs: number | null = null): FileDeletePermission => ({
    allowed: false,
    reason,
    undoEndsAtMs,
  })
  if (!viewer) return deny('signed_out')
  const parsed = storedFileKind(input.storagePath)
  if (!parsed) return deny('unknown_path')
  const org = text(input.organizationId)
  if (!org || parsed.organizationId.toLowerCase() !== org.toLowerCase()) return deny('other_organization')
  // 1.30.0 (§26): a personal site audit file is its owner's only — admins never delete it; the owner within the undo
  // window. Claim evidence is in the person's own folder: only they upload there.
  if (parsed.kind === 'personal_site_audit' && parsed.ownerUserId !== viewer) return deny('owner_only')
  if (parsed.kind !== 'personal_site_audit' && isFileAdmin(input.viewerRole)) return { allowed: true, reason: 'admin', undoEndsAtMs: null }
  if (parsed.kind === 'profile_photo') {
    return parsed.ownerUserId === viewer ? { allowed: true, reason: 'own_profile_photo', undoEndsAtMs: null } : deny('not_uploader')
  }
  if (parsed.kind === 'company_logo' || parsed.kind === 'timesheet_export') return deny('admin_only')
  const uploader = storedFileUploader(input.storagePath)
  if (!uploader || uploader.uploaderUserId !== viewer) return deny('not_uploader')
  const given = Number(input.uploadedAtMs)
  const uploadedAtMs = input.uploadedAtMs != null && Number.isFinite(given) ? given : uploader.uploadedAtMs
  if (uploadedAtMs == null) return deny('undo_expired')
  const undoEndsAtMs = uploadedAtMs + FILE_UNDO_WINDOW_MS
  if (Number(input.nowMs) < undoEndsAtMs) return { allowed: true, reason: 'uploader_undo', undoEndsAtMs }
  return deny('undo_expired', undoEndsAtMs)
}

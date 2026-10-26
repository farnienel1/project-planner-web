/**
 * Tax identifiers (UTR and VAT number). They live at users/{uid}/private/taxIds,
 * not on the users document every company member can read. Only the person
 * and admins (or super admins) of their company see them. Elsewhere they are
 * masked to the last four characters, and exports leave them out unless an
 * admin or the person asks for them.
 *
 * Until the one-off migration runs, a value still on users/{uid} is read as a
 * fallback (`resolveSensitiveProfile`). Saves write only the private document
 * and remove the old field.
 */

import type { StaffAccountRole } from './staffAccess'

export const SENSITIVE_PROFILE_FIELDS = ['utrNumber', 'vatNumber'] as const
export type SensitiveProfileField = (typeof SENSITIVE_PROFILE_FIELDS)[number]

export const SENSITIVE_PROFILE_DOC_ID = 'taxIds'
export const SENSITIVE_VALUE_MAX = 20
export const SENSITIVE_HELD_BY_ADMIN_COPY = 'Held by admin'
export const SENSITIVE_EXPORT_OPTION_LABEL = 'Include UTR and VAT number'

export type SensitiveProfile = {
  utrNumber: string
  vatNumber: string
  source: 'private' | 'legacy' | 'none'
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function sensitiveProfileDocPath(userId: string): string {
  return `users/${text(userId)}/private/${SENSITIVE_PROFILE_DOC_ID}`
}

/** The person themselves, or an admin or super admin who is not in operative mode. */
export function canViewSensitiveProfile(input: {
  viewerRole: StaffAccountRole
  viewerUserId: string
  subjectUserId: string
}): boolean {
  const viewer = text(input.viewerUserId)
  if (viewer && viewer === text(input.subjectUserId)) return true
  if (input.viewerRole.isOperativeMode) return false
  return input.viewerRole.isSuperAdmin || input.viewerRole.isAdmin
}

/** "•••• 1234". Four characters or fewer are fully masked; blank stays blank. */
export function maskSensitiveValue(value: unknown): string {
  const raw = text(value).replace(/\s+/g, '')
  if (!raw) return ''
  if (raw.length <= 4) return '••••'
  return `•••• ${raw.slice(-4)}`
}

/**
 * The private document wins once it exists, even when a field in it is blank
 * (that is a deliberate clear). Otherwise the legacy users-document value.
 */
export function resolveSensitiveProfile(input: {
  privateDoc?: Record<string, unknown> | null
  legacyUser?: Record<string, unknown> | null
}): SensitiveProfile {
  if (input.privateDoc && typeof input.privateDoc === 'object') {
    return {
      utrNumber: text(input.privateDoc.utrNumber),
      vatNumber: text(input.privateDoc.vatNumber),
      source: 'private',
    }
  }
  const legacy = input.legacyUser && typeof input.legacyUser === 'object' ? input.legacyUser : {}
  const utrNumber = text(legacy.utrNumber)
  const vatNumber = text(legacy.vatNumber)
  return { utrNumber, vatNumber, source: utrNumber || vatNumber ? 'legacy' : 'none' }
}

export type SensitiveProfileWriteResult =
  | { ok: true; fields: { utrNumber: string; vatNumber: string; updatedByUserId: string } }
  | { ok: false; error: 'missing_user' | 'too_long' }

/** Fields for users/{uid}/private/taxIds. Blank clears. Callers add `updatedAt` (server time). */
export function sensitiveProfileWriteFields(input: {
  utrNumber?: string | null
  vatNumber?: string | null
  updatedByUserId: string
}): SensitiveProfileWriteResult {
  const updatedByUserId = text(input.updatedByUserId)
  if (!updatedByUserId) return { ok: false, error: 'missing_user' }
  const utrNumber = text(input.utrNumber)
  const vatNumber = text(input.vatNumber)
  if (utrNumber.length > SENSITIVE_VALUE_MAX || vatNumber.length > SENSITIVE_VALUE_MAX) {
    return { ok: false, error: 'too_long' }
  }
  return { ok: true, fields: { utrNumber, vatNumber, updatedByUserId } }
}

/** Exports carry tax identifiers only when asked for and the exporter may see them. */
export function exportIncludesSensitiveFields(input: { requested?: boolean | null; canView: boolean }): boolean {
  return input.requested === true && input.canView === true
}

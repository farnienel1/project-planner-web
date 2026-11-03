/**
 * Company deletion and "Delete my account" (rulebook §11, §16, §20; 1.15.0, owner decisions round 6).
 *
 *   - A super admin deletes the organisation from web Settings → Billing ("Delete organisation"): they type the
 *     company name and DELETE (`organizationDeleteConfirmationError`). The server cancels the Stripe subscription at
 *     the period end (no refund) and writes `organizations/{orgId}.deletion` (`organizationDeletionWriteFields`):
 *     `{ status: 'scheduled', requestedAt, requestedBy, eraseAfter: requestedAt + 60 days, restoreBy }`.
 *   - While scheduled the organisation is locked (`organizationDeletionState` → `scheduled`): the security rules
 *     refuse its data to everyone but the platform owner, like a lapsed subscription; every member sees
 *     `organizationDeletedMessage` and the super admin (when `restoreBy` is `super_admin`) also sees Restore
 *     (`canRestoreOrganization`). Restore removes `deletion` and resumes the subscription when it is still in its
 *     period.
 *   - After `eraseAfter` a daily server job erases it (`organizationEraseDue`): organisation subcollections, the
 *     organisation document, its Storage files, memberships and email claims; users documents whose only
 *     organisation it was are anonymised and deleted; an audit row `erasedOrganizations/{orgId}`
 *     (`erasedOrganizationAuditFields`: `erasedAt`, `name`; no personal data) is written.
 *   - "Delete my account" (`accountDeletionPath`): a super admin with other active members hands super admin to
 *     another admin first (`handover_required`); a super admin who is the only active member deletes the company
 *     with the account (`delete_with_company`, the same 60-day state, restorable only by the platform owner because
 *     the account is gone); everyone else just deletes the account (`delete`).
 *
 * Pure, JSON in / JSON out. Dates are epoch milliseconds (a Firestore Timestamp, Date, ISO string or `{ seconds }`
 * is read too).
 */

import { personIdSet, type PersonRosterRow } from './personIds'
import { rosterSegment, type RosterSegmentProfile } from './userRosterSegment'

/** Days a deleted organisation stays restorable before it is erased. */
export const DELETION_RESTORE_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000

/** The word typed with the company name to delete an organisation (and an account). */
export const ORGANIZATION_DELETE_CONFIRMATION = 'DELETE'

export type OrganizationDeletionRestoreBy = 'super_admin' | 'platform_owner'

export type OrganizationDeletion = {
  status: 'scheduled' | 'erased'
  requestedAtMs: number | null
  requestedBy: string
  eraseAfterMs: number | null
  restoreBy: OrganizationDeletionRestoreBy
}

export type OrganizationDeletionState =
  | { state: 'active' }
  | { state: 'scheduled'; locked: true; eraseAfterMs: number | null; due: boolean; restoreBy: OrganizationDeletionRestoreBy; requestedBy: string }
  | { state: 'erased'; locked: true }

export const ORGANIZATION_DELETE_TITLE = 'Delete organisation'
export const ORGANIZATION_DELETE_BODY = [
  'This deletes the organisation for everyone. Nobody can open it once you confirm.',
  'The subscription is cancelled at the end of the current billing period. Payments already made are not refunded.',
  `You can restore the organisation from this screen for ${DELETION_RESTORE_DAYS} days. After that every job, booking, timesheet, file and person in it is erased for good.`,
] as const
export const ORGANIZATION_DELETE_SUPER_ADMIN_ONLY_MESSAGE = 'Only the super admin can delete the organisation.'
export const ORGANIZATION_RESTORED_MESSAGE = 'The organisation is restored.'
export const ACCOUNT_HANDOVER_REQUIRED_MESSAGE =
  'You are the super admin. Make another admin the super admin before you delete your account.'
export const ACCOUNT_DELETE_WITH_COMPANY_MESSAGE =
  'You are the only member of this organisation. Deleting your account also deletes the organisation. Type the company name and DELETE to confirm.'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Epoch ms from a Firestore Timestamp, Date, number, ISO string or `{ seconds, nanoseconds }`; else null. */
export function deletionTimeMs(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object') {
    const row = value as { toMillis?: () => number; getTime?: () => number; seconds?: unknown; _seconds?: unknown; nanoseconds?: unknown }
    // A Date from another realm (the packed script runs in its own context) fails `instanceof Date`.
    if (typeof row.getTime === 'function') {
      const ms = row.getTime()
      return Number.isFinite(ms) ? ms : null
    }
    if (typeof row.toMillis === 'function') {
      const ms = row.toMillis()
      return Number.isFinite(ms) ? ms : null
    }
    const seconds = typeof row.seconds === 'number' ? row.seconds : typeof row._seconds === 'number' ? row._seconds : null
    if (seconds != null) return seconds * 1000 + (typeof row.nanoseconds === 'number' ? Math.floor(row.nanoseconds / 1e6) : 0)
  }
  return null
}

/** `organizations/{orgId}.deletion`, or null when the organisation is not being deleted. */
export function parseOrganizationDeletion(org: unknown): OrganizationDeletion | null {
  const raw = record(record(org).deletion)
  const status = text(raw.status).toLowerCase()
  if (status !== 'scheduled' && status !== 'erased') return null
  const requestedAtMs = deletionTimeMs(raw.requestedAt)
  const eraseAfterMs =
    deletionTimeMs(raw.eraseAfter) ?? (requestedAtMs == null ? null : requestedAtMs + DELETION_RESTORE_DAYS * DAY_MS)
  return {
    status,
    requestedAtMs,
    requestedBy: text(raw.requestedBy),
    eraseAfterMs,
    restoreBy: text(raw.restoreBy) === 'platform_owner' ? 'platform_owner' : 'super_admin',
  }
}

/**
 * Where the organisation is in its deletion: `active` (no deletion), `scheduled` (locked; `due` once `eraseAfter` has
 * passed and the eraser may run) or `erased`. A missing `eraseAfter` is never due.
 */
export function organizationDeletionState(org: unknown, now: number = Date.now()): OrganizationDeletionState {
  const deletion = parseOrganizationDeletion(org)
  if (!deletion) return { state: 'active' }
  if (deletion.status === 'erased') return { state: 'erased', locked: true }
  return {
    state: 'scheduled',
    locked: true,
    eraseAfterMs: deletion.eraseAfterMs,
    due: deletion.eraseAfterMs != null && now >= deletion.eraseAfterMs,
    restoreBy: deletion.restoreBy,
    requestedBy: deletion.requestedBy,
  }
}

/** True while the organisation is scheduled for erasure and `eraseAfter` has passed. */
export function organizationEraseDue(org: unknown, now: number = Date.now()): boolean {
  const state = organizationDeletionState(org, now)
  return state.state === 'scheduled' && state.due
}

/** The erase day as shown to people ("3 January 2027"), in the organisation zone. */
export function organizationEraseDateLabel(eraseAfterMs: number | null, timeZone?: string | null): string {
  if (eraseAfterMs == null || !Number.isFinite(eraseAfterMs)) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: text(timeZone) || 'Europe/London',
    }).format(new Date(eraseAfterMs))
  } catch {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(
      new Date(eraseAfterMs)
    )
  }
}

/** What every member sees while the organisation is scheduled for erasure. */
export function organizationDeletedMessage(eraseAfterMs: number | null, timeZone?: string | null): string {
  const label = organizationEraseDateLabel(eraseAfterMs, timeZone)
  return label
    ? `This organisation has been deleted and will be erased on ${label}.`
    : 'This organisation has been deleted and will be erased.'
}

/**
 * The `deletion` map the server writes when the organisation is deleted. `requestedAtMs` is the server's clock;
 * `eraseAfter` is `DELETION_RESTORE_DAYS` later. `restoreBy` is `platform_owner` when the deletion came with the last
 * member's account deletion (nobody is left to restore it).
 */
export function organizationDeletionWriteFields(input: {
  requestedBy: string
  requestedAtMs: number
  restoreBy?: OrganizationDeletionRestoreBy | null
}): { deletion: { status: 'scheduled'; requestedAt: Date; requestedBy: string; eraseAfter: Date; restoreBy: OrganizationDeletionRestoreBy } } {
  const at = Number.isFinite(input?.requestedAtMs) ? input.requestedAtMs : Date.now()
  return {
    deletion: {
      status: 'scheduled',
      requestedAt: new Date(at),
      requestedBy: text(input?.requestedBy),
      eraseAfter: new Date(at + DELETION_RESTORE_DAYS * DAY_MS),
      restoreBy: input?.restoreBy === 'platform_owner' ? 'platform_owner' : 'super_admin',
    },
  }
}

/** The organisation's super admin: its creator, or a users document of it flagged `isSuperAdmin`. */
export function isOrganizationSuperAdmin(
  viewer: { id?: string | null; isSuperAdmin?: boolean | null; organizationId?: string | null } | null | undefined,
  org: { id?: string | null; creatorUserId?: unknown } | null | undefined
): boolean {
  const id = text(viewer?.id)
  if (!id) return false
  const creator = text(org?.creatorUserId)
  if (creator && creator.toLowerCase() === id.toLowerCase()) return true
  if (viewer?.isSuperAdmin !== true) return false
  const orgId = text(org?.id)
  const home = text(viewer?.organizationId)
  const homeId = home.includes('/') ? home.split('/').filter(Boolean).pop() ?? '' : home
  return !orgId || !homeId || homeId.toLowerCase() === orgId.toLowerCase()
}

/**
 * Who may restore a scheduled organisation: the platform owner always; the organisation's super admin only when the
 * deletion was theirs to undo (`restoreBy` `super_admin`). Never after `erased`.
 */
export function canRestoreOrganization(input: {
  org: unknown
  viewer?: { id?: string | null; isSuperAdmin?: boolean | null; organizationId?: string | null } | null
  viewerIsPlatformOwner?: boolean | null
  now?: number
}): boolean {
  const state = organizationDeletionState(input?.org, input?.now ?? Date.now())
  if (state.state !== 'scheduled') return false
  if (input.viewerIsPlatformOwner === true) return true
  if (state.restoreBy !== 'super_admin') return false
  const org = record(input.org)
  return isOrganizationSuperAdmin(input.viewer ?? null, { id: text(org.id), creatorUserId: org.creatorUserId })
}

/**
 * The delete form: the company name typed exactly (ignoring case and surrounding spaces) and `DELETE`. Null when
 * both match, else the message to show.
 */
export function organizationDeleteConfirmationError(input: {
  organizationName: string
  typedName: string
  typedConfirmation: string
}): string | null {
  const name = text(input?.organizationName).toLowerCase()
  if (!name || text(input?.typedName).toLowerCase() !== name) return 'Type the company name exactly as it is shown.'
  if (text(input?.typedConfirmation) !== ORGANIZATION_DELETE_CONFIRMATION) return 'Type DELETE to confirm.'
  return null
}

export type AccountDeletionPath = 'delete' | 'handover_required' | 'delete_with_company'

export type AccountDeletionRosterRow = PersonRosterRow & RosterSegmentProfile & { isSuperAdmin?: boolean | null }

/**
 * What "Delete my account" does for this organisation (rulebook §11, §20; 1.15.0):
 *   - `handover_required`: the viewer is its super admin (`isOrganizationSuperAdmin`) and someone else is an active
 *     member (`rosterSegment` active, not the viewer under any of their ids) — they make another admin the super
 *     admin first (Change Super Admin; a member can be made an admin first);
 *   - `delete_with_company`: the viewer is its super admin and the only active member — the organisation is deleted
 *     with the account (60-day scheduled state, `restoreBy` `platform_owner`);
 *   - `delete`: anyone else, and an organisation already scheduled for erasure.
 */
export function accountDeletionPath(
  viewer: { id: string; email?: string | null; isSuperAdmin?: boolean | null; organizationId?: string | null; formerUserIds?: ReadonlyArray<string> | null; sameEmailUserIds?: ReadonlyArray<string> | null },
  roster: ReadonlyArray<AccountDeletionRosterRow> | null | undefined,
  org: { id?: string | null; creatorUserId?: unknown; deletion?: unknown } | null | undefined
): AccountDeletionPath {
  if (!viewer || !text(viewer.id) || !org) return 'delete'
  if (organizationDeletionState(org).state !== 'active') return 'delete'
  if (!isOrganizationSuperAdmin(viewer, org)) return 'delete'
  const rows = roster || []
  const own = new Set(personIdSet(viewer, rows).map((id) => id.toLowerCase()))
  const others = rows.filter((row) => {
    const id = text(row?.id).toLowerCase()
    if (!id || own.has(id)) return false
    return rosterSegment(row) === 'active'
  })
  return others.length > 0 ? 'handover_required' : 'delete_with_company'
}

/** The audit row the eraser writes at `erasedOrganizations/{orgId}`: when and the company name, no personal data. */
export function erasedOrganizationAuditFields(org: unknown, erasedAtMs: number): { erasedAt: Date; name: string } {
  const name = text(record(org).name)
  return { erasedAt: new Date(Number.isFinite(erasedAtMs) ? erasedAtMs : Date.now()), name }
}

/** Collection path of the eraser's audit rows. */
export const ERASED_ORGANIZATIONS_COLLECTION = 'erasedOrganizations'

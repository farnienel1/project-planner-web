import { parseTimesheetStatusFields } from '@/lib/canonical'
import { isInvitePlaceholderId } from '@/lib/owner/collapseDirectoryUsers'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import {
  accountDeletionPath,
  organizationDeleteConfirmationError,
  type AccountDeletionPath,
  type AccountDeletionRosterRow,
} from '@/lib/canonical/organizationDeletion'

export const ACCOUNT_DELETE_CONFIRMATION = 'DELETE'
export const DELETED_USER_DISPLAY_NAME = 'Deleted user'
export const DELETED_PRODUCT_EVENT_USER_ID = 'deleted'
export const ACCOUNT_DELETE_JOB_TYPE = 'accountDelete'
export const ACCOUNT_DELETE_JOB_EMAIL_FIELD = 'email'
export const SOLE_ADMIN_CODE = 'sole_admin'
export const SUPPORT_EMAIL = 'info@projectplanner.us'

export const ACCOUNT_DELETE_COPY = {
  rowLabel: 'Delete my account',
  rowDescription: 'Permanently delete your login. Company records stay.',
  title: 'Delete my account',
  body: [
    'This permanently deletes your Project Planner login. You will not be able to sign in again.',
    'Timesheets, invoices and other company records stay with the organisation. Your name on those records becomes “Deleted user”.',
    'This does not cancel your organisation’s subscription. An admin must manage billing separately.',
  ],
  typeLabel: 'Type DELETE to confirm',
  passwordLabel: 'Current password',
  confirmButton: 'Delete my account',
  cancelButton: 'Cancel',
  soleAdminTitle: 'Transfer admin first',
  soleAdminBody: (orgName: string) =>
    `You are the only admin of ${orgName || 'this organisation'}. Transfer admin access to someone else, or email ${SUPPORT_EMAIL} if you need this organisation removed.`,
  soleAdminClose: 'OK',
  // Rulebook 1.15.0 (`accountDeletionPath`).
  handoverTitle: 'Hand over super admin first',
  handoverPickLabel: 'Make one of these admins the super admin',
  handoverPromoteLabel: 'Or make a member an admin and the super admin',
  handoverOtherOrg: (orgName: string) =>
    `Open ${orgName || 'that organisation'}, then hand over super admin in Manage Users (Change Super Admin) before you delete your account.`,
  handoverDone: 'Super admin handed over. You can delete your account now.',
  companyTitle: 'This also deletes the organisation',
  companyNameLabel: (orgName: string) => `Type the company name (${orgName})`,
  companyNote:
    'The organisation is locked straight away and erased after 30 days. Only Project Planner support (info@projectplanner.us) can restore it, because nobody else is left in it. The subscription is cancelled at the end of the billing period, with no refund.',
} as const

export type AdminLikeFlags = {
  isSuperAdmin?: boolean
  adminAccess?: boolean
  role?: string | null
  memberRole?: string | null
  permissions?: { adminAccess?: boolean } | null
}

export type OrgMemberSnapshot = {
  uid: string
  flags: AdminLikeFlags
  /** Rulebook 1.15.0: the users document as stored (roster fields for `accountDeletionPath`). */
  profile?: Record<string, unknown>
}

export type OrgDeleteSnapshot = {
  orgId: string
  orgName: string
  creatorUserId: string
  members: Record<string, string>
  memberFlags: OrgMemberSnapshot[]
  /** Rulebook 1.15.0 §20: `organizations/{orgId}.deletion` as stored. */
  deletion?: unknown
}

export type SoleAdminBlock = {
  code: typeof SOLE_ADMIN_CODE
  orgId: string
  orgName: string
}

export type AccountDeleteBodyError = {
  ok: false
  status: number
  error: string
}

export type AccountDeleteBodyOk = {
  ok: true
  confirmation: typeof ACCOUNT_DELETE_CONFIRMATION
  password: string
  /** Rulebook 1.15.0: organisation id → company name typed, for the organisations deleted with the account. */
  companyNames: Record<string, string>
}

const ROSTER_CLEAR_FIELDS = [
  'email',
  'mobileNumber',
  'mobile',
  'phone',
  'profilePhotoURL',
  'vatNumber',
  'utrNumber',
] as const

const ROSTER_NAME_FIELDS = ['firstName', 'surname', 'lastName', 'name', 'displayName'] as const

export function isAdminLike(flags: AdminLikeFlags): boolean {
  if (flags.isSuperAdmin === true) return true
  if (flags.adminAccess === true) return true
  if (flags.permissions?.adminAccess === true) return true
  if (String(flags.role || '').trim().toLowerCase() === 'admin') return true
  if (String(flags.memberRole || '').trim().toLowerCase() === 'admin') return true
  return false
}

export function parseAccountDeleteBody(body: unknown): AccountDeleteBodyOk | AccountDeleteBodyError {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const confirmation = typeof value.confirmation === 'string' ? value.confirmation.trim() : ''
  const password = typeof value.password === 'string' ? value.password : ''
  if (confirmation !== ACCOUNT_DELETE_CONFIRMATION || !password) {
    return {
      ok: false,
      status: 400,
      error: 'Type DELETE and enter your password to delete your account.',
    }
  }
  const companyNames: Record<string, string> = {}
  if (value.companyNames && typeof value.companyNames === 'object' && !Array.isArray(value.companyNames)) {
    for (const [key, name] of Object.entries(value.companyNames as Record<string, unknown>).slice(0, 20)) {
      if (typeof name === 'string') companyNames[key] = name.slice(0, 200)
    }
  }
  return { ok: true, confirmation: ACCOUNT_DELETE_CONFIRMATION, password, companyNames }
}

export function normalizeAccountDeleteEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** Auth email, then the value stored on the admin job, then the profile field. */
export function resolveAccountDeleteEmail(input: {
  authEmail?: unknown
  storedEmail?: unknown
  profileEmail?: unknown
}): string {
  return (
    normalizeAccountDeleteEmail(input.authEmail) ||
    normalizeAccountDeleteEmail(input.storedEmail) ||
    normalizeAccountDeleteEmail(input.profileEmail)
  )
}

export function ownerAccountDeleteBlock(email: string | null | undefined): AccountDeleteBodyError | null {
  if (!isPlatformOwnerEmail(email)) return null
  return { ok: false, status: 403, error: 'The owner account cannot be deleted.' }
}

export function soleAdminErrorBody(block: SoleAdminBlock) {
  return {
    error: `You are the only admin of ${block.orgName || 'an organisation'}. Transfer admin access first, or email ${SUPPORT_EMAIL}.`,
    code: SOLE_ADMIN_CODE,
    orgId: block.orgId,
    orgName: block.orgName,
  }
}

export function findSoleAdminBlock(uid: string, orgs: readonly OrgDeleteSnapshot[]): SoleAdminBlock | null {
  for (const org of orgs) {
    const listed = org.memberFlags.some((row) => row.uid === uid)
      ? org.memberFlags
      : [
          ...org.memberFlags,
          {
            uid,
            flags: { memberRole: org.members[uid] || (org.creatorUserId === uid ? 'admin' : '') },
          },
        ]
    const adminLike = listed.filter((row) => isAdminLike(row.flags) || org.members[row.uid] === 'admin')
    const others = adminLike.filter((row) => row.uid !== uid)
    const selfIsAdmin =
      adminLike.some((row) => row.uid === uid) ||
      org.members[uid] === 'admin' ||
      org.creatorUserId === uid
    if (selfIsAdmin && others.length === 0) {
      return { code: SOLE_ADMIN_CODE, orgId: org.orgId, orgName: org.orgName }
    }
    if (org.creatorUserId === uid && others.length === 0) {
      return { code: SOLE_ADMIN_CODE, orgId: org.orgId, orgName: org.orgName }
    }
  }
  return null
}

export function pickCreatorSuccessor(uid: string, org: OrgDeleteSnapshot): string | null {
  if (org.creatorUserId !== uid) return null
  const successors = org.memberFlags
    .filter((row) => row.uid !== uid && (isAdminLike(row.flags) || org.members[row.uid] === 'admin'))
    .map((row) => row.uid)
    .sort()
  return successors[0] || null
}

/** Existing roster keys only — do not invent Firestore field names. */
export function rosterAnonymisePatch(existing: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const hasFirst = 'firstName' in existing
  const hasSurname = 'surname' in existing
  const hasLast = 'lastName' in existing
  if (hasFirst && (hasSurname || hasLast)) patch.firstName = 'Deleted'
  else if (hasFirst) patch.firstName = DELETED_USER_DISPLAY_NAME
  if (hasSurname) patch.surname = hasFirst ? 'user' : DELETED_USER_DISPLAY_NAME
  if (hasLast) patch.lastName = hasFirst ? 'user' : DELETED_USER_DISPLAY_NAME
  if ('name' in existing) patch.name = DELETED_USER_DISPLAY_NAME
  if ('displayName' in existing) patch.displayName = DELETED_USER_DISPLAY_NAME
  if (!ROSTER_NAME_FIELDS.some((key) => key in existing)) {
    patch.firstName = 'Deleted'
    patch.surname = 'user'
  }
  for (const key of ROSTER_CLEAR_FIELDS) {
    if (key in existing) patch[key] = ''
  }
  return patch
}

/**
 * Placeholder delete failed. Clearing only a uid field is not enough — write
 * the full anonymised shape so the row cannot stay Pending with a real name.
 */
export function placeholderDeleteFallbackPatch(existing: Record<string, unknown>): Record<string, unknown> {
  return rosterAnonymisePatch({
    ...existing,
    email: existing.email ?? '',
    firstName: existing.firstName ?? '',
    surname: existing.surname ?? '',
    name: existing.name ?? '',
    displayName: existing.displayName ?? '',
    mobileNumber: existing.mobileNumber ?? '',
    mobile: existing.mobile ?? '',
    phone: existing.phone ?? '',
  })
}

/** Fields whose stored value is already the anonymised value. Rewriting them is a no-op. */
export function changedAnonymisePatch(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const changed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.is(existing[key], value)) changed[key] = value
  }
  return changed
}

/**
 * A previous delete already cleared the login identity.
 * Contact fields that are still present must already be empty; a leftover phone means cleanup is unfinished.
 */
export function profileAlreadyAnonymised(existing: Record<string, unknown>): boolean {
  if (existing.email !== '') return false
  if (existing.name !== DELETED_USER_DISPLAY_NAME && existing.displayName !== DELETED_USER_DISPLAY_NAME) {
    return false
  }
  for (const key of ROSTER_CLEAR_FIELDS) {
    if (key in existing && existing[key] !== '') return false
  }
  return true
}

/** Membership is already gone and the profile is already the deleted-user shape. Do not scan the org again. */
export function retryFinishesWithoutOrgScan(input: {
  profile: Record<string, unknown> | null
  membershipCount: number
}): boolean {
  if (!input.profile || input.membershipCount > 0) return false
  return profileAlreadyAnonymised(input.profile)
}

/** Unused invite rows. A used invitation is left as an audit record. */
export function unusedInvitationShouldDelete(plain: Record<string, unknown>): boolean {
  return plain.isUsed !== true
}

/**
 * Invite placeholder: another users/{uuid} still holding this email because the
 * invite was never accepted (passwordSet false). Missing passwordSet is a live
 * account. Not the Auth uid being deleted.
 */
export function isUnusedInvitePlaceholder(input: {
  userId: string
  deletingUid: string
  email: string
  userEmail: unknown
  passwordSet: unknown
}): boolean {
  const userId = String(input.userId || '').trim()
  const deletingUid = String(input.deletingUid || '').trim()
  if (!userId || !deletingUid || userId === deletingUid) return false
  if (!isInvitePlaceholderId(userId)) return false
  if (input.passwordSet !== false) return false
  const target = input.email.trim().toLowerCase()
  if (!target) return false
  const userEmail = typeof input.userEmail === 'string' ? input.userEmail.trim().toLowerCase() : ''
  return userEmail === target
}

export function timesheetSnapshotShouldStay(data: Record<string, unknown>): boolean {
  const fields = parseTimesheetStatusFields(data)
  return (
    (fields.exportedAtMs != null && fields.exportedAtMs > 0) ||
    (fields.operativeSignedAtMs != null && fields.operativeSignedAtMs > 0) ||
    (fields.managerSignedAtMs != null && fields.managerSignedAtMs > 0)
  )
}

export function unsignedTimesheetAnonymisePatch(existing: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (timesheetSnapshotShouldStay(existing)) return patch
  for (const key of ['firstName', 'surname', 'lastName', 'name', 'displayName', 'operativeName'] as const) {
    if (key in existing) {
      patch[key] = key === 'firstName' ? 'Deleted' : key === 'surname' || key === 'lastName' ? 'user' : DELETED_USER_DISPLAY_NAME
    }
  }
  for (const key of ROSTER_CLEAR_FIELDS) {
    if (key in existing) patch[key] = ''
  }
  return patch
}

export function ideaAuthorAnonymisePatch(existing: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if ('authorName' in existing) patch.authorName = DELETED_USER_DISPLAY_NAME
  return patch
}

export function commentAnonymisePatch(existing: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if ('authorName' in existing) patch.authorName = DELETED_USER_DISPLAY_NAME
  return patch
}

export function collectMembershipIds(input: {
  membershipDocIds?: readonly string[]
  userOrganizationId?: string | null
  memberMapOrgIds?: readonly string[]
  creatorOrgIds?: readonly string[]
}): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of [
    ...(input.membershipDocIds || []),
    input.userOrganizationId || '',
    ...(input.memberMapOrgIds || []),
    ...(input.creatorOrgIds || []),
  ]) {
    const id = String(value || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function adminLikeFromUserFields(
  fields: Record<string, unknown>,
  memberRole?: string | null
): AdminLikeFlags {
  const permissions =
    fields.permissions && typeof fields.permissions === 'object'
      ? (fields.permissions as { adminAccess?: boolean })
      : null
  return {
    isSuperAdmin: fields.isSuperAdmin === true,
    adminAccess: fields.adminAccess === true,
    role: typeof fields.role === 'string' ? fields.role : '',
    memberRole: memberRole || '',
    permissions,
  }
}

// MARK: - Rulebook 1.15.0: delete my account paths

export const HANDOVER_REQUIRED_CODE = 'handover_required'
export const COMPANY_DELETE_REQUIRED_CODE = 'company_delete_required'

export type AccountOrgPath = { orgId: string; orgName: string; path: AccountDeletionPath }

/**
 * `accountDeletionPath` for every organisation the account belongs to, from the server's snapshots: the roster is
 * the members (and creator) with their users documents; the viewer is the account's users document.
 */
export function accountOrgPaths(
  uid: string,
  viewerProfile: Record<string, unknown> | null | undefined,
  snapshots: readonly OrgDeleteSnapshot[]
): AccountOrgPath[] {
  return snapshots.map((org) => {
    const roster = org.memberFlags.map((row) => ({ ...(row.profile || {}), id: row.uid }) as AccountDeletionRosterRow)
    const viewer = { ...(viewerProfile || {}), id: uid } as Parameters<typeof accountDeletionPath>[0]
    const path = accountDeletionPath(viewer, roster, { id: org.orgId, creatorUserId: org.creatorUserId, deletion: org.deletion })
    return { orgId: org.orgId, orgName: org.orgName, path }
  })
}

/**
 * The organisations whose company-name confirmation is missing or wrong (`organizationDeleteConfirmationError`), for
 * the organisations deleted with the account. `companyNames` maps organisation id → the name typed.
 */
export function missingCompanyConfirmations(
  paths: readonly AccountOrgPath[],
  companyNames: Record<string, unknown> | null | undefined
): AccountOrgPath[] {
  return paths.filter(
    (row) =>
      row.path === 'delete_with_company' &&
      organizationDeleteConfirmationError({
        organizationName: row.orgName,
        typedName: String((companyNames || {})[row.orgId] ?? ''),
        typedConfirmation: ACCOUNT_DELETE_CONFIRMATION,
      }) !== null
  )
}

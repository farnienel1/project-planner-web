/**
 * Accepting an invitation (rulebook §11, §14; 1.10.0 H3). One plan for every platform: whether `users/{authUid}`
 * is written, whether the invite placeholder is copied and removed, and the role and pay the person gets in the
 * inviting organisation. Pure; the app runs the writes in the order given.
 *
 * Before 1.10.0 a person who already had an account in another company and accepted an invite to a second one had
 * the placeholder deleted although their profile was not rewritten, and their role in the new company copied from
 * the first company's profile.
 */

import { accountKindFromFlags } from './userProfile'

export type InviteAcceptMode =
  /** No account yet: `users/{authUid}` is created from the invitation. */
  | 'newProfile'
  /** No account yet and the placeholder Add User wrote is this invite's: copied onto `users/{authUid}`, then removed. */
  | 'migratePlaceholder'
  /** The account already exists (it set a password before): its profile is never rewritten, the placeholder stays. */
  | 'existingAccount'

export type InviteAcceptPlan = {
  mode: InviteAcceptMode
  /** `users/{authUid}` is created (from `profileSource`); false for an existing account. */
  writeProfile: boolean
  profileSource: 'placeholder' | 'invitation' | null
  /** Copy the placeholder's `private/taxIds`, then delete the placeholder — only after `users/{authUid}` was written. */
  movePlaceholder: boolean
  /** Point `organizations/{orgId}/userEmails/{email}` at the account (false keeps it on the placeholder). */
  claimToAccount: boolean
  /** The account's role in the inviting organisation: from the invitation, never another company's profile. */
  role: 'admin' | 'manager' | 'operative' | 'member'
  /** The invitation's permissions for that organisation (membership `permissions`). */
  permissions: Record<string, boolean>
  /** The invitation's pay (`payBasis` with its one rate), or null when it set none. */
  pay: { payBasis: 'day' | 'hourly'; dayRate: number | null; hourlyRate: number | null } | null
  /** True when the account's own profile names another organisation (a second company). */
  joinsAnotherCompany: boolean
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function flags(value: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [key, flag] of Object.entries(record(value) ?? {})) if (typeof flag === 'boolean') out[key] = flag
  return out
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sameOrganization(a: unknown, b: string): boolean {
  const raw = text(a)
  const id = raw.includes('/') ? raw.split('/').filter(Boolean).pop() ?? '' : raw
  return id !== '' && id.toLowerCase() === b.toLowerCase()
}

/**
 * The accept plan. `existingProfile` is `users/{authUid}` when it exists and has set a password (null otherwise);
 * `placeholder` is the placeholder the email claim names when it is this invite's (pending, same email, same
 * organisation; null otherwise); `invitation` is `invitations/{id}` (`organizationId`, `role`, `permissions`,
 * `payBasis`, `dayRate`, `hourlyRate`).
 *   - Role: the invitation's `role`, else the kind its permissions give (`accountKindFromFlags`), else the
 *     placeholder's role, else `member` — never the existing profile's role.
 *   - An existing account in another company keeps its profile and the placeholder (the in-organisation row with
 *     the invited pay); the claim stays on the placeholder; the role is granted through the membership path. An
 *     existing profile in this organisation is a retried accept: the profile is not rewritten, the placeholder is
 *     moved and the claim pointed at the account.
 *   - Otherwise `users/{authUid}` is written (from the placeholder when there is one), and only then is the
 *     placeholder moved (tax ids) and removed and the claim pointed at the account.
 */
export function inviteAcceptWrites(input: {
  existingProfile: Record<string, unknown> | null | undefined
  placeholder: Record<string, unknown> | null | undefined
  invitation: Record<string, unknown> | null | undefined
}): InviteAcceptPlan {
  const invitation = record(input.invitation) ?? {}
  const placeholder = record(input.placeholder)
  const existing = record(input.existingProfile)
  const organizationId = text(invitation.organizationId)
  const permissions = flags(invitation.permissions)
  const invitedRole = text(invitation.role).toLowerCase()
  const role = (['admin', 'manager', 'operative', 'member'].includes(invitedRole)
    ? invitedRole
    : Object.keys(permissions).length > 0
      ? accountKindFromFlags({
          isSuperAdmin: false,
          adminAccess: permissions.adminAccess === true,
          operativeMode: permissions.operativeMode === true,
          role: '',
        })
      : ['admin', 'manager', 'operative'].includes(text(placeholder?.role).toLowerCase())
        ? text(placeholder?.role).toLowerCase()
        : 'member') as InviteAcceptPlan['role']
  const basis = text(invitation.payBasis) === 'hourly' ? 'hourly' : text(invitation.payBasis) === 'day' ? 'day' : null
  const pay = basis === 'hourly' && finite(invitation.hourlyRate) != null
    ? { payBasis: 'hourly' as const, dayRate: null, hourlyRate: finite(invitation.hourlyRate) }
    : basis === 'day' && finite(invitation.dayRate) != null
      ? { payBasis: 'day' as const, dayRate: finite(invitation.dayRate), hourlyRate: null }
      : null
  if (existing) {
    const another = organizationId !== '' && !sameOrganization(existing.organizationId, organizationId)
    // Same organisation: a retried Continue whose profile write already landed — finish moving the placeholder.
    return {
      mode: 'existingAccount',
      writeProfile: false,
      profileSource: null,
      movePlaceholder: !another && Boolean(placeholder),
      claimToAccount: !another,
      role,
      permissions,
      pay,
      joinsAnotherCompany: another,
    }
  }
  const migrating = Boolean(placeholder)
  return {
    mode: migrating ? 'migratePlaceholder' : 'newProfile',
    writeProfile: true,
    profileSource: migrating ? 'placeholder' : 'invitation',
    movePlaceholder: migrating,
    claimToAccount: true,
    role,
    permissions,
    pay,
    joinsAnotherCompany: false,
  }
}

// MARK: - What accepting applies (1.11.0, owner decisions round 3)

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const id = text(item)
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

/**
 * The role an invitation gives in its organisation (§11, §14): its `role` (`admin` | `manager` | `operative` |
 * `member`); else, for an older invitation without one, the kind its `permissions` give (`adminAccess` → admin,
 * `operativeMode` → operative, else manager); with no permissions either, `member`. The security rules compute the
 * same (`invitationRole`).
 */
export function invitationRole(invitation: Record<string, unknown> | null | undefined): 'admin' | 'manager' | 'operative' | 'member' {
  const row = record(invitation) ?? {}
  const stored = text(row.role).toLowerCase()
  if (stored === 'admin' || stored === 'manager' || stored === 'operative' || stored === 'member') return stored
  const permissions = record(row.permissions) ?? {}
  if (Object.keys(permissions).length === 0) return 'member'
  if (permissions.adminAccess === true) return 'admin'
  if (permissions.operativeMode === true) return 'operative'
  return 'manager'
}

const OPERATIVE_INVITE_FORBIDDEN_FLAGS = ['adminAccess', 'isSuperAdmin', 'manager', 'operatives'] as const

function flagOn(value: unknown): boolean {
  return value === true || value === 1
}

/**
 * Rulebook 1.12.0 (§11, §16, B2): an invitation that gives an operative and nothing more — `invitationRole` is
 * `operative`, operative mode is on (in `permissions`, or the stored role), and no admin, super admin, manager or
 * operatives toggle is on at the top level or in `permissions`. The only invitation a manager with operatives access
 * may create or change (the security rules apply the same test, `invitationIsOperativeOnly`); Add User on both apps
 * checks it before writing so the save is not refused.
 */
export function invitationIsOperativeOnly(invitation: Record<string, unknown> | null | undefined): boolean {
  const row = record(invitation) ?? {}
  const permissions = record(row.permissions) ?? {}
  if (invitationRole(row) !== 'operative') return false
  if (!(flagOn(permissions.operativeMode) || text(row.role).toLowerCase() === 'operative')) return false
  return OPERATIVE_INVITE_FORBIDDEN_FLAGS.every((key) => !flagOn(permissions[key]) && !flagOn(row[key]))
}

/**
 * The fields accepting writes from the invitation onto a new `users/{authUid}` (mode `newProfile`; rulebook §11,
 * 1.11.0): exactly what Add User stored on it — `role`, the `permissions` map (and its flags at the top level, as
 * both apps read them), `employmentType`, one pay basis with its rate, and the line manager (`assignedManagerUserIds`
 * with `assignedManagerUserId`, or `hasNoLineManager: true`). Nothing from another company's profile.
 */
export function invitationProfileFields(invitation: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const row = record(invitation) ?? {}
  const out: Record<string, unknown> = { role: invitationRole(row) }
  const permissions = record(row.permissions)
  if (permissions) {
    out.permissions = { ...permissions }
    for (const [key, value] of Object.entries(permissions)) if (typeof value === 'boolean') out[key] = value
  }
  const employment = text(row.employmentType)
  if (employment) out.employmentType = employment === 'paye' ? 'paye' : 'self_employed'
  const basis = text(row.payBasis)
  if (basis === 'hourly' && finite(row.hourlyRate) != null) {
    out.payBasis = 'hourly'
    out.hourlyRate = finite(row.hourlyRate)
  } else if (basis === 'day' && finite(row.dayRate) != null) {
    out.payBasis = 'day'
    out.dayRate = finite(row.dayRate)
  }
  if (row.hasNoLineManager === true) {
    out.hasNoLineManager = true
  } else {
    let managers = idList(row.assignedManagerUserIds)
    if (managers.length === 0 && text(row.assignedManagerUserId)) managers = [text(row.assignedManagerUserId)]
    if (managers.length > 0) {
      out.assignedManagerUserIds = managers
      out.assignedManagerUserId = managers[0]
      out.hasNoLineManager = false
    }
  }
  return out
}

/** Membership keys an accepted invitation writes (and the security rules allow on that create). */
export const INVITE_MEMBERSHIP_FIELDS = [
  'organizationId',
  'role',
  'status',
  'isSuperAdmin',
  'accountActive',
  'permissions',
  'invitationId',
  'invitedBy',
  'invitedAt',
  'acceptedAt',
  'updatedAt',
] as const

/**
 * The writes that make an accepted invitation the person's access in the inviting organisation (rulebook §11, §14,
 * §16; 1.11.0), for an account that already exists in another company (`inviteAcceptWrites` `joinsAnotherCompany`):
 * one batch of
 *   - `users/{authUid}/orgMemberships/{orgId}` created with `membership` — the invitation's role
 *     (`invitationRole`) and its `permissions` map exactly as stored, `status: 'active'`, not super admin, active,
 *     and `invitationId` naming the invitation;
 *   - `organizations/{orgId}` `members.{authUid}` = that role (`membersField`, `role`);
 *   - `invitations/{id}` marked used (`invitationUsedWriteFields`).
 * The security rules accept it only for a genuine, unused invitation to the signed-in email, with exactly these values
 * and the invitation marked used in the same batch. Pay and the line manager stay on the placeholder Add User wrote
 * (the in-organisation row). Null without an organisation, invitation id or account id.
 */
export function inviteMembershipWrites(input: {
  invitation: Record<string, unknown> | null | undefined
  invitationId: string
  authUid: string
  now: unknown
}): { organizationId: string; membership: Record<string, unknown>; membersField: string; role: string } | null {
  const row = record(input?.invitation) ?? {}
  const organizationId = text(row.organizationId)
  const invitationId = text(input?.invitationId)
  const authUid = text(input?.authUid)
  if (!organizationId || !invitationId || !authUid) return null
  const role = invitationRole(row)
  const membership: Record<string, unknown> = {
    organizationId,
    role,
    status: 'active',
    isSuperAdmin: false,
    accountActive: true,
    permissions: { ...(record(row.permissions) ?? {}) },
    invitationId,
    invitedAt: input.now,
    acceptedAt: input.now,
    updatedAt: input.now,
  }
  const invitedBy = text(row.invitedBy)
  if (invitedBy) membership.invitedBy = invitedBy
  return { organizationId, membership, membersField: `members.${authUid}`, role }
}

// MARK: - The invited rate under private pay (rulebook §8, §11; 1.27.0, owner decision 6)

const INVITED_PAY_FIELDS = [
  'payBasis',
  'dayRate',
  'hourlyRate',
  'employmentType',
  'employmentTypeTransitionFrom',
  'employmentTypeEffectiveAt',
] as const

/**
 * The pay profile an accepting invitee creates for their own account while `privatePay` is on (rulebook §8, §11,
 * 1.27.0): an exact copy of the pay fields on their invitation placeholder's pay profile
 * (`payProfiles/{placeholderId}`, written at Add User), with `userId` the account id — written to
 * `payProfiles/{authUid}` before the email claim moves to the account (the security rules allow this one create only
 * while the claim still names that pending placeholder, and only with the same values; the person never sets their
 * own pay). Null — nothing is written — when `privatePay` is off (nothing changes), when there is no placeholder or it
 * is the account itself, when the account already has a pay profile (a retried accept), or when the placeholder's
 * profile holds no pay field. `placeholderProfile` and `accountProfile` are the stored documents (or null).
 */
export function invitePayProfileCopyWrite(input: {
  privatePay: boolean | null | undefined
  authUid: unknown
  placeholderId: unknown
  placeholderProfile: Record<string, unknown> | null | undefined
  accountProfile?: Record<string, unknown> | null | undefined
}): { subjectId: string; set: Record<string, unknown> } | null {
  if (input?.privatePay !== true) return null
  const authUid = text(input.authUid)
  const placeholderId = text(input.placeholderId)
  if (!authUid || !placeholderId || placeholderId === authUid) return null
  if (record(input.accountProfile)) return null
  const source = record(input.placeholderProfile)
  if (!source) return null
  const set: Record<string, unknown> = { userId: authUid }
  let copied = 0
  for (const key of INVITED_PAY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    set[key] = source[key]
    copied += 1
  }
  return copied > 0 ? { subjectId: authUid, set } : null
}

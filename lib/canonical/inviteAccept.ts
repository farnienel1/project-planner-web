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

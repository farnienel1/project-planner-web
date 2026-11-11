/**
 * Ghost operatives (rulebook 1.34.0 §11, owner design 6 Nov "ghost: all recommended", answers rounds 1–2).
 *
 * A ghost is a bookable operative with no app login: no email, no phone. It is a `users/{ghostId}` document of the
 * organisation with `ghost: true`, `passwordSet: false` (stored explicitly), the operative level, always
 * self-employed, a day OR hourly rate above 0 and a line manager. No `userEmails` claim, no invitation, no membership,
 * no `members` entry. It reuses every users-document rule (line manager, leave deciders, pay, the delete plan), so a
 * ghost is bookable everywhere, shows as unbooked labour in Warnings and Daily Overview, has leave booked for it by
 * its line manager or an admin (saved approved, nobody notified) and its cost shows on the weekly report. It never
 * logs in, never gets notifications, timesheets, overtime, price work, expenses or My Schedule.
 *
 * Created by admins and managers with the Operatives toggle (`canCreateGhost` = `canManageOperatives`); the admins are
 * told with the existing `operative_created` / `operative_deleted` notices. An admin may give a ghost app access
 * (`ghostUpgradeWrites`): the ghost gets an email, an invitation and an email claim and becomes an ordinary invite
 * placeholder that stays a ghost (bookable, "No app login · Invited") until the person accepts; accepting copies it
 * onto their account without `ghost` / `inviteEmailHint` (`inviteAcceptPlaceholderFields`) and history follows through
 * `formerUserIds`. Existing no-login `operatives` rows are converted by an owner-run script
 * (`ghostConversionCandidates`, `ghostConversionWrites`); a converted row keeps its id, so its bookings, leave and pay
 * history stay attached, and its email is kept aside as `inviteEmailHint` for "Give app access".
 *
 * Pure. Both apps call these through the packed script (iOS `CanonicalBusinessEngine`).
 */

import { invitationCreateFields } from './createDocuments'
import { canDecideLeave, type LeaveApproverMember, type LeaveDecisionViewer, type LeaveRequester } from './leaveRequests'
import { lineManagerCandidates, type LineManagerRosterPerson } from './lineManagers'
import { documentOrganizationId } from './peopleDocuments'
import { payProfilePath, payProfileWriteFieldsFromProfileWrite, sharedDocumentPayWrite } from './payProfile'
import { canManageOperatives, permissionLevelOf, permissionsWriteMap, addUserPermissionDefaults } from './permissionLevels'
import { idKey, idText } from './personIds'
import { isAnonymisedDeletedProfile, isGhostUser } from './userRosterSegment'
import { writeMetadataFields } from './writeMetadata'

export { isGhostUser }

// MARK: - Copy

export const GHOST_FIELD = 'ghost'
export const GHOST_INVITE_EMAIL_HINT_FIELD = 'inviteEmailHint'
/** The badge on every list and picker row of a ghost. */
export const GHOST_BADGE_LABEL = 'No app login'
/** A ghost an admin has invited who has not accepted yet (still bookable, Q-G3 / J1). */
export const GHOST_INVITED_BADGE_LABEL = 'No app login · Invited'
/** The toggle at the very top of Add user (operative) / Add new operative. */
export const GHOST_TOGGLE_LABEL = 'Ghost account'
export const GHOST_TOGGLE_HELP = 'For someone who works for you but does not use the app.'
/** The small expandable explanation under the toggle (owner wording Q-G4, without the phone mention). */
export const GHOST_OPERATIVE_EXPLANATION =
  'A ghost account is for someone who works for you but does not use the app — they have no login and no email. ' +
  'Add their name, their day or hourly rate and their line manager. You can then book them onto jobs, see them in ' +
  'Daily Overview and Warnings when they are not booked, book their annual leave, and see their cost on the weekly ' +
  'report. They never log in, and they get no notifications, timesheets, overtime, price work or expenses. An admin ' +
  'can give them app access later, and everything already booked for them stays with them.'
export const GHOST_UPGRADE_LABEL = 'Give app access'
export const GHOST_UPGRADE_HELP =
  'Send this person an invitation. They stay bookable as they are until they accept; their bookings, leave and pay history move to their account.'
export const GHOST_NAME_REQUIRED_MESSAGE = 'First name and surname are required.'
export const GHOST_RATE_REQUIRED_MESSAGE = 'Set a day rate or hourly rate above 0 — a ghost is paid from it.'
export const GHOST_LINE_MANAGER_REQUIRED_MESSAGE = 'Choose a line manager — they book this person’s leave and see when they are not booked.'
export const GHOST_LINE_MANAGER_INVALID_MESSAGE = 'Choose a line manager from the list (an active admin or manager).'
export const GHOST_EMAIL_REFUSED_MESSAGE = 'A ghost has no email. Turn off Ghost account to invite this person instead.'
export const GHOST_PHONE_REFUSED_MESSAGE = 'A ghost has no phone number.'
export const GHOST_CREATE_REFUSED_MESSAGE = 'Only admins and managers with the Operatives permission can add a ghost.'
export const GHOST_UPGRADE_REFUSAL_MESSAGES = {
  not_admin: 'Only an admin can give a ghost app access.',
  not_ghost: 'This person already has app access.',
  inactive: 'Reactivate this person before giving them app access.',
  email_required: 'Enter the email address the invitation goes to.',
  email_invalid: 'Enter a valid email address.',
  already_invited: 'This person has already been invited. They can use the email they were sent.',
} as const
export type GhostUpgradeRefusal = keyof typeof GHOST_UPGRADE_REFUSAL_MESSAGES

// MARK: - Reading

/** True for a ghost an admin has invited (it has an email now) who has not accepted. */
export function isGhostInvited(user: { ghost?: unknown; email?: unknown } | null | undefined): boolean {
  return isGhostUser(user) && idText(user?.email) !== ''
}

/** The badge for a list or picker row: '' for anyone who is not a ghost. */
export function ghostBadgeLabel(user: { ghost?: unknown; email?: unknown } | null | undefined): string {
  if (!isGhostUser(user)) return ''
  return isGhostInvited(user) ? GHOST_INVITED_BADGE_LABEL : GHOST_BADGE_LABEL
}

/**
 * The key two picker / list rows are folded on: the email (trimmed, lower case), else `id:` + the id (lower case) —
 * the key `rosterPeople` already uses. Before 1.34.0 several pickers folded on the email alone, so every person with
 * no email (ghosts, catalogue rows without one) shared the key '' and only the first was offered. '' only when there
 * is neither an email nor an id.
 */
export function personDedupeKey(person: { id?: unknown; email?: unknown } | null | undefined): string {
  const email = idKey(person?.email)
  if (email) return email
  const id = idKey(person?.id)
  return id ? `id:${id}` : ''
}

// MARK: - Creating

/** Who may add a ghost: admins and managers with the Operatives toggle (`canManageOperatives`). Never an operative. */
export function canCreateGhost(viewer: unknown): boolean {
  return canManageOperatives(viewer)
}

export type GhostDraft = {
  firstName?: string | null
  surname?: string | null
  payBasis?: 'day' | 'hourly' | string | null
  dayRate?: number | string | null
  hourlyRate?: number | string | null
  /** Line managers, stored order. At least one, each an active admin or manager (`lineManagerCandidates`). */
  lineManagerIds?: ReadonlyArray<string> | null
  tradeTypePreset?: string | null
  tradeTypeCustom?: string | null
  /** Refused when given: a ghost has no email (Give app access adds one). */
  email?: string | null
  /** Refused when given: a ghost has no phone. */
  mobileNumber?: string | null
  /** The annual-leave allowance, as Add user writes it (missing: on, organisation defaults). */
  annualLeave?: {
    enabled?: boolean | null
    daysPerYear?: number | null
    startMonth?: number | null
    endMonth?: number | null
    carriesOver?: boolean | null
    yearAllowance?: number | null
    yearAllowanceKey?: string | null
  } | null
}

function positiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The one rate a ghost is paid from: `{ payBasis, amount }`, or null when the chosen basis has no rate above 0. */
export function ghostRate(draft: GhostDraft | null | undefined): { payBasis: 'day' | 'hourly'; amount: number } | null {
  const basis = draft?.payBasis === 'hourly' ? 'hourly' : draft?.payBasis === 'day' ? 'day' : null
  if (basis === 'hourly') {
    const amount = positiveNumber(draft?.hourlyRate)
    return amount == null ? null : { payBasis: 'hourly', amount }
  }
  if (basis === 'day') {
    const amount = positiveNumber(draft?.dayRate)
    return amount == null ? null : { payBasis: 'day', amount }
  }
  const day = positiveNumber(draft?.dayRate)
  if (day != null) return { payBasis: 'day', amount: day }
  const hourly = positiveNumber(draft?.hourlyRate)
  return hourly == null ? null : { payBasis: 'hourly', amount: hourly }
}

function lineManagerIdList(draft: GhostDraft | null | undefined): string[] {
  const out: string[] = []
  for (const raw of draft?.lineManagerIds ?? []) {
    const id = idText(raw)
    if (id && !out.some((existing) => idKey(existing) === idKey(id))) out.push(id)
  }
  return out
}

/**
 * Why a ghost cannot be saved, or null: names, then the rate (above 0), then the line manager — in that order, the
 * first missing one. With `roster`, every line manager must be one `lineManagerCandidates` offers (an active, signed-up
 * admin or manager). An email or phone number is refused (a ghost holds neither; Give app access adds the email).
 * Trade is optional.
 */
export function ghostCreateError(
  draft: GhostDraft | null | undefined,
  options?: { roster?: ReadonlyArray<LineManagerRosterPerson> | null } | null
): string | null {
  if (idText(draft?.email)) return GHOST_EMAIL_REFUSED_MESSAGE
  if (idText(draft?.mobileNumber)) return GHOST_PHONE_REFUSED_MESSAGE
  if (!idText(draft?.firstName) || !idText(draft?.surname)) return GHOST_NAME_REQUIRED_MESSAGE
  if (!ghostRate(draft)) return GHOST_RATE_REQUIRED_MESSAGE
  const managers = lineManagerIdList(draft)
  if (managers.length === 0) return GHOST_LINE_MANAGER_REQUIRED_MESSAGE
  if (options?.roster) {
    const offered = new Set(lineManagerCandidates(null, options.roster).map((row) => idKey(row.id)))
    if (managers.some((id) => !offered.has(idKey(id)))) return GHOST_LINE_MANAGER_INVALID_MESSAGE
  }
  return null
}

/** The permissions a ghost's users document stores: the operative level, every toggle the adder could change off. */
export function ghostPermissions(): Record<string, boolean> {
  const map = permissionsWriteMap({ permissions: addUserPermissionDefaults('operative') }, 'operative') as Record<string, boolean>
  return { ...map, operativeMode: true, materials: false, siteAudit: false }
}

export type GhostWrite = { path: string; fields: Record<string, unknown>; serverTimestampFields: string[] }

export type GhostCreatePlan = {
  /** `users/{ghostId}`, created whole. */
  user: GhostWrite
  /** `payProfiles/{ghostId}` while `privatePay` is on (written after the users document); else null. */
  payProfile: GhostWrite | null
}

function nameFields(firstName: string, surname: string): Record<string, string> {
  const displayName = `${firstName} ${surname}`.trim()
  return { firstName, surname, lastName: surname, name: displayName, displayName }
}

/**
 * The create for a new ghost (owner design). `users/{ghostId}`: the organisation, the operative level (role,
 * `operativeMode`, `ghostPermissions` at the top level and in `permissions`), `ghost: true`, `passwordSet: false`,
 * `isActive: true` (no `isSuperAdmin` key), `policyAccepted: false`, `employmentType: 'self_employed'`,
 * `timesheetsEnabled: false`, the line managers (`assignedManagerUserIds` with `assignedManagerUserId`), one pay basis
 * with its rate, the trade when given, and write metadata. `email: ''`; no phone, `hasNoLineManager`, alias ids or claim —
 * the operatives-manager create rule accepts exactly this. The app adds `createdAt` / `updatedAt` as server time
 * (`serverTimestampFields`). While `privatePay` is on the pay goes to `payProfiles/{ghostId}` instead
 * (`sharedDocumentPayWrite`). Null when the draft fails `ghostCreateError` or an id is missing.
 */
export function ghostCreateWrites(input: {
  organizationId: string
  ghostId: string
  draft: GhostDraft
  actorUserId: string
  platform: 'web' | 'ios' | 'android'
  privatePay?: boolean | null
  roster?: ReadonlyArray<LineManagerRosterPerson> | null
}): GhostCreatePlan | null {
  const org = idText(input?.organizationId)
  const ghostId = idText(input?.ghostId)
  if (!org || !ghostId || org.includes('/') || ghostId.includes('/')) return null
  if (ghostCreateError(input.draft, { roster: input.roster ?? null })) return null
  const rate = ghostRate(input.draft)!
  const managers = lineManagerIdList(input.draft)
  const permissions = ghostPermissions()
  const fields: Record<string, unknown> = {
    organizationId: org,
    // '' (never a missing key): both apps' readers expect the field, and the Firestore emulator (1.22.0) crashes on an
    // Operatives manager's users create with no `email` key at all (docs/firestore-rules-notes.md "1.34.0").
    email: '',
    role: 'operative',
    ...nameFields(idText(input.draft.firstName), idText(input.draft.surname)),
    [GHOST_FIELD]: true,
    passwordSet: false,
    isActive: true,
    // No `isSuperAdmin` key (missing reads false): the Firestore emulator (1.22.0) crashes on an Operatives manager's
    // users create that carries `isSuperAdmin: false` (docs/firestore-rules-notes.md "1.34.0").
    policyAccepted: false,
    employmentType: 'self_employed',
    timesheetsEnabled: false,
    annualLeaveEnabled: true,
    permissions,
    ...permissions,
    assignedManagerUserIds: managers,
    assignedManagerUserId: managers[0],
    payBasis: rate.payBasis,
    ...(rate.payBasis === 'day' ? { dayRate: rate.amount } : { hourlyRate: rate.amount }),
    ...(writeMetadataFields(input.actorUserId, input.platform) || {}),
  }
  const leave = input.draft.annualLeave
  if (leave) {
    if (typeof leave.enabled === 'boolean') fields.annualLeaveEnabled = leave.enabled
    const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
    if (leave.enabled !== false) {
      if (finite(leave.daysPerYear) != null) fields.annualLeaveDaysPerYear = leave.daysPerYear
      if (finite(leave.startMonth) != null) fields.annualLeaveYearStartMonth = leave.startMonth
      if (finite(leave.endMonth) != null) fields.annualLeaveYearEndMonth = leave.endMonth
      if (typeof leave.carriesOver === 'boolean') fields.annualLeaveCarriesOver = leave.carriesOver
      if (finite(leave.yearAllowance) != null) fields.annualLeaveYearAllowance = leave.yearAllowance
      if (idText(leave.yearAllowanceKey)) fields.annualLeaveYearAllowanceKey = idText(leave.yearAllowanceKey)
    }
  }
  const preset = idText(input.draft.tradeTypePreset)
  if (preset) fields.tradeTypePreset = preset
  const custom = idText(input.draft.tradeTypeCustom)
  if (custom && preset === 'Other') fields.tradeTypeCustom = custom
  const privatePay = input.privatePay === true
  const userFields = sharedDocumentPayWrite(fields, { privatePay })
  const payFields = privatePay ? payProfileWriteFieldsFromProfileWrite(ghostId, fields) : null
  return {
    user: { path: `users/${ghostId}`, fields: userFields, serverTimestampFields: ['createdAt', 'updatedAt'] },
    payProfile: payFields
      ? {
          path: payProfilePath(org, ghostId),
          fields: { ...payFields, ...(writeMetadataFields(input.actorUserId, input.platform) || {}) },
          serverTimestampFields: ['updatedAt'],
        }
      : null,
  }
}

// MARK: - Add form

export type GhostAddFormField =
  | 'ghostToggle'
  | 'accountType'
  | 'firstName'
  | 'surname'
  | 'email'
  | 'mobileNumber'
  | 'permissions'
  | 'taxIds'
  | 'annualLeave'
  | 'lineManagers'
  | 'pay'
  | 'trade'
  | 'employmentType'
  | 'timesheets'

export type GhostAddFormRow = { field: GhostAddFormField; visible: boolean; required: boolean }

const ADD_FORM_ORDER: ReadonlyArray<GhostAddFormField> = [
  'ghostToggle',
  'accountType',
  'firstName',
  'surname',
  'email',
  'mobileNumber',
  'permissions',
  'taxIds',
  'annualLeave',
  'lineManagers',
  'pay',
  'trade',
  'employmentType',
  'timesheets',
]

/**
 * Whether the Ghost account toggle is shown on Add user / Add new operative: the viewer may add a ghost
 * (`canCreateGhost`, the permission) **and** the platform owner has switched ghost accounts on for the organisation
 * (`ghostAccountsEnabled` on `platformConfig/app`; owner decision 7 Nov "1b": hidden until the iPhone 1.34 update is
 * out). A missing switch value is off. Existing ghosts are not affected by the switch.
 */
export function ghostToggleVisible(input: { canCreateGhost: boolean; ghostAccountsEnabled?: boolean | null }): boolean {
  return input.canCreateGhost === true && input.ghostAccountsEnabled === true
}

/**
 * The Add user (operative) / Add new operative form, in order, for both apps. The Ghost account toggle is first and is
 * shown only when `ghostToggleVisible` (someone who may add a ghost, `canCreateGhost`, while the `ghostAccounts` switch
 * is on for the organisation, `ghostAccountsEnabled`; a missing `ghostAccountsEnabled` is off). With the toggle on,
 * only the fields a ghost needs stay: first name and surname (required), line managers (required), pay (required) and
 * trade (optional), plus the annual-leave allowance; the account type (always operative), email, phone, permissions,
 * tax ids, employment type (always self-employed) and timesheets disappear. With it off or hidden the form is the
 * ordinary invite form.
 */
export function ghostAddFormRows(input: {
  ghost: boolean
  canCreateGhost: boolean
  ghostAccountsEnabled?: boolean | null
}): GhostAddFormRow[] {
  const toggleVisible = ghostToggleVisible(input)
  const ghost = input.ghost === true && toggleVisible
  const ghostFields: Record<GhostAddFormField, { visible: boolean; required: boolean }> = {
    ghostToggle: { visible: true, required: false },
    accountType: { visible: false, required: false },
    firstName: { visible: true, required: true },
    surname: { visible: true, required: true },
    email: { visible: false, required: false },
    mobileNumber: { visible: false, required: false },
    permissions: { visible: false, required: false },
    taxIds: { visible: false, required: false },
    annualLeave: { visible: true, required: false },
    lineManagers: { visible: true, required: true },
    pay: { visible: true, required: true },
    trade: { visible: true, required: false },
    employmentType: { visible: false, required: false },
    timesheets: { visible: false, required: false },
  }
  return ADD_FORM_ORDER.map((field) => {
    if (field === 'ghostToggle') return { field, visible: toggleVisible, required: false }
    if (ghost) return { field, ...ghostFields[field] }
    return { field, visible: true, required: field === 'firstName' || field === 'surname' || field === 'email' }
  })
}

// MARK: - Leave

/**
 * Whether `viewer` may book leave for `person` on their behalf. For a ghost: exactly who decides their leave
 * (`canDecideLeave`: their line manager or an admin, never another manager); the leave saves approved and nobody is
 * notified (a ghost has no inbox). For anyone else the same test (a manager or admin booking for a report).
 */
export function canBookLeaveFor(
  viewer: LeaveDecisionViewer | null | undefined,
  person: (LeaveRequester & { ghost?: unknown }) | null | undefined,
  roster: ReadonlyArray<LeaveApproverMember> | null | undefined
): boolean {
  return canDecideLeave(viewer, person, roster)
}

/**
 * Leave booked for a ghost: `{ allowed, status, notify }` — allowed for `canBookLeaveFor`, always `approved`, and
 * `notify` false (no `holiday_booked_for_you` row: a ghost has no inbox, and recipient lists drop ghosts).
 */
export function ghostLeaveBooking(
  viewer: LeaveDecisionViewer | null | undefined,
  ghost: (LeaveRequester & { ghost?: unknown }) | null | undefined,
  roster: ReadonlyArray<LeaveApproverMember> | null | undefined
): { allowed: boolean; status: 'approved'; notify: false } {
  return { allowed: isGhostUser(ghost) && canBookLeaveFor(viewer, ghost, roster), status: 'approved', notify: false }
}

// MARK: - Giving app access (admins only, owner decision round 2, option 1)

export type GhostUpgradeViewer = { isActive?: boolean | null } & Record<string, unknown>

/**
 * Why `viewer` may not give `ghost` app access with `email`, or null. Admins only (outside operative mode); the person
 * must be a ghost, active, and not already invited; the email must look like an address. Whether the email is free in
 * the organisation is the app's `resolveInviteEmailClaim` check, as for Add User.
 */
export function ghostUpgradeRefusal(
  viewer: GhostUpgradeViewer | null | undefined,
  ghost: ({ ghost?: unknown; email?: unknown; isActive?: boolean | null } & Record<string, unknown>) | null | undefined,
  email?: string | null
): GhostUpgradeRefusal | null {
  if (!viewer || viewer.isActive === false || permissionLevelOf(viewer) !== 'admin') return 'not_admin'
  if (!ghost || !isGhostUser(ghost)) return 'not_ghost'
  if (ghost.isActive === false || isAnonymisedDeletedProfile(ghost as never)) return 'inactive'
  if (isGhostInvited(ghost)) return 'already_invited'
  if (email === undefined) return null
  const address = idText(email).toLowerCase()
  if (!address) return 'email_required'
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(address)) return 'email_invalid'
  return null
}

/** Whether "Give app access" is shown on a ghost's profile: an admin, an active ghost not yet invited. */
export function canUpgradeGhost(
  viewer: GhostUpgradeViewer | null | undefined,
  ghost: ({ ghost?: unknown; email?: unknown; isActive?: boolean | null } & Record<string, unknown>) | null | undefined
): boolean {
  return ghostUpgradeRefusal(viewer, ghost) === null
}

export type GhostUpgradePlan = {
  /** `users/{ghostId}` partial update: the email set, `inviteEmailHint` removed. `ghost` stays true until accepted. */
  user: { path: string; set: Record<string, unknown>; remove: string[] }
  /** `invitations/{invitationId}`, created whole (`invitationCreateFields`, operative, the ghost's line manager and pay). */
  invitation: { path: string; fields: Record<string, unknown> }
  /** `organizations/{orgId}/userEmails/{email}` → the ghost id. */
  claim: { path: string; fields: Record<string, unknown> }
}

/**
 * The writes that give a ghost app access (one batch, admins only): the ghost becomes an ordinary invite placeholder —
 * its users document gets the email (and loses `inviteEmailHint`), an invitation is created for the operative level
 * with the ghost's line managers and pay, and the email claim names the ghost. `ghost` stays true so the person stays
 * bookable and listed ("No app login · Invited") until they accept; accepting (`inviteAcceptWrites`, the existing flow)
 * copies the placeholder onto their account without `ghost` / `inviteEmailHint` and puts the ghost id in
 * `formerUserIds`, so their bookings, leave and pay history follow. Null when `ghostUpgradeRefusal` refuses.
 */
export function ghostUpgradeWrites(input: {
  viewer: GhostUpgradeViewer
  organizationId: string
  ghostId: string
  /** `users/{ghostId}` as stored. */
  ghost: Record<string, unknown>
  email: string
  invitationId: string
  invitedBy: string
  /** The app's timestamp for `createdAt` on the invitation. */
  now: unknown
  actorUserId: string
  platform: 'web' | 'ios' | 'android'
}): GhostUpgradePlan | null {
  const org = idText(input?.organizationId)
  const ghostId = idText(input?.ghostId)
  const invitationId = idText(input?.invitationId)
  if (!org || !ghostId || !invitationId || [org, ghostId, invitationId].some((id) => id.includes('/'))) return null
  if (ghostUpgradeRefusal(input.viewer, input.ghost, input.email)) return null
  const email = idText(input.email).toLowerCase()
  const ghost = input.ghost || {}
  const managers = Array.isArray(ghost.assignedManagerUserIds)
    ? (ghost.assignedManagerUserIds as unknown[]).map(idText).filter(Boolean)
    : idText(ghost.assignedManagerUserId)
      ? [idText(ghost.assignedManagerUserId)]
      : []
  const invitation = invitationCreateFields({
    email,
    organizationId: org,
    invitedBy: idText(input.invitedBy),
    firstName: ghost.firstName,
    surname: ghost.surname ?? ghost.lastName,
    employmentType: 'self_employed',
    permissions: ghostPermissions(),
    role: 'operative',
    createdAt: input.now,
    assignedManagerUserIds: managers,
    payBasis: ghost.payBasis,
    dayRate: ghost.dayRate,
    hourlyRate: ghost.hourlyRate,
    tradeTypePreset: ghost.tradeTypePreset,
    tradeTypeCustom: ghost.tradeTypeCustom,
    timesheetsEnabled: true,
    annualLeaveEnabled: typeof ghost.annualLeaveEnabled === 'boolean' ? (ghost.annualLeaveEnabled as boolean) : undefined,
  })
  if (!invitation) return null
  return {
    user: {
      path: `users/${ghostId}`,
      set: { email, ...(writeMetadataFields(input.actorUserId, input.platform) || {}) },
      remove: Object.prototype.hasOwnProperty.call(ghost, GHOST_INVITE_EMAIL_HINT_FIELD) ? [GHOST_INVITE_EMAIL_HINT_FIELD] : [],
    },
    invitation: { path: `invitations/${invitationId}`, fields: invitation },
    claim: { path: `organizations/${org}/userEmails/${email}`, fields: { userId: ghostId } },
  }
}

/** The fields accepting an invitation never copies from a placeholder onto the account (1.34.0): the ghost markers. */
/** Kept equal to `inviteAcceptWrites(...).dropPlaceholderFields` (a test locks it). */
export const INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS: ReadonlyArray<string> = [GHOST_FIELD, GHOST_INVITE_EMAIL_HINT_FIELD]

/** The placeholder as the new account copies it: every field but `INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS`. */
export function inviteAcceptPlaceholderFields<T extends Record<string, unknown>>(placeholder: T | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(placeholder || {})) {
    if (INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS.includes(key)) continue
    out[key] = value
  }
  return out
}

// MARK: - Converting no-login operatives rows (owner-run script, Q-G2)

export type GhostConversionOperativeRow = {
  id: string
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  isActive?: boolean | null
  linkedUserId?: string | null
  userId?: string | null
  uid?: string | null
  tradeTypePreset?: string | null
  tradeTypeCustom?: string | null
  trade?: string | null
  payBasis?: string | null
  dayRate?: number | null
  hourlyRate?: number | null
}

export type GhostConversionUser = {
  id: string
  email?: string | null
  /** The id, a path (`organizations/{id}`) or a DocumentReference (`documentOrganizationId`). */
  organizationId?: unknown
  ghost?: unknown
}

export type GhostConversionCandidate = {
  /** The row kept: its id becomes `users/{operativeId}`. */
  operativeId: string
  firstName: string
  lastName: string
  name: string
  /** The row's email (kept aside as `inviteEmailHint`), '' when none. */
  email: string
  trade: string
  payBasis: 'day' | 'hourly' | null
  rate: number | null
  /** Other no-login rows on the same email: their ids go on the ghost's `formerUserIds`. */
  duplicateOperativeIds: string[]
  /** What the owner must check or fill on the check list. Empty when the row is ready apart from the line manager. */
  issues: string[]
}

function rowName(row: GhostConversionOperativeRow): { first: string; last: string; full: string } {
  const first = idText(row.firstName)
  const last = idText(row.lastName)
  const full = `${first} ${last}`.trim() || idText(row.name)
  if (first || last) return { first, last, full }
  const parts = full.split(/\s+/).filter(Boolean)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' '), full }
}

/**
 * The `operatives` rows of one organisation that are no-login people (Q-G2): active, not anonymised, with no users
 * document of this organisation on their id, their stored link (`linkedUserId` / `userId` / `uid`) or their email. One
 * candidate per email (the row with a rate first, then the lower id); the other rows on that email are listed as
 * `duplicateOperativeIds`. Rows with no email are each their own candidate. Sorted by name. `issues` lists what the
 * owner's check list must fill: no name, no rate above 0. The line manager is always filled on the check list.
 */
export function ghostConversionCandidates(input: {
  organizationId: string
  operatives: ReadonlyArray<GhostConversionOperativeRow>
  users: ReadonlyArray<GhostConversionUser>
  /**
   * 1.36.0: the organisation's anchored people (§1 `rosterMembersForOrganization`: every key of `members` and the
   * creator). Their users documents count as accounts here whatever company the document names, so a member from
   * another company whose `operatives` row is on their email is never converted into a ghost.
   */
  memberIds?: ReadonlyArray<string> | null
}): GhostConversionCandidate[] {
  const org = idKey(input?.organizationId)
  const memberKeys = new Set((input?.memberIds || []).map(idKey).filter(Boolean))
  // 1.36.0: a stored organisation reference is read with `documentOrganizationId` (an id, a path or a reference), so a
  // users document that stores `organizations/{id}` is this organisation's account, not missing (before, its row was
  // a ghost candidate and the conversion would have created a second person).
  const users = (input?.users || []).filter((user) => {
    if (!user || !idText(user.id)) return false
    if (!org || memberKeys.has(idKey(user.id))) return true
    const stored = documentOrganizationId(user.organizationId)
    return !stored || idKey(stored) === org
  })
  const userIds = new Set(users.map((user) => idKey(user.id)))
  const userEmails = new Set(users.map((user) => idKey(user.email)).filter(Boolean))
  const rows = (input?.operatives || []).filter((row) => {
    if (!row || !idText(row.id) || row.isActive === false) return false
    if (isAnonymisedDeletedProfile({ email: row.email ?? '', firstName: row.firstName ?? '', surname: row.lastName ?? '', name: row.name ?? '' })) return false
    if (userIds.has(idKey(row.id))) return false
    if ([row.linkedUserId, row.userId, row.uid].some((id) => idText(id) && userIds.has(idKey(id)))) return false
    const email = idKey(row.email)
    if (email && userEmails.has(email)) return false
    return true
  })
  const groups = new Map<string, GhostConversionOperativeRow[]>()
  for (const row of rows) {
    const key = personDedupeKey(row)
    const list = groups.get(key) || []
    list.push(row)
    groups.set(key, list)
  }
  const out: GhostConversionCandidate[] = []
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const ra = positiveNumber(a.dayRate) ?? positiveNumber(a.hourlyRate) ? 0 : 1
      const rb = positiveNumber(b.dayRate) ?? positiveNumber(b.hourlyRate) ? 0 : 1
      return ra - rb || idKey(a.id).localeCompare(idKey(b.id))
    })
    const kept = sorted[0]
    const name = rowName(kept)
    const rate = ghostRate({ payBasis: kept.payBasis ?? null, dayRate: kept.dayRate ?? null, hourlyRate: kept.hourlyRate ?? null })
    const issues: string[] = []
    if (!name.first || !name.last) issues.push('name')
    if (!rate) issues.push('rate')
    out.push({
      operativeId: idText(kept.id),
      firstName: name.first,
      lastName: name.last,
      name: name.full,
      email: idText(kept.email).toLowerCase(),
      trade: idText(kept.tradeTypeCustom) || idText(kept.tradeTypePreset) || idText(kept.trade),
      payBasis: rate?.payBasis ?? null,
      rate: rate?.amount ?? null,
      duplicateOperativeIds: sorted.slice(1).map((row) => idText(row.id)),
      issues,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.operativeId.localeCompare(b.operativeId))
}

export type GhostConversionPlan = {
  /** `users/{operativeId}` created as a ghost (with `inviteEmailHint` and `formerUserIds` for duplicates). */
  user: GhostWrite
  payProfile: GhostWrite | null
  /** The kept `operatives` row: linked to the ghost, its email cleared (kept aside on the ghost). */
  operativeRow: { path: string; set: Record<string, unknown> }
  /** Duplicate rows on the same email: linked to the ghost and made inactive (their history follows `formerUserIds`). */
  duplicateRows: Array<{ path: string; set: Record<string, unknown> }>
}

/**
 * The writes that turn one candidate into a ghost (owner-run script, admin credentials). The filled check list gives
 * the line managers and, where the row had none, the names and rate (`overrides`). Null when the result would fail
 * `ghostCreateError` (the script then reports the row and skips it). Idempotent at the script level: a candidate whose
 * users document now exists is no longer a candidate.
 */
export function ghostConversionWrites(input: {
  organizationId: string
  candidate: GhostConversionCandidate
  lineManagerIds: ReadonlyArray<string>
  overrides?: Partial<Pick<GhostDraft, 'firstName' | 'surname' | 'payBasis' | 'dayRate' | 'hourlyRate'>> | null
  actorUserId: string
  privatePay?: boolean | null
  /**
   * The organisation's users documents (review follow-up 4): with it, every line manager on the check list must be one
   * `lineManagerCandidates` offers (`ghostCreateError`), so a mistyped or former id is refused before it is written.
   */
  roster?: ReadonlyArray<LineManagerRosterPerson> | null
}): GhostConversionPlan | null {
  const candidate = input?.candidate
  if (!candidate || !idText(candidate.operativeId)) return null
  const over = input.overrides || {}
  const payBasis = (over.payBasis as string | undefined) ?? candidate.payBasis ?? undefined
  const draft: GhostDraft = {
    firstName: idText(over.firstName) || candidate.firstName,
    surname: idText(over.surname) || candidate.lastName,
    payBasis: payBasis ?? null,
    dayRate: over.dayRate ?? (candidate.payBasis === 'day' ? candidate.rate : null),
    hourlyRate: over.hourlyRate ?? (candidate.payBasis === 'hourly' ? candidate.rate : null),
    lineManagerIds: input.lineManagerIds,
    tradeTypePreset: candidate.trade ? 'Other' : null,
    tradeTypeCustom: candidate.trade || null,
  }
  if (input.roster && ghostCreateError(draft, { roster: input.roster })) return null
  const plan = ghostCreateWrites({
    organizationId: input.organizationId,
    ghostId: candidate.operativeId,
    draft,
    actorUserId: input.actorUserId,
    platform: 'web',
    privatePay: input.privatePay,
  })
  if (!plan) return null
  const org = idText(input.organizationId)
  const userFields: Record<string, unknown> = { ...plan.user.fields }
  if (candidate.email) userFields[GHOST_INVITE_EMAIL_HINT_FIELD] = candidate.email
  if (candidate.duplicateOperativeIds.length > 0) userFields.formerUserIds = [...candidate.duplicateOperativeIds]
  return {
    user: { ...plan.user, fields: userFields },
    payProfile: plan.payProfile,
    operativeRow: {
      path: `organizations/${org}/operatives/${candidate.operativeId}`,
      set: { linkedUserId: candidate.operativeId, email: '' },
    },
    duplicateRows: candidate.duplicateOperativeIds.map((id) => ({
      path: `organizations/${org}/operatives/${id}`,
      set: { linkedUserId: candidate.operativeId, isActive: false },
    })),
  }
}

// MARK: - Data health

export type GhostCheckIssue = 'name' | 'rate' | 'lineManager' | 'converted'
export const GHOST_CHECK_ISSUE_LABELS: Readonly<Record<GhostCheckIssue, string>> = {
  name: 'First name and surname missing',
  rate: 'No day or hourly rate above 0',
  lineManager: 'No active line manager',
  converted: 'Converted from a no-login operative: check the name, rate and line manager',
}

/**
 * Settings → Data health "Ghosts to check" (admins): every active ghost with something to fix — a missing name, no
 * rate above 0, no active line manager on the roster — and every ghost converted from an `operatives` row (it still
 * holds `inviteEmailHint`) for the owner's first check. Roster order. Never writes.
 */
export function ghostsToCheck(
  roster: ReadonlyArray<{
    id: string
    ghost?: unknown
    isActive?: boolean | null
    firstName?: string | null
    surname?: string | null
    payBasis?: string | null
    dayRate?: number | null
    hourlyRate?: number | null
    assignedManagerUserIds?: ReadonlyArray<string> | null
    assignedManagerUserId?: string | null
    inviteEmailHint?: string | null
  }> | null | undefined
): Array<{ id: string; issues: GhostCheckIssue[] }> {
  const rows = (roster || []).filter((row) => row && idText(row.id))
  const active = new Set(rows.filter((row) => row.isActive !== false && !isGhostUser(row)).map((row) => idKey(row.id)))
  const out: Array<{ id: string; issues: GhostCheckIssue[] }> = []
  for (const row of rows) {
    if (!isGhostUser(row) || row.isActive === false) continue
    const issues: GhostCheckIssue[] = []
    if (!idText(row.firstName) || !idText(row.surname)) issues.push('name')
    if (!ghostRate({ payBasis: row.payBasis ?? null, dayRate: row.dayRate ?? null, hourlyRate: row.hourlyRate ?? null })) issues.push('rate')
    const managers = [...(row.assignedManagerUserIds ?? []), row.assignedManagerUserId ?? ''].map(idKey).filter(Boolean)
    if (!managers.some((id) => active.has(id))) issues.push('lineManager')
    if (idText(row.inviteEmailHint)) issues.push('converted')
    if (issues.length > 0) out.push({ id: idText(row.id), issues })
  }
  return out
}

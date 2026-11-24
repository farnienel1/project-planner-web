/**
 * Line managers per organisation (rulebook §8, §11, §14, §16; 1.88.0, owner decision 24 Nov, before launch).
 *
 * A person's line manager (`assignedManagerUserIds` / `assignedManagerUserId` / `hasNoLineManager`) was stored only on
 * their own `users/{uid}` document, which belongs to their HOME organisation. A member of another company (Jane: home
 * A, also a member of B through `users/{uid}/orgMemberships/B` and `organizations/B.members`) had nowhere in B for B's
 * line manager, and B's admins could not set one (they may not write A's users document), so in B her timesheets and
 * leave fell to B's admins (§8 fallback).
 *
 * The rule (the 1.30.2 self-manage pattern, `organizationSelfManageFlags`):
 *   - in the person's home organisation (their users document's `organizationId`), the users document, exactly as
 *     before 1.88.0;
 *   - in any other organisation, the `lineManager` map on their membership there
 *     (`users/{uid}/orgMemberships/{orgId}.lineManager = { assignedManagerUserIds, assignedManagerUserId,
 *     hasNoLineManager }`), written only by an admin of that organisation (or copied from the invitation they
 *     accepted, set under the 1.33.0 line-manager lock);
 *   - a membership with no `lineManager` map (every membership written before 1.88.0, including the flat copies
 *     older iOS builds made of the whole users document) reads the users document, exactly as before — nobody loses a
 *     line manager they have today (guardrail 3).
 * It is a nested map, never the flat keys, so a pre-1.10.0 flat copy on a membership is never read as this
 * company's choice. The security rules read the same source (`firestore.rules` `lmData`, `storage.rules`
 * `callerLineManagesUser`). Pure.
 */

import { documentOrganizationId } from './peopleDocuments'

/** The membership field holding this organisation's line manager for a member whose home is elsewhere. */
export const ORG_MEMBERSHIP_LINE_MANAGER_FIELD = 'lineManager' as const

/** Shown when an admin sets a line manager for a member here who has no membership document to hold it. */
export const ORG_LINE_MANAGER_NO_MEMBERSHIP_MESSAGE =
  "This person's company record here could not be found, so their line manager can't be saved yet. Ask them to open this company in the app once, then try again."

/** Shown when the person's home company could not be read, so where to save is unknown (fail closed). */
export const ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE = "Couldn't check this person's company — try saving the line manager again."

export type OrgLineManagerFields = {
  assignedManagerUserIds: string[]
  assignedManagerUserId: string | null
  hasNoLineManager: boolean
}

export type OrgLineManagerSource = 'users' | 'membership'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function idList(many: unknown, one: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (value: unknown) => {
    const id = text(value)
    if (!id || seen.has(id.toLowerCase())) return
    seen.add(id.toLowerCase())
    out.push(id)
  }
  if (Array.isArray(many)) for (const id of many) add(id)
  if (out.length === 0) add(one)
  return out
}

/**
 * Reads a `lineManager` map (a membership's, or any object carrying the three keys). Null when `value` is not a map, or an empty one —
 * the membership has no line manager of its own for this organisation. Ids trimmed, de-duplicated without case, in
 * stored order; `assignedManagerUserIds` falls back to the single id; with `hasNoLineManager` no ids are returned.
 */
export function parseOrgLineManager(value: unknown): OrgLineManagerFields | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  // An empty map holds no choice (the security rules read `{}` as "none here" too).
  if (Object.keys(row).length === 0) return null
  const hasNoLineManager = row.hasNoLineManager === true
  const ids = hasNoLineManager ? [] : idList(row.assignedManagerUserIds, row.assignedManagerUserId)
  return { assignedManagerUserIds: ids, assignedManagerUserId: ids[0] ?? null, hasNoLineManager }
}

function storedFields(user: Record<string, unknown> | null | undefined): OrgLineManagerFields {
  const row = user && typeof user === 'object' ? user : {}
  const many = Array.isArray(row.assignedManagerUserIds) ? row.assignedManagerUserIds.map(text).filter(Boolean) : []
  return {
    assignedManagerUserIds: many,
    assignedManagerUserId: text(row.assignedManagerUserId) || null,
    hasNoLineManager: row.hasNoLineManager === true,
  }
}

/** Whether the users document `user` names `organizationId` as its home (an id, a path or a reference). */
export function isHomeOrganization(user: Record<string, unknown> | null | undefined, organizationId: unknown): boolean {
  const org = text(organizationId).toLowerCase()
  if (!org || !user || typeof user !== 'object') return false
  const home = documentOrganizationId((user as Record<string, unknown>).organizationId)
  return home != null && home.trim().toLowerCase() === org
}

/**
 * The person's line-manager fields in `organizationId` (see file header): the users document's in their home
 * organisation, or when the membership here holds no `lineManager` map; otherwise the membership's. `user` is the
 * person's users document (its `organizationId` decides home), `membership` their `users/{uid}/orgMemberships/{orgId}`
 * document when read (null / missing: the users document). The users document's fields are returned as stored.
 */
export function organizationLineManagerFields(input: {
  organizationId: string
  user?: Record<string, unknown> | null
  membership?: Record<string, unknown> | null
}): OrgLineManagerFields & { source: OrgLineManagerSource } {
  const user = input?.user && typeof input.user === 'object' ? input.user : null
  const fromUsers = { ...storedFields(user), source: 'users' as const }
  if (isHomeOrganization(user, input?.organizationId)) return fromUsers
  const membership = input?.membership && typeof input.membership === 'object' ? input.membership : null
  const parsed = membership ? parseOrgLineManager(membership[ORG_MEMBERSHIP_LINE_MANAGER_FIELD]) : null
  return parsed ? { ...parsed, source: 'membership' } : fromUsers
}

/**
 * `person` with its line-manager fields for `organizationId` laid over (`organizationLineManagerFields`), so every
 * reader that takes a person (`lineManagerIds`, `hasActiveLineManager`, `leaveApproverIds`, `canDecideLeave`,
 * `userTimesheetSubjects`, `timesheetWriterIsReviewer`, `canViewPersonPay`, `lineManagerRequiredError`,
 * `usersMissingLineManager`, the notification recipients, the pickers) reads this organisation's line manager. The
 * same object when the users document is the source. `homeOrganizationId` overrides the person's `organizationId` for
 * the home test (a session profile whose `organizationId` was set to the open company).
 */
export function withOrganizationLineManager<T extends object>(
  person: T,
  input: { organizationId: string; membership?: Record<string, unknown> | null; homeOrganizationId?: unknown }
): T {
  if (!person || typeof person !== 'object') return person
  const row = person as unknown as Record<string, unknown>
  const user = input?.homeOrganizationId !== undefined ? { ...row, organizationId: input.homeOrganizationId } : row
  const fields = organizationLineManagerFields({ organizationId: input?.organizationId, user, membership: input?.membership })
  if (fields.source === 'users') return person
  const same =
    row.hasNoLineManager === fields.hasNoLineManager &&
    text(row.assignedManagerUserId) === (fields.assignedManagerUserId ?? '') &&
    Array.isArray(row.assignedManagerUserIds) &&
    row.assignedManagerUserIds.length === fields.assignedManagerUserIds.length &&
    row.assignedManagerUserIds.every((id, at) => id === fields.assignedManagerUserIds[at])
  if (same) return person
  return {
    ...person,
    assignedManagerUserIds: fields.assignedManagerUserIds,
    assignedManagerUserId: fields.assignedManagerUserId ?? undefined,
    hasNoLineManager: fields.hasNoLineManager,
  } as T
}

/**
 * Where a line-manager change made in `organizationId` is saved: `users` in the person's home organisation (their
 * users document, as before 1.88.0), `membership` in any other (their membership's `lineManager` map). Null when the
 * open organisation is blank or the home organisation is unknown (a failed read): the save is refused
 * (`ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE`), never written to the wrong company.
 */
export function orgLineManagerEditTarget(input: { organizationId: unknown; homeOrganizationId: unknown }): OrgLineManagerSource | null {
  const org = text(input?.organizationId)
  const home = documentOrganizationId(input?.homeOrganizationId)
  if (!org || !home) return null
  return home.trim().toLowerCase() === org.toLowerCase() ? 'users' : 'membership'
}

/**
 * The `lineManager` map an admin writes on a membership (whole, the three keys together): ids trimmed and
 * de-duplicated without case, the first as the single id; "No line manager" stores no ids.
 */
export function orgMembershipLineManagerFields(next: {
  assignedManagerUserIds?: ReadonlyArray<unknown> | null
  assignedManagerUserId?: unknown
  hasNoLineManager?: unknown
}): OrgLineManagerFields {
  const hasNoLineManager = next?.hasNoLineManager === true
  const ids = hasNoLineManager ? [] : idList(next?.assignedManagerUserIds, next?.assignedManagerUserId)
  return { assignedManagerUserIds: ids, assignedManagerUserId: ids[0] ?? null, hasNoLineManager }
}

/**
 * The `lineManager` map a membership created from an invitation carries (`inviteMembershipWrites`): the invitation's
 * three line-manager keys exactly as stored (the security rules compare them with the invitation), or null when the
 * invitation stores none.
 */
export function invitationLineManagerMap(invitation: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const row = invitation && typeof invitation === 'object' ? invitation : {}
  if (!('assignedManagerUserIds' in row) && !('assignedManagerUserId' in row) && !('hasNoLineManager' in row)) return null
  return {
    assignedManagerUserIds: Array.isArray(row.assignedManagerUserIds) ? [...row.assignedManagerUserIds] : [],
    assignedManagerUserId: typeof row.assignedManagerUserId === 'string' ? row.assignedManagerUserId : null,
    hasNoLineManager: row.hasNoLineManager === true,
  }
}

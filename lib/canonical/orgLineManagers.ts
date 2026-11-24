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
 *   - in any other organisation, that organisation's own record `organizations/{orgId}/memberLineManagers/{uid}`
 *     (`MEMBER_LINE_MANAGERS_COLLECTION`), which holds ONLY the three line-manager keys and write metadata, is read by
 *     every active member of the organisation and is written only by its admins — never by the person — or created
 *     once by the invitee from the invitation they accept (exactly as the inviter set it, under the 1.33.0 lock);
 *   - with no record, there is NO line manager here (owner answer 24 Nov: a line manager belongs to each company):
 *     this organisation's admins decide, its notices go to them, Edit user asks for one (`lineManagerRequiredError`),
 *     Data health lists the person, the screens read "Not set", and the security rules give the home company's line
 *     manager no rights here;
 *   - a users document that stores no organisation at all reads its own fields, as before 1.88.0.
 * Owner decision 24 Nov (review of #455, fix (a)): the record is its own document, never a field on the membership,
 * because memberships written by iPhone builds before 1.10.0 hold a copy of the whole users document (pay, phone) and
 * stay readable to the person and the organisation's admins only. The security rules read the same record
 * (`firestore.rules` `lmData`, `storage.rules` `callerLineManagesUser`). Pure.
 */

import { documentOrganizationId } from './peopleDocuments'

/** The organisation subcollection holding this organisation's line manager for members whose home is elsewhere. */
export const MEMBER_LINE_MANAGERS_COLLECTION = 'memberLineManagers' as const

/** The only data keys a `memberLineManagers/{uid}` record holds (plus `updatedAt` / `updatedBy` / `updatedFrom`). */
export const MEMBER_LINE_MANAGER_FIELDS = ['assignedManagerUserIds', 'assignedManagerUserId', 'hasNoLineManager'] as const

/** `organizations/{orgId}/memberLineManagers/{uid}`; null when either id is blank or holds a slash. */
export function memberLineManagerPath(organizationId: unknown, userId: unknown): string | null {
  const org = text(organizationId)
  const uid = text(userId)
  if (!org || !uid || org.includes('/') || uid.includes('/')) return null
  return `organizations/${org}/${MEMBER_LINE_MANAGERS_COLLECTION}/${uid}`
}

/** Shown when the person's home company could not be read, so where to save is unknown (fail closed). */
export const ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE = "Couldn't check this person's company — try saving the line manager again."

export type OrgLineManagerFields = {
  assignedManagerUserIds: string[]
  assignedManagerUserId: string | null
  hasNoLineManager: boolean
}

/**
 * Where a person's line manager in an organisation comes from: `users` (their users document: the home organisation, or
 * a users document with no organisation stored), `record` (this organisation's `memberLineManagers` record), or `none`
 * (a member whose home is another company and who has no record here: no line manager here).
 */
export type OrgLineManagerSource = 'users' | 'record' | 'none'

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
 * Reads a `memberLineManagers/{uid}` record's data (or any object carrying the three keys). Null when `value` is not a
 * map or holds none of the three keys — no line manager of this organisation's own. Ids trimmed, de-duplicated without
 * case, in stored order; `assignedManagerUserIds` falls back to the single id; with `hasNoLineManager` no ids.
 */
export function parseOrgLineManager(value: unknown): OrgLineManagerFields | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (!MEMBER_LINE_MANAGER_FIELDS.some((key) => key in row)) return null
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
 * The organisation's records (`memberLineManagers` documents as `{ id, data }`) as lower-case users id → fields; a
 * record holding none of the three keys is left out.
 */
export function parseMemberLineManagerDocuments(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }> | null | undefined
): Record<string, OrgLineManagerFields> {
  const out: Record<string, OrgLineManagerFields> = {}
  for (const row of docs ?? []) {
    const id = text(row?.id).toLowerCase()
    const parsed = id ? parseOrgLineManager(row?.data) : null
    if (parsed) out[id] = parsed
  }
  return out
}

const NO_LINE_MANAGER_HERE: OrgLineManagerFields = { assignedManagerUserIds: [], assignedManagerUserId: null, hasNoLineManager: false }

/**
 * The person's line-manager fields in `organizationId` for every DECISION (see file header): the users document's in
 * their home organisation (and, as before 1.88.0, when the users document stores no organisation at all); the record's
 * when this organisation holds one; otherwise NONE (`source: 'none'`, no ids) — a member whose home is another company
 * has no line manager here until this organisation's admin sets one, so this organisation's admins decide, notices go
 * to them and Data health lists the person (`lineManagerRequiredError`). Their home company's line manager is never a
 * decision-maker here and is not shown here either (owner answer 24 Nov: a line manager belongs to each company). `user` is the person's users document (its
 * `organizationId` decides home), `record` the data of `organizations/{orgId}/memberLineManagers/{uid}` when read. The
 * users document's fields are returned as stored.
 */
export function organizationLineManagerFields(input: {
  organizationId: string
  user?: Record<string, unknown> | null
  record?: Record<string, unknown> | null
}): OrgLineManagerFields & { source: OrgLineManagerSource } {
  const user = input?.user && typeof input.user === 'object' ? input.user : null
  const fromUsers = { ...storedFields(user), source: 'users' as const }
  if (!documentOrganizationId(user?.organizationId)) return fromUsers
  if (isHomeOrganization(user, input?.organizationId)) return fromUsers
  const parsed = parseOrgLineManager(input?.record)
  return parsed
    ? { ...parsed, source: 'record' }
    : { ...NO_LINE_MANAGER_HERE, assignedManagerUserIds: [], source: 'none' }
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
  input: { organizationId: string; record?: Record<string, unknown> | null; homeOrganizationId?: unknown }
): T {
  if (!person || typeof person !== 'object') return person
  const row = person as unknown as Record<string, unknown>
  const user = input?.homeOrganizationId !== undefined ? { ...row, organizationId: input.homeOrganizationId } : row
  const fields = organizationLineManagerFields({ organizationId: input?.organizationId, user, record: input?.record })
  if (fields.source === 'users') return person
  // `none`: no line manager here (the home company's is not a decision-maker in this organisation).
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

/** Where a line-manager change is saved (`orgLineManagerEditTarget`). */
export type OrgLineManagerEditTarget = 'users' | 'record'

/**
 * Where a line-manager change made in `organizationId` is saved: `users` in the person's home organisation (their
 * users document, as before 1.88.0), `record` in any other (`memberLineManagers/{uid}` here). Null when the
 * open organisation is blank or the home organisation is unknown (a failed read): the save is refused
 * (`ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE`), never written to the wrong company.
 */
export function orgLineManagerEditTarget(input: { organizationId: unknown; homeOrganizationId: unknown }): OrgLineManagerEditTarget | null {
  const org = text(input?.organizationId)
  const home = documentOrganizationId(input?.homeOrganizationId)
  if (!org || !home) return null
  return home.trim().toLowerCase() === org.toLowerCase() ? 'users' : 'record'
}

/**
 * The `memberLineManagers/{uid}` record an admin writes (a whole-document set, the three keys together): ids trimmed
 * and de-duplicated without case, the first as the single id; "No line manager" stores no ids. With `writerUserId` /
 * `platform` it adds `updatedBy` / `updatedFrom` (the app adds its server `updatedAt`).
 */
export function memberLineManagerWriteFields(next: {
  assignedManagerUserIds?: ReadonlyArray<unknown> | null
  assignedManagerUserId?: unknown
  hasNoLineManager?: unknown
  writerUserId?: unknown
  platform?: unknown
}): OrgLineManagerFields & { updatedBy?: string; updatedFrom?: string } {
  const hasNoLineManager = next?.hasNoLineManager === true
  const ids = hasNoLineManager ? [] : idList(next?.assignedManagerUserIds, next?.assignedManagerUserId)
  const out: OrgLineManagerFields & { updatedBy?: string; updatedFrom?: string } = {
    assignedManagerUserIds: ids,
    assignedManagerUserId: ids[0] ?? null,
    hasNoLineManager,
  }
  const writer = text(next?.writerUserId)
  if (writer) out.updatedBy = writer
  const platform = text(next?.platform)
  if (platform === 'web' || platform === 'ios' || platform === 'android') out.updatedFrom = platform
  return out
}

/** Whether two line-manager field sets are the same choice (ids in order, exactly as stored). */
export function sameOrgLineManager(a: OrgLineManagerFields | null | undefined, b: OrgLineManagerFields | null | undefined): boolean {
  if (!a || !b) return false
  return (
    a.hasNoLineManager === b.hasNoLineManager &&
    a.assignedManagerUserIds.length === b.assignedManagerUserIds.length &&
    a.assignedManagerUserIds.every((id, at) => id === b.assignedManagerUserIds[at])
  )
}

/**
 * The `memberLineManagers/{uid}` record the invitee creates when accepting into a company that is not their home
 * (`inviteMembershipWrites` → `lineManagerRecord`): the invitation's three line-manager keys exactly as stored (the
 * security rules compare them with the invitation), or null when the invitation stores none — or stores one of them in
 * a shape the record cannot copy exactly (ids not a list, the single id not text, the flag not a boolean), so a
 * malformed invitation never makes the whole accept batch fail; an admin then sets the line manager here.
 */
export function invitationLineManagerRecord(invitation: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const row = invitation && typeof invitation === 'object' ? invitation : {}
  if (!('assignedManagerUserIds' in row) && !('assignedManagerUserId' in row) && !('hasNoLineManager' in row)) return null
  if ('assignedManagerUserIds' in row && !Array.isArray(row.assignedManagerUserIds)) return null
  if (row.assignedManagerUserId != null && typeof row.assignedManagerUserId !== 'string') return null
  if (row.hasNoLineManager != null && typeof row.hasNoLineManager !== 'boolean') return null
  return {
    assignedManagerUserIds: Array.isArray(row.assignedManagerUserIds) ? [...row.assignedManagerUserIds] : [],
    assignedManagerUserId: typeof row.assignedManagerUserId === 'string' ? row.assignedManagerUserId : null,
    hasNoLineManager: row.hasNoLineManager === true,
  }
}

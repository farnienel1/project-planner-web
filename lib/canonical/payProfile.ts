/**
 * Rulebook 1.13.0 §8 / §16 (owner decisions round 4, Q1): who may see a person's pay, and the private document it
 * moves to.
 *
 * Pay is a person's day / hourly rate, pay basis, employment type (with its effective-dated transition), their rate
 * history, and their timesheets and invoices. Only these people see it (`canViewPersonPay`):
 *   - the person (under any of their ids);
 *   - their active line managers (`lineManagerIds(subject, roster)`);
 *   - admins and super admins of the organisation;
 *   - a manager with the Operatives toggle, for an operative only (never another manager's or an admin's pay);
 *   - the platform owner (support).
 *
 * Firestore rules cannot hide fields of a document someone may read, and every member reads the roster's
 * `users/{uid}` documents. So pay moves to `organizations/{orgId}/payProfiles/{subjectId}` (`payProfilePath`), one
 * document per person per organisation, readable only by those people. `subjectId` is the person's `users` id, or an
 * `operatives` row id for a catalogue operative with no account. Fields: `PAY_PROFILE_FIELDS` plus `userId` (the
 * subject id) and write metadata. During the move (Deploy notes 1.13.0) apps write pay to both places, read it from
 * the pay profile first (`overlayPayProfile`), and the backfill (`payProfileBackfillWrites`) copies it and, as the
 * last step, removes it from `users`, `operatives` and `managers`.
 */

import { lineManagerIds } from './leaveRequests'
import { effectivePermissions, permissionLevelOf } from './permissionLevels'
import { idKey, personIdSet, type PersonRosterRow } from './personIds'

export const PAY_PROFILES_COLLECTION = 'payProfiles'

/** The fields that are pay. They live on the pay profile; `users` / `operatives` / `managers` lose them at the strip. */
export const PAY_PROFILE_FIELDS = [
  'payBasis',
  'dayRate',
  'hourlyRate',
  'employmentType',
  'employmentTypeTransitionFrom',
  'employmentTypeEffectiveAt',
] as const
export type PayProfileField = (typeof PAY_PROFILE_FIELDS)[number]

export function payProfilePath(organizationId: string, subjectId: string): string {
  return `organizations/${String(organizationId || '').trim()}/${PAY_PROFILES_COLLECTION}/${String(subjectId || '').trim()}`
}

export type PayViewer = {
  id?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  isActive?: boolean | null
  isPlatformOwner?: boolean | null
  [key: string]: unknown
}

export type PaySubject = {
  id?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  assignedManagerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserId?: string | null
  hasNoLineManager?: boolean | null
  [key: string]: unknown
}

/**
 * Whether `viewer` may see `subject`'s pay (rates, pay basis, employment type, rate history, timesheets and invoices).
 * `viewer` and `subject` are users documents as each app holds them (role, flags and `permissions`); `roster` is the
 * organisation roster (`id`, `email`, `isActive`, alias ids) so line managers are active only and aliases count. An
 * inactive viewer sees only their own. The security rules apply the same test (`canViewPayOf`).
 */
export function canViewPersonPay(
  viewer: PayViewer | null | undefined,
  subject: PaySubject | null | undefined,
  roster?: ReadonlyArray<PersonRosterRow> | null
): boolean {
  if (!viewer || !subject) return false
  const viewerIds = new Set(personIdSet(viewer as never, roster).map(idKey))
  if (viewerIds.size === 0) return false
  if (viewer.isPlatformOwner === true) return true
  const subjectIds = personIdSet(subject as never, roster).map(idKey)
  if (subjectIds.some((id) => viewerIds.has(id))) return true
  if (viewer.isActive === false) return false
  const level = permissionLevelOf(viewer)
  if (level === 'admin') return true
  if (lineManagerIds(subject, roster as never).some((id) => viewerIds.has(idKey(id)))) return true
  return level === 'manager' && effectivePermissions(viewer).operatives === true && permissionLevelOf(subject) === 'operative'
}

export type PayProfileDocument = {
  /** The document id: the person's users id or an operatives row id, as stored. */
  subjectId: string
  /** Only the pay fields the document stores (a missing field is not "cleared"). */
  fields: Partial<Record<PayProfileField, unknown>>
}

/** Reads `payProfiles/{subjectId}`. Keeps only `PAY_PROFILE_FIELDS`; a stored `null` is kept (rate cleared). */
export function parsePayProfileDocument(docId: string, data: Record<string, unknown> | null | undefined): PayProfileDocument {
  const fields: Partial<Record<PayProfileField, unknown>> = {}
  for (const key of PAY_PROFILE_FIELDS) {
    if (data && Object.prototype.hasOwnProperty.call(data, key)) fields[key] = data[key]
  }
  return { subjectId: String(docId || '').trim(), fields }
}

/**
 * The person's document with pay taken from their pay profile: every field the profile stores replaces the one on
 * `person` (the profile is the source once it exists); fields it does not store stay as read from `person` (older
 * data before the backfill). A missing profile returns `person` unchanged.
 */
export function overlayPayProfile<T extends Record<string, unknown>>(person: T, profile: PayProfileDocument | null | undefined): T {
  if (!profile) return person
  const out: Record<string, unknown> = { ...person }
  for (const [key, value] of Object.entries(profile.fields)) out[key] = value
  return out as T
}

/**
 * The pay-profile half of a profile save: the `PAY_PROFILE_FIELDS` entries of a `users` / `operatives` / `managers`
 * partial update (its `set` map, values as written — a delete sentinel stays a delete), plus `userId`. Null when the
 * save changes no pay field. Written in the same batch as the profile, by someone `canChangePersonPay` allows.
 */
export function payProfileWriteFieldsFromProfileWrite(
  subjectId: string,
  profileWrite: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  const id = String(subjectId || '').trim()
  if (!id || !profileWrite) return null
  const out: Record<string, unknown> = {}
  for (const key of PAY_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(profileWrite, key)) out[key] = profileWrite[key]
  }
  if (Object.keys(out).length === 0) return null
  return { userId: id, ...out }
}

/**
 * One backfill step for one person (`scripts/backfill-pay-profiles.mjs`):
 *   - `profileSet`: the pay fields the source document holds that the pay profile does not have yet (a profile value
 *     already written by an app is never overwritten), plus `userId`; null when nothing to copy;
 *   - `sourceRemove`: with `strip`, the pay fields to delete from the source document — only those the pay profile
 *     will hold afterwards with the same value or that it already holds, so nothing is lost.
 */
export function payProfileBackfillWrites(input: {
  subjectId: string
  source: Record<string, unknown> | null | undefined
  profile: Record<string, unknown> | null | undefined
  strip?: boolean
}): { profileSet: Record<string, unknown> | null; sourceRemove: PayProfileField[] } {
  const source = input.source || {}
  const profile = input.profile || {}
  const has = (data: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(data, key)
  const set: Record<string, unknown> = {}
  for (const key of PAY_PROFILE_FIELDS) {
    if (has(source, key) && !has(profile, key)) set[key] = source[key]
  }
  const profileSet = Object.keys(set).length > 0 ? { userId: String(input.subjectId || '').trim(), ...set } : null
  const sourceRemove: PayProfileField[] = []
  if (input.strip === true) {
    for (const key of PAY_PROFILE_FIELDS) {
      if (has(source, key) && (has(profile, key) || has(set, key))) sourceRemove.push(key)
    }
  }
  return { profileSet, sourceRemove }
}

// MARK: - Reading and writing pay with the `privatePay` switch (rulebook §8, §16, 1.26.0)

/**
 * How a viewer reads `operativeDayRateHistory` (rulebook §8, §16; `privatePay` from `securitySwitchOn`):
 *   - `all`: the whole collection — while `privatePay` is off (every member reads it, as before), and for admins,
 *     super admins and the platform owner when it is on;
 *   - `people`: with `privatePay` on, everyone else runs one `userId ==` query per id in `userIds` — their own id and
 *     the ids of the `subjects` whose pay they may see (`canViewPersonPay`), exact de-dupe, order kept. The rules
 *     refuse a whole-collection query for them (Firestore rules are not filters).
 * Known limit: a catalogue operative's rows with no `userId` (an `operatives` row with no account) are read only by
 * admins while `privatePay` is on — the rules cannot prove a non-admin's `operativeId ==` query.
 */
export type RateHistoryQueryPlan = { kind: 'all' } | { kind: 'people'; userIds: string[] }

function viewerSeesEveryPay(viewer: PayViewer): boolean {
  if (viewer.isPlatformOwner === true) return true
  if (viewer.isActive === false) return false
  return permissionLevelOf(viewer) === 'admin'
}

function viewablePayIds(
  viewer: PayViewer,
  subjects: ReadonlyArray<PaySubject> | null | undefined,
  roster: ReadonlyArray<PersonRosterRow> | null | undefined
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: unknown) => {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push(id)
  }
  add(viewer.id)
  for (const subject of subjects || []) {
    if (subject && canViewPersonPay(viewer, subject, roster)) add(subject.id)
  }
  return out
}

export function rateHistoryQueryPlan(
  viewer: PayViewer | null | undefined,
  subjects: ReadonlyArray<PaySubject> | null | undefined,
  roster?: ReadonlyArray<PersonRosterRow> | null,
  options?: { privatePay?: boolean } | null
): RateHistoryQueryPlan {
  if (options?.privatePay !== true) return { kind: 'all' }
  if (!viewer) return { kind: 'people', userIds: [] }
  if (viewerSeesEveryPay(viewer)) return { kind: 'all' }
  return { kind: 'people', userIds: viewablePayIds(viewer, subjects, roster) }
}

/**
 * How a viewer reads `payProfiles` (private from the 1.13.0 deploy, whatever the switch): `all` (one collection
 * query) for admins, super admins and the platform owner; otherwise `documents` — one read by id per person whose pay
 * they may see (`canViewPersonPay`), their own first. Each app lays the result over its roster (`overlayPayProfile`),
 * so once the strip has run pay still shows to the people who may see it.
 */
export type PayProfileReadPlan = { kind: 'all' } | { kind: 'documents'; ids: string[] }

export function payProfileReadPlan(
  viewer: PayViewer | null | undefined,
  subjects: ReadonlyArray<PaySubject> | null | undefined,
  roster?: ReadonlyArray<PersonRosterRow> | null
): PayProfileReadPlan {
  if (!viewer) return { kind: 'documents', ids: [] }
  if (viewerSeesEveryPay(viewer)) return { kind: 'all' }
  return { kind: 'documents', ids: viewablePayIds(viewer, subjects, roster) }
}

/**
 * The part of a `users` / `operatives` / `managers` write that may go onto that shared document. While `privatePay`
 * is off it is the write unchanged (apps write pay to both places, so older builds still read it). While it is on,
 * every `PAY_PROFILE_FIELDS` key is left out — pay goes only to the pay profile (`payProfileWriteFieldsFromProfileWrite`)
 * and the rate history, and the rules refuse a pay value on a shared document (`payStaysPrivate`). The backfill's
 * `--strip` removes the values already there.
 */
export function sharedDocumentPayWrite<T extends Record<string, unknown>>(
  write: T,
  options?: { privatePay?: boolean } | null
): T {
  if (options?.privatePay !== true || !write) return write
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(write)) {
    if ((PAY_PROFILE_FIELDS as ReadonlyArray<string>).includes(key)) continue
    out[key] = value
  }
  return out as T
}

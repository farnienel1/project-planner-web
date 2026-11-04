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
import { readStoredRates, type PayRateProfile, type StoredPay } from './payRate'

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
  /**
   * 1.27.0: true for a catalogue operative — an `operatives` row with no app account (`catalogueOperativePaySubjects`).
   * `id` is then the row id, the subject id of its `payProfiles/{rowId}` and the `operativeId` of its rate history.
   */
  catalogueOperative?: boolean | null
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
  const operativesManager = level === 'manager' && effectivePermissions(viewer).operatives === true
  // 1.27.0: a catalogue operative (an `operatives` row with no account) has no line manager and no level of its own:
  // admins, the person on the row's email (above) and managers with the Operatives toggle see its pay.
  if (subject.catalogueOperative === true) return operativesManager
  if (lineManagerIds(subject, roster as never).some((id) => viewerIds.has(idKey(id)))) return true
  return operativesManager && permissionLevelOf(subject) === 'operative'
}

/** An `operatives` row as `catalogueOperativePaySubjects` reads it (`parseOperativeDocument` output, or the stored row). */
export type CatalogueOperativeRow = {
  id?: string | null
  email?: string | null
  linkedUserId?: string | null
  userId?: string | null
  uid?: string | null
  isActive?: boolean | null
  [key: string]: unknown
}

/**
 * The catalogue operatives among `operatives` rows (rulebook §8, 1.27.0): rows with no app account — no stored
 * `linkedUserId` / `userId` / `uid`, a row id that is no roster member's id (`personIdSet`, any letter case), and no
 * roster member on the row's email (without case). Each comes back as a pay subject `{ id: <row id>, email,
 * catalogueOperative: true }` for `canViewPersonPay`, `payProfileReadPlan` and `rateHistoryQueryPlan`. A row that
 * belongs to an account is that person's, read through their users id (never twice).
 */
export function catalogueOperativePaySubjects(
  operatives: ReadonlyArray<CatalogueOperativeRow> | null | undefined,
  roster: ReadonlyArray<PersonRosterRow> | null | undefined
): PaySubject[] {
  const rosterIds = new Set<string>()
  const rosterEmails = new Set<string>()
  for (const member of roster || []) {
    if (!member) continue
    for (const id of personIdSet(member as never, null)) rosterIds.add(idKey(id))
    const email = idKey(member.email)
    if (email) rosterEmails.add(email)
  }
  const out: PaySubject[] = []
  const seen = new Set<string>()
  for (const row of operatives || []) {
    const id = typeof row?.id === 'string' ? row.id.trim() : ''
    if (!id || seen.has(idKey(id))) continue
    const linked = [row.linkedUserId, row.userId, row.uid].some((value) => typeof value === 'string' && value.trim() !== '')
    if (linked || rosterIds.has(idKey(id))) continue
    const email = typeof row.email === 'string' ? row.email.trim() : ''
    if (email && rosterEmails.has(idKey(email))) continue
    seen.add(idKey(id))
    out.push({ id, email: email || null, catalogueOperative: true })
  }
  return out
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
 * 1.27.0: `operativeIds` — the catalogue operatives among `subjects` (`catalogueOperative: true`, from
 * `catalogueOperativePaySubjects`) whose pay the viewer may see (admins and managers with the Operatives toggle). Each
 * is one query `operativeId ==` <row id> `and userId == ''` (rows written by `payRateHistoryWriteFields` store an
 * empty `userId` for a catalogue operative); the rules allow it because the query proves the row names no account.
 * Rows saved without any `userId` field (older builds) are read by admins only.
 */
export type RateHistoryQueryPlan = { kind: 'all' } | { kind: 'people'; userIds: string[]; operativeIds: string[] }

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

function viewableCatalogueIds(
  viewer: PayViewer,
  subjects: ReadonlyArray<PaySubject> | null | undefined,
  roster: ReadonlyArray<PersonRosterRow> | null | undefined
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const subject of subjects || []) {
    if (!subject || subject.catalogueOperative !== true) continue
    const id = typeof subject.id === 'string' ? subject.id.trim() : ''
    if (!id || seen.has(id) || !canViewPersonPay(viewer, subject, roster)) continue
    seen.add(id)
    out.push(id)
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
  if (!viewer) return { kind: 'people', userIds: [], operativeIds: [] }
  if (viewerSeesEveryPay(viewer)) return { kind: 'all' }
  const operativeIds = viewableCatalogueIds(viewer, subjects, roster)
  const catalogue = new Set(operativeIds)
  const userIds = viewablePayIds(viewer, subjects, roster).filter((id) => !catalogue.has(id))
  return { kind: 'people', userIds, operativeIds }
}

/**
 * How a viewer reads `payProfiles` (private from the 1.13.0 deploy, whatever the switch): `all` (one collection
 * query) for admins, super admins and the platform owner; otherwise `documents` — one read by id per person whose pay
 * they may see (`canViewPersonPay`), their own first. Each app lays the result over its roster (`overlayPayProfile`),
 * so once the strip has run pay still shows to the people who may see it. 1.27.0: `subjects` include the catalogue
 * operatives (`catalogueOperativePaySubjects`), so a manager with the Operatives toggle reads `payProfiles/{rowId}`
 * for each and the `operatives` row is laid over with it (`overlayPayProfile`) — before 1.27.0 only admins did.
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

// MARK: - Pay editor starting values (rulebook §8, 1.26.1)

/**
 * Where a pay editor's starting values came from: `payProfile` when the pay profile was laid over the person, `users`
 * when the person's own document (`users` / `operatives` / `managers`) is used as stored.
 */
export type PayEditorStartingSource = 'users' | 'payProfile'

export type PayEditorStartingValues<T extends Record<string, unknown>> = {
  /**
   * The record a pay editor starts from AND the baseline its save is diffed against (the changed-fields payload, the
   * "rate changed?" test and the rate-history `previousProfile` of `payRateChangeWrites`). With `privatePay` off it
   * is `person` itself (the same object, unchanged).
   */
  record: T
  /** The record's stored pay (`readStoredRates`): basis, day rate, hourly rate. */
  pay: StoredPay
  /** The amount for the record's basis (`pay.hourlyRate` when hourly, else `pay.dayRate`), or null. */
  rate: number | null
  /** The record's stored `employmentType`, as stored (null when missing). */
  employmentType: unknown
  source: PayEditorStartingSource
}

/**
 * The starting values and save baseline of every single-person pay display and pay editor (Manage Users / Edit User,
 * the people profile, the catalogue operative form, the rate dialogs), rulebook §8 1.26.1:
 *   - `privatePay` off for the organisation (`securitySwitchOn`): the person's own document exactly as stored — a pay
 *     profile is never read into the result, because older app builds still write pay only to `users` /
 *     `operatives` / `managers` and a pay profile can be stale;
 *   - `privatePay` on: the person with their pay profile laid over (`overlayPayProfile`) — the same value the display
 *     shows — so an editor never starts from (and saves back) an old rate left on the shared document, and the rate
 *     history's "previous" rate is the one in force. With no readable pay profile the person's document is used.
 * `profile` is the parsed pay profile (`parsePayProfileDocument`) of the person's id (else of a former invite id), or
 * null.
 */
export function payEditorStartingValues<T extends Record<string, unknown>>(
  person: T,
  profile: PayProfileDocument | null | undefined,
  options?: { privatePay?: boolean } | null
): PayEditorStartingValues<T> {
  const overlaid = options?.privatePay === true && profile ? overlayPayProfile(person, profile) : person
  const record = overlaid || ({} as T)
  const pay = readStoredRates(record as PayRateProfile)
  const rate = pay.payBasis === 'hourly' ? pay.hourlyRate : pay.dayRate
  const employmentType = Object.prototype.hasOwnProperty.call(record, 'employmentType') ? record.employmentType ?? null : null
  return { record, pay, rate, employmentType, source: overlaid !== person ? 'payProfile' : 'users' }
}

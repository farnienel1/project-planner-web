/**
 * Who a booking belongs to. A stored `operativeId` can be an operative
 * catalogue id, a users document id (a Firebase Auth uid, web #189), an
 * invite placeholder id the account later replaced (`formerUserIds`), or the
 * id of another users document on the same email. Timesheets, the weekly
 * report, Daily Overview, payroll and the warnings name lookup all ask these
 * two functions, on web and on iOS, so no screen keeps its own matching.
 *
 * `accounts` are the people as the roster lists them: one row per email,
 * with the other same-email users document ids in `aliasIds`.
 */

import { labourPersonIds } from './warningRows'
import { formerPersonForId, type FormerPersonInput } from './formerPeople'

export type BookingPersonAccount = {
  id: string
  email?: string | null
  formerIds?: readonly string[] | null
  aliasIds?: readonly string[] | null
}

export type BookingPersonOperative = {
  id: string
  email?: string | null
}

export type BookingPersonInput = {
  accounts: readonly BookingPersonAccount[]
  operatives: readonly BookingPersonOperative[]
  /**
   * 1.59.0: `managers` catalogue rows (id, email). A manager site booking filed under a `managers` row id resolves to
   * that row, and to the account on its email. Optional; missing reads as none (as before 1.59.0).
   */
  managers?: readonly BookingPersonOperative[] | null
  /** 1.59.0 §11: `deletedPeople` records (`parseFormerPersonDocument`). Optional. */
  formerPeople?: readonly FormerPersonInput[] | null
}

export type ResolvedBookingPerson = {
  /** The roster account the booking names, or null. */
  accountId: string | null
  /** The catalogue row the booking names or that shares the account's email, or null. */
  operativeId: string | null
  /** Lower-case email of that person, or null. */
  email: string | null
  /** 1.59.0: the `managers` row the booking names or that shares the account's email (absent when none). */
  managerId?: string | null
  /**
   * 1.59.0 §11: when no account, catalogue row or managers row is found, the former person (`deletedPeople`) the id
   * belongs to (absent when none).
   */
  former?: { id: string; displayName: string } | null
}

function idKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function emailKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * The other users document ids the roster folded into `accountId` because they share its email.
 * `aliases` is the roster's map of every listed id to the id it kept (web `userIdAliases`). Ids compare
 * without case; the account's own id is left out. Pass the result as `aliasIds` on the account.
 */
export function rosterAliasIdsFor(
  accountId: unknown,
  aliases: Readonly<Record<string, string>> | null | undefined
): string[] {
  const kept = idKey(accountId)
  if (!kept || !aliases) return []
  const ids: string[] = []
  const seen = new Set<string>([kept])
  for (const [alias, keptId] of Object.entries(aliases)) {
    const key = idKey(alias)
    if (!key || seen.has(key) || idKey(keptId) !== kept) continue
    seen.add(key)
    ids.push(alias.trim())
  }
  return ids
}

/** Every id this account's bookings may be stored under: its own id, former ids, same-email aliases, and catalogue rows on its email. */
export function bookingIdsForAccount(
  account: BookingPersonAccount,
  operatives: readonly BookingPersonOperative[]
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const add = (raw: unknown) => {
    const id = typeof raw === 'string' ? raw.trim() : ''
    const key = id.toLowerCase()
    if (!id || seen.has(key)) return
    seen.add(key)
    ids.push(id)
  }
  for (const id of labourPersonIds({ id: account.id, formerIds: account.formerIds ? [...account.formerIds] : [] })) add(id)
  for (const id of account.aliasIds || []) add(id)
  const email = emailKey(account.email)
  if (email) {
    for (const operative of operatives) {
      if (emailKey(operative.email) === email) add(operative.id)
    }
  }
  return ids
}

/** The account and catalogue row a stored booking `operativeId` names. Ids compare without case. */
export function resolveBookingPerson(operativeId: unknown, input: BookingPersonInput): ResolvedBookingPerson {
  const needle = idKey(operativeId)
  if (!needle) return { accountId: null, operativeId: null, email: null }

  const managers = input.managers || []
  const operative = input.operatives.find((row) => idKey(row.id) === needle) || null
  const managerRow = operative ? null : managers.find((row) => idKey(row.id) === needle) || null
  let account =
    input.accounts.find((row) => idKey(row.id) === needle) ||
    input.accounts.find((row) => (row.formerIds || []).some((id) => idKey(id) === needle)) ||
    input.accounts.find((row) => (row.aliasIds || []).some((id) => idKey(id) === needle)) ||
    null

  const operativeEmail = emailKey(operative?.email)
  const managerEmail = emailKey(managerRow?.email)
  if (!account && operativeEmail) {
    account = input.accounts.find((row) => emailKey(row.email) === operativeEmail) || null
  }
  if (!account && managerEmail) {
    account = input.accounts.find((row) => emailKey(row.email) === managerEmail) || null
  }
  const accountEmail = emailKey(account?.email)
  const linkedOperative =
    operative ||
    (accountEmail ? input.operatives.find((row) => emailKey(row.email) === accountEmail) || null : null)
  const linkedManager =
    managerRow || (accountEmail ? managers.find((row) => emailKey(row.email) === accountEmail) || null : null)

  const email = operativeEmail || managerEmail || accountEmail || emailKey(linkedOperative?.email) || null
  const resolved = Boolean(account || linkedOperative || linkedManager)
  const former = resolved ? null : formerPersonForId(operativeId, input.formerPeople)
  // The 1.59.0 fields are present only when set, so every result from before 1.59.0 keeps its exact shape.
  const result: ResolvedBookingPerson = {
    accountId: account ? account.id : null,
    operativeId: linkedOperative ? linkedOperative.id : null,
    email: email || (former ? emailKey(former.email) || null : null),
  }
  if (linkedManager) result.managerId = linkedManager.id
  if (former) result.former = { id: former.id, displayName: former.displayName }
  return result
}

/**
 * One key per person for grouping bookings: the account when one is found, else the catalogue row, else the
 * stored id. Two bookings on one day under a re-added person's old and new ids share a key, so clash checks
 * and day counts see them together.
 */
export function bookingPersonKey(operativeId: unknown, input: BookingPersonInput): string {
  const person = resolveBookingPerson(operativeId, input)
  if (person.accountId) return `account:${idKey(person.accountId)}`
  if (person.operativeId) return `operative:${idKey(person.operativeId)}`
  if (person.managerId) return `manager:${idKey(person.managerId)}`
  if (person.former) return `former:${idKey(person.former.id)}`
  return `id:${idKey(operativeId)}`
}

/**
 * Every stored id that names the same person as `operativeId`: the id itself, its catalogue row, and when an
 * account is found, that account's `bookingIdsForAccount`. Overlap, duplicate and hours-already-booked checks use
 * it, so a booking under a re-added person's other ids still counts as theirs.
 */
export function bookingIdsForPerson(operativeId: unknown, input: BookingPersonInput): string[] {
  const first = typeof operativeId === 'string' ? operativeId.trim() : ''
  if (!first) return []
  const ids: string[] = []
  const seen = new Set<string>()
  const add = (raw: string | null | undefined) => {
    const id = (raw || '').trim()
    if (!id || seen.has(id.toLowerCase())) return
    seen.add(id.toLowerCase())
    ids.push(id)
  }
  add(first)
  const person = resolveBookingPerson(first, input)
  add(person.operativeId)
  add(person.managerId)
  const account = person.accountId ? input.accounts.find((row) => row.id === person.accountId) : undefined
  if (account) for (const id of bookingIdsForAccount(account, input.operatives)) add(id)
  return ids
}


/**
 * 1.9.0 (§9, §10): the leave records that belong to an account — a record whose `userId` or `operativeId` is any of
 * `bookingIdsForAccount(account, operatives)` (the users id, former and same-email ids, `aliasIds`, catalogue rows on
 * the email) or the account's email (older iOS builds stored it as `userId`, 1.10.0), compared without case. Never
 * matched by name. Returned in the given order.
 */
export function leaveRecordsForAccount<T extends { userId?: string | null; operativeId?: string | null }>(
  records: readonly T[],
  account: BookingPersonAccount,
  operatives: readonly BookingPersonOperative[]
): T[] {
  const ids = new Set(bookingIdsForAccount(account, operatives).map((id) => id.toLowerCase()))
  if (ids.size === 0) return []
  // 1.10.0: older iOS builds stored the account's email as `userId`; that email (and the email of any same-email
  // catalogue row, which bookingIdsForAccount already ties to the account) also matches, without case.
  const email = emailKey(account?.email)
  if (email) ids.add(email)
  const has = (value: unknown) => typeof value === 'string' && value.trim() !== '' && ids.has(value.trim().toLowerCase())
  return (records || []).filter((record) => has(record?.userId) || has(record?.operativeId))
}

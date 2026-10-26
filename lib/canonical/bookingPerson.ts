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
}

export type ResolvedBookingPerson = {
  /** The roster account the booking names, or null. */
  accountId: string | null
  /** The catalogue row the booking names or that shares the account's email, or null. */
  operativeId: string | null
  /** Lower-case email of that person, or null. */
  email: string | null
}

function idKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function emailKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
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

  const operative = input.operatives.find((row) => idKey(row.id) === needle) || null
  let account =
    input.accounts.find((row) => idKey(row.id) === needle) ||
    input.accounts.find((row) => (row.formerIds || []).some((id) => idKey(id) === needle)) ||
    input.accounts.find((row) => (row.aliasIds || []).some((id) => idKey(id) === needle)) ||
    null

  const operativeEmail = emailKey(operative?.email)
  if (!account && operativeEmail) {
    account = input.accounts.find((row) => emailKey(row.email) === operativeEmail) || null
  }
  const accountEmail = emailKey(account?.email)
  const linkedOperative =
    operative ||
    (accountEmail ? input.operatives.find((row) => emailKey(row.email) === accountEmail) || null : null)

  const email = operativeEmail || accountEmail || emailKey(linkedOperative?.email) || null
  return {
    accountId: account ? account.id : null,
    operativeId: linkedOperative ? linkedOperative.id : null,
    email: email || null,
  }
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
  return `id:${idKey(operativeId)}`
}

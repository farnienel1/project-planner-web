/**
 * Which users document a labour booking on Daily Overview belongs to (guardrail 1). The person is resolved by the
 * rulebook (`resolveBookingPerson`, the same rule as `personIdSet` / `bookingIdsForAccount`): the operatives row's
 * stored account link (`linkedUserId`) first, then a users document whose id is the stored booking id (or one of its
 * former / same-email ids), then the row's email — never a blank email. With none of these the booking has no
 * account and the result is undefined, so a screen never books, checks or moves it under someone else.
 */

import { normalizeDocumentId, resolveBookingPerson, rosterAliasIdsFor, type BookingPersonInput } from '@/lib/canonical'
import type { Operative, User } from '@/types'

export type BookingRowUserInput = {
  operatives: readonly Pick<Operative, 'id' | 'email' | 'linkedUserId'>[]
  users: readonly Pick<User, 'id' | 'email' | 'formerUserIds'>[]
  userIdAliases?: Readonly<Record<string, string>> | null
}

export function bookingRowPeople(input: BookingRowUserInput): BookingPersonInput {
  return {
    accounts: input.users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      formerIds: user.formerUserIds ?? [],
      aliasIds: rosterAliasIdsFor(user.id, input.userIdAliases ?? null),
    })),
    operatives: input.operatives.map((row) => ({ id: row.id, email: row.email ?? null })),
  }
}

/**
 * A resolver for many bookings: the people input is built once (review L3), then each stored `operativeId` is
 * resolved to the account it names, or undefined when it names no account.
 */
export function bookingRowUserResolver(input: BookingRowUserInput): (operativeId: string | null | undefined) => string | undefined {
  const people = bookingRowPeople(input)
  const rowsById = new Map(input.operatives.map((entry) => [normalizeDocumentId(entry.id), entry]))
  return (operativeId) => {
    const stored = (operativeId || '').trim()
    if (!stored) return undefined
    const linked = (rowsById.get(normalizeDocumentId(stored))?.linkedUserId || '').trim()
    if (linked) {
      const viaLink = resolveBookingPerson(linked, people).accountId
      if (viaLink) return viaLink
    }
    return resolveBookingPerson(stored, people).accountId ?? undefined
  }
}

/** The account id the booking's stored `operativeId` names, or undefined when it names no account. */
export function bookingRowUserId(operativeId: string | null | undefined, input: BookingRowUserInput): string | undefined {
  return bookingRowUserResolver(input)(operativeId)
}

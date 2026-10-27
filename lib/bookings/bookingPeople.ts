/**
 * The roster as the rulebook's booking-person functions take it (`lib/canonical/bookingPerson.ts`).
 * Screens pass users and operatives here and compare stored booking ids without case.
 */
import type { Operative, User } from '@/types'
import { bookingIdsForPerson, type BookingPersonInput } from '@/lib/canonical'

export function bookingPersonInput(
  users: ReadonlyArray<Pick<User, 'id' | 'email' | 'formerUserIds'>>,
  operatives: ReadonlyArray<Pick<Operative, 'id' | 'email'>>
): BookingPersonInput {
  return {
    accounts: users.map((user) => ({ id: user.id, email: user.email, formerIds: user.formerUserIds ?? [] })),
    operatives: operatives.map((operative) => ({ id: operative.id, email: operative.email })),
  }
}

/** Lower-cased ids of every booking that belongs to the person `operativeId` names (`bookingIdsForPerson`). */
export function samePersonBookingIds(
  operativeId: string,
  users: ReadonlyArray<Pick<User, 'id' | 'email' | 'formerUserIds'>>,
  operatives: ReadonlyArray<Pick<Operative, 'id' | 'email'>>
): Set<string> {
  return new Set(bookingIdsForPerson(operativeId, bookingPersonInput(users, operatives)).map((id) => id.toLowerCase()))
}

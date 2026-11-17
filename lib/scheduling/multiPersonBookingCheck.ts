/**
 * Rulebook 1.60.0 §5 (owner request 17 Nov 2026), web wiring: a booking for more than one person lists everyone
 * already booked on a selected day (`multiPersonBookingBlocks`) and the save waits until they are removed. Each
 * person is matched under every id they go by (`personIdSet` over the roster, `bookingIdsForAccount` for the
 * `operatives` rows on their email). One person keeps the double-booking rows (✓ / ✕ / Replace).
 */

import {
  bookingIdsForAccount,
  multiPersonBookingBlocks,
  personIdSet,
  type MultiPersonBookingBlock,
} from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Booking, Operative, User } from '@/types'

export type MultiPersonSelection = {
  personKey: string
  name: string
  /** The users id, or the `operatives` row id for someone with no account. */
  id: string
  email?: string | null
}

export function multiPersonBookingIds(person: MultiPersonSelection, users: User[], operatives: Operative[]): string[] {
  const account = users.find((user) => user.id === person.id)
  const email = person.email ?? account?.email ?? operatives.find((op) => op.id === person.id)?.email ?? null
  const fromRoster = personIdSet(
    {
      id: person.id,
      email,
      formerUserIds: account?.formerUserIds ?? null,
      sameEmailUserIds: (account as { sameEmailUserIds?: string[] } | undefined)?.sameEmailUserIds ?? null,
    },
    users
  )
  const fromOperatives = bookingIdsForAccount(
    { id: person.id, email, formerIds: account?.formerUserIds ?? null, aliasIds: fromRoster },
    operatives
  )
  return [...new Set([...fromRoster, ...fromOperatives, person.id])]
}

export function webMultiPersonBookingBlocks(input: {
  people: MultiPersonSelection[]
  dayKeys: string[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  users: User[]
  operatives: Operative[]
  timeZone: string
}): MultiPersonBookingBlock[] {
  if (input.people.length <= 1) return []
  return multiPersonBookingBlocks({
    people: input.people.map((person) => ({
      personKey: person.personKey,
      name: person.name,
      ids: multiPersonBookingIds(person, input.users, input.operatives),
    })),
    dayKeys: input.dayKeys,
    bookings: [
      ...input.bookings.map((booking) => ({
        id: booking.id,
        personId: booking.operativeId,
        dayKey: dayKey(booking.date, input.timeZone),
        status: String(booking.status ?? ''),
      })),
      ...input.managerSiteBookings.map((booking) => ({
        id: booking.id,
        personId: booking.userId,
        dayKey: dayKey(booking.date, input.timeZone),
        status: (booking as { status?: string | null }).status ?? null,
      })),
    ],
  })
}

/** "Mon 23 Nov" for each day key, in the organisation zone. */
export function multiPersonBlockDaysText(dayKeys: string[], timeZone: string, toDate: (key: string) => Date): string {
  return dayKeys
    .map((key) =>
      new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(toDate(key))
    )
    .join(', ')
}

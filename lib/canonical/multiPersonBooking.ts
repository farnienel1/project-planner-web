/**
 * Rulebook 1.60.0 §5 (owner request 17 Nov 2026): a booking request for MORE THAN ONE person never books someone who
 * already has any booking on a selected day. The flow lists each such person and day with
 * `MULTI_PERSON_ALREADY_BOOKED_MESSAGE` and cannot save until they are removed from the selection; they are booked
 * separately. A request for one person keeps the per-row double-booking choices (✓ / ✕ / Replace, §5).
 *
 * "Any booking" is any labour or manager site booking of the person on that organisation day whose status occupies the
 * day (`bookingOccupiesDay`; a booking stored with no status, as manager site bookings are, occupies it). A person is
 * matched under every id they go by — the app passes them (`personIdSet` / `bookingIdsForAccount`), compared without
 * case (`idKey`).
 */

import { idKey } from './personIds'
import { bookingOccupiesDay } from './warningRows'

export const MULTI_PERSON_ALREADY_BOOKED_MESSAGE =
  'This user already has hours booked for this day. Remove this user from the selection to continue with the booking. The user will have to be booked separately.'

export const MULTI_PERSON_ALREADY_BOOKED_REMOVE_LABEL = 'Remove'

export type MultiPersonBookingPerson = {
  /** The app's key for the person in the selection (returned unchanged). */
  personKey: string
  name: string
  /** Every id the person's bookings may be filed under. */
  ids: readonly (string | null | undefined)[]
}

export type MultiPersonExistingBooking = {
  personId: string | null | undefined
  /** Organisation-zone day key, `YYYY-MM-DD`. */
  dayKey: string
  status?: string | null
  /** The booking being edited is skipped (never "already booked" against itself). */
  id?: string | null
}

export type MultiPersonBookingBlock = {
  personKey: string
  name: string
  /** The selected days on which the person already has a booking, sorted. */
  dayKeys: string[]
  message: string
}

export function multiPersonBookingBlocks(input: {
  people: readonly MultiPersonBookingPerson[]
  dayKeys: readonly string[]
  bookings: readonly MultiPersonExistingBooking[]
  /** Ids of bookings that are part of this request (an edit), never counted. */
  ignoreBookingIds?: readonly (string | null | undefined)[] | null
}): MultiPersonBookingBlock[] {
  if (input.people.length <= 1) return []
  const days = new Set(input.dayKeys.filter(Boolean))
  if (days.size === 0) return []
  const ignore = new Set((input.ignoreBookingIds || []).map(idKey).filter(Boolean))
  const bookedDaysById = new Map<string, Set<string>>()
  for (const booking of input.bookings) {
    const personId = idKey(booking.personId)
    if (!personId || !days.has(booking.dayKey)) continue
    if (booking.id && ignore.has(idKey(booking.id))) continue
    const status = String(booking.status ?? '').trim()
    if (status && !bookingOccupiesDay(status)) continue
    const set = bookedDaysById.get(personId) || new Set<string>()
    set.add(booking.dayKey)
    bookedDaysById.set(personId, set)
  }
  const blocks: MultiPersonBookingBlock[] = []
  for (const person of input.people) {
    const booked = new Set<string>()
    for (const id of person.ids) {
      for (const day of bookedDaysById.get(idKey(id)) || []) booked.add(day)
    }
    if (booked.size === 0) continue
    blocks.push({
      personKey: person.personKey,
      name: person.name,
      dayKeys: [...booked].sort(),
      message: MULTI_PERSON_ALREADY_BOOKED_MESSAGE,
    })
  }
  return blocks
}

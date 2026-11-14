/**
 * Rulebook 1.44.0 §21, §11 (owner decision 14 Nov, question H option 1): a booking whose person id names nobody the
 * device has loaded is never hidden. A job's scheduling week shows it as its own row, labelled with the stored id and
 * marked "Not linked to a person", and Settings → Data health lists every such id for admins, with one action that
 * links the id to a person (adds it to that person's `formerUserIds`, so `personIdSet` / `resolveBookingPerson` then
 * resolve every booking under it to them, on every screen and both apps).
 *
 * Bookings store no name of the booked person (`parseBookingDocument` / `parseManagerSiteBookingDocument` read only
 * the person id; `bookedBy` is who made the booking), so an unresolved row is "Unknown person" with a short form of the
 * stored id; `bookedBy` names are listed in Data health as a clue to who it was.
 */

import { resolveBookingPerson, type BookingPersonInput } from './bookingPerson'
import { personDedupeKey } from './ghostOperatives'
import { isAnonymisedDeletedProfile } from './userRosterSegment'
import { writeMetadataFields } from './writeMetadata'

export const UNKNOWN_BOOKING_PERSON_LABEL = 'Unknown person'
export const UNRESOLVED_BOOKING_PERSON_CHIP = 'Not linked to a person'
export const UNRESOLVED_BOOKINGS_HEADING = 'Bookings not linked to a person'
export const UNRESOLVED_BOOKINGS_HELP =
  'These bookings are filed under an ID that does not match anyone in your company — usually an old account or ' +
  'invite of someone who was later added again. They still show on the job\'s schedule as "Unknown person". ' +
  'Choose who each ID belongs to and every booking under it will show as that person everywhere (schedule, ' +
  'Daily Overview, warnings, timesheets and reports). Nothing else about the bookings changes.'
export const UNRESOLVED_BOOKINGS_EMPTY = 'Every booking is linked to a person.'
export const LINK_BOOKING_PERSON_ACTION = 'Link to a person…'

function idKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** A short, readable form of a stored id for labels: its first 8 characters, upper case ("6A9632BA"). */
export function bookingPersonIdHint(personId: unknown): string {
  return text(personId).slice(0, 8).toUpperCase()
}

export type ScheduleRowPerson = {
  /** One key per person (`bookingPersonKey` shape): the account, else the catalogue row, else the stored id. */
  key: string
  accountId: string | null
  operativeId: string | null
  /** True when the stored id names nobody loaded: the row is shown, marked, with no Quick Add. */
  unresolved: boolean
  /** Unresolved only: "Unknown person · 6A9632BA". Resolved rows are named by the caller from the person found. */
  label: string | null
  idHint: string
}

/**
 * Rulebook 1.44.0 §21: who a job-schedule row is (`resolveBookingPerson`, so former ids, same-email documents and
 * `operatives` rows on the email resolve) and, when nobody is found, the row's label. Never returns null: the grid
 * never drops a booking.
 */
export function scheduleRowPerson(personId: unknown, input: BookingPersonInput): ScheduleRowPerson {
  const person = resolveBookingPerson(personId, input)
  const idHint = bookingPersonIdHint(personId)
  if (person.accountId) {
    return { key: `account:${idKey(person.accountId)}`, accountId: person.accountId, operativeId: person.operativeId, unresolved: false, label: null, idHint }
  }
  if (person.operativeId) {
    return { key: `operative:${idKey(person.operativeId)}`, accountId: null, operativeId: person.operativeId, unresolved: false, label: null, idHint }
  }
  return {
    key: `id:${idKey(personId)}`,
    accountId: null,
    operativeId: null,
    unresolved: true,
    label: idHint ? `${UNKNOWN_BOOKING_PERSON_LABEL} · ${idHint}` : UNKNOWN_BOOKING_PERSON_LABEL,
    idHint,
  }
}

export type UnresolvedBookingInput = {
  id: string
  /** `operativeId` of a labour booking, `userId` of a manager site booking. */
  personId: string
  /** Organisation-zone day key of the booking. */
  dayKey: string
  /** The job (`projectId`, or a manager site booking's `locationId`); '' for office / home / survey bookings. */
  jobId?: string | null
  jobName?: string | null
  bookedBy?: string | null
  collection: 'bookings' | 'managerSiteBookings'
}

export type UnresolvedBookingPerson = {
  /** The stored id, as first seen. */
  personId: string
  idHint: string
  count: number
  firstDayKey: string
  lastDayKey: string
  jobs: Array<{ jobId: string; jobName: string; count: number }>
  /** Who made these bookings (`bookedBy`), as a clue to who the person is. Not the booked person's name. */
  bookedBy: string[]
  bookingIds: string[]
  collections: Array<'bookings' | 'managerSiteBookings'>
}

/**
 * Rulebook 1.44.0 §11 (Data health): every stored person id that no loaded person resolves (`resolveBookingPerson`),
 * one entry per id (without case), with its bookings' count, first and last day, jobs and bookers. Most bookings
 * first, then by id. Bookings with a blank person id are left out (the readers refuse them).
 */
export function unresolvedBookingPeople(input: BookingPersonInput & {
  bookings: readonly UnresolvedBookingInput[]
}): UnresolvedBookingPerson[] {
  const groups = new Map<string, UnresolvedBookingPerson>()
  const resolved = new Map<string, boolean>()
  for (const booking of input.bookings || []) {
    const key = idKey(booking.personId)
    if (!key) continue
    let isResolved = resolved.get(key)
    if (isResolved == null) {
      isResolved = !scheduleRowPerson(booking.personId, input).unresolved
      resolved.set(key, isResolved)
    }
    if (isResolved) continue
    let group = groups.get(key)
    if (!group) {
      group = {
        personId: text(booking.personId),
        idHint: bookingPersonIdHint(booking.personId),
        count: 0,
        firstDayKey: booking.dayKey,
        lastDayKey: booking.dayKey,
        jobs: [],
        bookedBy: [],
        bookingIds: [],
        collections: [],
      }
      groups.set(key, group)
    }
    group.count += 1
    group.bookingIds.push(booking.id)
    if (booking.dayKey && (!group.firstDayKey || booking.dayKey < group.firstDayKey)) group.firstDayKey = booking.dayKey
    if (booking.dayKey && booking.dayKey > group.lastDayKey) group.lastDayKey = booking.dayKey
    if (!group.collections.includes(booking.collection)) group.collections.push(booking.collection)
    const jobId = text(booking.jobId)
    if (jobId) {
      const job = group.jobs.find((row) => idKey(row.jobId) === idKey(jobId))
      if (job) {
        job.count += 1
        if (!job.jobName && text(booking.jobName)) job.jobName = text(booking.jobName)
      } else {
        group.jobs.push({ jobId, jobName: text(booking.jobName), count: 1 })
      }
    }
    const booker = text(booking.bookedBy)
    if (booker && !group.bookedBy.some((name) => name.toLowerCase() === booker.toLowerCase())) group.bookedBy.push(booker)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.personId.localeCompare(b.personId))
}

export type LinkCandidateProfile = {
  id: string
  name?: string | null
  firstName?: string | null
  surname?: string | null
  email?: string | null
  organizationId?: string | null
  isActive?: boolean | null
  formerUserIds?: readonly string[] | null
}

export type LinkCandidate = { id: string; name: string; email: string | null }

function profileName(profile: LinkCandidateProfile): string {
  const combined = [text(profile.firstName), text(profile.surname)].filter(Boolean).join(' ')
  return combined || text(profile.name) || text(profile.email) || profile.id
}

/**
 * Rulebook 1.44.0 §11: who an unlinked id may be linked to — the active people whose users document belongs to this
 * organisation (the security rules let an admin write only those), never an anonymised deleted profile, one option per
 * person (`personDedupeKey`: the email, else the id; the first document in roster order speaks for them), by name.
 */
export function linkBookingPersonCandidates(roster: readonly LinkCandidateProfile[], organizationId: string): LinkCandidate[] {
  const org = idKey(organizationId)
  const seen = new Set<string>()
  const out: LinkCandidate[] = []
  for (const profile of roster || []) {
    if (!profile || !text(profile.id)) continue
    if (idKey(profile.organizationId) !== org) continue
    if (profile.isActive === false) continue
    if (isAnonymisedDeletedProfile({ email: profile.email ?? '', firstName: profile.firstName ?? '', surname: profile.surname ?? '', name: profile.name ?? '' })) continue
    const key = personDedupeKey(profile)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ id: profile.id, name: profileName(profile), email: text(profile.email) || null })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** "All 3 bookings under this ID will show as Farnie Nel." */
export function linkBookingPersonConfirmMessage(count: number, name: string): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  return `All ${n} booking${n === 1 ? '' : 's'} under this ID will show as ${text(name) || 'this person'}.`
}

/** "Linked: 3 bookings now show as Farnie Nel." */
export function linkBookingPersonDoneMessage(count: number, name: string): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  return `Linked: ${n} booking${n === 1 ? '' : 's'} now show${n === 1 ? 's' : ''} as ${text(name) || 'this person'}.`
}

/**
 * Rulebook 1.44.0 §11: the partial update of the chosen person's `users/{uid}` that links an unlinked booking id —
 * `formerUserIds` with the id appended (stored ids kept as stored, never reordered) and write metadata. Null when the
 * id is blank, is the person's own id, is already listed (without case), or the metadata is invalid. An admin write
 * (§16 identity links: admins write `formerUserIds`, the person never does).
 */
export function linkBookingPersonWriteFields(input: {
  person: { id: string; formerUserIds?: readonly string[] | null }
  personId: string
  actorUserId: string
  platform: 'web' | 'ios' | 'android'
}): { set: Record<string, unknown> } | null {
  const id = text(input.personId)
  if (!id || idKey(id) === idKey(input.person?.id)) return null
  const stored = Array.isArray(input.person?.formerUserIds) ? input.person.formerUserIds.filter((v) => typeof v === 'string') : []
  if (stored.some((value) => idKey(value) === idKey(id))) return null
  const metadata = writeMetadataFields(input.actorUserId, input.platform)
  if (!metadata) return null
  return { set: { formerUserIds: [...stored, id], ...metadata } }
}

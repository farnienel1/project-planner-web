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
import { rosterPersonGroups, rosterPersonName, type LineManagerRosterPerson } from './lineManagers'
import { rosterSegment } from './userRosterSegment'
import { writeMetadataFields } from './writeMetadata'

export const UNKNOWN_BOOKING_PERSON_LABEL = 'Unknown person'
export const UNRESOLVED_BOOKING_PERSON_CHIP = 'Not linked to a person'
export const UNRESOLVED_BOOKINGS_HEADING = 'Bookings not linked to a person'
export const UNRESOLVED_BOOKINGS_HELP =
  'These bookings are filed under an ID that does not match anyone in your company — usually an old account or ' +
  'invite of someone who was later added again. They still show on the job\'s schedule as "Unknown person". ' +
  'Choose who each ID belongs to and every booking under it will show as that person everywhere (schedule, ' +
  'Daily Overview, warnings, timesheets and reports). Anything else filed under the ID — pay-rate history, annual ' +
  'leave, timesheets, overtime, price work and expenses — becomes theirs too; the confirm lists it, and if pay-rate ' +
  'history is filed under the ID, pay for unsigned timesheets may change. Nothing on the records themselves changes.'
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

export type LinkCandidateProfile = LineManagerRosterPerson & {
  organizationId?: string | null
  ghost?: boolean | null
}

export type LinkCandidate = { id: string; name: string; email: string | null }

/** Shown in place of the viewer in the picker: an admin never writes their own identity links (§16). */
export const LINK_BOOKING_PERSON_SELF_NOTE = 'To link bookings to yourself, ask another admin.'
export const LINK_BOOKING_PERSON_ALREADY_MESSAGE = 'Already linked.'

/**
 * Rulebook 1.44.0 §11: who an unlinked id may be linked to. Built from every users document of the organisation
 * (the unfolded roster), grouped into people (`rosterPersonGroups`: same id, `formerUserIds`, `sameEmailUserIds`,
 * email); the group's live, signed-up, active document speaks for the person and is the document written. A person
 * is offered only when that document belongs to this organisation (the security rules let an admin write only those)
 * and is Active (`rosterSegment`: never a pending invite, an inactive person or an anonymised deleted profile; a ghost
 * operative is Active by design). The viewer is never offered under any of their ids (`viewerIds`): nobody writes their
 * own identity links, admins included (§16) — show `LINK_BOOKING_PERSON_SELF_NOTE`. One option per person, by name.
 */
export function linkBookingPersonCandidates(
  roster: readonly LinkCandidateProfile[],
  organizationId: string,
  options?: { viewerIds?: readonly string[] | null }
): LinkCandidate[] {
  const org = idKey(organizationId)
  const viewer = new Set((options?.viewerIds || []).map(idKey).filter(Boolean))
  const out: LinkCandidate[] = []
  for (const group of rosterPersonGroups((roster || []).filter((row) => row && text(row.id)))) {
    if ([...group.keys].some((key) => viewer.has(key))) continue
    const primary = group.primary as LinkCandidateProfile
    if (idKey(primary.organizationId) !== org) continue
    if (rosterSegment(primary as never) !== 'active') continue
    out.push({ id: text(primary.id), name: rosterPersonName(primary) || text(primary.email) || text(primary.id), email: text(primary.email) || null })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

/** "All 3 bookings under this ID will show as Farnie Nel." */
export function linkBookingPersonConfirmMessage(count: number, name: string): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  return `All ${n} booking${n === 1 ? '' : 's'} under this ID will show as ${text(name) || 'this person'}.`
}

/** "Linked: 3 bookings now show as Farnie Nel." Only after a write happened; otherwise `LINK_BOOKING_PERSON_ALREADY_MESSAGE`. */
export function linkBookingPersonDoneMessage(count: number, name: string): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  return `Linked: ${n} booking${n === 1 ? '' : 's'} now show${n === 1 ? 's' : ''} as ${text(name) || 'this person'}.`
}

export type LinkBookingPersonRefusal = {
  reason: 'blank' | 'resolves' | 'already_linked' | 'not_candidate'
  message: string
}

/**
 * Rulebook 1.44.0 §11: the re-check made just before the link is written, on a fresh read of the organisation's users
 * documents (and `operatives` rows): refused when the id is blank, now resolves to someone (`scheduleRowPerson` — e.g.
 * linked from another device meanwhile), is already listed on any users document's `formerUserIds` /
 * `sameEmailUserIds`, or the chosen person is no longer a `linkBookingPersonCandidates` row. Null when the link may go
 * ahead.
 */
export function linkBookingPersonRefusal(input: {
  personId: string
  targetId: string
  roster: readonly LinkCandidateProfile[]
  operatives: readonly BookingPersonInput['operatives'][number][]
  organizationId: string
  viewerIds?: readonly string[] | null
}): LinkBookingPersonRefusal | null {
  const id = text(input.personId)
  if (!id) return { reason: 'blank', message: 'This booking has no person ID to link.' }
  const roster = (input.roster || []).filter((row) => row && text(row.id))
  const holder = roster.find((row) =>
    [...(row.formerUserIds || []), ...(row.sameEmailUserIds || [])].some((value) => idKey(value) === idKey(id))
  )
  if (holder) {
    return { reason: 'already_linked', message: `This ID is already linked to ${rosterPersonName(holder) || text(holder.email) || text(holder.id)}. Check again to refresh the list.` }
  }
  const row = scheduleRowPerson(id, {
    accounts: roster.map((r) => ({ id: r.id, email: r.email ?? null, formerIds: r.formerUserIds ?? [], aliasIds: r.sameEmailUserIds ?? [] })),
    operatives: input.operatives || [],
  })
  if (!row.unresolved) {
    return { reason: 'resolves', message: 'This ID now matches a person, so its bookings already show by name. Check again to refresh the list.' }
  }
  const candidates = linkBookingPersonCandidates(roster, input.organizationId, { viewerIds: input.viewerIds })
  if (!candidates.some((candidate) => idKey(candidate.id) === idKey(input.targetId))) {
    return { reason: 'not_candidate', message: 'That person can no longer be chosen (inactive, not signed up, or in another company). Pick someone else.' }
  }
  return null
}

/**
 * Rulebook 1.44.0 §11: the partial update of the chosen person's `users/{uid}` that links an unlinked booking id —
 * `arrayUnion` of the id onto `formerUserIds` (so a link written meanwhile by another admin is never lost, and stored
 * ids are never rewritten) plus write metadata. Each app maps `arrayUnion` to its SDK's (web `arrayUnion`, iOS
 * `FieldValue.arrayUnion`) and adds its server `updatedAt`. Null when the id is blank, is the person's own id, is
 * already listed on them (without case; then show `LINK_BOOKING_PERSON_ALREADY_MESSAGE`), or the metadata is invalid.
 * Run it on the person's document read inside the same transaction, after `linkBookingPersonRefusal`. An admin write
 * (§16 identity links: admins write `formerUserIds`, the person never does).
 */
export function linkBookingPersonWriteFields(input: {
  person: { id: string; formerUserIds?: readonly string[] | null }
  personId: string
  actorUserId: string
  platform: 'web' | 'ios' | 'android'
}): { arrayUnion: { formerUserIds: string[] }; set: { updatedBy: string; updatedFrom: string } } | null {
  const id = text(input.personId)
  if (!id || idKey(id) === idKey(input.person?.id)) return null
  const stored = Array.isArray(input.person?.formerUserIds) ? input.person.formerUserIds : []
  if (stored.some((value) => idKey(value) === idKey(id))) return null
  const metadata = writeMetadataFields(input.actorUserId, input.platform)
  if (!metadata) return null
  return { arrayUnion: { formerUserIds: [id] }, set: { ...metadata } }
}

// MARK: - What else a link brings with it (1.44.0 review r319)

export const LINK_BOOKING_PERSON_PAY_ACK_LABEL = 'I understand pay may change'
export const LINK_BOOKING_PERSON_PAY_WARNING = 'Pay for unsigned timesheets may change.'

export type LinkBookingPersonFiledUnder = {
  /** `operativeDayRateHistory` rows whose `userId` or `operativeId` is the id. */
  rateHistoryRows?: number
  /** `holidayBookings` whose `userId` or `operativeId` is the id. */
  leaveRecords?: number
  /** `settings/timesheet_<id>_*` sheets, or sheets whose `userId` is the id. */
  timesheets?: number
  overtimeRequests?: number
  priceWorkItems?: number
  expenseItems?: number
}

export type LinkBookingPersonImpact = {
  /** "2 pay-rate history rows", "1 leave record", … in that order; only kinds with at least one record. */
  parts: string[]
  /** "Also linked: 2 pay-rate history rows, 1 leave record. Pay for unsigned timesheets may change." or null. */
  alsoText: string | null
  /** A rate history row is filed under the id: pay may change, so the admin must tick `LINK_BOOKING_PERSON_PAY_ACK_LABEL`. */
  requiresPayAck: boolean
}

function countText(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Rulebook 1.44.0 §11 (review r319): linking an id adds it to the person's `formerUserIds`, so everything filed under
 * it becomes theirs through `personIdSet` — not only bookings: pay-rate history (`payRateOnDay` reads those rows, so the
 * pay of unsigned timesheets may change), annual leave, timesheets, overtime requests, price work and expenses. The
 * confirm lists them (`alsoText`) and, when any rate history row is filed under the id, the Link button waits for an
 * explicit tick (`requiresPayAck`, `LINK_BOOKING_PERSON_PAY_ACK_LABEL`). Counts below 1 (or missing) are left out.
 */
export function linkBookingPersonImpact(filed: LinkBookingPersonFiledUnder | null | undefined): LinkBookingPersonImpact {
  const n = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0))
  const f = filed || {}
  const parts: string[] = []
  if (n(f.rateHistoryRows)) parts.push(countText(n(f.rateHistoryRows), 'pay-rate history row', 'pay-rate history rows'))
  if (n(f.leaveRecords)) parts.push(countText(n(f.leaveRecords), 'leave record', 'leave records'))
  if (n(f.timesheets)) parts.push(countText(n(f.timesheets), 'timesheet', 'timesheets'))
  if (n(f.overtimeRequests)) parts.push(countText(n(f.overtimeRequests), 'overtime request', 'overtime requests'))
  if (n(f.priceWorkItems)) parts.push(countText(n(f.priceWorkItems), 'price work item', 'price work items'))
  if (n(f.expenseItems)) parts.push(countText(n(f.expenseItems), 'expense', 'expenses'))
  const requiresPayAck = n(f.rateHistoryRows) > 0
  const alsoText = parts.length ? `Also linked: ${parts.join(', ')}.${requiresPayAck ? ` ${LINK_BOOKING_PERSON_PAY_WARNING}` : ''}` : null
  return { parts, alsoText, requiresPayAck }
}

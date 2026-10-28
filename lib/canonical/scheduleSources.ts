/**
 * What each app loads before it builds a schedule, and who a booking belongs to.
 *
 * - `rosterPeople`: one roster row per email, with the other same-email `users` document ids kept on it.
 * - `bookingLoadStart`: the first day the booking download must cover.
 * - `workDocuments` / `isWorkLiveOn` / `workStatusOn`: every job document, and whether it runs on a day.
 * - `personDayItems` / `managerClashGroups`: a manager or admin's bookings per day, and where they clash.
 * - `clashPairKey` / `isClashAccepted` / `acceptedClashWriteFields`: `organizations/{orgId}/acceptedBookingClashes`.
 * - `warningResolutionWriteFields`: `organizations/{orgId}/warningResolutions`.
 *
 * Days are organisation day keys (`yyyy-MM-dd`). Both apps run `lib/canonical/parity-fixture.json` against
 * these functions, so web and iOS load, count and approve the same rows.
 */

import { resolveBookingPerson, type BookingPersonInput } from './bookingPerson'
import { normalizeBookingStatus } from './bookings'
import { overlappingIntervalGroups, slotInterval, type MinuteInterval, type StandardDayInput } from './engine'
import { bookingOccupiesDay } from './warningRows'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function idText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function idKey(value: unknown): string {
  return idText(value).toLowerCase()
}

function emailKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function dayKeyText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return DAY_KEY.test(text) ? text : null
}

/** Code-unit order, the same as Swift's `<` on ASCII ids. Never locale order. */
function compareText(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

function uniqueIds(values: Iterable<unknown>, without: readonly string[]): string[] {
  const skip = new Set(without.map(idKey))
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const id = idText(raw)
    const key = id.toLowerCase()
    if (!id || skip.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out.sort(compareText)
}

// MARK: - Roster

export type RosterDocument = {
  id: string
  email?: string | null
  passwordSet?: boolean | null
  isActive?: boolean | null
  firstName?: string | null
  surname?: string | null
  /** Admin access, super admin, or the admin role. */
  admin?: boolean | null
  /** On the Admins, Managers or Operatives list (admin access, manager, or operative mode). */
  listed?: boolean | null
  updatedAtMs?: number | null
  formerUserIds?: readonly string[] | null
  sameEmailUserIds?: readonly string[] | null
}

export type RosterPeopleResult<T extends RosterDocument> = {
  /** One row per email (a blank email keeps its own row), in the order each email first appears. */
  people: Array<T & { sameEmailUserIds: string[]; formerUserIds: string[] }>
  /** Every folded `users` document id → the id kept for that email. Kept ids are not listed. */
  userIdAliases: Record<string, string>
}

/** Tie-break score when two documents share an email: signed in 4, listed 2, named 1, active 1. */
export function rosterDocumentRank(doc: RosterDocument): number {
  let rank = 0
  if (doc.passwordSet === true) rank += 4
  if (doc.listed === true) rank += 2
  if (idText(doc.firstName) || idText(doc.surname)) rank += 1
  if (doc.isActive === true) rank += 1
  return rank
}

function updatedMs(doc: RosterDocument): number {
  return typeof doc.updatedAtMs === 'number' && Number.isFinite(doc.updatedAtMs) ? doc.updatedAtMs : 0
}

/** True when `incoming` replaces `existing` as the kept document. */
function rosterKeeps(existing: RosterDocument, incoming: RosterDocument): boolean {
  const adminA = existing.admin === true
  const adminB = incoming.admin === true
  if (adminA !== adminB) return adminB
  const signedA = existing.passwordSet === true
  const signedB = incoming.passwordSet === true
  if (signedA !== signedB) return signedB
  // The newer write wins, so a person deactivated a moment ago stays inactive.
  if (updatedMs(existing) !== updatedMs(incoming)) return updatedMs(incoming) > updatedMs(existing)
  const activeA = existing.isActive === true
  const activeB = incoming.isActive === true
  if (activeA !== activeB) return activeB
  const rankA = rosterDocumentRank(existing)
  const rankB = rosterDocumentRank(incoming)
  if (rankA !== rankB) return rankB > rankA
  return compareText(idKey(incoming.id), idKey(existing.id)) < 0
}

/**
 * The people a roster lists. Two `users` documents on one email are one person. The kept document is the
 * admin one, then the signed-in one, then the newer `updatedAtMs`, then the active one, then the higher
 * `rosterDocumentRank`, then the lower id. The other id goes
 * on `sameEmailUserIds` and into `userIdAliases`, so bookings saved under it still count for that person.
 * Former invite ids are merged. Exact duplicate ids are read once.
 */
export function rosterPeople<T extends RosterDocument>(docs: readonly T[]): RosterPeopleResult<T> {
  const seenIds = new Set<string>()
  const order: string[] = []
  const groups = new Map<string, T[]>()
  for (const doc of docs || []) {
    const id = idText(doc?.id)
    if (!id || seenIds.has(id.toLowerCase())) continue
    seenIds.add(id.toLowerCase())
    const email = emailKey(doc.email)
    const key = email || `id:${id.toLowerCase()}`
    const list = groups.get(key)
    if (list) list.push(doc)
    else {
      groups.set(key, [doc])
      order.push(key)
    }
  }

  const people: Array<T & { sameEmailUserIds: string[]; formerUserIds: string[] }> = []
  const userIdAliases: Record<string, string> = {}
  for (const key of order) {
    const group = groups.get(key) || []
    let kept = group[0]
    for (const doc of group.slice(1)) if (rosterKeeps(kept, doc)) kept = doc
    const keptId = idText(kept.id)
    const aliases: unknown[] = []
    const former: unknown[] = []
    for (const doc of group) {
      aliases.push(...(doc.sameEmailUserIds || []))
      former.push(...(doc.formerUserIds || []))
      if (doc !== kept) {
        aliases.push(doc.id)
        userIdAliases[idText(doc.id)] = keptId
      }
    }
    people.push({
      ...kept,
      sameEmailUserIds: uniqueIds(aliases, [keptId]),
      formerUserIds: uniqueIds(former, [keptId]),
    })
  }
  return { people, userIdAliases }
}

// MARK: - Booking download

export type BookingLoadStartInput = {
  /** First day the current download covers, or null when nothing is loaded yet. */
  loadedFromDayKey?: string | null
  /** The whole collection is loaded (no lower bound). */
  fullHistory?: boolean | null
  /** Days a screen needs: the warning window start, this week's Monday, a report's first day. */
  neededDayKeys: ReadonlyArray<string | null | undefined>
}

export type BookingLoadStart = {
  /** First day to download from; null means the whole collection. */
  startDayKey: string | null
  /** True when the download must restart from an earlier day. */
  reload: boolean
}

/**
 * The booking download covers every needed day. A warning window that starts before this week's Monday
 * moves the start back and reloads; otherwise its first days look empty and everyone shows as unbooked.
 */
export function bookingLoadStart(input: BookingLoadStartInput): BookingLoadStart {
  if (input?.fullHistory === true) return { startDayKey: null, reload: false }
  const needed = (input?.neededDayKeys || []).map(dayKeyText).filter((key): key is string => Boolean(key))
  const earliest = needed.length ? needed.reduce((a, b) => (compareText(b, a) < 0 ? b : a)) : null
  const loaded = dayKeyText(input?.loadedFromDayKey)
  if (!loaded) return { startDayKey: earliest, reload: false }
  if (earliest && compareText(earliest, loaded) < 0) return { startDayKey: earliest, reload: true }
  return { startDayKey: loaded, reload: false }
}

// MARK: - Jobs

/**
 * Every job document once: projects and small works, deduplicated by document id only. Two documents
 * may share a job number (there are two "C646"s) and bookings point at either, so both stay.
 * The legacy `INITIAL-PLACEHOLDER` document is not a job.
 */
export function workDocuments<T extends { id: string }>(
  projects: readonly T[] | null | undefined,
  smallWorks?: readonly T[] | null
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const work of [...(projects || []), ...(smallWorks || [])]) {
    const key = idKey(work?.id)
    if (!key || key === 'initial-placeholder' || seen.has(key)) continue
    seen.add(key)
    out.push(work)
  }
  return out
}

export type WorkDays = {
  isLive?: boolean | null
  startDayKey?: string | null
  endDayKey?: string | null
}

export type WorkStatusOnDay = 'active' | 'upcoming' | 'completed' | 'inactive'

/** Calendar-day status: not live is inactive; before the start day upcoming; after the end day completed. */
export function workStatusOn(work: WorkDays, dayKey: string): WorkStatusOnDay {
  if (work?.isLive === false) return 'inactive'
  const day = dayKeyText(dayKey)
  if (!day) return 'active'
  const start = dayKeyText(work?.startDayKey)
  const end = dayKeyText(work?.endDayKey)
  if (start && compareText(day, start) < 0) return 'upcoming'
  if (end && compareText(day, end) > 0) return 'completed'
  return 'active'
}

/** The job is live and the day falls on or between its start and end days. A job ending today still runs today. */
export function isWorkLiveOn(work: WorkDays, dayKey: string): boolean {
  return workStatusOn(work, dayKey) === 'active'
}

// MARK: - A manager's day

type ClockFields = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  /** Absent on manager bookings. When present, a cancelled booking is left out. */
  status?: string | null
}

export type PersonDayManagerBooking = ClockFields & { id: string; userId: string; dayKey: string }
export type PersonDayOperativeBooking = ClockFields & { id: string; operativeId: string; dayKey: string }

export type PersonDayItemsInput = {
  managerBookings: readonly PersonDayManagerBooking[]
  operativeBookings: readonly PersonDayOperativeBooking[]
  /** Accounts as the roster lists them (`rosterPeople`), with `formerIds` and `aliasIds`, and the catalogue. */
  people: BookingPersonInput
  /** Roster ids of active managers and admins. */
  managerIds: readonly string[]
}

export type PersonDayItem = {
  kind: 'manager' | 'operative'
  bookingId: string
  /** `m-{id}` or `o-{id}`; items sort by it. */
  pairId: string
  /** Index into `managerBookings` or `operativeBookings`. */
  index: number
}

export type PersonDay = { userId: string; dayKey: string; items: PersonDayItem[] }

function occupiesDay(status: unknown): boolean {
  if (status == null || status === '') return true
  return bookingOccupiesDay(normalizeBookingStatus(status) ?? status)
}

/**
 * Each manager or admin's bookings per day: their manager-schedule bookings, plus labour bookings that
 * name them. A stored id is read through `resolveBookingPerson`, so a booking under their sign-in uid,
 * a folded same-email id, a former invite id, or a catalogue row on their email is theirs. Ordered by
 * day, then user id; items by `pairId`.
 */
export function personDayItems(input: PersonDayItemsInput): PersonDay[] {
  const managerIdByKey = new Map<string, string>()
  for (const id of input?.managerIds || []) {
    const text = idText(id)
    if (text) managerIdByKey.set(text.toLowerCase(), text)
  }
  const people = input?.people || { accounts: [], operatives: [] }
  const managerIdByEmail = new Map<string, string>()
  for (const account of people.accounts || []) {
    const kept = managerIdByKey.get(idKey(account.id))
    const email = emailKey(account.email)
    if (kept && email && !managerIdByEmail.has(email)) managerIdByEmail.set(email, kept)
  }

  const ownerOf = (storedId: string): string | null => {
    const direct = managerIdByKey.get(idKey(storedId))
    const person = resolveBookingPerson(storedId, people)
    const account = person.accountId ? managerIdByKey.get(idKey(person.accountId)) : undefined
    if (account) return account
    if (direct) return direct
    return person.email ? managerIdByEmail.get(person.email) ?? null : null
  }

  const days = new Map<string, PersonDay>()
  const seenPairIds = new Set<string>()
  const push = (userId: string, dayKey: string, item: PersonDayItem) => {
    if (seenPairIds.has(item.pairId.toLowerCase())) return
    seenPairIds.add(item.pairId.toLowerCase())
    const key = `${userId}|${dayKey}`
    const day = days.get(key) || { userId, dayKey, items: [] }
    day.items.push(item)
    days.set(key, day)
  }

  ;(input?.managerBookings || []).forEach((booking, index) => {
    const id = idText(booking?.id)
    const day = dayKeyText(booking?.dayKey)
    if (!id || !day || !occupiesDay(booking.status)) return
    const owner = ownerOf(idText(booking.userId))
    if (owner) push(owner, day, { kind: 'manager', bookingId: id, pairId: `m-${id}`, index })
  })
  ;(input?.operativeBookings || []).forEach((booking, index) => {
    const id = idText(booking?.id)
    const day = dayKeyText(booking?.dayKey)
    if (!id || !day || !occupiesDay(booking.status)) return
    const owner = ownerOf(idText(booking.operativeId))
    if (owner) push(owner, day, { kind: 'operative', bookingId: id, pairId: `o-${id}`, index })
  })

  return Array.from(days.values())
    .map((day) => ({ ...day, items: [...day.items].sort((a, b) => compareText(a.pairId, b.pairId)) }))
    .sort((a, b) => compareText(a.dayKey, b.dayKey) || compareText(a.userId, b.userId))
}

export type ManagerClashGroup = {
  userId: string
  dayKey: string
  /** Two or more items whose clock intervals overlap, in `pairId` order. */
  items: Array<PersonDayItem & { interval: MinuteInterval }>
  /** `pairId`s joined with `|`. */
  pairKey: string
  /** Booking ids of the first two items: the pair `acceptedBookingClashes` records. */
  bookingAId: string
  bookingBId: string
  /** `mgr-clash-{userId}-{dayKey}-{group index on that day}`. */
  resolutionKey: string
}

/**
 * Manager and admin double bookings: per person-day (`personDayItems`), the groups whose `slotInterval`s
 * overlap (`overlappingIntervalGroups`). Touching intervals do not clash.
 */
export function managerClashGroups(input: PersonDayItemsInput & { day?: StandardDayInput | null }): ManagerClashGroup[] {
  const groups: ManagerClashGroup[] = []
  const seen = new Set<string>()
  for (const personDay of personDayItems(input)) {
    if (personDay.items.length < 2) continue
    const intervals = personDay.items.map((item) => {
      const booking =
        item.kind === 'manager' ? input.managerBookings[item.index] : input.operativeBookings[item.index]
      return slotInterval(
        { timeSlot: booking?.timeSlot, workStartTime: booking?.workStartTime, workEndTime: booking?.workEndTime },
        input.day
      )
    })
    overlappingIntervalGroups(intervals).forEach((indexes, clusterIndex) => {
      const items = indexes
        .map((i) => ({ ...personDay.items[i], interval: intervals[i] as MinuteInterval }))
        .sort((a, b) => compareText(a.pairId, b.pairId))
      const pairKey = items.map((item) => item.pairId).join('|')
      if (items.length < 2 || seen.has(pairKey)) return
      seen.add(pairKey)
      groups.push({
        userId: personDay.userId,
        dayKey: personDay.dayKey,
        items,
        pairKey,
        bookingAId: items[0].bookingId,
        bookingBId: items[1].bookingId,
        resolutionKey: `mgr-clash-${personDay.userId}-${personDay.dayKey}-${clusterIndex}`,
      })
    })
  }
  return groups
}

// MARK: - Approvals

/** `acceptedBookingClashes` document id: the two booking ids in code-unit order, joined with `|`. */
export function clashPairKey(bookingAId: unknown, bookingBId: unknown): string {
  return [idText(bookingAId), idText(bookingBId)].sort(compareText).join('|')
}

export type AcceptedClashRecord = string | { id?: string | null; bookingAId?: string | null; bookingBId?: string | null }

/** True when a saved `acceptedBookingClashes` row (its id, or its two booking ids in either order) names this pair. Ids compare without case. */
export function isClashAccepted(
  bookingAId: unknown,
  bookingBId: unknown,
  accepted: readonly AcceptedClashRecord[] | null | undefined
): boolean {
  const a = idKey(bookingAId)
  const b = idKey(bookingBId)
  if (!a || !b) return false
  const key = clashPairKey(a, b)
  const savedKey = (raw: unknown) => {
    const [first, second, ...rest] = idKey(raw).split('|')
    return first && second && rest.length === 0 ? clashPairKey(first, second) : ''
  }
  return (accepted || []).some((row) => {
    if (typeof row === 'string') return savedKey(row) === key
    if (!row) return false
    if (savedKey(row.id) === key) return true
    const rowA = idKey(row.bookingAId)
    const rowB = idKey(row.bookingBId)
    return Boolean(rowA && rowB) && clashPairKey(rowA, rowB) === key
  })
}

function validDocumentId(id: string): boolean {
  return Boolean(id) && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id) && id.length <= 1500
}

export type AcceptedClashWrite = {
  documentId: string
  /** The app adds `acceptedAt` (a server or client Timestamp). */
  fields: { bookingAId: string; bookingBId: string; acceptedByUserId: string }
}

/** `organizations/{orgId}/acceptedBookingClashes/{clashPairKey}`. Null when either id is blank, both are the same, or no one is signed in. */
export function acceptedClashWriteFields(input: {
  bookingAId: unknown
  bookingBId: unknown
  acceptedByUserId: unknown
}): AcceptedClashWrite | null {
  const a = idText(input?.bookingAId)
  const b = idText(input?.bookingBId)
  const by = idText(input?.acceptedByUserId)
  if (!a || !b || !by || a.toLowerCase() === b.toLowerCase()) return null
  const documentId = clashPairKey(a, b)
  if (!validDocumentId(documentId)) return null
  return { documentId, fields: { bookingAId: a, bookingBId: b, acceptedByUserId: by } }
}

export const WARNING_RESOLUTION_STATUSES = ['approved', 'dismissed'] as const
export type WarningResolutionStatus = (typeof WARNING_RESOLUTION_STATUSES)[number]

export type WarningResolutionWrite = {
  documentId: string
  /** The app adds `resolvedAt` (a server or client Timestamp). */
  fields: { resolutionKey: string; status: WarningResolutionStatus; resolvedByUserId: string }
}

/**
 * `organizations/{orgId}/warningResolutions/{resolutionKey}`: an approved or dismissed warning, shared by
 * every device in the organisation (iOS kept these in UserDefaults). Undoing an approval deletes the
 * document. Null for a blank key, a key Firestore cannot use as an id, an unknown status, or no signed-in user.
 */
export function warningResolutionWriteFields(input: {
  resolutionKey: unknown
  status: unknown
  resolvedByUserId: unknown
}): WarningResolutionWrite | null {
  const resolutionKey = idText(input?.resolutionKey)
  const status = typeof input?.status === 'string' ? input.status.trim().toLowerCase() : ''
  const by = idText(input?.resolvedByUserId)
  if (!validDocumentId(resolutionKey) || !by) return null
  if (!(WARNING_RESOLUTION_STATUSES as readonly string[]).includes(status)) return null
  return {
    documentId: resolutionKey,
    fields: { resolutionKey, status: status as WarningResolutionStatus, resolvedByUserId: by },
  }
}

export type WarningResolutionRecord = { id?: unknown; resolutionKey?: unknown; status?: unknown } | null | undefined

/**
 * Keys of `warningResolutions` documents that hide a warning: status `approved` or `dismissed` (any case).
 * The key is the document's `resolutionKey`, else its document id. Unknown statuses are ignored.
 */
export function resolvedWarningKeys(records: readonly WarningResolutionRecord[] | null | undefined): string[] {
  const keys = new Set<string>()
  for (const record of records || []) {
    if (!record) continue
    const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : ''
    if (!(WARNING_RESOLUTION_STATUSES as readonly string[]).includes(status)) continue
    const key = idText(record.resolutionKey) || idText(record.id)
    if (key) keys.add(key)
  }
  return [...keys].sort(compareText)
}

export type WarningDecisions = {
  /** From `resolvedWarningKeys`. */
  resolvedKeys?: readonly string[] | null
  /** `acceptedBookingClashes` rows. */
  acceptedClashes?: readonly AcceptedClashRecord[] | null
}

/**
 * Whether a computed warning row still counts and is listed. A row is hidden when its resolution key was
 * approved or dismissed in `warningResolutions`, or, for a clash row (both booking ids), when that pair is in
 * `acceptedBookingClashes`. The warning total on both apps is the number of rows this keeps.
 */
export function isWarningActive(
  row: { resolutionKey?: unknown; bookingAId?: unknown; bookingBId?: unknown } | null | undefined,
  decisions: WarningDecisions | null | undefined
): boolean {
  if (!row) return false
  const key = idText(row.resolutionKey)
  if (key && (decisions?.resolvedKeys || []).includes(key)) return false
  if (idText(row.bookingAId) && idText(row.bookingBId)) {
    return !isClashAccepted(row.bookingAId, row.bookingBId, decisions?.acceptedClashes)
  }
  return true
}

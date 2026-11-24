/**
 * Rulebook 1.86.0 §2 / §5 (owner decision 24 Nov, "offline Replace on iPhone"): Replace on an orange double-booking
 * row works offline on iOS and Android (`offlineAvailability('booking.replace')` = `allowedOffline`). Web stays online
 * only.
 *
 * Offline, Replace queues ONE item: the new booking (a create) and, for each replaced booking, its delete with its
 * tombstone. The item keeps each replaced booking's `bookingDeleteFingerprint` as last synced from the server (the
 * baseline of a queued edit of it, never the unsynced edit). It shows "Pending sync" and the sync list offers undo
 * until it is sent. On replay the app reads, in one Firestore transaction, the new booking's document and its
 * tombstone and every replaced booking and its tombstone, asks `offlineReplaceReplayDecision`, and writes only what it
 * answers: the create (a plain create, never a merge) and the deletes it lists (`bookingReplaceWrites` for the paths
 * and tombstones). A server refusal of that write is read with `offlineReplaceRefusalDecision`.
 *
 * Why a changed replaced booking refuses the whole Replace (owner recommendation, adopted): the person chose Replace
 * against the booking they were shown. If another device changed it since, deleting it would remove work nobody here
 * saw, and creating the new booking alone would silently leave a double booking. So nothing is written, both bookings
 * stay as the server has them (the new one leaves this device), and the person reads
 * `OFFLINE_REPLACE_CHANGED_MESSAGE` and decides again.
 */

import { bookingDeleteFingerprint, offlineDeleteRefusalDecision, type BookingFingerprintInput } from './bookingTombstones'
import { BOOKING_REPLACE_COLLECTIONS, type BookingReplaceCollection } from './bookingReplace'

export const OFFLINE_REPLACE_REPLAY_DECISIONS = [
  'apply',
  'createOnly',
  'alreadyApplied',
  'dropLocal',
  'refuseChanged',
  'refusePermission',
] as const
export type OfflineReplaceReplayDecision = (typeof OFFLINE_REPLACE_REPLAY_DECISIONS)[number]

/** Per replaced booking: what the replay does with it. */
export const OFFLINE_REPLACE_TARGET_OUTCOMES = ['delete', 'dropLocal', 'alreadyGone', 'refuseChanged', 'refusePermission'] as const
export type OfflineReplaceTargetOutcome = (typeof OFFLINE_REPLACE_TARGET_OUTCOMES)[number]

/** Shown when a queued Replace is refused because a replaced booking changed on another device after it was queued. */
export const OFFLINE_REPLACE_CHANGED_MESSAGE = 'Changed on another device — not replaced'
/** Shown when a queued Replace is refused because the person may no longer remove a replaced booking (or book this). */
export const OFFLINE_REPLACE_REFUSED_MESSAGE =
  'Not replaced — you can no longer remove the existing booking, so both bookings are as they were'

/** One replaced booking as the device queued it. */
export type QueuedOfflineReplaceTarget = {
  bookingId: string
  collection: string
  /** `bookingDeleteFingerprint` of the booking as last synced from the server when Replace was chosen offline. */
  fingerprint: string
  /** True when this replaced booking was itself created offline and its create never reached the server. */
  createdOffline?: boolean | null
}

/** A queued offline Replace, as the device stored it. */
export type QueuedOfflineReplace = {
  booking: { bookingId: string; collection: string }
  replaced: ReadonlyArray<QueuedOfflineReplaceTarget>
  /** True when the person deleted the new booking on this device before the item was sent. */
  newBookingDeleted?: boolean | null
}

/** What the replay read for one replaced booking. */
export type OfflineReplaceLiveTarget = {
  bookingId: string
  collection?: string | null
  /** The live document, or null when it is missing. */
  live: BookingFingerprintInput | null | undefined
  tombstoned?: boolean | null
  /** `canDeleteBooking` for the signed-in user on the live booking; missing is read as allowed (the rules still check). */
  mayDelete?: boolean | null
}

export type OfflineReplaceReplayResult = {
  decision: OfflineReplaceReplayDecision
  /** The replaced bookings to delete with their tombstones, only for `apply` (stored spelling, queue order). */
  deletes: Array<{ collection: BookingReplaceCollection; bookingId: string }>
  /** Each queued replaced booking with its own outcome (for the message and the device's local copy). */
  targets: Array<{ collection: string; bookingId: string; outcome: OfflineReplaceTargetOutcome }>
  /** The message to show for a refusal, else null. */
  message: string | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function usableId(value: unknown): string {
  const id = text(value)
  return id && !id.includes('/') ? id : ''
}

function isReplaceCollection(value: unknown): value is BookingReplaceCollection {
  return (BOOKING_REPLACE_COLLECTIONS as readonly string[]).includes(text(value))
}

function refKey(collection: string, bookingId: string): string {
  return `${collection}/${bookingId.toLowerCase()}`
}

/**
 * What replaying a queued offline Replace does. In order:
 *   - `dropLocal` — the person deleted the new booking on this device before the item was sent (or the item is
 *     unusable): the whole item is removed, nothing is sent, the replaced bookings come back on this device;
 *   - `alreadyApplied` — the new booking already exists or is tombstoned on the server (an earlier attempt committed
 *     and the device did not hear back; the batch is atomic, so the deletes went with it): removed quietly, nothing
 *     is sent, never re-created;
 *   - `refusePermission` — `mayCreate` is false, or a live replaced booking the person may no longer delete
 *     (`mayDelete` false), or a collection Replace may not delete: nothing is sent, the item is removed, the new booking
 *     leaves this device and the replaced ones come back, with `OFFLINE_REPLACE_REFUSED_MESSAGE`;
 *   - `refuseChanged` — a live replaced booking's `bookingDeleteFingerprint` differs from the queued one (or the queued
 *     one is blank): the same, with `OFFLINE_REPLACE_CHANGED_MESSAGE`;
 *   - `createOnly` — every replaced booking is already gone (missing or tombstoned) or was created offline and never
 *     sent: only the new booking is created;
 *   - `apply` — the new booking is created and each live, unchanged, deletable replaced booking is deleted with its
 *     tombstone (`deletes`); replaced bookings already gone are skipped.
 * Per target: created offline → `dropLocal`; missing or tombstoned → `alreadyGone`; not deletable → `refusePermission`;
 * fingerprint differs → `refuseChanged`; else `delete`.
 */
export function offlineReplaceReplayDecision(input: {
  queued: QueuedOfflineReplace | null | undefined
  /** The new booking's document as the replay read it. */
  newBooking?: { exists?: boolean | null; tombstoned?: boolean | null } | null
  replaced: ReadonlyArray<OfflineReplaceLiveTarget | null | undefined> | null | undefined
  /** `canWriteBooking` for the new booking; missing is read as allowed (the rules still check). */
  mayCreate?: boolean | null
  timeZone?: string | null
}): OfflineReplaceReplayResult {
  const nothing = (decision: OfflineReplaceReplayDecision, targets: OfflineReplaceReplayResult['targets'] = []): OfflineReplaceReplayResult => ({
    decision,
    deletes: [],
    targets,
    message:
      decision === 'refuseChanged'
        ? OFFLINE_REPLACE_CHANGED_MESSAGE
        : decision === 'refusePermission'
          ? OFFLINE_REPLACE_REFUSED_MESSAGE
          : null,
  })
  const queued = input?.queued
  const bookingId = usableId(queued?.booking?.bookingId)
  if (!queued || !bookingId || !isReplaceCollection(queued.booking?.collection)) return nothing('dropLocal')
  if (queued.newBookingDeleted === true) return nothing('dropLocal')
  if (input.newBooking?.exists === true || input.newBooking?.tombstoned === true) return nothing('alreadyApplied')

  const live = new Map<string, OfflineReplaceLiveTarget>()
  for (const row of input.replaced || []) {
    const id = usableId(row?.bookingId)
    if (!row || !id) continue
    live.set(refKey(text(row.collection), id), row)
  }

  const targets: OfflineReplaceReplayResult['targets'] = []
  const deletes: OfflineReplaceReplayResult['deletes'] = []
  const seen = new Set<string>()
  for (const target of queued.replaced || []) {
    const id = usableId(target?.bookingId)
    const collection = text(target?.collection)
    if (!target || !id) continue
    const key = refKey(collection, id)
    if (seen.has(key)) continue
    seen.add(key)
    if (id.toLowerCase() === bookingId.toLowerCase()) {
      targets.push({ collection, bookingId: id, outcome: 'refusePermission' })
      continue
    }
    if (target.createdOffline === true) {
      targets.push({ collection, bookingId: id, outcome: 'dropLocal' })
      continue
    }
    if (!isReplaceCollection(collection)) {
      targets.push({ collection, bookingId: id, outcome: 'refusePermission' })
      continue
    }
    const read = live.get(key)
    if (!read || read.tombstoned === true || !read.live) {
      targets.push({ collection, bookingId: id, outcome: 'alreadyGone' })
      continue
    }
    if (read.mayDelete === false) {
      targets.push({ collection, bookingId: id, outcome: 'refusePermission' })
      continue
    }
    const queuedFingerprint = text(target.fingerprint)
    const liveFingerprint = bookingDeleteFingerprint({ ...read.live, collection }, input.timeZone)
    if (!queuedFingerprint || !liveFingerprint || queuedFingerprint !== liveFingerprint) {
      targets.push({ collection, bookingId: id, outcome: 'refuseChanged' })
      continue
    }
    targets.push({ collection, bookingId: id, outcome: 'delete' })
    deletes.push({ collection, bookingId: id })
  }

  if (input.mayCreate === false || targets.some((t) => t.outcome === 'refusePermission')) return nothing('refusePermission', targets)
  if (targets.some((t) => t.outcome === 'refuseChanged')) return nothing('refuseChanged', targets)
  if (deletes.length === 0) return { decision: 'createOnly', deletes: [], targets, message: null }
  return { decision: 'apply', deletes, targets, message: null }
}

/**
 * The server refused the write `offlineReplaceReplayDecision` let through (the transaction raced another device). The
 * same mapping as `offlineDeleteRefusalDecision`: not-found → `alreadyGone`, permission-denied → `refusePermission`,
 * anything else (offline, unavailable, aborted) → `retry` (the item stays queued). For a Replace, `alreadyGone` and
 * `refusePermission` both mean "read again and ask `offlineReplaceReplayDecision` once more": a replaced booking may
 * have been deleted (its tombstone then refuses the second tombstone). Only a second permission-denied on a fresh
 * decision is final (`OFFLINE_REPLACE_REFUSED_MESSAGE`); a second not-found retries later.
 */
export function offlineReplaceRefusalDecision(code: unknown): 'alreadyGone' | 'refusePermission' | 'retry' {
  return offlineDeleteRefusalDecision(code)
}

/**
 * Rulebook 1.46.0: one slot spelling inside a booking fingerprint (`overtimeBookingFingerprint`), on every platform.
 *
 * Web stores a custom-hours booking's slot as `CUSTOM` or `CUSTOM_HOURS`, iOS reads it as `CUSTOM_HOURS`, and older
 * fingerprints wrote the slot with spaces (`CUSTOM HOURS`), so the same booking fingerprinted differently on the two
 * apps and a review made on one read as stale on the other. The slot is now the rulebook's canonical slot
 * (`normalizeBookingTimeSlot`, the vocabulary `bookingDeleteFingerprint` uses, §2), and fingerprints are compared with
 * `overtimeFingerprintsMatch`, which reads the slot of both sides canonically — so a fingerprint stored before this
 * change (overtime reviews and requests since 1.29.0) still matches the same booking.
 */

import { normalizeBookingTimeSlot } from './bookings'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

/**
 * The canonical slot for a fingerprint: `normalizeBookingTimeSlot` (`CUSTOM`, `CUSTOM HOURS`, `custom_hours` →
 * `CUSTOM_HOURS`; `Full day` → `FULL DAY`; `morning` → `AM` …); an unknown slot is upper case with spaces.
 */
export function bookingFingerprintSlot(raw: unknown): string {
  return normalizeBookingTimeSlot(raw) ?? text(raw).toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

/**
 * A stored or computed `overtimeBookingFingerprint` (`dayKey|slot|start|end|rate|nb|status`) with its slot read
 * canonically, so every stored spelling of a slot gives the same key. '' for none.
 */
export function overtimeFingerprintKey(fingerprint: unknown): string {
  const value = text(fingerprint)
  if (!value) return ''
  const parts = value.split('|')
  if (parts.length > 1) parts[1] = bookingFingerprintSlot(parts[1])
  return parts.join('|')
}

/** Whether two booking fingerprints are the same booking (slot spellings compared canonically). Blank never matches. */
export function overtimeFingerprintsMatch(a: unknown, b: unknown): boolean {
  const left = overtimeFingerprintKey(a)
  return left !== '' && left === overtimeFingerprintKey(b)
}

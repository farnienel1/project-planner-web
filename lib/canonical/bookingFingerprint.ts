/**
 * Rulebook 1.46.0: booking fingerprints (`overtimeBookingFingerprint`) compared with the slot read canonically, on every
 * platform.
 *
 * Web stores a custom-hours booking's slot as `CUSTOM` or `CUSTOM_HOURS`, and iOS reads it as `CUSTOM_HOURS`, so the
 * same booking fingerprinted `…|CUSTOM|…` on one app and `…|CUSTOM HOURS|…` on the other, and a review made on one read
 * as stale on the other. The written fingerprint is unchanged (the pre-1.46.0 form, so app builds on the 1.45 script
 * still write and compare the same strings); 1.46.0 compares fingerprints only with `overtimeFingerprintsMatch`, which
 * reads the slot of both sides through the rulebook's slot normaliser (`normalizeBookingTimeSlot`, the vocabulary
 * `bookingDeleteFingerprint` uses, §2).
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

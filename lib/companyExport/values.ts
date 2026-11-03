/**
 * Company data export (launch checklist 2.1): turning stored Firestore values into plain export values.
 *
 * Pure: no Firebase import, so the conversion is unit-tested in Node. Firestore class instances are recognised by
 * shape (Timestamp `toDate` + `seconds`, GeoPoint `latitude` / `longitude`, DocumentReference `path` + `firestore`,
 * Bytes `toBase64`), never by `instanceof`, so a value from any SDK copy converts the same way.
 *
 * Instants are written in the organisation business time zone (rulebook §1, `organizationTimeZone`), never the
 * browser zone: `2026-11-03T14:05:09+00:00`.
 */
import { partsInZone } from '../orgTime/zoneTime'

/** A plain export value: what goes into `export.json` and, flattened, into a CSV cell. */
export type ExportValue = string | number | boolean | null | ExportValue[] | { [key: string]: ExportValue }

function pad(value: number, width = 2): string {
  return String(Math.abs(Math.trunc(value))).padStart(width, '0')
}

/** ISO 8601 date-time of `instant` on the organisation's wall clock, with that zone's offset (seconds kept). */
export function isoInZone(instant: Date, timeZone: string): string {
  const ms = instant.getTime()
  if (!Number.isFinite(ms)) return ''
  const floored = Math.floor(ms / 60_000) * 60_000
  const p = partsInZone(new Date(floored), timeZone)
  const offsetMs = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - floored
  const wall = new Date(ms + offsetMs).toISOString().slice(0, 19)
  const offsetMinutes = Math.round(offsetMs / 60_000)
  const sign = offsetMinutes < 0 ? '-' : '+'
  return `${wall}${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function timestampDate(value: Record<string, unknown>): Date | null {
  if (typeof value.toDate === 'function' && typeof value.seconds === 'number') {
    const date = (value.toDate as () => unknown)()
    return date instanceof Date ? date : null
  }
  // A Timestamp that went through JSON (or a REST read) keeps only its numbers.
  const keys = Object.keys(value)
  const seconds = value.seconds ?? value._seconds
  const nanos = value.nanoseconds ?? value._nanoseconds
  if (keys.length === 2 && typeof seconds === 'number' && typeof nanos === 'number') {
    return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000))
  }
  return null
}

/**
 * One stored value as a plain export value. Timestamps and Dates become organisation-zone ISO text; a GeoPoint is
 * `{ latitude, longitude }`; a DocumentReference is its path; Bytes are base64; anything else plain is kept.
 */
export function exportValue(value: unknown, timeZone: string): ExportValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return isoInZone(value, timeZone)
  if (Array.isArray(value)) return value.map((entry) => exportValue(entry, timeZone))
  if (isRecord(value)) {
    const date = timestampDate(value)
    if (date) return isoInZone(date, timeZone)
    if (typeof value.path === 'string' && 'firestore' in value && typeof value.id === 'string') return value.path
    if (typeof value.toBase64 === 'function') return String((value.toBase64 as () => unknown)())
    if (
      typeof value.latitude === 'number' &&
      typeof value.longitude === 'number' &&
      typeof value.isEqual === 'function'
    ) {
      return { latitude: value.latitude, longitude: value.longitude }
    }
    const out: { [key: string]: ExportValue } = {}
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined || typeof value[key] === 'function') continue
      out[key] = exportValue(value[key], timeZone)
    }
    return out
  }
  return String(value)
}

/** A whole document as plain export values. */
export function exportDocument(data: Record<string, unknown>, timeZone: string): Record<string, ExportValue> {
  const value = exportValue(data, timeZone)
  return isRecord(value) ? (value as Record<string, ExportValue>) : {}
}

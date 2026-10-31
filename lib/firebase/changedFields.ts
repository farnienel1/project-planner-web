/**
 * Partial writes (rulebook §1 "Partial writes only"): the fields of `next` that differ from the stored document,
 * for an `updateDoc` / `updateData`. A key the stored copy lacks is written; a stored key `next` lacks is left
 * alone (never deleted). A plain map that exists on both sides is compared key by key and written as dotted
 * paths, so a concurrent change to a sibling key is not overwritten. Arrays, Timestamps and other values are
 * written whole when they differ. No Firebase import, so it runs in unit tests.
 */

const SAFE_SEGMENT = /^[A-Za-z_][A-Za-z0-9_-]*$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

type TimestampLike = { toMillis: () => number; isEqual?: (other: unknown) => boolean }

function isTimestampLike(value: unknown): value is TimestampLike {
  return Boolean(value) && typeof value === 'object' && typeof (value as TimestampLike).toMillis === 'function'
}

/** Deep equality for Firestore values: primitives, Dates, Timestamps, arrays and plain maps. */
export function sameFirestoreValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b)
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (isTimestampLike(a) && isTimestampLike(b)) {
    if (typeof a.isEqual === 'function') return a.isEqual(b)
    return a.toMillis() === b.toMillis()
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => sameFirestoreValue(entry, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a).filter((key) => a[key] !== undefined)
    const keysB = Object.keys(b).filter((key) => b[key] !== undefined)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && sameFirestoreValue(a[key], b[key]))
  }
  return false
}

export function changedFirestoreFields(
  next: Record<string, unknown>,
  stored: Record<string, unknown> | null | undefined,
  prefix = ''
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const base = stored || {}
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue
    const path = prefix ? `${prefix}.${key}` : key
    const has = Object.prototype.hasOwnProperty.call(base, key)
    if (has && sameFirestoreValue(value, base[key])) continue
    const before = has ? base[key] : undefined
    const nestedKeysSafe = isPlainObject(value) && Object.keys(value).every((sub) => SAFE_SEGMENT.test(sub))
    if (has && isPlainObject(value) && isPlainObject(before) && nestedKeysSafe && SAFE_SEGMENT.test(key)) {
      Object.assign(out, changedFirestoreFields(value, before, path))
      continue
    }
    out[path] = value
  }
  return out
}

import { Timestamp } from 'firebase/firestore'

export function parseFirestoreDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = value as { toDate?: () => Date }
    if (typeof maybe.toDate === 'function') return maybe.toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  return undefined
}

export function toFirestoreTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date)
}

export function newUuid(): string {
  return crypto.randomUUID()
}

export function parseUuid(value: unknown, fallbackDocId?: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallbackDocId || newUuid()
}

export function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const maybe = value as { toNumber?: () => number }
    if (typeof maybe.toNumber === 'function') return maybe.toNumber()
  }
  return undefined
}

/** Remove undefined values before writing to Firestore (SDK rejects undefined). */
export function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value instanceof Date || value instanceof Timestamp) return value
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const sanitized = sanitizeForFirestore(entry)
      return sanitized === undefined ? null : sanitized
    })
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue
      out[key] = sanitizeForFirestore(entry)
    }
    return out
  }
  return value
}

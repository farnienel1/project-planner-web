/**
 * iOS parity source: FirebaseBackend.swift hand-written dictionary parsers
 * Spec: docs/ios-parity/IOS_PARITY_REBUILD.md §5, docs/ios-parity/01-data-model.md §11
 */

import { Timestamp, deleteField } from 'firebase/firestore'
import { z } from 'zod'

export class IosWriteValidationError extends Error {
  issues: string[]
  constructor(message: string, issues: string[]) {
    super(message)
    this.name = 'IosWriteValidationError'
    this.issues = issues
  }
}

export function asDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = value as { toDate?: () => Date }
    if (typeof maybe.toDate === 'function') {
      const d = maybe.toDate()
      return Number.isNaN(d.getTime()) ? undefined : d
    }
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = Number((value as { seconds: number }).seconds)
    if (!Number.isNaN(seconds)) return new Date(seconds * 1000)
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

export function asTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date)
}

export function asInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const n = (value as { toNumber?: () => number }).toNumber?.()
    if (typeof n === 'number' && Number.isFinite(n)) return Math.trunc(n)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return undefined
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const n = (value as { toNumber?: () => number }).toNumber?.()
    if (typeof n === 'number' && Number.isFinite(n)) return n
  }
  return undefined
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function padClockPart(n: number): string {
  return String(n).padStart(2, '0')
}

/** Booking custom hours are `"HH:mm"`; older docs may store a Timestamp or hour number. */
export function asClockHhMm(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return undefined
    const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)$/i)
    if (ampm) {
      let hours = Number(ampm[1])
      const minutes = Number(ampm[2] || '0')
      const mer = ampm[3].toUpperCase()
      if (mer === 'AM' && hours === 12) hours = 0
      if (mer === 'PM' && hours !== 12) hours += 12
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return `${padClockPart(hours)}:${padClockPart(minutes)}`
      }
    }
    const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw)
    if (m) {
      const hours = Number(m[1])
      const minutes = Number(m[2])
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return `${padClockPart(hours)}:${padClockPart(minutes)}`
      }
    }
    const compact = /^(\d{2})(\d{2})$/.exec(raw)
    if (compact) return `${compact[1]}:${compact[2]}`
    return undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value < 24) {
      const hours = Math.floor(value)
      const minutes = Math.round((value - hours) * 60)
      return `${padClockPart(hours)}:${padClockPart(minutes % 60)}`
    }
    if (value >= 24 && value < 24 * 60) {
      const minutes = Math.round(value)
      return `${padClockPart(Math.floor(minutes / 60))}:${padClockPart(minutes % 60)}`
    }
    return undefined
  }
  const date = asDate(value)
  if (date) return `${padClockPart(date.getHours())}:${padClockPart(date.getMinutes())}`
  return undefined
}

export function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

/** Whole-number Int field — iOS `as? Int` fails on 7.5. */
export function requireInt(value: number, field: string): number {
  if (!Number.isInteger(value)) {
    throw new IosWriteValidationError(`Field ${field} must be a whole number (Int)`, [
      `${field} is ${value}`,
    ])
  }
  return value
}

export function emptyOrDelete(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : deleteField()
}

export const firestoreDateSchema = z.preprocess(
  (v) => asDate(v),
  z.date()
)

export const optionalFirestoreDateSchema = z.preprocess(
  (v) => (v == null ? undefined : asDate(v)),
  z.date().optional()
)

export function issuesFromZod(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
}

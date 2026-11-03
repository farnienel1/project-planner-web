/**
 * Rulebook 1.23.0 §23 (audit finding 18): when a task is overdue and how urgent a deadline is.
 *
 * Both are read on the organisation-zone day (`organizationTimeZone`), never the browser's or the phone's: web used
 * the browser midnight for tasks and London for deadlines, iOS the device calendar. A due date is any stored shape
 * `holidayDocumentDayKey` reads (a `YYYY-MM-DD` key as that day, epoch ms or seconds, an ISO string, a Firestore
 * Timestamp or Date), turned into the organisation day.
 *
 * Pure, JSON in / JSON out.
 */

import { holidayDocumentDayKey } from './holidayDocument'
import { normalizeProjectTaskStatus } from './operationsDocuments'

/** The organisation-zone day key of a stored due date, or '' when there is none. */
export function dueDayKey(raw: unknown, timeZone?: string | null): string {
  return holidayDocumentDayKey(raw, timeZone)
}

/** Whole calendar days from `fromKey` to `toKey` (negative when `toKey` is earlier). */
export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000)
}

/** A `YYYY-MM-DD` key plus `days` calendar days (plain calendar arithmetic). */
export function addCalendarDayKeys(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function todayKey(nowMs: number, timeZone?: string | null): string {
  return holidayDocumentDayKey(Number.isFinite(nowMs) ? nowMs : Date.now(), timeZone)
}

export type DueTask = { status?: string | null; dueDate?: unknown }

/** A task is completed when its status reads as Completed (`normalizeProjectTaskStatus`). */
export function isTaskCompleted(task: DueTask | null | undefined): boolean {
  return normalizeProjectTaskStatus(task?.status) === 'Completed'
}

/**
 * Rulebook 1.23.0 §23: a task is overdue when it is not completed and its due day (organisation zone) is before
 * today in that zone. A task due today is not overdue; a task with no due date never is.
 */
export function isTaskOverdue(task: DueTask | null | undefined, nowMs: number, timeZone?: string | null): boolean {
  if (!task || isTaskCompleted(task)) return false
  const due = dueDayKey(task.dueDate, timeZone)
  return Boolean(due) && due < todayKey(nowMs, timeZone)
}

export type DeadlineUrgency =
  | { kind: 'complete' }
  | { kind: 'blocked' }
  | { kind: 'overdue'; days: number }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'soon'; days: number }
  | { kind: 'thisWeek'; days: number }
  | { kind: 'later'; days: number }

/** Whole organisation-zone days from today to the deadline's due day (negative = overdue); null without a due day. */
export function deadlineDaysRemaining(
  item: { due?: unknown } | null | undefined,
  nowMs: number,
  timeZone?: string | null
): number | null {
  const due = dueDayKey(item?.due, timeZone)
  if (!due) return null
  return calendarDaysBetween(todayKey(nowMs, timeZone), due)
}

/**
 * Rulebook 1.23.0 §23: a deadline's urgency, the rule both apps already used, on the organisation day.
 * complete (status `complete`) → overdue (due day before today, `days` late, even when blocked) → blocked → today →
 * tomorrow → soon (2–3 days) → this week (4–7 days) → later. A deadline with no readable due day is `later` 0.
 */
export function deadlineUrgency(
  item: { status?: string | null; due?: unknown } | null | undefined,
  nowMs: number,
  timeZone?: string | null
): DeadlineUrgency {
  const status = String(item?.status ?? '').trim().toLowerCase()
  if (status === 'complete') return { kind: 'complete' }
  const days = deadlineDaysRemaining(item, nowMs, timeZone)
  if (days == null) return status === 'blocked' ? { kind: 'blocked' } : { kind: 'later', days: 0 }
  if (days < 0) return { kind: 'overdue', days: -days }
  if (status === 'blocked') return { kind: 'blocked' }
  if (days === 0) return { kind: 'today' }
  if (days === 1) return { kind: 'tomorrow' }
  if (days <= 3) return { kind: 'soon', days }
  if (days <= 7) return { kind: 'thisWeek', days }
  return { kind: 'later', days }
}

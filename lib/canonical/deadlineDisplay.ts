/**
 * Rulebook 1.94.0 §23 (owner decision 25 Nov, deadlines UI upgrade): how a deadline reads on every screen — its
 * status, colour, tab, group and words — the same on web and iOS. Display only: nothing here is stored.
 *
 * Day arithmetic is on the organisation-zone day (`dueDayKey`), never the browser's or the phone's. The week is
 * Monday–Sunday (rulebook §1).
 *
 * Pure, JSON in / JSON out.
 */

import { addCalendarDayKeys, calendarDaysBetween, dueDayKey } from './dueDates'

/** The list tabs, in order. Tabs overlap (a deadline can be in This week and Behind pace); groups do not. */
export const DEADLINE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'behindPace', label: 'Behind pace' },
  { key: 'completed', label: 'Completed' },
] as const
export type DeadlineTabKey = (typeof DEADLINE_TABS)[number]['key']

/** The list groups, in order. Each deadline is in exactly one. */
export const DEADLINE_GROUPS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'nextWeek', label: 'Next week' },
  { key: 'later', label: 'Later' },
  { key: 'completed', label: 'Completed' },
] as const
export type DeadlineGroupKey = (typeof DEADLINE_GROUPS)[number]['key']

/** Progress more than this many points below where it should be by today is Behind pace. */
export const DEADLINE_BEHIND_PACE_POINTS = 10

export type DeadlineDisplayStatus = 'met' | 'late' | 'overdue' | 'blocked' | 'behindPace' | 'onTrack'
/** Colour meaning: red overdue, amber this week / behind pace / blocked, primary on track, green met, grey the rest. */
export type DeadlineTone = 'red' | 'amber' | 'primary' | 'green' | 'grey'

export type DeadlineDisplayInput = {
  /** Stored status token (`notStarted`, `inProgress`, `blocked`, `complete`). */
  status?: string | null
  /** 0–1 or 0–100 (either reads the same). */
  progress?: number | null
  due?: unknown
  /** The start date, else the created date; any stored shape `dueDayKey` reads. */
  start?: unknown
  createdAt?: unknown
  completedAt?: unknown
}

export type DeadlineDisplay = {
  status: DeadlineDisplayStatus
  statusLabel: string
  tone: DeadlineTone
  group: DeadlineGroupKey
  tabs: DeadlineTabKey[]
  /** Whole days from today to the due day (negative = overdue); null with no due day. */
  daysRemaining: number | null
  /** "Due today", "Due tomorrow", "Due in 3 days", "1 day overdue", "Met on time", "Done 3 days late". */
  dueText: string
  /** Short pill: "Today", "3d", "+2d", "Done". */
  pill: string
  /** Progress 0–100 (rounded) and where it should be by today, or null when there is no start or due day. */
  progressPercent: number
  expectedPercent: number | null
  /** "25% · expected 64%" when behind pace, else null. */
  paceText: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function keyDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** "Fri 27 Nov" (with `withYear`, "Fri 27 Nov 2026") of a `YYYY-MM-DD` day key; '' for none. */
export function deadlineDayText(dayKey: string | null | undefined, withYear = false): string {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return ''
  const date = keyDate(dayKey)
  const base = `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
  return withYear ? `${base} ${date.getUTCFullYear()}` : base
}

function days(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

function percent(progress: number | null | undefined): number {
  const value = Number(progress)
  if (!Number.isFinite(value)) return 0
  const scaled = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(scaled)))
}

/** The Monday of the organisation week containing `dayKey`. */
function weekStartKey(dayKey: string): string {
  const iso = ((keyDate(dayKey).getUTCDay() + 6) % 7) + 1
  return addCalendarDayKeys(dayKey, 1 - iso)
}

/**
 * Rulebook 1.94.0 §23: one deadline as every screen shows it.
 * - complete → `met` when completed on or before the due day (organisation zone), else `late`;
 * - due day before today → `overdue`; `blocked` → blocked;
 * - expected % = (today − start) ÷ (due − start) × 100, 0–100 (start = start date, else created date; due ≤ start →
 *   100 once due has arrived, else 0); progress more than 10 points below it → `behindPace`, else `onTrack`.
 * Groups: overdue, this week (to this Sunday), next week, later, completed. A deadline with no due day is Later.
 */
export function deadlineDisplay(item: DeadlineDisplayInput | null | undefined, nowMs: number, timeZone?: string | null): DeadlineDisplay {
  const today = dueDayKey(Number.isFinite(nowMs) ? nowMs : Date.now(), timeZone)
  const due = dueDayKey(item?.due, timeZone) || null
  const start = dueDayKey(item?.start, timeZone) || dueDayKey(item?.createdAt, timeZone) || null
  const status = String(item?.status ?? '').trim().toLowerCase()
  const complete = status === 'complete'
  const progressPercent = complete ? 100 : percent(item?.progress)
  const daysRemaining = due ? calendarDaysBetween(today, due) : null

  let expectedPercent: number | null = null
  if (due && start) {
    const span = calendarDaysBetween(start, due)
    expectedPercent =
      span <= 0 ? (today >= due ? 100 : 0) : Math.max(0, Math.min(100, Math.round((calendarDaysBetween(start, today) / span) * 100)))
  }

  const sunday = addCalendarDayKeys(weekStartKey(today), 6)
  const nextSunday = addCalendarDayKeys(sunday, 7)

  if (complete) {
    const doneDay = dueDayKey(item?.completedAt, timeZone)
    const lateBy = doneDay && due ? calendarDaysBetween(due, doneDay) : 0
    const late = lateBy > 0
    return {
      status: late ? 'late' : 'met',
      statusLabel: late ? 'Completed late' : 'Met on time',
      tone: late ? 'grey' : 'green',
      group: 'completed',
      tabs: ['all', 'completed'],
      daysRemaining,
      dueText: late ? `Done ${days(lateBy)} late` : 'Met on time',
      pill: 'Done',
      progressPercent,
      expectedPercent,
      paceText: null,
    }
  }

  const overdue = daysRemaining != null && daysRemaining < 0
  const behind = !overdue && expectedPercent != null && progressPercent < expectedPercent - DEADLINE_BEHIND_PACE_POINTS
  const group: DeadlineGroupKey = overdue
    ? 'overdue'
    : !due
      ? 'later'
      : due <= sunday
        ? 'thisWeek'
        : due <= nextSunday
          ? 'nextWeek'
          : 'later'
  const tabs: DeadlineTabKey[] = ['all']
  if (overdue) tabs.push('overdue')
  if (group === 'thisWeek') tabs.push('thisWeek')
  if (behind) tabs.push('behindPace')

  const displayStatus: DeadlineDisplayStatus = overdue ? 'overdue' : status === 'blocked' ? 'blocked' : behind ? 'behindPace' : 'onTrack'
  const statusLabel = { overdue: 'Overdue', blocked: 'Blocked', behindPace: 'Behind pace', onTrack: 'On track' }[displayStatus as 'overdue']
  const tone: DeadlineTone =
    displayStatus === 'overdue' ? 'red' : displayStatus === 'onTrack' && group !== 'thisWeek' ? 'primary' : 'amber'
  const dueText =
    daysRemaining == null
      ? 'No due date'
      : overdue
        ? `${days(-daysRemaining)} overdue`
        : daysRemaining === 0
          ? 'Due today'
          : daysRemaining === 1
            ? 'Due tomorrow'
            : `Due in ${days(daysRemaining)}`
  const pill = daysRemaining == null ? '—' : overdue ? `+${-daysRemaining}d` : daysRemaining === 0 ? 'Today' : `${daysRemaining}d`
  return {
    status: displayStatus,
    statusLabel,
    tone,
    group,
    tabs,
    daysRemaining,
    dueText,
    pill,
    progressPercent,
    expectedPercent,
    paceText: behind ? `${progressPercent}% · expected ${expectedPercent}%` : null,
  }
}

/** Counts per tab over the deadlines given. */
export function deadlineTabCounts(
  items: ReadonlyArray<DeadlineDisplayInput>,
  nowMs: number,
  timeZone?: string | null
): Record<DeadlineTabKey, number> {
  const counts: Record<DeadlineTabKey, number> = { all: 0, overdue: 0, thisWeek: 0, behindPace: 0, completed: 0 }
  for (const item of items) for (const tab of deadlineDisplay(item, nowMs, timeZone).tabs) counts[tab] += 1
  return counts
}

/**
 * Rulebook 1.94.0 §23: the one summary line above the list — "2 of 3 complete · 1 on time · Next: Fit-out, Fri 27 Nov".
 * "On time" = completed on or before the due day. Next = the earliest-due deadline not completed (overdue first).
 */
export function deadlineSummaryLine(
  items: ReadonlyArray<DeadlineDisplayInput & { title?: string | null }>,
  nowMs: number,
  timeZone?: string | null
): string {
  let completed = 0
  let met = 0
  let next: { title: string; due: string } | null = null
  for (const item of items) {
    const view = deadlineDisplay(item, nowMs, timeZone)
    if (view.group === 'completed') {
      completed += 1
      if (view.status === 'met') met += 1
      continue
    }
    const due = dueDayKey(item.due, timeZone)
    if (due && (!next || due < next.due)) next = { title: String(item.title ?? '').trim() || 'Untitled', due }
  }
  const parts = [`${completed} of ${items.length} complete`, `${met} on time`]
  if (next) parts.push(`Next: ${next.title}, ${deadlineDayText(next.due)}`)
  return parts.join(' · ')
}

/** Rulebook 1.94.0 §23: "Moved 1 day from 27 Nov" / "Brought forward 2 days from 27 Nov"; '' when unchanged. */
export function deadlineMovedNote(fromDue: unknown, toDue: unknown, timeZone?: string | null): string {
  const from = dueDayKey(fromDue, timeZone)
  const to = dueDayKey(toDue, timeZone)
  if (!from || !to || from === to) return ''
  const shift = calendarDaysBetween(from, to)
  const date = keyDate(from)
  const fromText = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
  return shift > 0 ? `Moved ${days(shift)} from ${fromText}` : `Brought forward ${days(-shift)} from ${fromText}`
}

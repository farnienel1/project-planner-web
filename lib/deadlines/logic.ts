/**
 * iOS parity source: Views/DLModels.swift, Views/DLScreens.swift
 * Urgency, risk and slippage are computed. They are never stored.
 */

import { newUuid } from '@/lib/firebase/firestoreUtils'
import {
  DEADLINE_GROUPS,
  calendarDaysBetween,
  deadlineDayText,
  deadlineDisplay,
  deadlineFloorGroup,
  deadlineMovedNote,
  deadlineOnLocation,
  deadlineUrgency,
  dueDayKey,
} from '@/lib/canonical'
import type { DeadlineDisplay, DeadlineTabKey } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type {
  Deadline,
  DeadlineChange,
  DeadlineGroup,
  DeadlineGrouping,
  DeadlineStatus,
  DeadlineUrgency,
} from '@/lib/deadlines/types'

/** Rulebook 1.23.0 §23: a date's day in the organisation zone (`dueDayKey`), never London or the browser. */
function dayKey(date: Date): string {
  return dueDayKey(date, organizationZoneOr())
}

const DAY_MS = 86_400_000

function dayIndex(date: Date): number {
  const [y, m, d] = dayKey(date).split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function daysBetween(from: Date, to: Date): number {
  const a = dayKey(from)
  const b = dayKey(to)
  return a && b ? calendarDaysBetween(a, b) : 0
}

export function daysRemaining(item: Pick<Deadline, 'due'>, now: Date): number {
  return daysBetween(now, item.due)
}

/** Rulebook 1.23.0 §23 `deadlineUrgency` on the organisation day. */
export function urgency(item: Pick<Deadline, 'status' | 'due'>, now: Date): DeadlineUrgency {
  return deadlineUrgency({ status: item.status, due: item.due }, now.getTime(), organizationZoneOr()) as DeadlineUrgency
}

/**
 * Rulebook 1.94.0 §23 `deadlineDisplay` for one stored deadline, on the organisation day: status, colour, tab, group
 * and words. The start is the start date, else the day it was created (its `created` history entry).
 */
export function deadlineView(item: Deadline, now: Date): DeadlineDisplay {
  const created = item.history.find((entry) => entry.kind.type === 'created')
  return deadlineDisplay(
    {
      status: item.status,
      progress: item.progress,
      due: item.due,
      start: item.start,
      createdAt: created?.at ?? null,
      completedAt: item.completedAt,
    },
    now.getTime(),
    organizationZoneOr()
  )
}

/** Rulebook 1.94.0 §23 `deadlineDayText` of a date's organisation day: "Fri 27 Nov" ("Fri 27 Nov 2026"). */
export function deadlineDayLabel(date: Date | null | undefined, withYear = false): string {
  return date ? deadlineDayText(dayKey(date), withYear) : ''
}

export function urgencyRank(value: DeadlineUrgency): number {
  switch (value.kind) {
    case 'overdue':
      return 0
    case 'today':
      return 1
    case 'tomorrow':
      return 2
    case 'soon':
      return 3
    case 'thisWeek':
      return 4
    case 'blocked':
      return 5
    case 'later':
      return 6
    case 'complete':
      return 7
  }
}

export function slippageDays(item: Deadline): number {
  if (!item.originalDue) return 0
  return daysBetween(item.originalDue, item.due)
}

export function timesRescheduled(item: Deadline): number {
  return item.history.filter((change) => change.kind.type === 'rescheduled').length
}

export function progressPercent(item: Pick<Deadline, 'progress'>): number {
  return Math.round(item.progress * 100)
}

export function assigneeInitials(names: string[]): string[] {
  return names.map((name) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
  )
}

export function statusLabel(status: DeadlineStatus): string {
  switch (status) {
    case 'notStarted':
      return 'Not started'
    case 'inProgress':
      return 'In progress'
    case 'blocked':
      return 'Blocked'
    case 'complete':
      return 'Complete'
  }
}

const londonDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: organizationZoneOr(), ...options }).format(date)

export function formatDay(date: Date): string {
  return londonDate(date, { day: 'numeric', month: 'short' })
}

export function formatStamp(date: Date): string {
  const day = formatDay(date)
  const time = londonDate(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${day}, ${time}`
}

export function formatWeekCommencing(date: Date): string {
  const index = dayIndex(date)
  const utc = new Date(index * DAY_MS)
  const weekday = utc.getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  const monday = new Date((index + mondayOffset) * DAY_MS)
  return `W/C ${formatDay(monday)}`
}

export function historyLine(change: DeadlineChange): string {
  const kind = change.kind
  switch (kind.type) {
    case 'created':
      return `Created, due ${formatDay(kind.due)}`
    case 'rescheduled': {
      // Rulebook 1.94.0 §23 `deadlineMovedNote`: "Moved 1 day from 27 Nov" (never "1 days").
      const note = deadlineMovedNote(kind.from, kind.to, organizationZoneOr())
      return `${note || 'Moved'} → ${formatDay(kind.to)} · ${kind.reason}`
    }
    case 'progress':
      return `Progress updated to ${kind.progress}%`
    case 'status':
      return `Marked ${statusLabel(kind.status).toLowerCase()}`
    case 'note':
      return kind.note
    case 'completed':
      return `Completed on ${formatDay(kind.completedOn)}`
    case 'assigned':
      return `Assigned to ${kind.assignedTo}`
    case 'fileAttached':
      return `Attached file · ${kind.name}`
    case 'siteAuditAttached':
      return `Attached site audit · ${kind.name}`
  }
}

/** Rulebook 1.92.0: every floor / area of the deadline (older data: its one `location`). */
export function deadlineLocationList(item: Pick<Deadline, 'location' | 'locations'>): string[] {
  if (item.locations && item.locations.length > 0) return item.locations
  return item.location ? [item.location] : []
}

/** "Ground Floor, 1st Floor" — every floor of the deadline, for cards and the detail sheet. */
export function deadlineLocationText(item: Pick<Deadline, 'location' | 'locations'>): string {
  return deadlineLocationList(item).join(', ')
}

/**
 * The deadlines a non-manager sees: those assigned to them under any id they go by (rulebook §8 `personIdSet`, so a
 * ghost given app access later keeps the deadlines filed under the ghost id, now on `formerUserIds`). Ids compare
 * without case.
 */
export function scopedDeadlines(items: Deadline[], restrictToAssigneeUserIds?: string | ReadonlyArray<string> | null): Deadline[] {
  if (!restrictToAssigneeUserIds || restrictToAssigneeUserIds.length === 0) return items
  const ids = new Set(
    (typeof restrictToAssigneeUserIds === 'string' ? [restrictToAssigneeUserIds] : restrictToAssigneeUserIds)
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean)
  )
  return items.filter((item) => item.assigneeUserIds.some((id) => ids.has(id.trim().toLowerCase())))
}

export function deadlineTrades(items: Deadline[]): string[] {
  return ['All trades', ...Array.from(new Set(items.map((item) => item.trade).filter((trade): trade is string => Boolean(trade)))).sort()]
}

export function filterDeadlines(params: {
  items: Deadline[]
  tab: DeadlineTabKey
  tradeFilter: string
  search: string
  now: Date
}): Deadline[] {
  const query = params.search.trim().toLowerCase()
  return params.items.filter((item) => {
    if (!deadlineView(item, params.now).tabs.includes(params.tab)) return false
    if (params.tradeFilter !== 'All trades' && item.trade !== params.tradeFilter) return false
    if (!query) return true
    const hay = [item.title, deadlineLocationList(item).join(' '), item.trade || '', item.company || '', item.assignees.join(' ')]
      .join(' ')
      .toLowerCase()
    return hay.includes(query)
  })
}

export const ALL_LOCATIONS = 'All locations'
export const EVERYONE = 'Everyone'

/** Every floor / area used by the deadlines, once each (ignoring case), sorted; the first option is "All locations". */
export function deadlineLocationOptions(items: Deadline[]): string[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    for (const floor of deadlineLocationList(item)) {
      const name = floor.trim()
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
    }
  }
  return [ALL_LOCATIONS, ...[...seen.values()].sort((a, b) => a.localeCompare(b))]
}

export type DeadlineResponsibleOption = { value: string; label: string }

/**
 * The people responsible across the deadlines, once each. A person is their user id (without case) when the deadline
 * stores ids beside the names, else their name (without case). The first option is "Everyone".
 */
export function deadlineResponsibleOptions(items: Deadline[]): DeadlineResponsibleOption[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const paired = item.assigneeUserIds.length === item.assignees.length
    item.assignees.forEach((name, index) => {
      const label = name.trim()
      if (!label) return
      const id = paired ? item.assigneeUserIds[index]?.trim().toLowerCase() : ''
      const value = id ? `id:${id}` : `name:${label.toLowerCase()}`
      if (!seen.has(value)) seen.set(value, label)
    })
  }
  const people = [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  return [{ value: EVERYONE, label: EVERYONE }, ...people]
}

function hasResponsible(item: Deadline, value: string): boolean {
  if (value.startsWith('id:')) {
    const want = value.slice(3)
    return item.assigneeUserIds.some((id) => id.trim().toLowerCase() === want)
  }
  if (value.startsWith('name:')) {
    const want = value.slice(5)
    return item.assignees.some((name) => name.trim().toLowerCase() === want)
  }
  return true
}

export type DeadlineToolbarFilters = { location: string; responsible: string; criticalOnly: boolean }

/**
 * Location (a deadline on several floors matches each of its floors, rulebook `deadlineOnLocation`), Responsible and
 * Critical path only. Narrows the list and the timeline; the tab counts and summary never read it.
 */
export function applyDeadlineToolbarFilters(items: Deadline[], filters: DeadlineToolbarFilters): Deadline[] {
  return items.filter((item) => {
    if (filters.criticalOnly && !item.isCritical) return false
    if (filters.location !== ALL_LOCATIONS && !deadlineOnLocation(item, filters.location)) return false
    if (filters.responsible !== EVERYONE && !hasResponsible(item, filters.responsible)) return false
    return true
  })
}

export type DeadlineSort = 'due' | 'critical' | 'leastProgress' | 'trade' | 'responsible'

export const DEADLINE_SORTS: { id: DeadlineSort; label: string }[] = [
  { id: 'due', label: 'Due date' },
  { id: 'critical', label: 'Critical first' },
  { id: 'leastProgress', label: 'Least progress first' },
  { id: 'trade', label: 'Trade' },
  { id: 'responsible', label: 'Responsible' },
]

/**
 * Orders the rows of a group. "Due date" (the default) keeps the order the grouping already gives; the others are a
 * stable sort, ties by due date. Rows with no trade / nobody responsible go last.
 */
export function sortDeadlines(items: Deadline[], sort: DeadlineSort): Deadline[] {
  if (sort === 'due') return items
  const byDue = (a: Deadline, b: Deadline) => a.due.getTime() - b.due.getTime()
  const text = (value: string | null | undefined) => (value || '').trim().toLowerCase()
  const lastIfBlank = (a: string, b: string) => (a === b ? 0 : !a ? 1 : !b ? -1 : a.localeCompare(b))
  const compare: Record<Exclude<DeadlineSort, 'due'>, (a: Deadline, b: Deadline) => number> = {
    critical: (a, b) => Number(b.isCritical) - Number(a.isCritical),
    leastProgress: (a, b) => a.progress - b.progress,
    trade: (a, b) => lastIfBlank(text(a.trade), text(b.trade)),
    responsible: (a, b) => lastIfBlank(text(a.assignees[0]), text(b.assignees[0])),
  }
  return [...items].sort((a, b) => compare[sort](a, b) || byDue(a, b))
}

/** `sortDeadlines` inside every group (groups keep their order). */
export function sortDeadlineGroups(groups: DeadlineGroup[], sort: DeadlineSort): DeadlineGroup[] {
  if (sort === 'due') return groups
  return groups.map((group) => ({ ...group, items: sortDeadlines(group.items, sort) }))
}

const GROUP_TONES: Record<string, DeadlineGroup['tone']> = {
  overdue: 'red',
  thisWeek: 'amber',
  nextWeek: null,
  later: null,
  completed: 'green',
}

/** Rulebook 1.94.0 §23: the date groups are `deadlineDisplay(...).group`, in `DEADLINE_GROUPS` order. */
function dateGroups(list: Deadline[], now: Date): DeadlineGroup[] {
  return DEADLINE_GROUPS.map((group) => ({
    id: group.key,
    title: group.label,
    tone: GROUP_TONES[group.key] ?? null,
    items: list.filter((item) => deadlineView(item, now).group === group.key).sort((a, b) => a.due.getTime() - b.due.getTime()),
  })).filter((group) => group.items.length > 0)
}

function keyedGroups(list: Deadline[], now: Date, keysOf: (item: Deadline) => string[]): DeadlineGroup[] {
  const map = new Map<string, Deadline[]>()
  for (const item of list) {
    for (const key of keysOf(item)) {
      const rows = map.get(key) || []
      rows.push(item)
      map.set(key, rows)
    }
  }
  return [...map.entries()]
    .map(([title, rows]) => ({
      id: title,
      title,
      tone: null,
      items: [...rows].sort((a, b) => {
        const ra = urgencyRank(urgency(a, now))
        const rb = urgencyRank(urgency(b, now))
        return ra === rb ? a.due.getTime() - b.due.getTime() : ra - rb
      }),
    }))
    .sort((a, b) => {
      const ra = a.items[0] ? urgencyRank(urgency(a.items[0], now)) : 99
      const rb = b.items[0] ? urgencyRank(urgency(b.items[0], now)) : 99
      return ra === rb ? a.title.localeCompare(b.title) : ra - rb
    })
}

export function groupDeadlines(list: Deadline[], grouping: DeadlineGrouping, now: Date): DeadlineGroup[] {
  switch (grouping) {
    case 'date':
      return dateGroups(list, now)
    case 'location':
      // Rulebook 1.93.0 (owner 25 Nov): a deadline on two or more floors is listed once, under "Multiple floors".
      return keyedGroups(list, now, (item) => [deadlineFloorGroup(item) ?? 'Unassigned area'])
    case 'trade':
      return keyedGroups(list, now, (item) => [item.trade || 'No trade'])
    case 'assignee':
      return keyedGroups(list, now, (item) => [item.assignees[0] || 'Unassigned'])
  }
}

/**
 * Owner 25 Nov: the timeline plots every deadline the filter keeps — completed ones too (drawn as complete), so
 * "All" is all. Before, completed deadlines were always dropped from the timeline.
 */
export function timelineItems(list: Deadline[]): Deadline[] {
  return [...list]
    .sort((a, b) => (a.start ?? a.due).getTime() - (b.start ?? b.due).getTime())
}

export function predecessors(items: Deadline[], item: Deadline): Deadline[] {
  const ids = new Set(item.dependsOn)
  return items.filter((row) => ids.has(row.id))
}

export function dependents(items: Deadline[], item: Deadline): Deadline[] {
  return items.filter((row) => row.dependsOn.includes(item.id))
}

export function timelineWindowStart(now: Date): Date {
  return new Date((dayIndex(now) - 7) * DAY_MS + 12 * 60 * 60 * 1000)
}

export function offsetDays(windowStart: Date, date: Date): number {
  return dayIndex(date) - dayIndex(windowStart)
}

function change(author: string, at: Date, kind: DeadlineChange['kind'], id = newUuid()): DeadlineChange {
  return { id, at, author, kind }
}

export function rescheduleDeadline(
  item: Deadline,
  to: Date,
  reason: string,
  author: string,
  now: Date
): Deadline | null {
  const text = reason.trim()
  if (!text || dayKey(item.due) === dayKey(to)) return null
  return {
    ...item,
    originalDue: item.originalDue ?? item.due,
    due: to,
    history: [change(author, now, { type: 'rescheduled', from: item.due, to, reason: text }), ...item.history],
  }
}

export function setDeadlineProgress(item: Deadline, pct: number, author: string, now: Date): Deadline {
  const progress = pct / 100
  const status = pct > 0 && item.status === 'notStarted' ? 'inProgress' : item.status
  return {
    ...item,
    progress,
    status,
    history: [change(author, now, { type: 'progress', progress: pct }), ...item.history],
  }
}

export function completeDeadline(item: Deadline, author: string, now: Date): Deadline {
  return {
    ...item,
    status: 'complete',
    progress: 1,
    completedAt: now,
    history: [change(author, now, { type: 'completed', completedOn: now }), ...item.history],
  }
}

export function replaceDeadline(items: Deadline[], next: Deadline): Deadline[] {
  const index = items.findIndex((item) => item.id === next.id)
  if (index === -1) return [next, ...items]
  return items.map((item) => (item.id === next.id ? next : item))
}

export function applyCreatedHistory(item: Deadline, author: string, now: Date): Deadline {
  const history: DeadlineChange[] = [change(author, now, { type: 'created', due: item.due })]
  if (item.assignees.length > 0) {
    history.unshift(change(author, now, { type: 'assigned', assignedTo: item.assignees.join(', ') }))
  }
  return { ...item, history }
}

export function applyEditHistory(previous: Deadline, next: Deadline, author: string, now: Date): Deadline {
  let history = next.history
  const previousIds = new Set(previous.assigneeUserIds)
  const nextIds = new Set(next.assigneeUserIds)
  const samePeople =
    previousIds.size === nextIds.size && [...previousIds].every((id) => nextIds.has(id))
  if (!samePeople && next.assignees.length > 0) {
    history = [change(author, now, { type: 'assigned', assignedTo: next.assignees.join(', ') }), ...history]
  }
  if (next.siteAuditId && next.siteAuditId !== previous.siteAuditId && next.siteAuditTitle) {
    history = [change(author, now, { type: 'siteAuditAttached', name: next.siteAuditTitle }), ...history]
  }
  return { ...next, history }
}

export function withFileAttached(item: Deadline, fileName: string, fileURL: string, author: string, now: Date): Deadline {
  return {
    ...item,
    fileName,
    fileURL,
    history: [change(author, now, { type: 'fileAttached', name: fileName }), ...item.history],
  }
}

/**
 * Another device saved the list after this screen loaded it: its versions win, except the deadlines this save is for
 * (`ownIds`) — the person's own edit is written, never silently dropped (owner 25 Nov: a deadline saved with a file
 * attached lost the file and the edits when the list changed during the upload).
 */
export function mergeDeadlinesFirstWriterWins(remote: Deadline[], local: Deadline[], ownIds: ReadonlyArray<string> = []): Deadline[] {
  const own = new Set(ownIds)
  const byId = new Map(remote.map((item) => [item.id, item]))
  for (const item of local) {
    if (!byId.has(item.id) || own.has(item.id)) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => a.due.getTime() - b.due.getTime())
}

export function projectNotificationName(siteName: string, jobNumber: string): string {
  const site = siteName.trim()
  const job = jobNumber.trim()
  if (!site) return job
  if (!job) return site
  return `${site} · ${job}`
}

export function emptyDeadlineCopy(filter: DeadlineTabKey, canManage: boolean, contextKind: string): { title: string; message: string } {
  const kind = contextKind.toLowerCase()
  switch (filter) {
    case 'overdue':
      return { title: 'Nothing overdue', message: 'Nothing matches this filter right now. Switch back to All to see the full programme.' }
    case 'behindPace':
      return { title: 'Everything on pace', message: 'Nothing matches this filter right now. Switch back to All to see the full programme.' }
    case 'thisWeek':
      return { title: 'Nothing due this week', message: 'Nothing matches this filter right now. Switch back to All to see the full programme.' }
    case 'completed':
      return { title: 'Nothing completed yet', message: 'Nothing matches this filter right now. Switch back to All to see the full programme.' }
    case 'all':
      return {
        title: 'No deadlines yet',
        message: canManage
          ? `Add the key dates for this ${kind} — first fix, sign-offs, handovers — and they will show here in order of urgency.`
          : `Deadlines assigned to you on this ${kind} will show here.`,
      }
  }
}

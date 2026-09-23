/**
 * iOS parity source: Views/DLModels.swift, Views/DLScreens.swift
 * Urgency, risk and slippage are computed. They are never stored.
 */

import { newUuid } from '@/lib/firebase/firestoreUtils'
import { dayKey } from '@/lib/ios-parity/londonTime'
import type {
  Deadline,
  DeadlineChange,
  DeadlineFilter,
  DeadlineGroup,
  DeadlineGrouping,
  DeadlineStatus,
  DeadlineUrgency,
} from '@/lib/deadlines/types'

const DAY_MS = 86_400_000

function dayIndex(date: Date): number {
  const [y, m, d] = dayKey(date).split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function daysBetween(from: Date, to: Date): number {
  return dayIndex(to) - dayIndex(from)
}

export function daysRemaining(item: Pick<Deadline, 'due'>, now: Date): number {
  return daysBetween(now, item.due)
}

export function urgency(item: Pick<Deadline, 'status' | 'due'>, now: Date): DeadlineUrgency {
  if (item.status === 'complete') return { kind: 'complete' }
  const d = daysRemaining(item, now)
  if (d < 0) return { kind: 'overdue', days: -d }
  if (item.status === 'blocked') return { kind: 'blocked' }
  if (d === 0) return { kind: 'today' }
  if (d === 1) return { kind: 'tomorrow' }
  if (d <= 3) return { kind: 'soon', days: d }
  if (d <= 7) return { kind: 'thisWeek', days: d }
  return { kind: 'later', days: d }
}

export function isOverdue(value: DeadlineUrgency): boolean {
  return value.kind === 'overdue'
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

export function urgencyPhrase(value: DeadlineUrgency): string {
  switch (value.kind) {
    case 'complete':
      return 'Complete'
    case 'blocked':
      return 'Blocked'
    case 'overdue':
      return value.days === 1 ? '1 day overdue' : `${value.days} days overdue`
    case 'today':
      return 'Due today'
    case 'tomorrow':
      return 'Due tomorrow'
    case 'soon':
    case 'thisWeek':
      return `Due in ${value.days} days`
    case 'later':
      return value.days > 60 ? `Due in ${Math.floor(value.days / 7)} weeks` : `Due in ${value.days} days`
  }
}

export function urgencyPill(value: DeadlineUrgency): string {
  switch (value.kind) {
    case 'complete':
      return 'Done'
    case 'blocked':
      return 'Held'
    case 'overdue':
      return `+${value.days}d`
    case 'today':
      return 'Today'
    case 'tomorrow':
      return '1d'
    case 'soon':
    case 'thisWeek':
      return `${value.days}d`
    case 'later':
      return value.days > 60 ? `${Math.floor(value.days / 7)}w` : `${value.days}d`
  }
}

export function urgencyTone(value: DeadlineUrgency): 'red' | 'amber' | 'blue' | 'green' | 'slate' | 'leave' {
  switch (value.kind) {
    case 'complete':
      return 'green'
    case 'blocked':
      return 'leave'
    case 'overdue':
      return 'red'
    case 'today':
    case 'tomorrow':
    case 'soon':
      return 'amber'
    case 'thisWeek':
      return 'blue'
    case 'later':
      return 'slate'
  }
}

export function expectedProgress(item: Pick<Deadline, 'start' | 'due'>, now: Date): number | null {
  if (!item.start || item.due.getTime() <= item.start.getTime()) return null
  const total = item.due.getTime() - item.start.getTime()
  const done = now.getTime() - item.start.getTime()
  return Math.min(Math.max(done / total, 0), 1)
}

export function isAtRisk(item: Deadline, now: Date): boolean {
  if (item.status === 'complete') return false
  if (item.status === 'blocked' && daysRemaining(item, now) <= 7) return true
  const expected = expectedProgress(item, now)
  if (expected == null) return false
  return expected - item.progress > 0.15 && daysRemaining(item, now) >= 0
}

export function pacingGap(item: Deadline, now: Date): number | null {
  const expected = expectedProgress(item, now)
  if (expected == null || expected <= item.progress) return null
  return Math.round((expected - item.progress) * 100)
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
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...options }).format(date)

export function formatDay(date: Date): string {
  return londonDate(date, { day: 'numeric', month: 'short' })
}

export function formatFullDay(date: Date): string {
  return londonDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatWeekdayLetter(date: Date): string {
  return londonDate(date, { weekday: 'narrow' })
}

export function formatDayNumber(date: Date): string {
  return londonDate(date, { day: 'numeric' })
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
      const dir = kind.to.getTime() > kind.from.getTime() ? 'Pushed' : 'Pulled forward'
      return `${dir} ${formatDay(kind.from)} → ${formatDay(kind.to)} · ${kind.reason}`
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

export function scopedDeadlines(items: Deadline[], restrictToAssigneeUserId?: string | null): Deadline[] {
  if (!restrictToAssigneeUserId) return items
  return items.filter((item) => item.assigneeUserIds.includes(restrictToAssigneeUserId))
}

export function deadlineStats(items: Deadline[], now: Date) {
  const overdueCount = items.filter((item) => isOverdue(urgency(item, now))).length
  const thisWeekCount = items.filter((item) => {
    const d = daysRemaining(item, now)
    return item.status !== 'complete' && d >= 0 && d <= 7
  }).length
  const atRiskCount = items.filter((item) => isAtRisk(item, now)).length
  const completeCount = items.filter((item) => item.status === 'complete').length
  const criticalOpen = items.filter((item) => item.isCritical && item.status !== 'complete').length
  const completionRatio = items.length === 0 ? 0 : completeCount / items.length
  return { overdueCount, thisWeekCount, atRiskCount, completeCount, criticalOpen, completionRatio }
}

export function deadlineTrades(items: Deadline[]): string[] {
  return ['All trades', ...Array.from(new Set(items.map((item) => item.trade).filter((trade): trade is string => Boolean(trade)))).sort()]
}

export function loadOnDay(items: Deadline[], day: Date): number {
  const key = dayKey(day)
  return items.filter((item) => item.status !== 'complete' && dayKey(item.due) === key).length
}

export function hasOverdueOnDay(items: Deadline[], day: Date, now: Date): boolean {
  const key = dayKey(day)
  return items.some((item) => isOverdue(urgency(item, now)) && dayKey(item.due) === key)
}

export function railDays(now: Date, count = 21, lead = 3): Date[] {
  const startIndex = dayIndex(now) - lead
  return Array.from({ length: count }, (_, offset) => new Date((startIndex + offset) * DAY_MS + 12 * 60 * 60 * 1000))
}

function matchesFilter(item: Deadline, filter: DeadlineFilter, now: Date): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'overdue':
      return isOverdue(urgency(item, now))
    case 'thisWeek': {
      const d = daysRemaining(item, now)
      return item.status !== 'complete' && d >= 0 && d <= 7
    }
    case 'atRisk':
      return isAtRisk(item, now)
    case 'complete':
      return item.status === 'complete'
  }
}

export function filterDeadlines(params: {
  items: Deadline[]
  filter: DeadlineFilter
  tradeFilter: string
  search: string
  now: Date
}): Deadline[] {
  const query = params.search.trim().toLowerCase()
  return params.items.filter((item) => {
    if (!matchesFilter(item, params.filter, params.now)) return false
    if (params.tradeFilter !== 'All trades' && item.trade !== params.tradeFilter) return false
    if (!query) return true
    const hay = [item.title, item.location || '', item.trade || '', item.company || '', item.assignees.join(' ')]
      .join(' ')
      .toLowerCase()
    return hay.includes(query)
  })
}

function dateGroups(list: Deadline[], now: Date): DeadlineGroup[] {
  const buckets: { id: string; tone: DeadlineGroup['tone']; items: Deadline[] }[] = [
    { id: 'Overdue', tone: 'red', items: [] },
    { id: 'Today', tone: 'amber', items: [] },
    { id: 'Tomorrow', tone: 'amber', items: [] },
    { id: 'This week', tone: 'blue', items: [] },
    { id: 'Next week', tone: 'slate', items: [] },
    { id: 'Later', tone: 'slate', items: [] },
    { id: 'Complete', tone: 'green', items: [] },
  ]
  for (const item of list) {
    const d = daysRemaining(item, now)
    let idx = 5
    if (item.status === 'complete') idx = 6
    else if (d < 0) idx = 0
    else if (d === 0) idx = 1
    else if (d === 1) idx = 2
    else if (d <= 7) idx = 3
    else if (d <= 14) idx = 4
    buckets[idx].items.push(item)
  }
  return buckets
    .filter((bucket) => bucket.items.length > 0)
    .map((bucket) => ({
      id: bucket.id,
      title: bucket.id,
      tone: bucket.tone,
      items: [...bucket.items].sort((a, b) => a.due.getTime() - b.due.getTime()),
    }))
}

function keyedGroups(list: Deadline[], now: Date, keyOf: (item: Deadline) => string): DeadlineGroup[] {
  const map = new Map<string, Deadline[]>()
  for (const item of list) {
    const key = keyOf(item)
    const rows = map.get(key) || []
    rows.push(item)
    map.set(key, rows)
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
      return keyedGroups(list, now, (item) => item.location || 'Unassigned area')
    case 'trade':
      return keyedGroups(list, now, (item) => item.trade || 'No trade')
    case 'assignee':
      return keyedGroups(list, now, (item) => item.assignees[0] || 'Unassigned')
  }
}

export function visibleGroups(groups: DeadlineGroup[], selectedDay: Date | null): DeadlineGroup[] {
  if (!selectedDay) return groups
  const key = dayKey(selectedDay)
  return groups.flatMap((group) => {
    const items = group.items.filter((item) => dayKey(item.due) === key)
    return items.length === 0 ? [] : [{ ...group, items }]
  })
}

export function timelineItems(list: Deadline[]): Deadline[] {
  return list
    .filter((item) => item.status !== 'complete')
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

export function mergeDeadlinesFirstWriterWins(remote: Deadline[], local: Deadline[]): Deadline[] {
  const byId = new Map(remote.map((item) => [item.id, item]))
  for (const item of local) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => a.due.getTime() - b.due.getTime())
}

export function riskBannerMessage(stats: {
  overdueCount: number
  atRiskCount: number
  criticalOpen: number
}): string | null {
  if (stats.overdueCount > 0 && stats.criticalOpen > 0) {
    return `${stats.overdueCount} overdue, ${stats.criticalOpen} on the critical path`
  }
  if (stats.overdueCount > 0) {
    return stats.overdueCount === 1 ? '1 deadline is overdue' : `${stats.overdueCount} deadlines are overdue`
  }
  if (stats.atRiskCount > 0) {
    return stats.atRiskCount === 1 ? '1 deadline is behind pace' : `${stats.atRiskCount} deadlines are behind pace`
  }
  return null
}

export function projectedFinish(item: Deadline, now: Date): Date {
  if (!item.start || item.progress <= 0.02) return item.due
  const elapsed = now.getTime() - item.start.getTime()
  const total = elapsed / item.progress
  return new Date(item.start.getTime() + total)
}

export function projectNotificationName(siteName: string, jobNumber: string): string {
  const site = siteName.trim()
  const job = jobNumber.trim()
  if (!site) return job
  if (!job) return site
  return `${site} · ${job}`
}

export function emptyDeadlineCopy(filter: DeadlineFilter, canManage: boolean, contextKind: string): { title: string; message: string } {
  const kind = contextKind.toLowerCase()
  switch (filter) {
    case 'overdue':
      return { title: 'Nothing overdue', message: 'Nothing matches this filter right now. Switch back to All to see the full programme.' }
    case 'atRisk':
      return { title: 'Everything on pace', message: 'Nothing matches this filter right now. Switch back to All to see the full programme.' }
    case 'thisWeek':
      return { title: 'Nothing due this week', message: 'Nothing matches this filter right now. Switch back to All to see the full programme.' }
    case 'complete':
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

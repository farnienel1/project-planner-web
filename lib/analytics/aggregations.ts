import { dateFromDayKeyInZone, dayKeyInZone, LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import { FEATURE_EVENT_GROUPS, type ProductEvent, type ProductEventName, type ProductSession } from '@/lib/analytics/events'
import type { AnalyticsDateRange } from '@/lib/analytics/dateRange'

export function inRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime()
  return time >= start.getTime() && time < end.getTime()
}

export function countUnique(ids: Array<string | undefined>): number {
  return new Set(ids.filter((id): id is string => Boolean(id))).size
}

export function dailyActiveUsers(events: ProductEvent[], range: { start: Date; end: Date }): number {
  return countUnique(
    events.filter((event) => inRange(event.createdAt, range.start, range.end)).map((event) => event.userId)
  )
}

export function seriesByDay(
  dates: Date[],
  timeZone = LONDON_TIME_ZONE
): string[] {
  const keys = dates.map((date) => dayKeyInZone(date, timeZone))
  return Array.from(new Set(keys)).sort()
}

export function fillDaySeries(
  start: Date,
  end: Date,
  values: Map<string, number>,
  timeZone = LONDON_TIME_ZONE
): { day: string; value: number }[] {
  const out: { day: string; value: number }[] = []
  const cursor = new Date(start.getTime())
  while (cursor.getTime() < end.getTime()) {
    const key = dayKeyInZone(cursor, timeZone)
    out.push({ day: key, value: values.get(key) || 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export function eventDayCounts(
  events: ProductEvent[],
  range: AnalyticsDateRange,
  eventName?: ProductEventName,
  timeZone = LONDON_TIME_ZONE
): { day: string; value: number }[] {
  const map = new Map<string, number>()
  const monthly = chartUsesMonths(range)
  for (const event of events) {
    if (!inRange(event.createdAt, range.start, range.end)) continue
    if (eventName && event.eventName !== eventName) continue
    const key = monthly ? monthKeyInZone(event.createdAt, timeZone) : dayKeyInZone(event.createdAt, timeZone)
    map.set(key, (map.get(key) || 0) + 1)
  }
  return monthly ? fillMonthSeries(range.start, range.end, map, timeZone) : fillDaySeries(range.start, range.end, map, timeZone)
}

function chartUsesMonths(range: AnalyticsDateRange): boolean {
  if (range.preset === 'all_time') return true
  return Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) > 92
}

function monthKeyInZone(date: Date, timeZone: string): string {
  return dayKeyInZone(date, timeZone).slice(0, 7)
}

function startOfMonthInZone(date: Date, timeZone: string): Date {
  const [y, m] = monthKeyInZone(date, timeZone).split('-')
  return dateFromDayKeyInZone(`${y}-${m}-01`, timeZone)
}

function addMonthInZone(date: Date, timeZone: string): Date {
  const [y, m] = monthKeyInZone(date, timeZone).split('-').map(Number)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  return dateFromDayKeyInZone(`${nextY}-${String(nextM).padStart(2, '0')}-01`, timeZone)
}

export function fillMonthSeries(
  start: Date,
  end: Date,
  values: Map<string, number>,
  timeZone = LONDON_TIME_ZONE
): { day: string; value: number }[] {
  const out: { day: string; value: number }[] = []
  let cursor = startOfMonthInZone(start, timeZone)
  while (cursor.getTime() < end.getTime()) {
    const key = monthKeyInZone(cursor, timeZone)
    out.push({ day: key, value: values.get(key) || 0 })
    cursor = addMonthInZone(cursor, timeZone)
  }
  return out
}

export function uniqueUsersByDay(
  events: ProductEvent[],
  range: AnalyticsDateRange,
  timeZone = LONDON_TIME_ZONE
): { day: string; value: number }[] {
  const map = new Map<string, Set<string>>()
  for (const event of events) {
    if (!inRange(event.createdAt, range.start, range.end)) continue
    const key = dayKeyInZone(event.createdAt, timeZone)
    const set = map.get(key) || new Set<string>()
    set.add(event.userId)
    map.set(key, set)
  }
  const counts = new Map<string, number>()
  for (const [day, users] of map) counts.set(day, users.size)
  return fillDaySeries(range.start, range.end, counts, timeZone)
}

export function uniqueUsersChart(
  events: ProductEvent[],
  range: AnalyticsDateRange,
  timeZone = LONDON_TIME_ZONE
): { day: string; value: number }[] {
  if (!chartUsesMonths(range)) return uniqueUsersByDay(events, range, timeZone)
  const map = new Map<string, Set<string>>()
  for (const event of events) {
    if (!inRange(event.createdAt, range.start, range.end)) continue
    const key = monthKeyInZone(event.createdAt, timeZone)
    const set = map.get(key) || new Set<string>()
    set.add(event.userId)
    map.set(key, set)
  }
  const counts = new Map<string, number>()
  for (const [day, users] of map) counts.set(day, users.size)
  return fillMonthSeries(range.start, range.end, counts, timeZone)
}

export function featureUsageRows(
  events: ProductEvent[],
  range: AnalyticsDateRange,
  previousRange: { start: Date; end: Date }
): { id: string; label: string; users: number; uses: number; previousUses: number }[] {
  return FEATURE_EVENT_GROUPS.map((group) => {
    const current = events.filter(
      (event) => group.events.includes(event.eventName) && inRange(event.createdAt, range.start, range.end)
    )
    const previous = events.filter(
      (event) =>
        group.events.includes(event.eventName) && inRange(event.createdAt, previousRange.start, previousRange.end)
    )
    return {
      id: group.id,
      label: group.label,
      users: countUnique(current.map((event) => event.userId)),
      uses: current.length,
      previousUses: previous.length,
    }
  }).filter((row) => row.uses > 0 || row.previousUses > 0)
}

export function averageSessionDuration(sessions: ProductSession[], range: { start: Date; end: Date }): number {
  const inWindow = sessions.filter((session) => inRange(session.startedAt, range.start, range.end))
  if (inWindow.length === 0) return 0
  const total = inWindow.reduce((sum, session) => {
    const duration =
      session.durationMs ??
      Math.max(0, (session.lastActivityAt || session.startedAt).getTime() - session.startedAt.getTime())
    return sum + duration
  }, 0)
  return total / inWindow.length
}

export function signupFunnel(events: ProductEvent[], range: { start: Date; end: Date }) {
  const signedUp = countUnique(
    events
      .filter((event) => event.eventName === 'user_signed_up' && inRange(event.createdAt, range.start, range.end))
      .map((event) => event.userId)
  )
  const createdProject = countUnique(
    events
      .filter(
        (event) =>
          (event.eventName === 'project_created' || event.eventName === 'small_work_created') &&
          inRange(event.createdAt, range.start, range.end)
      )
      .map((event) => event.userId)
  )
  const createdTask = countUnique(
    events
      .filter((event) => event.eventName === 'task_created' && inRange(event.createdAt, range.start, range.end))
      .map((event) => event.userId)
  )
  const returned = countUnique(
    events
      .filter((event) => event.eventName === 'user_logged_in' && inRange(event.createdAt, range.start, range.end))
      .map((event) => event.userId)
  )
  return [
    { id: 'signup', label: 'Signed up', users: signedUp },
    { id: 'project', label: 'Created a project or small work', users: createdProject },
    { id: 'task', label: 'Created a task', users: createdTask },
    { id: 'return', label: 'Signed in again', users: returned },
  ]
}

export function retentionCohorts(
  users: { id: string; createdAt: Date }[],
  events: ProductEvent[],
  now = new Date()
): { label: string; size: number; retained: number; rate: number | null }[] {
  const dayMs = 86_400_000
  return [1, 7, 30].map((days) => {
    const eligible = users.filter((user) => now.getTime() - user.createdAt.getTime() >= days * dayMs)
    if (eligible.length < 5) {
      return { label: `Day ${days}`, size: eligible.length, retained: 0, rate: null }
    }
    const retained = eligible.filter((user) =>
      events.some((event) => {
        if (event.userId !== user.id) return false
        const offset = event.createdAt.getTime() - user.createdAt.getTime()
        return offset >= days * dayMs && offset < (days + 1) * dayMs
      })
    ).length
    return {
      label: `Day ${days}`,
      size: eligible.length,
      retained,
      rate: Math.round((retained / eligible.length) * 1000) / 10,
    }
  })
}

export function relatedFeatureUsage(
  events: ProductEvent[],
  featureId: string,
  range: { start: Date; end: Date }
): { users: number; uses: number } {
  const group = FEATURE_EVENT_GROUPS.find((item) => item.id === featureId)
  if (!group) return { users: 0, uses: 0 }
  const matched = events.filter(
    (event) => group.events.includes(event.eventName) && inRange(event.createdAt, range.start, range.end)
  )
  return { users: countUnique(matched.map((event) => event.userId)), uses: matched.length }
}

export type OrganisationActivityRow = {
  id: string
  name: string
  userCount: number
  activeUsers: number
  events: number
  lastActivityAt?: Date
  ideaCount: number
  createdAt?: Date
}

function laterDate(a?: Date, b?: Date): Date | undefined {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

export function organisationActivityRows(input: {
  organisations: { id: string; name: string; createdAt?: Date }[]
  users: { id: string; organizationId: string; lastSeenAt?: Date }[]
  events: ProductEvent[]
  ideas: { organizationId: string }[]
  range: { start: Date; end: Date }
}): OrganisationActivityRow[] {
  const usersByOrg = new Map<string, typeof input.users>()
  for (const user of input.users) {
    const list = usersByOrg.get(user.organizationId) || []
    list.push(user)
    usersByOrg.set(user.organizationId, list)
  }
  const eventsByOrg = new Map<string, ProductEvent[]>()
  for (const event of input.events) {
    if (!event.organizationId) continue
    const list = eventsByOrg.get(event.organizationId) || []
    list.push(event)
    eventsByOrg.set(event.organizationId, list)
  }
  const ideasByOrg = new Map<string, number>()
  for (const idea of input.ideas) {
    if (!idea.organizationId) continue
    ideasByOrg.set(idea.organizationId, (ideasByOrg.get(idea.organizationId) || 0) + 1)
  }

  const knownIds = new Set(input.organisations.map((org) => org.id))
  const extraIds = [...usersByOrg.keys(), ...eventsByOrg.keys()].filter((id) => id && !knownIds.has(id))
  const rows = [
    ...input.organisations,
    ...extraIds.map((id) => ({ id, name: 'Unknown organisation', createdAt: undefined as Date | undefined })),
  ]

  return rows
    .map((org) => {
      const orgUsers = usersByOrg.get(org.id) || []
      const orgEvents = (eventsByOrg.get(org.id) || []).filter((event) => inRange(event.createdAt, input.range.start, input.range.end))
      const lastEvent = (eventsByOrg.get(org.id) || []).reduce<Date | undefined>((latest, event) => {
        if (!latest || event.createdAt.getTime() > latest.getTime()) return event.createdAt
        return latest
      }, undefined)
      const lastSeen = orgUsers.reduce<Date | undefined>((latest, user) => {
        return laterDate(latest, user.lastSeenAt)
      }, lastEvent)
      const seenInRange = orgUsers.filter((user) => user.lastSeenAt && inRange(user.lastSeenAt, input.range.start, input.range.end))
      return {
        id: org.id,
        name: org.name,
        userCount: orgUsers.length,
        activeUsers: Math.max(countUnique(orgEvents.map((event) => event.userId)), seenInRange.length),
        events: orgEvents.length,
        lastActivityAt: lastSeen,
        ideaCount: ideasByOrg.get(org.id) || 0,
        createdAt: org.createdAt,
      }
    })
    .sort((a, b) => b.userCount - a.userCount || b.activeUsers - a.activeUsers || a.name.localeCompare(b.name))
}

export function directoryActiveUsers(
  users: { id: string; lastSeenAt?: Date }[],
  range: { start: Date; end: Date }
): number {
  return users.filter((user) => (user.lastSeenAt ? inRange(user.lastSeenAt, range.start, range.end) : false)).length
}

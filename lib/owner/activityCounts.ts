/**
 * Owner console activity counts (Overview "Bookings made" and the Platform scoreboard rows Projects created, Small
 * works created, Tasks completed, Bookings made).
 *
 * Before this, those figures counted product events (`productEvents`): `schedule_edited` is written by no app, so
 * "Bookings made" was always 0; the iPhone writes no product events at all, and web writes them only for people who
 * accepted analytics, so projects, small works and completed tasks made on the iPhone (or by anyone who declined)
 * never moved the scoreboard. These counts read the records themselves: a Firestore `count()` of each organisation's
 * own collection, filtered on the record's stored Timestamp (a single-field range, so no composite index), run with
 * the owner's token on the server. A count that cannot be read is null (shown as "—"), never 0.
 *
 * Display only (owner console, web): no business rule is computed here.
 */
import { PLATFORM_OWNER_SENTINEL_ORG } from '@/lib/platform/owner'
import { isTestOrganisation } from '@/lib/owner/testData'
import { CONSOLE_PERIODS, resolveConsolePeriod, type ConsolePeriodId } from '@/lib/analytics/consolePeriod'
import { firestoreCount, firestoreRunQuery, restTimeRange, structuredQuery } from '@/lib/owner/firestoreRest'

export type ActivityMetricId = 'bookings' | 'projects' | 'smallWorks' | 'tasksCompleted'

/** Which organisation sub-collections each figure counts, and the Timestamp field that dates a record. */
export const ACTIVITY_METRICS: { id: ActivityMetricId; label: string; field: string; collections: string[] }[] = [
  // Labour, manager schedule and subcontractor bookings, by when they were created (deleted bookings are gone).
  { id: 'bookings', label: 'Bookings made', field: 'createdAt', collections: ['bookings', 'managerSiteBookings', 'subcontractorBookings'] },
  { id: 'projects', label: 'Projects created', field: 'createdAt', collections: ['projects'] },
  { id: 'smallWorks', label: 'Small works created', field: 'createdAt', collections: ['smallWorks'] },
  { id: 'tasksCompleted', label: 'Tasks completed', field: 'completedAt', collections: ['tasks'] },
]

/** The previous (comparison) range of the selected period is counted under this id. */
export const PREVIOUS_RANGE_ID = 'previous'

export type ActivityRange = { id: string; start: Date; end: Date }

/** The scoreboard columns (every console period) and the selected period's comparison range, at `now`. */
export function activityRanges(selected: ConsolePeriodId, now = new Date()): ActivityRange[] {
  const ranges: ActivityRange[] = CONSOLE_PERIODS.map((item) => {
    const range = resolveConsolePeriod(item.id, now)
    return { id: item.id, start: range.start, end: range.end }
  })
  const chosen = resolveConsolePeriod(selected, now)
  ranges.push({ id: PREVIOUS_RANGE_ID, start: chosen.previousStart, end: chosen.previousEnd })
  return ranges
}

/** `value[metric][rangeId]`: a count, or null when any organisation's count for it could not be read. */
export type ActivityCountValues = Record<ActivityMetricId, Record<string, number | null>>

export type ActivityCounts = {
  values: ActivityCountValues
  organisationsCounted: number
  /** Organisations with at least one count that could not be read (their figures make the totals null). */
  failedOrganisations: string[]
}

/** One `count()`: records of `collectionId` under `organizations/{orgId}` whose `field` is in [start, end]. */
export type CountRecords = (orgId: string, collectionId: string, field: string, start: Date, end: Date) => Promise<number>

async function mapLimit<T>(items: readonly T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next]
      next += 1
      await run(item)
    }
  })
  await Promise.all(workers)
}

/** Sums every organisation's counts per figure and range. A failed count makes that figure's range null, never 0. */
export async function countActivity(input: {
  organizationIds: readonly string[]
  ranges: readonly ActivityRange[]
  count: CountRecords
  concurrency?: number
}): Promise<ActivityCounts> {
  const values = {} as ActivityCountValues
  for (const metric of ACTIVITY_METRICS) {
    values[metric.id] = Object.fromEntries(input.ranges.map((range) => [range.id, 0])) as Record<string, number | null>
  }
  const failed = new Set<string>()
  const jobs: { orgId: string; metric: (typeof ACTIVITY_METRICS)[number]; collectionId: string; range: ActivityRange }[] = []
  for (const orgId of input.organizationIds) {
    for (const metric of ACTIVITY_METRICS) {
      for (const collectionId of metric.collections) {
        for (const range of input.ranges) jobs.push({ orgId, metric, collectionId, range })
      }
    }
  }
  await mapLimit(jobs, input.concurrency ?? 12, async (job) => {
    const row = values[job.metric.id]
    try {
      const n = await input.count(job.orgId, job.collectionId, job.metric.field, job.range.start, job.range.end)
      if (!Number.isFinite(n)) throw new Error('not a number')
      if (row[job.range.id] !== null) row[job.range.id] = (row[job.range.id] as number) + n
    } catch {
      row[job.range.id] = null
      failed.add(job.orgId)
    }
  })
  return { values, organisationsCounted: input.organizationIds.length, failedOrganisations: [...failed].sort() }
}

/** The organisations the console counts: never the platform-owner sentinel; test organisations only when asked. */
export function activityOrganisationIds(
  orgs: readonly { id: string; isInternal?: unknown; isTest?: unknown }[],
  includeTestData: boolean
): string[] {
  return orgs
    .filter((org) => org.id && org.id !== PLATFORM_OWNER_SENTINEL_ORG)
    .filter((org) => includeTestData || !isTestOrganisation(org))
    .map((org) => org.id)
    .sort()
}

/**
 * Review of #366: one read per period and test-data choice is kept for OWNER_ACTIVITY_CACHE_MS in this server process
 * (the `/api/owner/directory` pattern), so reloads and several tabs do not re-run every count. Only the platform owner
 * reaches the route (the guard runs first). `refresh: true` (the Refresh button) reads again. A failed read is never kept.
 */
export const OWNER_ACTIVITY_CACHE_MS = 60_000

type ActivityRead = ActivityCounts & { ranges: ActivityRange[] }
const activityCache = new Map<string, { at: number; value: Promise<ActivityRead> }>()

export function clearOwnerActivityCache(): void {
  activityCache.clear()
}

export async function readOwnerActivityCountsCached(
  token: string,
  options: { period: ConsolePeriodId; includeTestData: boolean; refresh?: boolean; nowMs?: number }
): Promise<ActivityRead & { cachedAt: string; fromCache: boolean }> {
  const now = options.nowMs ?? Date.now()
  const key = `${options.period}|${options.includeTestData ? 1 : 0}`
  const existing = activityCache.get(key)
  if (!options.refresh && existing && now - existing.at < OWNER_ACTIVITY_CACHE_MS) {
    return { ...(await existing.value), cachedAt: new Date(existing.at).toISOString(), fromCache: true }
  }
  const entry = { at: now, value: readOwnerActivityCounts(token, { period: options.period, includeTestData: options.includeTestData, now: new Date(now) }) }
  activityCache.set(key, entry)
  try {
    return { ...(await entry.value), cachedAt: new Date(now).toISOString(), fromCache: false }
  } catch (error) {
    if (activityCache.get(key) === entry) activityCache.delete(key)
    throw error
  }
}

/** Reads the organisations and every count with the owner's ID token (Firestore REST; the rules decide). */
export async function readOwnerActivityCounts(
  token: string,
  options: { period: ConsolePeriodId; includeTestData: boolean; now?: Date }
): Promise<ActivityCounts & { ranges: ActivityRange[] }> {
  const orgDocs = await firestoreRunQuery(
    token,
    structuredQuery('organizations', undefined, { select: { fields: [{ fieldPath: 'isInternal' }, { fieldPath: 'isTest' }] } })
  )
  const orgs = orgDocs.map((doc) => ({
    id: doc.id,
    isInternal: (doc.fields?.isInternal as { booleanValue?: boolean } | undefined)?.booleanValue,
    isTest: (doc.fields?.isTest as { booleanValue?: boolean } | undefined)?.booleanValue,
  }))
  const ranges = activityRanges(options.period, options.now)
  const counts = await countActivity({
    organizationIds: activityOrganisationIds(orgs, options.includeTestData),
    ranges,
    count: (orgId, collectionId, field, start, end) =>
      firestoreCount(token, structuredQuery(collectionId, restTimeRange(field, start, end)), `organizations/${orgId}`),
  })
  return { ...counts, ranges }
}

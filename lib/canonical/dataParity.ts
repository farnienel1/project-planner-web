/**
 * Rulebook 1.38.0 §27 "Data check" (owner decision 11 Nov): each app compares, for the lists that matter, the number of
 * documents the server holds for the query its own listener runs with the number of documents the app holds for that
 * query (before any rulebook filtering). A mismatch means the app's loading layer (listener, offline cache, merge) lost
 * or kept a record the database does not agree with; the app then re-reads that list from the server (self-heal),
 * checks again and records the result on this device only. Read-only: nothing here writes to Firestore.
 *
 * The server count is a Firestore aggregation (`count()`, server source) of exactly the query the listener uses — the
 * viewer's read plan, so the rules never refuse it. Lists a plan reads document by document (an operative's jobs) are
 * not counted (`skipped`). Pure functions only; each app does the I/O.
 */
import { partsInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'

export type DataParityListKey =
  | 'projects'
  | 'smallWorks'
  | 'users'
  | 'operatives'
  | 'managers'
  | 'clients'
  | 'bookings'
  | 'managerSiteBookings'
  | 'holidayBookings'
  | 'tasks'

export interface DataParityCheckDefinition {
  key: DataParityListKey
  /** Firestore collection: `organizations/{orgId}/{collection}`, except `users` (top level, `organizationId ==`). */
  collection: string
  /** `organization`: a subcollection of the organisation; `users`: the top-level users query of the organisation. */
  scope: 'organization' | 'users'
  /** True when the app's listener is bounded by a date window (`bookingLoadStart`); the count uses the same bound. */
  windowed: boolean
  label: string
}

/** The lists every app checks, in display order. */
export const DATA_PARITY_CHECKS: ReadonlyArray<DataParityCheckDefinition> = Object.freeze([
  { key: 'projects', collection: 'projects', scope: 'organization', windowed: false, label: 'Projects' },
  { key: 'smallWorks', collection: 'smallWorks', scope: 'organization', windowed: false, label: 'Small works' },
  { key: 'users', collection: 'users', scope: 'users', windowed: false, label: 'Users' },
  { key: 'operatives', collection: 'operatives', scope: 'organization', windowed: false, label: 'Operatives' },
  { key: 'managers', collection: 'managers', scope: 'organization', windowed: false, label: 'Managers' },
  { key: 'clients', collection: 'clients', scope: 'organization', windowed: false, label: 'Clients' },
  { key: 'bookings', collection: 'bookings', scope: 'organization', windowed: true, label: 'Bookings' },
  {
    key: 'managerSiteBookings',
    collection: 'managerSiteBookings',
    scope: 'organization',
    windowed: true,
    label: 'Manager schedule bookings',
  },
  { key: 'holidayBookings', collection: 'holidayBookings', scope: 'organization', windowed: false, label: 'Annual leave' },
  { key: 'tasks', collection: 'tasks', scope: 'organization', windowed: false, label: 'Tasks' },
] as DataParityCheckDefinition[])

/** No automatic check runs within this long of the last one on this device (the "Check now" button is exempt). */
export const DATA_PARITY_MIN_INTERVAL_MS = 10 * 60 * 1000
/** How many results this device keeps (newest last). */
export const DATA_PARITY_LOG_LIMIT = 20
export const DATA_PARITY_TRIGGERS = Object.freeze(['open', 'foreground', 'timer', 'manual'] as const)
export type DataParityTrigger = (typeof DATA_PARITY_TRIGGERS)[number]

export const DATA_PARITY_SKIP_REASONS = Object.freeze({
  notListening: 'This device is not listening to this list.',
  documentReads: 'This viewer reads the list one document at a time (read plan), so it is not counted.',
  serverCountUnavailable: 'The server count could not be read (offline, refused or timed out).',
  unknownList: 'Not a list the data check knows.',
} as const)
export type DataParitySkipReason = keyof typeof DATA_PARITY_SKIP_REASONS

export function dataParityCheckDefinition(key: unknown): DataParityCheckDefinition | null {
  return DATA_PARITY_CHECKS.find((check) => check.key === key) ?? null
}

/**
 * Whether a check should run now. Never offline. "Check now" (`manual`) always runs when online; every other trigger
 * runs only when no check ran on this device in the last `minIntervalMs` (default `DATA_PARITY_MIN_INTERVAL_MS`).
 */
export function dataParityCheckDue(input: {
  trigger: DataParityTrigger | string
  lastCheckedMs?: number | null
  nowMs: number
  online: boolean
  minIntervalMs?: number | null
}): boolean {
  if (!input.online) return false
  if (input.trigger === 'manual') return true
  if (!(DATA_PARITY_TRIGGERS as readonly string[]).includes(input.trigger)) return false
  const last = typeof input.lastCheckedMs === 'number' && Number.isFinite(input.lastCheckedMs) ? input.lastCheckedMs : null
  if (last === null) return true
  const interval =
    typeof input.minIntervalMs === 'number' && Number.isFinite(input.minIntervalMs) && input.minIntervalMs >= 0
      ? input.minIntervalMs
      : DATA_PARITY_MIN_INTERVAL_MS
  // A clock that moved backwards (last check "in the future") runs the check rather than waiting.
  if (input.nowMs < last) return true
  return input.nowMs - last >= interval
}

export interface DataParityListInput {
  key: string
  /** The server's `count()` for the listener's query; null/undefined when it could not be read. */
  serverCount?: number | null
  /** How many documents the app holds for that query. Ignored when `localIds` is given. */
  localCount?: number | null
  /** The ids the app holds (counted once each, as stored). */
  localIds?: ReadonlyArray<string> | null
  /**
   * Documents the app's reader deliberately leaves out but the server counts (the legacy `INITIAL-PLACEHOLDER` job
   * document, `workDocuments`), as seen in the listener's last snapshot. Added to the local count.
   */
  readerDroppedCount?: number | null
  /** Set by the app when it did not ask (`notListening`, `documentReads`). */
  skipped?: DataParitySkipReason | null
}

export interface DataParityMismatch {
  key: DataParityListKey
  label: string
  serverCount: number
  localCount: number
  /** localCount − serverCount: negative when this device is missing documents, positive when it holds extra. */
  difference: number
  direction: 'missingOnDevice' | 'extraOnDevice'
}

export interface DataParityResult {
  ok: boolean
  action: 'none' | 'reload'
  mismatches: DataParityMismatch[]
  /** Lists to re-read from the server (the mismatches, in `DATA_PARITY_CHECKS` order). */
  reloadKeys: DataParityListKey[]
  /** Lists compared (matched or not). */
  checked: DataParityListKey[]
  skipped: Array<{ key: string; reason: DataParitySkipReason }>
}

function wholeCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

/**
 * Compare server and device counts per list. `ok` is true when every compared list matches (a list that was skipped
 * does not fail the check). `action` is `reload` when any list differs.
 */
export function dataParityCheck(input: { lists?: ReadonlyArray<DataParityListInput> | null }): DataParityResult {
  const byKey = new Map<string, DataParityListInput>()
  const skipped: DataParityResult['skipped'] = []
  for (const list of input.lists ?? []) {
    if (!list || typeof list.key !== 'string') continue
    if (!dataParityCheckDefinition(list.key)) {
      skipped.push({ key: String(list.key), reason: 'unknownList' })
      continue
    }
    byKey.set(list.key, list)
  }
  const mismatches: DataParityMismatch[] = []
  const checked: DataParityListKey[] = []
  for (const definition of DATA_PARITY_CHECKS) {
    const list = byKey.get(definition.key)
    if (!list) continue
    if (list.skipped) {
      skipped.push({ key: definition.key, reason: list.skipped })
      continue
    }
    const serverCount = wholeCount(list.serverCount)
    if (serverCount === null) {
      skipped.push({ key: definition.key, reason: 'serverCountUnavailable' })
      continue
    }
    const held = Array.isArray(list.localIds)
      ? new Set(list.localIds.filter((id) => typeof id === 'string' && id !== '')).size
      : wholeCount(list.localCount)
    if (held === null) {
      skipped.push({ key: definition.key, reason: 'notListening' })
      continue
    }
    const localCount = held + (wholeCount(list.readerDroppedCount) ?? 0)
    checked.push(definition.key)
    if (localCount === serverCount) continue
    mismatches.push({
      key: definition.key,
      label: definition.label,
      serverCount,
      localCount,
      difference: localCount - serverCount,
      direction: localCount < serverCount ? 'missingOnDevice' : 'extraOnDevice',
    })
  }
  return {
    ok: mismatches.length === 0,
    action: mismatches.length === 0 ? 'none' : 'reload',
    mismatches,
    reloadKeys: mismatches.map((mismatch) => mismatch.key),
    checked,
    skipped,
  }
}

export interface DataParityLogMismatch {
  key: DataParityListKey
  label: string
  serverCount: number
  localCount: number
  /** After the re-read: true when the list then matched, false when it still differed, null when not re-checked. */
  healed: boolean | null
  afterServerCount: number | null
  afterLocalCount: number | null
}

export interface DataParityLogEntry {
  atMs: number
  trigger: string
  /** True when every compared list matched first time, or matched after its re-read. */
  ok: boolean
  checked: DataParityListKey[]
  skipped: Array<{ key: string; reason: DataParitySkipReason }>
  mismatches: DataParityLogMismatch[]
}

/**
 * One device-local record of a check: the first comparison and, when it found mismatches, the comparison after the
 * app re-read those lists (`recheck`).
 */
export function dataParityLogEntry(input: {
  atMs: number
  trigger: string
  first: DataParityResult
  recheck?: DataParityResult | null
}): DataParityLogEntry {
  const recheck = input.recheck ?? null
  const mismatches: DataParityLogMismatch[] = input.first.mismatches.map((mismatch) => {
    if (!recheck) {
      return { ...mismatch, healed: null, afterServerCount: null, afterLocalCount: null }
    }
    const after = recheck.mismatches.find((row) => row.key === mismatch.key)
    if (after) {
      return { ...pickMismatch(mismatch), healed: false, afterServerCount: after.serverCount, afterLocalCount: after.localCount }
    }
    const healed = recheck.checked.includes(mismatch.key)
    return { ...pickMismatch(mismatch), healed: healed ? true : null, afterServerCount: null, afterLocalCount: null }
  })
  return {
    atMs: input.atMs,
    trigger: String(input.trigger),
    ok: mismatches.every((row) => row.healed === true),
    checked: [...input.first.checked],
    skipped: [...input.first.skipped],
    mismatches,
  }
}

function pickMismatch(mismatch: DataParityMismatch) {
  return { key: mismatch.key, label: mismatch.label, serverCount: mismatch.serverCount, localCount: mismatch.localCount }
}

/** The device log with `entry` added, newest last, at most `limit` entries. */
export function dataParityLogAppend(
  log: ReadonlyArray<DataParityLogEntry> | null | undefined,
  entry: DataParityLogEntry,
  limit: number = DATA_PARITY_LOG_LIMIT
): DataParityLogEntry[] {
  const kept = Array.isArray(log) ? log.filter((row) => row && typeof row.atMs === 'number') : []
  const next = [...kept, entry]
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DATA_PARITY_LOG_LIMIT
  return next.slice(Math.max(0, next.length - cap))
}

export interface DataParitySummary {
  tone: 'none' | 'ok' | 'warning'
  title: string
  lines: string[]
}

function clock(atMs: number, timeZone?: string | null): string {
  const parts = partsInZone(new Date(atMs), zoneOrLondon(timeZone))
  return `${String(parts.h).padStart(2, '0')}:${String(parts.min).padStart(2, '0')}`
}

/**
 * Text for Settings → Data health (admins): "Data check: all lists match (checked 14:05)" or the lists that differed,
 * each with what the re-read did. Times in the organisation zone.
 */
export function dataParitySummary(input: {
  entry?: DataParityLogEntry | null
  timeZone?: string | null
}): DataParitySummary {
  const entry = input.entry
  if (!entry || typeof entry.atMs !== 'number') {
    return { tone: 'none', title: 'Data check has not run on this device yet.', lines: [] }
  }
  const at = clock(entry.atMs, input.timeZone)
  if (entry.mismatches.length === 0) {
    return { tone: 'ok', title: `Data check: all lists match (checked ${at})`, lines: [] }
  }
  const lines = entry.mismatches.map((row) => {
    const base = `${row.label}: server ${row.serverCount}, this device ${row.localCount}`
    if (row.healed === true) return `${base} — reloaded, now matches`
    if (row.healed === false) {
      return `${base} — reloaded, still differs (server ${row.afterServerCount ?? '?'}, this device ${row.afterLocalCount ?? '?'})`
    }
    return `${base} — not re-checked`
  })
  if (entry.ok) {
    const n = entry.mismatches.length
    return {
      tone: 'ok',
      title: `Data check: ${n} ${n === 1 ? 'list was' : 'lists were'} reloaded and now match (checked ${at})`,
      lines,
    }
  }
  const open = entry.mismatches.filter((row) => row.healed !== true).length
  return {
    tone: 'warning',
    title: `Data check: ${open} ${open === 1 ? 'list does' : 'lists do'} not match the server (checked ${at})`,
    lines,
  }
}

/** The server count of a plan made of several disjoint queries (`bookingQueryPlan`): their sum; null when any part is unknown. */
export function dataParitySumCounts(counts: ReadonlyArray<number | null | undefined>): number | null {
  let total = 0
  for (const value of counts) {
    const whole = wholeCount(value)
    if (whole === null) return null
    total += whole
  }
  return total
}

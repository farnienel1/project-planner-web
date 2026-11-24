/**
 * Client error reports (rulebook §32, 1.84.0; owner decision D7, 16 Nov): a small, sampled `clientErrors`
 * collection written by web and iOS — at most 20 reports per person per day — read only by the platform owner
 * (owner console → Errors). No third-party tool.
 *
 * A report never holds free text: error messages are built from names and other personal data at their throw
 * sites ("Order is locked by Jane Smith"), and no pattern can strip that reliably. `clientErrors/{id}` (root)
 * holds exactly `CLIENT_ERROR_FIELDS`:
 * - `platform` `web` | `ios`; `source` one of `CLIENT_ERROR_SOURCES`;
 * - `kind`: the error class and code only (`clientErrorKind`: "FirebaseError permission-denied", "TypeError",
 *   "NSCocoaErrorDomain 4");
 * - `where`: the top app stack frame, file and function only (`clientErrorWhere`), never arguments or line text;
 * - `route`: the route pattern (`clientErrorRoute`: every segment that is not a plain lower-case word is `:id`);
 * - `build`: the app version / build;
 * - `messageKey`: the key of the message when it is exactly one of `CLIENT_ERROR_KNOWN_MESSAGES` (fixed constants),
 *   else `other` (`clientErrorMessageKey`);
 * - `messageHash`: the lower-case hex SHA-256 of the raw message (computed by the app), so identical errors group
 *   together without their text;
 * - `organizationId` ('' when none is open), `dayIndex` (UTC day), `createdAt` (server time), `expireAt` (+30 days).
 *
 * Pseudonymous, not anonymous: the document id is `<sha256(uid + '|' + dayIndex), hex>_<slot>` (`clientErrorDocId`)
 * — the security rules recompute the hash from the signed-in account and allow a create only, so one person writes at
 * most 20 a day; the owner could recompute it for a known uid and day, so a report can be linked to a person by
 * someone who already knows who to look for. The day salt stops linking one person's reports across days.
 */
import { BOOKING_REPLAY_REFUSED_MESSAGE, OFFLINE_DELETE_CHANGED_MESSAGE } from './bookingTombstones'
import { EDIT_OF_MISSING_DOCUMENT_MESSAGE } from './liveSources'
import { OFFLINE_ONLINE_ONLY_MESSAGE } from './offlinePolicy'
import { PAY_HISTORY_NOT_LOADED_MESSAGE } from './payRate'
import { PAYROLL_POLICY_STALE_SAVE_MESSAGE } from './payrollPolicySchedule'
import { TIMESHEET_SNAPSHOT_FAILED_MESSAGE } from './timesheetSnapshot'
import { VARIATION_RENUMBER_STALE_MESSAGE } from './variations'

export const CLIENT_ERRORS_COLLECTION = 'clientErrors'
export const CLIENT_ERROR_PLATFORMS = ['web', 'ios'] as const
export type ClientErrorPlatform = (typeof CLIENT_ERROR_PLATFORMS)[number]
/** window = window.onerror; promise = an unhandled promise rejection; boundary = a React error boundary;
 * caught = an error the app caught and logged; uncaught = an uncaught exception (iOS, sent on the next launch). */
export const CLIENT_ERROR_SOURCES = ['window', 'promise', 'boundary', 'caught', 'uncaught'] as const
export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number]
export const CLIENT_ERRORS_PER_DAY = 20
export const CLIENT_ERROR_TTL_DAYS = 30
export const CLIENT_ERROR_KIND_MAX = 80
export const CLIENT_ERROR_WHERE_MAX = 120
export const CLIENT_ERROR_ROUTE_MAX = 120
export const CLIENT_ERROR_BUILD_MAX = 40
export const CLIENT_ERROR_ORGANIZATION_ID_MAX = 128
export const CLIENT_ERROR_DAY_MS = 86_400_000
export const CLIENT_ERROR_OTHER_MESSAGE_KEY = 'other'
export const CLIENT_ERROR_FIELDS = [
  'platform',
  'source',
  'kind',
  'where',
  'route',
  'build',
  'messageKey',
  'messageHash',
  'organizationId',
  'dayIndex',
  'createdAt',
  'expireAt',
] as const

/**
 * The only message texts ever named in a report: fixed constants that contain no personal data. A message is stored
 * as its key only when it is exactly one of these (after trimming); anything else is `other`.
 */
export const CLIENT_ERROR_KNOWN_MESSAGES: Readonly<Record<string, string>> = {
  'edit-of-missing-document': EDIT_OF_MISSING_DOCUMENT_MESSAGE,
  'offline-online-only': OFFLINE_ONLINE_ONLY_MESSAGE,
  'booking-replay-refused': BOOKING_REPLAY_REFUSED_MESSAGE,
  'offline-delete-changed': OFFLINE_DELETE_CHANGED_MESSAGE,
  'pay-history-not-loaded': PAY_HISTORY_NOT_LOADED_MESSAGE,
  'payroll-policy-stale-save': PAYROLL_POLICY_STALE_SAVE_MESSAGE,
  'timesheet-snapshot-failed': TIMESHEET_SNAPSHOT_FAILED_MESSAGE,
  'variation-renumber-stale': VARIATION_RENUMBER_STALE_MESSAGE,
  'firestore-permission-denied': 'Missing or insufficient permissions.',
  'firestore-client-offline': 'Failed to get document because the client is offline.',
  'firestore-unavailable': 'The service is currently unavailable. This is a most likely a transient condition and may be corrected by retrying with a backoff.',
  'fetch-failed': 'Failed to fetch',
  'fetch-load-failed': 'Load failed',
  'network-error': 'NetworkError when attempting to fetch resource.',
  'network-request-failed': 'Firebase: Error (auth/network-request-failed).',
  'resize-observer-loop': 'ResizeObserver loop completed with undelivered notifications.',
  'resize-observer-limit': 'ResizeObserver loop limit exceeded',
  'script-error': 'Script error.',
  'aborted': 'The user aborted a request.',
  'quota-exceeded': 'QuotaExceededError',
}

/** `messageKey`: the key of an exactly known constant message, else `other`. */
export function clientErrorMessageKey(message: unknown): string {
  if (typeof message !== 'string') return CLIENT_ERROR_OTHER_MESSAGE_KEY
  const text = message.trim()
  for (const [key, known] of Object.entries(CLIENT_ERROR_KNOWN_MESSAGES)) if (known === text) return key
  return CLIENT_ERROR_OTHER_MESSAGE_KEY
}

/** Any run of 16 or more letters and digits (with or without digits) becomes `*`: ids, tokens, keys, hashes. */
export function redactClientErrorTokens(text: string): string {
  return text.replace(/[A-Za-z0-9]{16,}/g, '*')
}

function cap(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max)
}

/**
 * `kind`: the error class (an identifier, else `Error`) and, when it is code-shaped, its code — "FirebaseError
 * permission-denied", "TypeError", "NSCocoaErrorDomain 4". Never message text.
 */
export function clientErrorKind(name: unknown, code?: unknown): string {
  // A class name: letters (dots and _ allowed) of any length, or a short identifier with digits; a long run with
  // digits (an id passed as a name) is never a class.
  const t = typeof name === 'string' ? name.trim() : ''
  const n = /^[A-Za-z][A-Za-z_.]{0,59}$/.test(t) || /^[A-Za-z][A-Za-z0-9_.]{0,14}$/.test(t) ? t : 'Error'
  const raw = typeof code === 'number' && Number.isInteger(code) ? String(code) : typeof code === 'string' ? code.trim() : ''
  const c = /^-?[A-Za-z0-9/_.-]{1,40}$/.test(raw) ? redactClientErrorTokens(raw) : ''
  return cap(c ? `${n} ${c}` : n, CLIENT_ERROR_KIND_MAX)
}

function frameName(file: string, fn: string): string {
  const base = file.replace(/[?#].*$/, '').split('/').pop() || ''
  const f = base.replace(/[^A-Za-z0-9_.-]/g, '')
  const g = fn.replace(/[^A-Za-z0-9_.$<>]/g, '')
  return cap(redactClientErrorTokens([f, g].filter(Boolean).join(' ')), CLIENT_ERROR_WHERE_MAX)
}

/**
 * `where`: the top app frame as "file function" — from a JS stack (Chrome "at fn (url:line:col)", Safari / Firefox
 * "fn@url:line:col"; library and framework frames are skipped), or from a native file and function (iOS
 * `#fileID` / `#function`, parameters dropped). Line and column numbers, arguments and query strings are never kept.
 * '' when nothing usable.
 */
export function clientErrorWhere(input: { stack?: unknown; file?: unknown; function?: unknown }): string {
  if (typeof input.file === 'string' || typeof input.function === 'string') {
    const fn = typeof input.function === 'string' ? input.function.replace(/\(.*$/, '') : ''
    return frameName(typeof input.file === 'string' ? input.file : '', fn)
  }
  if (typeof input.stack !== 'string') return ''
  const skip = /node_modules|\/framework[-.]|\/main-app[-.]|\/webpack[-.]|\/polyfills[-.]|react-dom|next\/dist|<anonymous>|native code/
  for (const line of input.stack.split('\n').slice(0, 30)) {
    const chrome = line.match(/^\s*at\s+(?:(?:async\s+)?([^\s(]+)\s+\()?([^()\s]+?):\d+(?::\d+)?\)?\s*$/)
    const gecko = line.match(/^\s*([^@\s]*)@(.+?):\d+(?::\d+)?\s*$/)
    const m = chrome ? { fn: chrome[1] || '', file: chrome[2] } : gecko ? { fn: gecko[1] || '', file: gecko[2] } : null
    if (!m || skip.test(m.file)) continue
    const where = frameName(m.file, m.fn.split('.').pop() || '')
    if (where) return where
  }
  return ''
}

/**
 * `route`: the path pattern only. A scheme and host (also a host with no scheme, "example.com/…"), query and
 * fragment are removed; percent escapes decoded; each segment that is not a plain lower-case word (letters,
 * digits after a letter, `-`, `_`) is `:id` — ids, emails (`@`, `%40`, `＠`), `(default)`, names. `/` when empty.
 */
export function clientErrorRoute(value: unknown): string {
  if (typeof value !== 'string') return '/'
  let path = value.normalize('NFKC').trim()
  path = path.replace(/[?#].*$/s, '')
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
  if (!path.startsWith('/')) path = path.includes('/') && /^[^/]*\./.test(path) ? path.replace(/^[^/]*/, '') : '/' + path
  const parts = path.split('/').map((segment) => {
    if (!segment) return segment
    let s = segment
    try {
      s = decodeURIComponent(segment).normalize('NFKC')
    } catch {
      return ':id'
    }
    return /^[a-z][a-z0-9_-]{0,39}$/.test(s) && !/[0-9]{3,}/.test(s) && s.length < 16 ? s : ':id'
  })
  const out = parts.join('/').replace(/\/{2,}/g, '/') || '/'
  return cap(out, CLIENT_ERROR_ROUTE_MAX)
}

/** `build`: the app version / build; letters, digits, space, `.`, `(`, `)`, `+`, `-` only. */
export function clientErrorBuild(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  return cap(redactClientErrorTokens(raw.replace(/[^A-Za-z0-9 .()+_-]/g, '')), CLIENT_ERROR_BUILD_MAX)
}

/** The UTC day number a report belongs to: `floor(ms / 86,400,000)`. */
export function clientErrorDayIndex(nowMs: number): number {
  return Math.floor(nowMs / CLIENT_ERROR_DAY_MS)
}

/** The text the apps hash (SHA-256, lower-case hex) for the document id: `uid|dayIndex`. */
export function clientErrorHashInput(uid: string, dayIndex: number): string {
  return `${uid}|${dayIndex}`
}

/** `clientErrors/{id}`: the hash of `clientErrorHashInput`, `_`, the slot (0–19). Null when either is unusable. */
export function clientErrorDocId(hashHex: string, slot: number): string | null {
  if (typeof hashHex !== 'string' || !/^[0-9a-f]{64}$/.test(hashHex)) return null
  if (!Number.isInteger(slot) || slot < 0 || slot >= CLIENT_ERRORS_PER_DAY) return null
  return `${hashHex}_${slot}`
}

/** One session's de-duplication key: platform, source, kind, where, route, build and the message hash. */
export function clientErrorSignature(input: {
  platform: string
  source: string
  kind: string
  where: string
  route: string
  build: string
  messageHash: string
}): string {
  return [input.platform, input.source, input.kind, input.where, input.route, input.build, input.messageHash].join('\u0001')
}

export type ClientErrorThrottleState = {
  /** The UTC day the counter belongs to. */
  dayIndex: number
  /** Slots used that day (the next report takes this slot). */
  used: number
  /** Signatures already sent in this session. */
  sent: string[]
}

/**
 * Whether to send a report: never the same signature twice in a session, at most `CLIENT_ERRORS_PER_DAY` a day.
 * A new day starts the counter again. Returns the slot to write and the state to keep (unchanged when not sent).
 */
export function clientErrorThrottle(
  state: ClientErrorThrottleState | null | undefined,
  input: { dayIndex: number; signature: string }
): { send: boolean; slot: number | null; state: ClientErrorThrottleState } {
  const sameDay = state && state.dayIndex === input.dayIndex
  const current: ClientErrorThrottleState = {
    dayIndex: input.dayIndex,
    used: sameDay ? Math.max(0, Math.floor(Number(state!.used) || 0)) : 0,
    sent: Array.isArray(state?.sent) ? state!.sent.slice(-200) : [],
  }
  if (current.sent.includes(input.signature)) return { send: false, slot: null, state: current }
  if (current.used >= CLIENT_ERRORS_PER_DAY) return { send: false, slot: null, state: current }
  return {
    send: true,
    slot: current.used,
    state: { dayIndex: input.dayIndex, used: current.used + 1, sent: [...current.sent, input.signature] },
  }
}

/**
 * The next slot to try when a create at `slot` was refused because that slot is already used (a counter lost on the
 * device). Null when no slot is left.
 */
export function clientErrorNextSlot(slot: number): number | null {
  return Number.isInteger(slot) && slot + 1 < CLIENT_ERRORS_PER_DAY ? slot + 1 : null
}

export type ClientErrorCreateInput = {
  platform: ClientErrorPlatform
  source: ClientErrorSource
  /** The error's class / domain (JS `error.name`, NSError domain, NSException name). */
  name?: unknown
  /** The error's code (Firebase `code`, NSError code). */
  code?: unknown
  /** The raw message: used only to pick `messageKey`; never stored. */
  message?: unknown
  /** Lower-case hex SHA-256 of the raw message (computed by the app). */
  messageHash: unknown
  /** JS stack, or a native file and function. */
  stack?: unknown
  file?: unknown
  function?: unknown
  route: unknown
  build: unknown
  organizationId?: unknown
  nowMs: number
}

export type ClientErrorFields = {
  platform: ClientErrorPlatform
  source: ClientErrorSource
  kind: string
  where: string
  route: string
  build: string
  messageKey: string
  messageHash: string
  organizationId: string
  dayIndex: number
  expireAtMs: number
}

/**
 * The document a device creates (the app sets `createdAt` to its SDK server timestamp and `expireAt` from
 * `expireAtMs`). Null when the platform or source is unknown or the message hash is not a SHA-256 hex.
 */
export function clientErrorCreateFields(input: ClientErrorCreateInput): ClientErrorFields | null {
  if (!(CLIENT_ERROR_PLATFORMS as readonly string[]).includes(input.platform)) return null
  if (!(CLIENT_ERROR_SOURCES as readonly string[]).includes(input.source)) return null
  if (typeof input.messageHash !== 'string' || !/^[0-9a-f]{64}$/.test(input.messageHash)) return null
  const org = typeof input.organizationId === 'string' ? input.organizationId.trim() : ''
  return {
    platform: input.platform,
    source: input.source,
    kind: clientErrorKind(input.name, input.code),
    where: clientErrorWhere({ stack: input.stack, file: input.file, function: input.function }),
    route: clientErrorRoute(input.route),
    build: clientErrorBuild(input.build),
    messageKey: clientErrorMessageKey(input.message),
    messageHash: input.messageHash,
    organizationId: org.length <= CLIENT_ERROR_ORGANIZATION_ID_MAX && /^[A-Za-z0-9_-]+$/.test(org) ? org : '',
    dayIndex: clientErrorDayIndex(input.nowMs),
    expireAtMs: input.nowMs + CLIENT_ERROR_TTL_DAYS * CLIENT_ERROR_DAY_MS,
  }
}

export type ClientErrorRecord = {
  id: string
  platform: string
  source: string
  kind: string
  where: string
  route: string
  build: string
  messageKey: string
  messageHash: string
  organizationId: string
  createdAtMs: number | null
}

function instantMs(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: unknown; _seconds?: unknown; nanoseconds?: unknown }
    if (typeof v.toMillis === 'function') return v.toMillis()
    const seconds = typeof v.seconds === 'number' ? v.seconds : typeof v._seconds === 'number' ? v._seconds : null
    if (seconds != null) return seconds * 1000 + Math.floor((typeof v.nanoseconds === 'number' ? v.nanoseconds : 0) / 1e6)
  }
  return null
}

/** Reads `clientErrors/{id}` (owner console). Never throws; text fields default to ''. */
export function parseClientErrorDocument(id: string, data: Record<string, unknown> | null | undefined): ClientErrorRecord {
  const d = data || {}
  const text = (key: string) => (typeof d[key] === 'string' ? (d[key] as string) : '')
  return {
    id,
    platform: text('platform'),
    source: text('source'),
    kind: text('kind'),
    where: text('where'),
    route: text('route'),
    build: text('build'),
    messageKey: text('messageKey') || CLIENT_ERROR_OTHER_MESSAGE_KEY,
    messageHash: text('messageHash'),
    organizationId: text('organizationId'),
    createdAtMs: instantMs(d.createdAt),
  }
}

export type ClientErrorGroup = {
  key: string
  platform: string
  kind: string
  where: string
  /** A known message's key, or `other`. */
  messageKey: string
  /** The message text for a known key (`CLIENT_ERROR_KNOWN_MESSAGES`), else ''. */
  messageText: string
  /** The first 12 characters of the message hash, for `other`. */
  messageHashShort: string
  routes: string[]
  builds: string[]
  count: number
  firstMs: number | null
  lastMs: number | null
  organizationIds: string[]
  sources: string[]
}

/**
 * The owner console's list: reports grouped by platform, kind, where and the message (its known key, else its hash),
 * with a count, the routes, builds, first and last time and the organisations; newest first. Optional filters:
 * platform and organisation ('' = reports with none).
 */
export function clientErrorGroups(
  records: readonly ClientErrorRecord[],
  filter: { platform?: string | null; organizationId?: string | null } = {}
): ClientErrorGroup[] {
  const groups = new Map<string, ClientErrorGroup>()
  const add = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value)
  }
  for (const r of records) {
    if (filter.platform && r.platform !== filter.platform) continue
    if (filter.organizationId != null && r.organizationId !== filter.organizationId) continue
    const message = r.messageKey && r.messageKey !== CLIENT_ERROR_OTHER_MESSAGE_KEY ? r.messageKey : `#${r.messageHash}`
    const key = [r.platform, r.kind, r.where, message].join('\u0001')
    let g = groups.get(key)
    if (!g) {
      const known = r.messageKey !== CLIENT_ERROR_OTHER_MESSAGE_KEY
      g = {
        key,
        platform: r.platform,
        kind: r.kind,
        where: r.where,
        messageKey: known ? r.messageKey : CLIENT_ERROR_OTHER_MESSAGE_KEY,
        messageText: known ? CLIENT_ERROR_KNOWN_MESSAGES[r.messageKey] || '' : '',
        messageHashShort: r.messageHash.slice(0, 12),
        routes: [],
        builds: [],
        count: 0,
        firstMs: null,
        lastMs: null,
        organizationIds: [],
        sources: [],
      }
      groups.set(key, g)
    }
    g.count += 1
    if (r.createdAtMs != null) {
      g.firstMs = g.firstMs == null ? r.createdAtMs : Math.min(g.firstMs, r.createdAtMs)
      g.lastMs = g.lastMs == null ? r.createdAtMs : Math.max(g.lastMs, r.createdAtMs)
    }
    add(g.routes, r.route)
    add(g.builds, r.build)
    add(g.organizationIds, r.organizationId)
    add(g.sources, r.source)
  }
  return [...groups.values()].sort((a, b) => (b.lastMs ?? -1) - (a.lastMs ?? -1) || b.count - a.count || a.key.localeCompare(b.key))
}

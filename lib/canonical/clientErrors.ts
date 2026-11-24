/**
 * Client error reports (rulebook §32, 1.84.0; owner decision D7, 16 Nov): a small, sampled `clientErrors`
 * collection written by web and iOS — at most 20 reports per person per day, each a message, a route and a build,
 * with no personal data — read only by the platform owner (owner console → Errors). No third-party tool.
 *
 * `clientErrors/{id}` (root collection) holds exactly `CLIENT_ERROR_FIELDS`:
 * - `platform` `web` | `ios`; `source` one of `CLIENT_ERROR_SOURCES`;
 * - `message` (1–300 characters) and `route` (0–120) after `sanitizeClientErrorText` / `sanitizeClientErrorRoute`:
 *   no email address, no URL query string or fragment, no id-like token (UUIDs, long hex, long digit runs,
 *   Firebase-style ids), whitespace collapsed, capped;
 * - `build` (0–40): the app version / build number;
 * - `organizationId`: the open organisation, or '' (an error before one is open — the person must still be signed in);
 * - `dayIndex`: the UTC day number (`floor(ms / 86,400,000)`), the throttle's day;
 * - `createdAt` (server time) and `expireAt` (30 days later, `CLIENT_ERROR_TTL_DAYS`; Firestore TTL deletes it).
 *
 * No user id is stored. The document id is `<sha256(uid + '|' + dayIndex), hex>_<slot>` with a slot 0–19
 * (`clientErrorDocId`, `clientErrorHashInput`): the security rules recompute the hash from the signed-in account and
 * only accept a create (never an update), so one person can write at most 20 reports per UTC day whatever their
 * device does, and the day salt stops a report being linked to the same person on another day. The apps hash
 * (web SubtleCrypto, iOS CryptoKit); the packed script has no hash function.
 *
 * The device throttles first (`clientErrorThrottle`): the same error is sent once per session (`clientErrorSignature`),
 * and the slot counter for the day is kept on the device; when it runs out nothing is sent.
 */

export const CLIENT_ERRORS_COLLECTION = 'clientErrors'
export const CLIENT_ERROR_PLATFORMS = ['web', 'ios'] as const
export type ClientErrorPlatform = (typeof CLIENT_ERROR_PLATFORMS)[number]
/** window = window.onerror; promise = an unhandled promise rejection; boundary = a React error boundary;
 * caught = an error the app caught and logged; uncaught = an uncaught exception / crash signal (iOS). */
export const CLIENT_ERROR_SOURCES = ['window', 'promise', 'boundary', 'caught', 'uncaught'] as const
export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number]
export const CLIENT_ERRORS_PER_DAY = 20
export const CLIENT_ERROR_TTL_DAYS = 30
export const CLIENT_ERROR_MESSAGE_MAX = 300
export const CLIENT_ERROR_ROUTE_MAX = 120
export const CLIENT_ERROR_BUILD_MAX = 40
export const CLIENT_ERROR_ORGANIZATION_ID_MAX = 128
export const CLIENT_ERROR_DAY_MS = 86_400_000
export const CLIENT_ERROR_FIELDS = [
  'platform',
  'source',
  'message',
  'route',
  'build',
  'organizationId',
  'dayIndex',
  'createdAt',
  'expireAt',
] as const

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const URL_WITH_PARTS = /\b(?:https?|wss?|ftp|file|gs):\/\/[^\s'"<>()]+/gi
const UUID = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g
const LONG_HEX = /\b[0-9a-fA-F]{16,}\b/g
const LONG_DIGITS = /\b\d{6,}\b/g
/** Firebase uids / auto ids, tokens, keys: 16+ characters of letters, digits, - or _ with at least one digit and one
 * letter. Plain long words ("permission-denied", "organizationId") have no digit and stay. */
const ID_TOKEN = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{16,}\b/g
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g

function cap(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : chars.slice(0, Math.max(0, max - 1)).join('') + '…'
}

function stripUrl(url: string): string {
  const cut = url.search(/[?#]/)
  const bare = cut >= 0 ? url.slice(0, cut) : url
  return bare.replace(/\/[^/]*$/, (last) => (/\d/.test(last) && last.length > 12 ? '/:id' : last))
}

/**
 * The text of an error, safe to store: emails → `<email>`, URLs without their query string or fragment (and a
 * trailing id-like path part as `:id`), UUIDs / long hex / 6+ digit runs / id-like tokens / JWTs → `<id>`,
 * whitespace collapsed, at most `max` characters. Never throws; a non-string gives ''.
 */
export function sanitizeClientErrorText(value: unknown, max: number = CLIENT_ERROR_MESSAGE_MAX): string {
  if (typeof value !== 'string') return ''
  let text = value
    .replace(JWT, '<id>')
    .replace(EMAIL, '<email>')
    .replace(URL_WITH_PARTS, (url) => stripUrl(url))
    .replace(UUID, '<id>')
    .replace(LONG_HEX, '<id>')
    .replace(ID_TOKEN, '<id>')
    .replace(LONG_DIGITS, '<id>')
  // Any '@' left could still be part of an address the patterns missed (no TLD): never store one.
  text = text.replace(/@/g, ' at ')
  text = text.replace(/\s+/g, ' ').trim()
  return cap(text, max)
}

/**
 * A route safe to store: the path only (no scheme, host, query or fragment), each id-like segment (a UUID, a run of
 * digits, a long hex or mixed id, an email) as `:id`, at most `CLIENT_ERROR_ROUTE_MAX` characters. `/` when empty.
 */
export function sanitizeClientErrorRoute(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '/'
  let path = value.trim()
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
  const cut = path.search(/[?#]/)
  if (cut >= 0) path = path.slice(0, cut)
  if (!path.startsWith('/')) path = '/' + path
  const parts = path.split('/').map((segment) => {
    if (!segment) return segment
    if (segment.includes('@')) return ':id'
    if (/^[0-9a-fA-F-]{8,}$/.test(segment) && /\d/.test(segment)) return ':id'
    if (/^\d+$/.test(segment)) return ':id'
    if (/^[A-Za-z0-9_-]{16,}$/.test(segment) && /\d/.test(segment)) return ':id'
    return segment.replace(/[^A-Za-z0-9_.\-[\]:]/g, '')
  })
  const out = parts.join('/').replace(/\/{2,}/g, '/') || '/'
  return cap(out, CLIENT_ERROR_ROUTE_MAX)
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

/** One session's de-duplication key for an error: platform, source, sanitised message and route, build. */
export function clientErrorSignature(input: {
  platform: string
  source: string
  message: string
  route: string
  build: string
}): string {
  return [input.platform, input.source, input.message, input.route, input.build].join('\u0001')
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

export type ClientErrorCreateInput = {
  platform: ClientErrorPlatform
  source: ClientErrorSource
  message: unknown
  route: unknown
  build: unknown
  organizationId?: unknown
  nowMs: number
}

/**
 * The document a device creates (the app sets `createdAt` to its SDK server timestamp). Null when the platform or
 * source is unknown or the message is empty after sanitising (nothing worth storing).
 */
export function clientErrorCreateFields(input: ClientErrorCreateInput): {
  platform: ClientErrorPlatform
  source: ClientErrorSource
  message: string
  route: string
  build: string
  organizationId: string
  dayIndex: number
  expireAtMs: number
} | null {
  if (!(CLIENT_ERROR_PLATFORMS as readonly string[]).includes(input.platform)) return null
  if (!(CLIENT_ERROR_SOURCES as readonly string[]).includes(input.source)) return null
  const message = sanitizeClientErrorText(input.message, CLIENT_ERROR_MESSAGE_MAX)
  if (!message) return null
  const build = sanitizeClientErrorText(typeof input.build === 'string' ? input.build : '', CLIENT_ERROR_BUILD_MAX)
  const org = typeof input.organizationId === 'string' ? input.organizationId.trim() : ''
  const organizationId =
    org && org.length <= CLIENT_ERROR_ORGANIZATION_ID_MAX && /^[A-Za-z0-9_-]+$/.test(org) ? org : ''
  return {
    platform: input.platform,
    source: input.source,
    message,
    route: sanitizeClientErrorRoute(input.route),
    build,
    organizationId,
    dayIndex: clientErrorDayIndex(input.nowMs),
    expireAtMs: input.nowMs + CLIENT_ERROR_TTL_DAYS * CLIENT_ERROR_DAY_MS,
  }
}

export type ClientErrorRecord = {
  id: string
  platform: string
  source: string
  message: string
  route: string
  build: string
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
    message: text('message'),
    route: text('route'),
    build: text('build'),
    organizationId: text('organizationId'),
    createdAtMs: instantMs(d.createdAt),
  }
}

export type ClientErrorGroup = {
  key: string
  platform: string
  message: string
  route: string
  build: string
  count: number
  firstMs: number | null
  lastMs: number | null
  organizationIds: string[]
  sources: string[]
}

/**
 * The owner console's list: reports grouped by platform, message, route and build, with a count, the first and last
 * time and the organisations; newest first. Optional filters: platform and organisation ('' = reports with none).
 */
export function clientErrorGroups(
  records: readonly ClientErrorRecord[],
  filter: { platform?: string | null; organizationId?: string | null } = {}
): ClientErrorGroup[] {
  const groups = new Map<string, ClientErrorGroup>()
  for (const r of records) {
    if (filter.platform && r.platform !== filter.platform) continue
    if (filter.organizationId != null && filter.organizationId !== '__all__' && r.organizationId !== filter.organizationId) continue
    const key = [r.platform, r.message, r.route, r.build].join('\u0001')
    let g = groups.get(key)
    if (!g) {
      g = { key, platform: r.platform, message: r.message, route: r.route, build: r.build, count: 0, firstMs: null, lastMs: null, organizationIds: [], sources: [] }
      groups.set(key, g)
    }
    g.count += 1
    if (r.createdAtMs != null) {
      g.firstMs = g.firstMs == null ? r.createdAtMs : Math.min(g.firstMs, r.createdAtMs)
      g.lastMs = g.lastMs == null ? r.createdAtMs : Math.max(g.lastMs, r.createdAtMs)
    }
    if (!g.organizationIds.includes(r.organizationId)) g.organizationIds.push(r.organizationId)
    if (!g.sources.includes(r.source)) g.sources.push(r.source)
  }
  return [...groups.values()].sort((a, b) => (b.lastMs ?? -1) - (a.lastMs ?? -1) || b.count - a.count || a.key.localeCompare(b.key))
}

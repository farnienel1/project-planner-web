/**
 * Rulebook 1.86.0 §2 (owner decision 24 Nov): the "Not synced" summary on iOS and Android.
 *
 * When the phone comes back online and a queued action is refused — an offline Replace or delete refused as changed or
 * for permission, or a queued edit refused because the booking is gone or permission is denied — the person is told on
 * that phone (a local notification, never an inbox row: it is about that device's queue) and the page "Not synced"
 * lists one row per refused action: what they tried, what changed while they were offline (read from the live
 * booking), when, and a button that opens that day. Rows clear on "Got it". With notifications off the app shows
 * `OFFLINE_SYNC_RESULT_BANNER` at the top on the next open. Every word is here; the apps only render the rows.
 *
 * Also `offlineReplaceOrganizationReadDecision`: a queued Replace for another company waits for that company's settings
 * (its time zone) only on a network or timeout failure; a refused read (access lost) or a company that is gone
 * resolves the item as `refusePermission` straight away, so it never waits for ever.
 */

import { partsInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'

export const OFFLINE_SYNC_RESULT_TITLE = 'Not synced'
export const OFFLINE_SYNC_RESULT_OPEN_DAY_LABEL = 'Open day'
export const OFFLINE_SYNC_RESULT_DISMISS_LABEL = 'Got it'
export const OFFLINE_SYNC_RESULT_EMPTY = 'Everything on this phone has synced.'
export const OFFLINE_SYNC_RESULT_BANNER = 'Some changes from this phone were not synced. Tap to see what happened.'
export const OFFLINE_SYNC_RESULT_NOTIFICATION_TITLE = 'Some changes were not synced'
export const OFFLINE_SYNC_RESULT_DETAIL_DELETED = 'deleted on another device'
export const OFFLINE_SYNC_RESULT_DETAIL_PERMISSION = 'you no longer have permission'
export const OFFLINE_SYNC_RESULT_DETAIL_CHANGED = 'changed on another device'

export const OFFLINE_SYNC_RESULT_KINDS = ['replace', 'delete', 'edit'] as const
export type OfflineSyncResultKind = (typeof OFFLINE_SYNC_RESULT_KINDS)[number]
export const OFFLINE_SYNC_RESULT_REASONS = ['changed', 'permission', 'missing'] as const
export type OfflineSyncResultReason = (typeof OFFLINE_SYNC_RESULT_REASONS)[number]

/** A booking as the summary shows it. `place` is the app's label for the job or place ("J-1042 · Station Road", "Office"). */
export type OfflineSyncBooking = {
  dayKey?: string | null
  place?: string | null
  startTime?: string | null
  endTime?: string | null
  timeSlot?: string | null
}

export type OfflineSyncResult = {
  id: string
  kind: OfflineSyncResultKind | string
  reason: OfflineSyncResultReason | string
  /** The booking the person tried to save, delete or change (for a Replace: the new booking). */
  attempted?: OfflineSyncBooking | null
  /** For a Replace: the bookings it was to remove, as the person saw them. */
  replaced?: ReadonlyArray<OfflineSyncBooking> | null
  /** The booking that changed, as the server has it now; `null` when it is gone; missing when not read. */
  live?: OfflineSyncBooking | null
  /** For a change: the booking as the person last saw it (to compare with `live`). Defaults to `attempted` (delete / edit) or the first replaced booking (Replace). */
  before?: OfflineSyncBooking | null
  /** When the refusal happened (epoch ms). */
  atMs?: number | null
}

export type OfflineSyncResultRow = {
  id: string
  title: string
  detail: string
  whenText: string
  /** The day "Open day" opens (organisation-zone key), or null. */
  dayKey: string | null
  openDayLabel: string
  dismissLabel: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function dayText(dayKey: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(dayKey))
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]
  return `${weekday} ${d} ${MONTHS[mo - 1]}`
}

function clock(value: unknown): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(text(value))
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

/** "07:00–16:00", else the slot in words ("Full day", "AM", "PM", "Custom hours"), else ''. */
export function offlineSyncTimesText(booking: OfflineSyncBooking | null | undefined): string {
  const start = clock(booking?.startTime)
  const end = clock(booking?.endTime)
  if (start && end) return `${start}–${end}`
  const slot = text(booking?.timeSlot).toUpperCase().replace(/[_\s]+/g, ' ')
  if (slot === 'FULL DAY') return 'Full day'
  if (slot === 'AM' || slot === 'PM') return slot
  if (slot === 'CUSTOM' || slot === 'CUSTOM HOURS') return 'Custom hours'
  return slot ? slot.charAt(0) + slot.slice(1).toLowerCase() : ''
}

/** "Mon 24 Nov · J-1042 · Station Road · 07:00–16:00" (parts left out when missing). */
export function offlineSyncBookingText(booking: OfflineSyncBooking | null | undefined): string {
  const parts = [dayText(booking?.dayKey), text(booking?.place), offlineSyncTimesText(booking)].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'a booking'
}

function whenText(atMs: unknown, timeZone: string | null | undefined): string {
  if (typeof atMs !== 'number' || !Number.isFinite(atMs)) return ''
  const p = partsInZone(new Date(atMs), zoneOrLondon(timeZone))
  return `${p.d} ${MONTHS[p.m - 1]}, ${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`
}

/** What changed: "now 08:00–17:00", "now Tue 25 Nov", "now at Office" (joined with ", "), else the plain words. */
function changedText(before: OfflineSyncBooking | null | undefined, live: OfflineSyncBooking): string {
  const out: string[] = []
  const liveDay = dayText(live.dayKey)
  if (liveDay && liveDay !== dayText(before?.dayKey)) out.push(`now ${liveDay}`)
  const livePlace = text(live.place)
  if (livePlace && livePlace !== text(before?.place)) out.push(`now at ${livePlace}`)
  const liveTimes = offlineSyncTimesText(live)
  if (liveTimes && liveTimes !== offlineSyncTimesText(before)) out.push(`now ${liveTimes}`)
  return out.length ? out.join(', ') : OFFLINE_SYNC_RESULT_DETAIL_CHANGED
}

/**
 * One row per refused queued action, newest first (`atMs`), for the "Not synced" page. Title: "You tried to replace
 * <old> with <new>" / "You tried to delete <booking>" / "You tried to change <booking>". Detail: permission →
 * `OFFLINE_SYNC_RESULT_DETAIL_PERMISSION`; missing, or a change whose live booking is gone (`live: null`) →
 * `OFFLINE_SYNC_RESULT_DETAIL_DELETED`; changed with a live copy → what changed ("now 08:00–17:00"); changed with no read
 * → `OFFLINE_SYNC_RESULT_DETAIL_CHANGED`. `dayKey`: the live booking's day when it moved, else the attempted booking's.
 */
export function offlineSyncResultRows(
  results: ReadonlyArray<OfflineSyncResult | null | undefined> | null | undefined,
  timeZone?: string | null
): OfflineSyncResultRow[] {
  const rows: Array<OfflineSyncResultRow & { at: number }> = []
  for (const result of results || []) {
    const id = text(result?.id)
    if (!result || !id) continue
    const replaced = (result.replaced || []).filter(Boolean)
    const attempted = result.attempted || null
    const kind = text(result.kind)
    const title =
      kind === 'replace'
        ? `You tried to replace ${replaced.length ? replaced.map(offlineSyncBookingText).join(' and ') : 'a booking'} with ${offlineSyncBookingText(attempted)}`
        : kind === 'delete'
          ? `You tried to delete ${offlineSyncBookingText(attempted)}`
          : `You tried to change ${offlineSyncBookingText(attempted)}`
    const reason = text(result.reason)
    let detail: string
    if (reason === 'permission') detail = OFFLINE_SYNC_RESULT_DETAIL_PERMISSION
    else if (reason === 'missing' || result.live === null) detail = OFFLINE_SYNC_RESULT_DETAIL_DELETED
    else if (result.live) detail = changedText(result.before ?? (kind === 'replace' ? replaced[0] : attempted), result.live)
    else detail = OFFLINE_SYNC_RESULT_DETAIL_CHANGED
    const day = text(result.live?.dayKey) || text(attempted?.dayKey) || text(replaced[0]?.dayKey)
    rows.push({
      id,
      title,
      detail: detail.charAt(0).toUpperCase() + detail.slice(1),
      whenText: whenText(result.atMs, timeZone),
      dayKey: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
      openDayLabel: OFFLINE_SYNC_RESULT_OPEN_DAY_LABEL,
      dismissLabel: OFFLINE_SYNC_RESULT_DISMISS_LABEL,
      at: typeof result.atMs === 'number' && Number.isFinite(result.atMs) ? result.atMs : 0,
    })
  }
  return rows.sort((a, b) => b.at - a.at).map(({ at: _at, ...row }) => row)
}

/** The local notification's text for `count` refused actions. */
export function offlineSyncResultNotificationText(count: number): { title: string; body: string } {
  const n = Math.max(1, Math.floor(Number(count) || 1))
  return {
    title: OFFLINE_SYNC_RESULT_NOTIFICATION_TITLE,
    body: `${n === 1 ? '1 change' : `${n} changes`} from this phone ${n === 1 ? 'was' : 'were'} not saved. Tap to see what happened.`,
  }
}

/**
 * A queued Replace for another company reads that company's document (its time zone) before it replays. Wait (retry
 * later) only on a network or timeout failure; a refused read (permission-denied: access lost), not-found, or a read
 * that found no document (the company is gone) → `refusePermission` at once.
 */
export function offlineReplaceOrganizationReadDecision(input: { code?: unknown; exists?: boolean | null } | null | undefined): 'wait' | 'refusePermission' {
  if (input?.exists === false) return 'refusePermission'
  const code = typeof input?.code === 'number' ? String(input.code) : text(input?.code).toLowerCase().replace(/^firestore\//, '')
  if (code === 'permission-denied' || code === '7' || code === 'not-found' || code === '5') return 'refusePermission'
  return 'wait'
}

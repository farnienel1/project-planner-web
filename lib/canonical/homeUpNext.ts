/**
 * Rulebook 1.53.0 §23: Home "Up next" — the signed-in person's own bookings from today on, on both apps.
 *
 * - Labour bookings are the viewer's when their stored person id is one of `bookingIdsForAccount` (the users id,
 *   former and same-email ids, and `operatives` rows on their email). Manager site bookings when their `userId` is
 *   one of `personIdSet` (the users id, former and same-email ids, roster rows on their email).
 * - Days are organisation-zone day keys. Today's bookings stay for the whole of today (a booking that started at 07:30
 *   is still "up next" at 10:00); earlier days never show.
 * - A booking shows while its status occupies the day (`bookingOccupiesDay`): Completed stays, Cancelled never.
 * - A booking's time is `slotInterval` under the working hours in effect on its own day (`bookingStandardDayOn`),
 *   so a named slot on a weekend reads that day's own window.
 *
 * The app adds titles (job, place, booker) and draws the rows; it never filters or sorts them itself.
 */

import { bookingIdsForAccount } from './bookingPerson'
import { slotInterval, type StandardDayInput } from './engine'
import { holidayDocumentDayKey } from './holidayDocument'
import { bookingStandardDayOn, type PayrollTimePolicyState } from './payrollPolicySchedule'
import { idKey, idText, personIdSet, type PersonRosterRow } from './personIds'
import { bookingOccupiesDay } from './warningRows'

export type HomeUpNextBooking = {
  id: string
  /** Labour: the stored `operativeId`. Manager site booking: the stored `userId`. */
  personId?: unknown
  /** The organisation-zone day key when the app has it, else `date` (any stored shape). */
  dayKey?: string | null
  date?: unknown
  /** Missing reads as Confirmed (manager site bookings store none). */
  status?: unknown
  timeSlot?: unknown
  workStartTime?: unknown
  workEndTime?: unknown
}

export type HomeUpNextInput = {
  nowMs: number
  timeZone: string
  viewer: { id?: string | null; email?: string | null; formerUserIds?: ReadonlyArray<string> | null; sameEmailUserIds?: ReadonlyArray<string> | null }
  /** The organisation's users documents (every one, so same-email ids are found). */
  roster?: ReadonlyArray<PersonRosterRow> | null
  /** `operatives` rows (id and email). */
  operatives?: ReadonlyArray<{ id: string; email?: string | null }> | null
  bookings?: ReadonlyArray<HomeUpNextBooking> | null
  managerSiteBookings?: ReadonlyArray<HomeUpNextBooking> | null
  /** The organisation's working-hours state (or one policy). */
  policy?: StandardDayInput | PayrollTimePolicyState | null
  /** Most rows returned (default 48). */
  limit?: number | null
  /** How many distinct days `days` holds (default 2). */
  minDistinctDays?: number | null
}

export type HomeUpNextRow = {
  id: string
  kind: 'labour' | 'manager'
  dayKey: string
  /** Minutes after the day's midnight the booking starts. */
  startMinutes: number
  /** "07:30". */
  startText: string
  /** "07:30–16:00", or '' when the booking has no clock range. */
  timeRange: string
}

export type HomeUpNextResult = {
  rows: HomeUpNextRow[]
  days: { dayKey: string; rows: HomeUpNextRow[] }[]
}

function clock(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function dayOf(row: HomeUpNextBooking, timeZone: string): string {
  const given = idText(row.dayKey)
  if (/^\d{4}-\d{2}-\d{2}$/.test(given)) return given
  return holidayDocumentDayKey(row.date, timeZone)
}

export function homeUpNextRows(input: HomeUpNextInput): HomeUpNextResult {
  const timeZone = input.timeZone
  const today = holidayDocumentDayKey(input.nowMs, timeZone)
  const roster = (input.roster || []).filter((row) => row && idText(row.id))
  const viewerId = idText(input.viewer?.id)
  const viewer = {
    id: viewerId || undefined,
    email: input.viewer?.email ?? null,
    formerUserIds: [...(input.viewer?.formerUserIds || [])],
    sameEmailUserIds: [...(input.viewer?.sameEmailUserIds || [])],
  }
  const managerIds = new Set(personIdSet(viewer as never, roster).map(idKey).filter(Boolean))
  const labourIds = new Set(
    bookingIdsForAccount(
      {
        id: viewerId,
        email: input.viewer?.email ?? null,
        formerIds: viewer.formerUserIds,
        aliasIds: [...personIdSet(viewer as never, roster)].filter((id) => idKey(id) !== idKey(viewerId)),
      },
      (input.operatives || []).filter((row) => row && idText(row.id))
    )
      .map(idKey)
      .filter(Boolean)
  )

  const rows: HomeUpNextRow[] = []
  const add = (booking: HomeUpNextBooking, kind: 'labour' | 'manager', ids: Set<string>) => {
    if (!booking || !idText(booking.id)) return
    if (!ids.has(idKey(booking.personId))) return
    if (!bookingOccupiesDay(booking.status ?? 'Confirmed')) return
    const dayKey = dayOf(booking, timeZone)
    if (!dayKey || !today || dayKey < today) return
    const day = bookingStandardDayOn(input.policy as never, dayKey)
    const interval = slotInterval(
      { timeSlot: booking.timeSlot as never, workStartTime: booking.workStartTime as never, workEndTime: booking.workEndTime as never },
      day
    )
    const start = interval?.start ?? slotInterval({ timeSlot: 'FULL DAY' }, day)?.start ?? 0
    rows.push({
      id: idText(booking.id),
      kind,
      dayKey,
      startMinutes: start,
      startText: clock(start),
      timeRange: interval ? `${clock(interval.start)}–${clock(interval.end)}` : '',
    })
  }
  for (const booking of input.bookings || []) add(booking, 'labour', labourIds)
  for (const booking of input.managerSiteBookings || []) add(booking, 'manager', managerIds)

  rows.sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : a.startMinutes - b.startMinutes || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
  const limited = rows.slice(0, Math.max(0, Number(input.limit ?? 48) || 0))
  const byDay = new Map<string, HomeUpNextRow[]>()
  for (const row of limited) {
    const list = byDay.get(row.dayKey) ?? []
    list.push(row)
    byDay.set(row.dayKey, list)
  }
  const days = [...byDay.keys()]
    .sort()
    .slice(0, Math.max(1, Number(input.minDistinctDays ?? 2) || 2))
    .map((dayKey) => ({ dayKey, rows: byDay.get(dayKey) ?? [] }))
  return { rows: limited, days }
}

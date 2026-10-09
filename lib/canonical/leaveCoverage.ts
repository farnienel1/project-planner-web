/**
 * Annual leave against bookings.
 *
 * Two warnings come from this file, both for approved leave only:
 *
 *   leave_clash  A booking occupies time inside the leave window.
 *                Full-day leave clashes with any booking on that day.
 *                AM leave clashes with anything that touches the AM window; PM likewise.
 *
 *   leave_cover  Half-day leave where the other half of the standard day is not fully booked.
 *                PM leave means the AM window should be booked. AM leave means the PM window should be.
 *                The row lists the clock ranges still open and their hours. No bookings at all on
 *                that day is the whole half missing. The unbooked-labour rule skips days with any
 *                approved leave, so this is the only warning for that person-day.
 *
 * Windows come from `halfDayWindows` in engine.ts. An AM booking and PM leave never clash:
 * the two halves are disjoint by construction, so "AM booking + PM leave" is silent, and any
 * booking whose hours sit entirely in the working half is silent too.
 *
 * Plain data in, plain data out. Web wrappers and the iOS engine map their own types.
 */

import {
  formatClockMinutes,
  halfDayWindows,
  intervalsOverlap,
  mergeMinuteIntervals,
  namedSlotKind,
  slotInterval,
  subtractMinuteIntervals,
  type MinuteInterval,
  type StandardDayInput,
} from './engine'
import { eachDayKey, formatLongDayKey, isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'

export type LeaveSlot = 'FULL_DAY' | 'AM' | 'PM'

export type LeavePerson = {
  /** Stable key for this person across both apps: the user id when there is one, else the operative id. */
  personKey: string
  name: string
  userId?: string | null
  /** Every operative profile that belongs to this person (linked by email). */
  operativeIds?: readonly string[] | null
}

export type LeaveRecord = {
  id: string
  userId?: string | null
  operativeId?: string | null
  startDayKey: string
  endDayKey: string
  timeSlot: string | null | undefined
  approved: boolean
}

export type LeaveBooking = {
  id: string
  /** operative id for operative bookings, user id for manager bookings. */
  personId: string
  kind: 'operative' | 'manager'
  dayKey: string
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  /** Job number and site, or Office / WFH. Shown in the message. */
  label?: string | null
}

export type LeaveCoverageInput = {
  timeZone?: string | null
  startDayKey: string
  endDayKey: string
  day: StandardDayInput | null | undefined
  includeWeekends: boolean
  /** Users who are never reported as unbooked. Applies to leave_cover, never to leave_clash. */
  excludedUserIds?: readonly string[] | null
  people: readonly LeavePerson[]
  leave: readonly LeaveRecord[]
  bookings: readonly LeaveBooking[]
}

export type LeaveClashEntry = {
  bookingId: string
  kind: 'operative' | 'manager'
  label: string
  start: number
  end: number
  overlapStart: number
  overlapEnd: number
}

export type LeaveCoverageRow = {
  id: string
  kind: 'leave_clash' | 'leave_cover'
  personKey: string
  personName: string
  userId?: string
  operativeId?: string
  dayKey: string
  leaveId: string
  leaveSlot: LeaveSlot
  leaveLabel: 'Full day' | 'AM' | 'PM'
  leaveWindow: MinuteInterval
  /** leave_clash: every booking that overlaps the leave window. */
  clashes: LeaveClashEntry[]
  /** leave_cover: the half of the day that should be booked. */
  workingWindow: MinuteInterval | null
  /** leave_cover: the clock ranges inside workingWindow with no booking. */
  missing: MinuteInterval[]
  missingHours: number
  bookedHours: number
  severity: 'high' | 'medium'
  title: 'Booked during annual leave' | 'Half-day leave not covered'
  message: string
}

export function leaveSlotKind(timeSlot: string | null | undefined): LeaveSlot {
  const kind = namedSlotKind(timeSlot)
  if (kind === 'AM') return 'AM'
  if (kind === 'PM') return 'PM'
  return 'FULL_DAY'
}

function leaveLabelFor(slot: LeaveSlot): LeaveCoverageRow['leaveLabel'] {
  return slot === 'AM' ? 'AM' : slot === 'PM' ? 'PM' : 'Full day'
}

function rangeLabel(interval: MinuteInterval): string {
  return `${formatClockMinutes(interval.start)}–${formatClockMinutes(interval.end)}`
}

function hoursOf(intervals: readonly MinuteInterval[]): number {
  const minutes = intervals.reduce((sum, interval) => sum + Math.max(0, interval.end - interval.start), 0)
  return Math.round((minutes / 60) * 100) / 100
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 4) / 4
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '')
  return `${text} hour${rounded === 1 ? '' : 's'}`
}

function joinRanges(intervals: readonly MinuteInterval[]): string {
  const labels = intervals.map(rangeLabel)
  if (labels.length <= 1) return labels[0] || ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export function leaveCoverageRows(input: LeaveCoverageInput): LeaveCoverageRow[] {
  const timeZone = zoneOrLondon(input.timeZone)
  const windows = halfDayWindows(input.day)
  const excluded = new Set((input.excludedUserIds || []).map((id) => String(id)))
  const approvedLeave = input.leave.filter((record) => record.approved && record.startDayKey && record.endDayKey)
  if (approvedLeave.length === 0) return []

  const peopleByUserId = new Map<string, LeavePerson>()
  const peopleByOperativeId = new Map<string, LeavePerson>()
  for (const person of input.people) {
    const userId = String(person.userId || '').trim()
    if (userId && !peopleByUserId.has(userId)) peopleByUserId.set(userId, person)
    for (const operativeId of person.operativeIds || []) {
      const key = String(operativeId || '').trim()
      if (key && !peopleByOperativeId.has(key)) peopleByOperativeId.set(key, person)
    }
  }

  const personForLeave = (record: LeaveRecord): LeavePerson | undefined => {
    const userId = String(record.userId || '').trim()
    if (userId && peopleByUserId.has(userId)) return peopleByUserId.get(userId)
    const operativeId = String(record.operativeId || '').trim()
    if (operativeId && peopleByOperativeId.has(operativeId)) return peopleByOperativeId.get(operativeId)
    return undefined
  }

  const bookingsByPersonDay = new Map<string, LeaveBooking[]>()
  for (const booking of input.bookings) {
    const personId = String(booking.personId || '').trim()
    if (!personId || !booking.dayKey) continue
    const person =
      booking.kind === 'manager' ? peopleByUserId.get(personId) : peopleByOperativeId.get(personId)
    if (!person) continue
    const key = `${person.personKey}|${booking.dayKey}`
    const list = bookingsByPersonDay.get(key) || []
    list.push(booking)
    bookingsByPersonDay.set(key, list)
  }

  const rows: LeaveCoverageRow[] = []
  const seen = new Set<string>()

  for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
    const iso = isoWeekdayOfDayKey(dayKey, timeZone)
    const weekend = iso === 6 || iso === 7
    for (const record of approvedLeave) {
      if (dayKey < record.startDayKey || dayKey > record.endDayKey) continue
      const person = personForLeave(record)
      if (!person) continue
      const dedupe = `${person.personKey}|${dayKey}|${record.id}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)

      const leaveSlot = leaveSlotKind(record.timeSlot)
      const leaveWindow =
        leaveSlot === 'AM' ? windows.am : leaveSlot === 'PM' ? windows.pm : windows.day
      const dayBookings = bookingsByPersonDay.get(`${person.personKey}|${dayKey}`) || []
      const intervals = dayBookings
        .map((booking) => ({ booking, interval: slotInterval(booking, input.day) }))
        .filter((entry): entry is { booking: LeaveBooking; interval: MinuteInterval } => entry.interval !== null)

      const personName = String(person.name || '').trim() || person.personKey
      const userId = String(person.userId || '').trim() || undefined
      const operativeId = String(record.operativeId || person.operativeIds?.[0] || '').trim() || undefined
      const longDay = formatLongDayKey(dayKey, timeZone)
      const leaveLabel = leaveLabelFor(leaveSlot)

      const clashes: LeaveClashEntry[] = intervals
        .filter(({ interval }) => intervalsOverlap(interval, leaveWindow))
        .map(({ booking, interval }) => ({
          bookingId: booking.id,
          kind: booking.kind,
          label: String(booking.label || '').trim() || (booking.kind === 'manager' ? 'Manager booking' : 'Booking'),
          start: interval.start,
          end: interval.end,
          overlapStart: Math.max(interval.start, leaveWindow.start),
          overlapEnd: Math.min(interval.end, leaveWindow.end),
        }))
        .sort((a, b) => a.start - b.start)

      if (clashes.length > 0) {
        const bookedText = clashes
          .map((clash) => `${clash.label} ${formatClockMinutes(clash.start)}–${formatClockMinutes(clash.end)}`)
          .join(', ')
        const leaveText =
          leaveSlot === 'FULL_DAY' ? 'full-day annual leave' : `${leaveLabel} annual leave (${rangeLabel(leaveWindow)})`
        rows.push({
          id: `leave-clash-${dayKey}-${person.personKey}-${record.id}`,
          kind: 'leave_clash',
          personKey: person.personKey,
          personName,
          userId,
          operativeId,
          dayKey,
          leaveId: record.id,
          leaveSlot,
          leaveLabel,
          leaveWindow: { ...leaveWindow },
          clashes,
          workingWindow: null,
          missing: [],
          missingHours: 0,
          bookedHours: hoursOf(mergeMinuteIntervals(intervals.map((entry) => entry.interval))),
          severity: 'high',
          title: 'Booked during annual leave',
          message: `${personName} is booked ${bookedText} on ${longDay} while on ${leaveText}.`,
        })
      }

      if (leaveSlot === 'FULL_DAY') continue
      if (weekend && !input.includeWeekends) continue
      if (userId && excluded.has(userId)) continue

      const workingWindow = leaveSlot === 'PM' ? windows.am : windows.pm
      const workingLabel = leaveSlot === 'PM' ? 'AM' : 'PM'
      const covered = intervals.map((entry) => entry.interval)
      const missing = subtractMinuteIntervals(workingWindow, covered)
      if (missing.length === 0) continue
      const missingHours = hoursOf(missing)
      const bookedInWorking = subtractMinuteIntervals(workingWindow, missing)
      const bookedHours = hoursOf(bookedInWorking)
      const message =
        bookedHours > 0
          ? `${personName} has ${leaveLabel} annual leave on ${longDay}. The ${workingLabel} (${rangeLabel(workingWindow)}) is only booked ${joinRanges(bookedInWorking)}; ${joinRanges(missing)} (${formatHours(missingHours)}) is not booked.`
          : `${personName} has ${leaveLabel} annual leave on ${longDay} but is not booked for the ${workingLabel} (${rangeLabel(workingWindow)}, ${formatHours(missingHours)}).`
      rows.push({
        id: `leave-cover-${dayKey}-${person.personKey}-${record.id}`,
        kind: 'leave_cover',
        personKey: person.personKey,
        personName,
        userId,
        operativeId,
        dayKey,
        leaveId: record.id,
        leaveSlot,
        leaveLabel,
        leaveWindow: { ...leaveWindow },
        clashes: [],
        workingWindow: { ...workingWindow },
        missing,
        missingHours,
        bookedHours,
        severity: 'medium',
        title: 'Half-day leave not covered',
        message,
      })
    }
  }

  return rows.sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1
    if (a.kind !== b.kind) return a.kind === 'leave_clash' ? -1 : 1
    return a.personName.localeCompare(b.personName, undefined, { sensitivity: 'base' })
  })
}

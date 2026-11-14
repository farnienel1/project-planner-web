/**
 * Rulebook 1.37.0 §21 (owner decisions 10 Nov): annual leave on a job's scheduling week (project and small works, web
 * and iOS).
 *
 * The grid lists only the people booked on that job somewhere in the visible days — leave never adds a person to it
 * (the caller builds the rows from the job's bookings, as before). For each person already on the grid this says,
 * per visible day, whether that day is annual leave and how to mark it:
 *   - approved full day → "AL"; approved half day → "AL AM" / "AL PM";
 *   - pending (requested) leave → "AL?" / "AL? AM" / "AL? PM", shown paler;
 *   - rejected leave never.
 * A day is leave only when it is one of the record's leave days (`leaveDayKind` → `leaveRecordDayKeys`: a multi-day
 * record skips weekends and the bank holidays given), in the organisation zone, with `leaveDayKind`'s fixed order
 * (full beats half; at the same length pending beats approved). Leave is matched to the person under every id they go
 * by (`personIdSet` over the roster: users documents and `operatives` rows) and, as older iOS builds stored it, their
 * email as `userId` — always without case (`leaveRecordsForAccount` rule, guardrail 1). Never by name.
 *
 * The apps draw the mark: a day with no booking on the job shows a brown leave cell; a day that also has a booking
 * keeps its booking cell with a thin brown band across the top. Booking figures are never changed by it. Pure.
 */

import { leaveDayKind, type LeaveDayKind } from './leaveCalendar'
import { normalizeHolidayStatus, normalizeHolidayTimeSlot, type HolidayTimeSlotValue } from './leaveRequests'
import { formatClockMinutes, leaveHalfDayLabel, slotInterval, type StandardDayInput } from './engine'
import { personIdSet, type PersonRosterRow } from './personIds'
import { bookingStandardDayOn, standardDayOn } from './payrollPolicySchedule'
import { namedSlotKind } from './engine'
import { multipliedHoursText, type PayrollHoursResult } from './payrollHours'

export const JOB_SCHEDULE_LEAVE_LABEL = 'AL'
export const JOB_SCHEDULE_LEAVE_PENDING_LABEL = 'AL?'
export const JOB_SCHEDULE_LEAVE_TITLE = 'Annual leave'
export const JOB_SCHEDULE_LEAVE_PENDING_TITLE = 'Annual leave requested'
/** The legend row both apps show under the week grid, in this order. */
export const JOB_SCHEDULE_LEGEND = ['Standard', 'Std + OT', 'OT only', 'Ann. leave', 'Half day'] as const

export type JobScheduleLeavePerson = {
  /** The grid row's own key, returned unchanged. */
  key: string
  /** Every id the row books under (operative ids, users ids), any case. */
  ids: ReadonlyArray<string | null | undefined>
  email?: string | null
}

export type JobScheduleLeaveRecord = {
  id?: string | null
  userId?: string | null
  operativeId?: string | null
  startDayKey: string
  endDayKey?: string | null
  timeSlot?: string | null
  status?: string | null
}

export type JobScheduleLeaveMark = {
  dayKey: string
  /** `leaveDayKind`: none, approvedFull, approvedHalf, pendingFull, pendingHalf. */
  kind: LeaveDayKind
  /** True when the day is leave (kind is not none). */
  onLeave: boolean
  pending: boolean
  /** FULL DAY, AM or PM; null when not on leave. */
  slot: HolidayTimeSlotValue | null
  /** "AL", "AL AM", "AL PM", "AL?", "AL? AM", "AL? PM"; '' when not on leave. */
  label: string
  /** "Annual leave · Full day", "Annual leave requested · AM 06:30–10:30" (`leaveHalfDayLabel`); '' when none. */
  title: string
  /** The record that decided the mark (for a mixed day, the approved half's record). */
  recordId: string | null
  /** How to shade each half of the day: approved, pending or null (not leave). A full day has both halves alike. */
  am: 'approved' | 'pending' | null
  pm: 'approved' | 'pending' | null
}

export type JobScheduleLeaveRow = { key: string; days: JobScheduleLeaveMark[] }

function key(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function noneMark(dayKey: string): JobScheduleLeaveMark {
  return { dayKey, kind: 'none', onLeave: false, pending: false, slot: null, label: '', title: '', recordId: null, am: null, pm: null }
}

/**
 * Rulebook 1.37.0: per grid person, per day key (in the order given), the annual-leave mark. `day` is the
 * organisation's working-hours policy or policy state (for the half-day clock in `title`, read per day with
 * `standardDayOn`); `nonWorkingDayKeys` the region's bank holidays.
 */
export function jobScheduleLeaveMarks(input: {
  people: ReadonlyArray<JobScheduleLeavePerson> | null | undefined
  holidays: ReadonlyArray<JobScheduleLeaveRecord> | null | undefined
  dayKeys: ReadonlyArray<string> | null | undefined
  timeZone?: string | null
  nonWorkingDayKeys?: ReadonlyArray<string> | null
  roster?: ReadonlyArray<PersonRosterRow> | null
  day?: unknown
}): JobScheduleLeaveRow[] {
  const dayKeys = (input?.dayKeys || []).filter((d): d is string => typeof d === 'string' && d.trim() !== '').map((d) => d.trim())
  const holidays = (input?.holidays || []).filter((h) => {
    if (!h || typeof h !== 'object') return false
    const status = normalizeHolidayStatus(h.status)
    return status === 'approved' || status === 'pending'
  })
  const roster = input?.roster || []
  return (input?.people || []).map((person) => {
    const ids = new Set<string>()
    const email = key(person?.email)
    for (const raw of person?.ids || []) {
      if (typeof raw !== 'string' || !raw.trim()) continue
      for (const id of personIdSet({ id: raw, email: person?.email ?? null }, roster)) ids.add(key(id))
      ids.add(key(raw))
    }
    if (email) {
      ids.add(email)
      // The person's other records on their email (roster rows) without a given id.
      for (const id of personIdSet({ id: email, email }, roster)) ids.add(key(id))
    }
    // Older iOS builds stored the account's email as `userId` (§10, `leaveRecordsForAccount`): the email of every
    // roster row that is this person counts too, so no caller has to pass the email itself (review #299, 1).
    for (const row of roster) {
      const rowEmail = key(row?.email)
      if (!rowEmail || ids.has(rowEmail)) continue
      const rowIds = [row?.id, ...(row?.formerUserIds || []), ...(row?.sameEmailUserIds || []), ...(row?.formerIds || []), ...(row?.aliasIds || [])]
      if (rowIds.some((id) => ids.has(key(id)))) ids.add(rowEmail)
    }
    const has = (value: unknown) => {
      const k = key(value)
      return k !== '' && ids.has(k)
    }
    const mine = ids.size === 0 ? [] : holidays.filter((h) => has(h.userId) || has(h.operativeId))
    const days = dayKeys.map((dayKey): JobScheduleLeaveMark => {
      if (mine.length === 0) return noneMark(dayKey)
      const result = leaveDayKind(mine, dayKey, input?.timeZone, input?.nonWorkingDayKeys)
      if (result.kind === 'none') return noneMark(dayKey)
      let kind = result.kind
      let recordId = result.recordId
      let mixedLabel: string | null = null
      let mixedSlot: HolidayTimeSlotValue | null = null
      if (kind === 'approvedHalf' || kind === 'pendingHalf') {
        // Review #299 (6): an AM record and a PM record on the same day are the whole day. Both approved → "AL",
        // both pending → "AL?"; one of each → both shown ("AL AM · AL? PM"), on the approved half.
        const halfState = (slot: 'AM' | 'PM'): { state: 'approved' | 'pending' | null; id: string | null } => {
          let state: 'approved' | 'pending' | null = null
          let id: string | null = null
          for (const h of mine) {
            if (normalizeHolidayTimeSlot(h.timeSlot) !== slot) continue
            const one = leaveDayKind([h], dayKey, input?.timeZone, input?.nonWorkingDayKeys).kind
            if (one === 'approvedHalf' && state !== 'approved') {
              state = 'approved'
              id = String(h.id ?? '').trim() || null
            } else if (one === 'pendingHalf' && state === null) {
              state = 'pending'
              id = String(h.id ?? '').trim() || null
            }
          }
          return { state, id }
        }
        const amHalf = halfState('AM')
        const pmHalf = halfState('PM')
        const am = amHalf.state
        const pm = pmHalf.state
        if (am && pm) {
          if (am === 'approved' && pm === 'approved') kind = 'approvedFull'
          else if (am === 'pending' && pm === 'pending') kind = 'pendingFull'
          else {
            kind = 'approvedHalf'
            mixedSlot = am === 'approved' ? 'AM' : 'PM'
            recordId = am === 'approved' ? amHalf.id : pmHalf.id
            mixedLabel = `${am === 'approved' ? JOB_SCHEDULE_LEAVE_LABEL : JOB_SCHEDULE_LEAVE_PENDING_LABEL} AM · ${
              pm === 'approved' ? JOB_SCHEDULE_LEAVE_LABEL : JOB_SCHEDULE_LEAVE_PENDING_LABEL
            } PM`
          }
        }
      }
      const pending = kind === 'pendingFull' || kind === 'pendingHalf'
      const half = kind === 'approvedHalf' || kind === 'pendingHalf'
      const record =
        (result.recordId ? mine.find((h) => String(h.id ?? '').trim() === result.recordId) : undefined) ??
        mine.find((h) => {
          const slot = normalizeHolidayTimeSlot(h.timeSlot)
          return half ? slot !== 'FULL DAY' : slot === 'FULL DAY'
        })
      const slot: HolidayTimeSlotValue =
        mixedSlot ?? (half ? (normalizeHolidayTimeSlot(record?.timeSlot) === 'PM' ? 'PM' : 'AM') : 'FULL DAY')
      const base = pending ? JOB_SCHEDULE_LEAVE_PENDING_LABEL : JOB_SCHEDULE_LEAVE_LABEL
      const dayInput = standardDayOn(input?.day as StandardDayInput | null | undefined, dayKey) as StandardDayInput | null
      const state: 'approved' | 'pending' = pending ? 'pending' : 'approved'
      const halvesOf = (): { am: 'approved' | 'pending' | null; pm: 'approved' | 'pending' | null } => {
        if (mixedLabel) {
          // Both halves, each in its own style.
          const amState = mixedSlot === 'AM' ? 'approved' : 'pending'
          return { am: amState, pm: amState === 'approved' ? 'pending' : 'approved' }
        }
        if (!half) return { am: state, pm: state }
        return slot === 'AM' ? { am: state, pm: null } : { am: null, pm: state }
      }
      const title = mixedLabel
        ? `${JOB_SCHEDULE_LEAVE_TITLE} · ${mixedLabel}`
        : `${pending ? JOB_SCHEDULE_LEAVE_PENDING_TITLE : JOB_SCHEDULE_LEAVE_TITLE} · ${leaveHalfDayLabel(slot, dayInput)}`
      return {
        dayKey,
        kind,
        onLeave: true,
        pending,
        slot,
        label: mixedLabel ?? (half ? `${base} ${slot}` : base),
        title,
        recordId,
        ...halvesOf(),
      }
    })
    return { key: String(person?.key ?? ''), days }
  })
}

export type ScheduleCellTone = 'standard' | 'split' | 'otOnly' | 'halfDay'

export type ScheduleCellKind = {
  tone: ScheduleCellTone
  /** Paid hours in the standard window (paid hours less the overtime part), to the hundredth. */
  standardHours: number
  /** Paid hours at a multiplier, to the hundredth. */
  overtimeHours: number
  /** "AM" / "PM" for a half day, else null. */
  halfLabel: 'AM' | 'PM' | null
}

/**
 * Rulebook 1.37.0 §21: a booking's paid hours split for its scheduling tile, from the pay rule's own result
 * (`payrollHoursResult`): `paidHours` = `totalPaidHours`; `overtimeHours` = the paid hours of every segment that is
 * not the standard window (the multiplied ones). A day with several bookings adds these up before
 * `scheduleCellKind`.
 */
export function scheduleCellHours(result: Pick<PayrollHoursResult, 'totalPaidHours' | 'segments'> | null | undefined): {
  paidHours: number
  overtimeHours: number
} {
  const paidHours = Math.max(0, Number(result?.totalPaidHours) || 0)
  const overtimeHours = Math.max(
    0,
    (result?.segments || []).filter((s) => s && s.kind !== 'standardWindow').reduce((sum, s) => sum + (Number(s.paidHours) || 0), 0)
  )
  return { paidHours, overtimeHours }
}

const CELL_EPSILON = 0.05
const hundredths = (value: number) => Math.round(value * 100) / 100

/**
 * Rulebook 1.37.0 §21 (owner decision 10 Nov, one booking colour scheme): the colour of a booking tile or day chip on
 * a job's scheduling week, the same on both apps — `halfDay` for a stored AM / PM, `otOnly` for a stored OVERTIME slot
 * or hours at a multiplier only, `split` (Std + OT) for both, else `standard`. A booking that pays 0 hours is a
 * Standard 0h tile, never hidden (review #299, 3). Display only: it never changes a figure.
 */
export function scheduleCellKind(input: { paidHours?: number | null; overtimeHours?: number | null; timeSlot?: string | null } | null | undefined): ScheduleCellKind {
  const total = Math.max(0, Number(input?.paidHours) || 0)
  const ot = Math.max(0, Number(input?.overtimeHours) || 0)
  const std = Math.max(0, total - ot)
  const slot = namedSlotKind(input?.timeSlot)
  if (slot === 'AM' || slot === 'PM') return { tone: 'halfDay', standardHours: hundredths(total), overtimeHours: 0, halfLabel: slot }
  if (slot === 'OVERTIME') return { tone: 'otOnly', standardHours: 0, overtimeHours: hundredths(total > 0 ? total : ot), halfLabel: null }
  if (ot > CELL_EPSILON && std > CELL_EPSILON) return { tone: 'split', standardHours: hundredths(std), overtimeHours: hundredths(ot), halfLabel: null }
  if (ot > CELL_EPSILON) return { tone: 'otOnly', standardHours: 0, overtimeHours: hundredths(ot), halfLabel: null }
  return { tone: 'standard', standardHours: hundredths(total), overtimeHours: 0, halfLabel: null }
}

// MARK: - One tile per person-day (1.41.0, owner decision 11 Nov, option a)

/** One booking on a person's day, as `scheduleCellHours` gives it, plus its overtime clock figures. */
export type ScheduleDayBooking = {
  /** `payrollHoursResult.totalPaidHours`. */
  paidHours?: number | null
  /** The paid hours of its multiplied segments (`scheduleCellHours.overtimeHours`). */
  overtimeHours?: number | null
  timeSlot?: string | null
  /**
   * `payrollMultipliedHours(result)` (clock hours at the multiplier, the multiplier and the unpaid break taken off
   * them); null or missing when the booking has no hours at a multiplier.
   */
  overtime?: { clockHours?: number | null; multiplier?: number | null; breakHours?: number | null } | null
}

export type ScheduleDayCell = ScheduleCellKind & {
  /** Every booking's paid hours added up, to the hundredth. */
  totalHours: number
  bookingCount: number
  /** "26h". */
  hoursText: string
  /** "2 bookings" when there is more than one, else null. */
  countText: string | null
  /** "26h · 2 bookings", or "8h" for one booking. */
  headline: string
  /** The word under a one-colour tile: "Std", "OT", "AM" / "PM"; null on a split tile and, for Std / OT, on leave. */
  caption: string | null
  /** "18h Std" ("18h" on a leave day); null when there are no standard hours. */
  standardText: string | null
  /** "8h OT" ("8h" on a leave day); null when there are no overtime hours. */
  overtimeText: string | null
  /** The clock hours at each multiplier, "4h × 2 = 8h" (`multipliedHoursText`), bookings at one rate added together. */
  overtimeLines: string[]
}

function dayHoursText(value: number): string {
  return `${hundredths(value)}h`
}

/**
 * Rulebook 1.41.0 §21 (owner decision 11 Nov, option a: one scheme on both apps): a job's scheduling week shows ONE
 * tile per person per day. With several bookings the tile reads the day total and the number of bookings —
 * "26h · 2 bookings" — with the standard and overtime hours underneath and the clock overtime at each rate
 * (`multipliedHoursText`, as every pay screen). The colour is `scheduleCellKind` of the summed hours (a named half day
 * or OVERTIME slot decides it only when it is the day's one booking). On a day of annual leave (the brown band) the
 * "Std" / "OT" words are left off so the figures fit (`onLeave`); "AM" / "PM" stay. Display only: it never changes a
 * figure, and every booking stays reachable for edit (the apps open a chooser of the day's bookings). Null with no
 * booking.
 */
export function scheduleDayCell(input: { bookings: ReadonlyArray<ScheduleDayBooking | null | undefined> | null | undefined; onLeave?: boolean | null } | null | undefined): ScheduleDayCell | null {
  const bookings = (input?.bookings || []).filter((b): b is ScheduleDayBooking => Boolean(b && typeof b === 'object'))
  if (bookings.length === 0) return null
  const onLeave = input?.onLeave === true
  let paid = 0
  let overtime = 0
  const byRate = new Map<number, { clock: number; brk: number }>()
  for (const booking of bookings) {
    paid += Math.max(0, Number(booking.paidHours) || 0)
    overtime += Math.max(0, Number(booking.overtimeHours) || 0)
    const clock = Math.max(0, Number(booking.overtime?.clockHours) || 0)
    if (clock > 0) {
      const rate = Number(booking.overtime?.multiplier) > 0 ? hundredths(Number(booking.overtime?.multiplier)) : 1
      const row = byRate.get(rate) ?? { clock: 0, brk: 0 }
      row.clock += clock
      row.brk += Math.max(0, Number(booking.overtime?.breakHours) || 0)
      byRate.set(rate, row)
    }
  }
  const single = bookings.length === 1
  const kind = scheduleCellKind({ paidHours: paid, overtimeHours: overtime, timeSlot: single ? bookings[0].timeSlot ?? null : null })
  const totalHours = hundredths(paid)
  const hoursText = dayHoursText(totalHours)
  const countText = single ? null : `${bookings.length} bookings`
  const caption =
    kind.tone === 'halfDay' ? kind.halfLabel : kind.tone === 'split' || onLeave ? null : kind.tone === 'otOnly' ? 'OT' : 'Std'
  const standardText = kind.standardHours > 0 ? (onLeave ? dayHoursText(kind.standardHours) : `${dayHoursText(kind.standardHours)} Std`) : null
  const overtimeText = kind.overtimeHours > 0 ? (onLeave ? dayHoursText(kind.overtimeHours) : `${dayHoursText(kind.overtimeHours)} OT`) : null
  const overtimeLines = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([multiplier, row]) => multipliedHoursText({ clockHours: row.clock, multiplier, breakHours: row.brk }))
  return {
    ...kind,
    totalHours,
    bookingCount: bookings.length,
    hoursText,
    countText,
    headline: countText ? `${hoursText} · ${countText}` : hoursText,
    caption,
    standardText,
    overtimeText,
    overtimeLines,
  }
}

export type SubcontractorScheduleBooking = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
}

export type SubcontractorScheduleCell = ScheduleDayCell & {
  /** Each booking's working window, "07:30–16:00", earliest first. */
  times: string[]
  /** `times` joined with " + ", e.g. "07:30–12:00 + 13:00–16:00". */
  timesText: string
}

/**
 * Rulebook 1.43.0 §21 (owner rule, 14 Nov): a subcontractor booking on a job's scheduling week shows only its working
 * window — start to finish — and, with several bookings that day, their number. Never the standard / overtime split
 * or paid hours: a firm's booking is not priced by the organisation's working hours. Custom hours are their clock
 * times (an overnight booking keeps its stored finish, "22:00–06:00"); a named slot (FULL DAY, AM, PM) is that slot's
 * clock window on the day under the working hours in effect on it (`slotInterval` on `bookingStandardDayOn`; a
 * set-window weekend day's own window). The tile is one plain colour (`tone` standard) and carries no hours. Null with
 * no booking. Display only.
 */
export function subcontractorScheduleCell(
  input:
    | {
        bookings: ReadonlyArray<SubcontractorScheduleBooking | null | undefined> | null | undefined
        /** The working hours (a policy, or the policy state) — for a named slot's window. */
        day?: Parameters<typeof bookingStandardDayOn>[0]
        dayKey?: string | null
      }
    | null
    | undefined
): SubcontractorScheduleCell | null {
  const bookings = (input?.bookings || []).filter((b): b is SubcontractorScheduleBooking => Boolean(b && typeof b === 'object'))
  if (bookings.length === 0) return null
  const dayInput = bookingStandardDayOn(input?.day ?? null, input?.dayKey ?? null)
  const spans = bookings
    .map((booking) => {
      const interval = slotInterval(booking, dayInput)
      if (!interval) return null
      const end = interval.end >= 24 * 60 ? interval.end - 24 * 60 : interval.end
      return { start: interval.start, text: `${formatClockMinutes(interval.start)}–${formatClockMinutes(end)}` }
    })
    .filter((row): row is { start: number; text: string } => row != null)
    .sort((a, b) => a.start - b.start)
  const times: string[] = []
  for (const span of spans) if (!times.includes(span.text)) times.push(span.text)
  const timesText = times.join(' + ')
  const countText = bookings.length > 1 ? `${bookings.length} bookings` : null
  const label = timesText || 'Booked'
  return {
    tone: 'standard',
    standardHours: 0,
    overtimeHours: 0,
    halfLabel: null,
    totalHours: 0,
    bookingCount: bookings.length,
    hoursText: '',
    countText,
    headline: countText ? `${label} · ${countText}` : label,
    caption: null,
    standardText: null,
    overtimeText: null,
    overtimeLines: [],
    times,
    timesText,
  }
}

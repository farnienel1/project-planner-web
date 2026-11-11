/**
 * Rulebook 1.39.0 §10 (owner answer 11 Nov): the booking clash marker on My Schedule. Each of the viewer's own bookings
 * that overlaps another of their bookings gets a small triangle — red while the clash is not approved, grey once it is
 * — worked out exactly as Warnings does: operative clashes `operativeClashGroups` (approved when every overlapping pair
 * is, `isClashGroupApproved`, so a third booking re-opens it), manager / admin clashes `managerClashGroups` (`clashManagerIds`
 * decides which), approval `isClashApproved` over `approvedWarningKeys` and `acceptedBookingClashes` (keys without case),
 * each booking's named slot under the working hours in effect on its own day. Tapping it opens a styled popup:
 *   not approved: "Booking clash", the other booking(s) (day · place · times) and "Open Warnings" only when the viewer
 *                 may open Warnings, the clash is in their warning scope (`isWarningRowInScope`) AND Warnings lists it
 *                 now — its day is one of `clashScanDays` and it is not dismissed (operative clusters
 *                 `isClashGroupApproved` over the resolved keys, manager clashes `isWarningActive`, exactly as the
 *                 Warnings list filters them). A staff viewer whose clash Warnings does not list reads "This clash
 *                 isn't in the current Warnings period." (or "This clash was dismissed in Warnings."); anyone else
 *                 "Ask your manager to review this clash." Close only in those cases;
 *   approved:     "Clash approved" — "This clash was already approved. The booking will have to be adjusted manually."
 * When the approvals have not loaded (`decisions` null) nothing reads as approved: a clash stays red.
 * Display only: nothing is written. Daily Overview does not show it.
 */

import { formatClockMinutes, parseClockMinutes } from './engine'
import type { BookingPersonInput } from './bookingPerson'
import {
  isClashApproved,
  isClashGroupApproved,
  isWarningActive,
  managerClashGroups,
  operativeClashGroups,
  type PersonDayManagerBooking,
  type PersonDayOperativeBooking,
  type WarningDecisions,
} from './scheduleSources'
import { isWarningRowInScope, type WarningScope } from './staffAccess'
import type { PayrollTimePolicyState } from './payrollPolicySchedule'
import type { OrgPayrollTimePolicy } from './organizationSettings'

export const MY_SCHEDULE_CLASH_TITLE = 'Booking clash'
export const MY_SCHEDULE_CLASH_APPROVED_TITLE = 'Clash approved'
export const MY_SCHEDULE_CLASH_APPROVED_MESSAGE = 'This clash was already approved. The booking will have to be adjusted manually.'
export const MY_SCHEDULE_CLASH_ASK_MANAGER = 'Ask your manager to review this clash.'
export const MY_SCHEDULE_CLASH_OPEN_WARNINGS = 'Open Warnings'
export const MY_SCHEDULE_CLASH_NOT_IN_PERIOD = "This clash isn't in the current Warnings period."
export const MY_SCHEDULE_CLASH_DISMISSED = 'This clash was dismissed in Warnings.'

export type MyScheduleClashOperativeBooking = PersonDayOperativeBooking & {
  /** The job's name or number, shown in the popup. */
  placeLabel?: string | null
  projectId?: string | null
}

export type MyScheduleClashManagerBooking = PersonDayManagerBooking & {
  placeLabel?: string | null
  /** Job id when the manager booking is at a project or small works. */
  jobId?: string | null
}

export type MyScheduleClashMarker = {
  bookingId: string
  /** 'clash' (red), 'approved' (grey). Bookings without a clash have no marker. */
  state: 'clash' | 'approved'
  otherBookingIds: string[]
  canOpenWarnings: boolean
  title: string
  message: string
  /** "Open Warnings", or null (Close only). */
  actionLabel: string | null
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Wed 12 Nov" for an organisation day key (calendar arithmetic only, no zone). */
function dayText(dayKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ''))
  if (!match) return String(dayKey || '')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

function timesText(booking: { timeSlot?: string | null; workStartTime?: string | null; workEndTime?: string | null }): string {
  const start = parseClockMinutes(booking.workStartTime ?? null)
  const end = parseClockMinutes(booking.workEndTime ?? null)
  if (start != null && end != null) return `${formatClockMinutes(start)}–${formatClockMinutes(end)}`
  const slot = String(booking.timeSlot ?? '').trim().toUpperCase()
  if (slot === 'AM') return 'AM'
  if (slot === 'PM') return 'PM'
  return 'Full day'
}

function describe(booking: { dayKey: string; placeLabel?: string | null } & Parameters<typeof timesText>[0]): string {
  const place = String(booking.placeLabel ?? '').trim()
  return [dayText(booking.dayKey), place, timesText(booking)].filter(Boolean).join(' · ')
}

/**
 * The markers for the viewer's own bookings (`operativeBookings` / `managerBookings` hold only the bookings My Schedule
 * shows for them, matched with `bookingIdsForAccount`). `people` and `managerIds` are the Warnings inputs
 * (`rosterPeople` accounts with `formerIds` / `aliasIds`, the `operatives` catalogue, `clashManagerIds(roster)`).
 * `canOpenWarnings`: the viewer may open the Warnings screen (admins and managers; never operatives). `scope`: the
 * viewer's `warningScopeFor`; `viewerIds` / `viewerEmail`: their ids for the scope test.
 */
export function myScheduleClashMarkers(input: {
  operativeBookings?: ReadonlyArray<MyScheduleClashOperativeBooking> | null
  managerBookings?: ReadonlyArray<MyScheduleClashManagerBooking> | null
  people?: BookingPersonInput | null
  managerIds?: ReadonlyArray<string> | null
  day?: OrgPayrollTimePolicy | PayrollTimePolicyState | null
  /**
   * `resolvedKeys` (`resolvedWarningKeys`: approved and dismissed), `approvedKeys` (`approvedWarningKeys`) and
   * `acceptedBookingClashes`; null while not loaded — nothing reads approved and "Open Warnings" is not offered.
   */
  decisions?: WarningDecisions | null
  /**
   * `clashScanDays(...).dayKeys` for today (the days Warnings checks clashes on). Missing → no day is in the Warnings
   * period, so "Open Warnings" is never offered on a guess.
   */
  scanDayKeys?: ReadonlyArray<string> | null
  canOpenWarnings?: boolean | null
  scope?: WarningScope | null
  viewerIds?: ReadonlyArray<string> | null
  viewerEmail?: string | null
}): MyScheduleClashMarker[] {
  const operativeBookings = [...(input?.operativeBookings || [])]
  const managerBookings = [...(input?.managerBookings || [])]
  const people = input?.people || { accounts: [], operatives: [] }
  const managerIds = [...(input?.managerIds || [])]
  const day = (input?.day ?? null) as Parameters<typeof managerClashGroups>[0]['day']
  const decisions = input?.decisions ?? null
  const markers = new Map<string, MyScheduleClashMarker>()
  const describeById = new Map<string, string>()
  for (const booking of operativeBookings) describeById.set(String(booking.id), describe(booking))
  for (const booking of managerBookings) describeById.set(String(booking.id), describe(booking))
  const jobOf = new Map<string, string>()
  for (const booking of operativeBookings) if (booking.projectId) jobOf.set(String(booking.id), String(booking.projectId))
  for (const booking of managerBookings) if (booking.jobId) jobOf.set(String(booking.id), String(booking.jobId))

  const inScope = (bookingIds: string[]): boolean =>
    isWarningRowInScope(input?.scope ?? null, {
      personIds: [...(input?.viewerIds || [])],
      email: input?.viewerEmail ?? null,
      jobIds: bookingIds.map((id) => jobOf.get(id) ?? null),
    })

  const scanDays = new Set((input?.scanDayKeys || []).map((key) => String(key)))
  const staff = input?.canOpenWarnings === true

  // `listed`: Warnings lists the clash today — its day is scanned and it is not dismissed.
  const add = (bookingIds: string[], approved: boolean, listed: 'listed' | 'notInPeriod' | 'dismissed') => {
    const scoped = staff && inScope(bookingIds)
    const open = !approved && scoped && listed === 'listed'
    const note = open
      ? ''
      : !scoped
        ? MY_SCHEDULE_CLASH_ASK_MANAGER
        : listed === 'dismissed'
          ? MY_SCHEDULE_CLASH_DISMISSED
          : MY_SCHEDULE_CLASH_NOT_IN_PERIOD
    for (const bookingId of bookingIds) {
      const others = bookingIds.filter((id) => id !== bookingId)
      const lines = others.map((id) => describeById.get(id) ?? id)
      const existing = markers.get(bookingId)
      // A booking in two groups (overnight carry) keeps red over grey.
      if (existing && existing.state === 'clash' && approved) continue
      markers.set(
        bookingId,
        approved
          ? {
              bookingId,
              state: 'approved',
              otherBookingIds: others,
              canOpenWarnings: false,
              title: MY_SCHEDULE_CLASH_APPROVED_TITLE,
              message: MY_SCHEDULE_CLASH_APPROVED_MESSAGE,
              actionLabel: null,
            }
          : {
              bookingId,
              state: 'clash',
              otherBookingIds: others,
              canOpenWarnings: open,
              title: MY_SCHEDULE_CLASH_TITLE,
              message: `This booking overlaps ${lines.join('; ')}.${note ? ` ${note}` : ''}`,
              actionLabel: open ? MY_SCHEDULE_CLASH_OPEN_WARNINGS : null,
            }
      )
    }
  }

  const listedOn = (dayKey: string, dismissed: boolean): 'listed' | 'notInPeriod' | 'dismissed' => {
    if (decisions == null || !scanDays.has(dayKey)) return 'notInPeriod'
    return dismissed ? 'dismissed' : 'listed'
  }

  for (const group of operativeClashGroups({ operativeBookings, people, managerIds, day })) {
    const approved = decisions != null && isClashGroupApproved(group, decisions)
    // Warnings hides an operative cluster once every pair is approved, dismissed or accepted (resolved keys).
    const hidden =
      decisions != null &&
      isClashGroupApproved(group, { resolvedKeys: decisions.resolvedKeys, acceptedClashes: decisions.acceptedClashes })
    add([...group.bookingIds], approved, listedOn(group.dayKey, hidden))
  }
  for (const group of managerClashGroups({ managerBookings, operativeBookings, people, managerIds, day })) {
    const approved = decisions != null && isClashApproved(group, decisions)
    const hidden =
      decisions != null &&
      !isWarningActive({ resolutionKey: group.resolutionKey, bookingAId: group.bookingAId, bookingBId: group.bookingBId }, decisions)
    add(
      group.items.map((item) => item.bookingId),
      approved,
      listedOn(group.dayKey, hidden)
    )
  }
  return [...markers.values()].sort((a, b) => a.bookingId.localeCompare(b.bookingId))
}

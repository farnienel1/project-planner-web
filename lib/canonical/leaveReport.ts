/**
 * Rulebook 1.22.0 (§9, audit finding 7): the Holiday Report — one person's leave in one leave year and the days it
 * takes. Built on `leaveRecordDayKeys` / `leaveDaysInRange` (the rule `annualLeaveBalance` counts with), so the report
 * and the balance the person sees never disagree: a multi-day record skips weekends and bank holidays
 * (`nonWorkingDayKeys`), a half day (AM / PM) counts 0.5, the year is the organisation leave year
 * (`leaveYearBounds` from `annualLeaveDefaults.startMonth`) and every day is an organisation-zone day key. Records
 * match the person under every id they go by, without case (`normalizeDocumentId`). Before 1.22.0 the iOS report
 * counted every calendar day, a half day as 1, the device calendar year, and exact ids only.
 *
 * Plain inputs (records as `parseHolidayDocument` returns them), so iOS calls it through JavaScriptCore.
 */

import { leaveDaysInRange, leaveRecordDayKeys, normalizeHolidayStatus, normalizeHolidayTimeSlot } from './leaveRequests'
import { leaveYearBounds, snapLeaveDays } from './annualLeaveBalance'
import { normalizeDocumentId } from './scheduleSources'
import { zoneOrLondon } from './dayKeys'

export type LeaveReportRecord = {
  id: string
  userId?: string | null
  operativeId?: string | null
  startDayKey: string
  endDayKey?: string | null
  timeSlot?: string | null
  status?: string | null
}

export type LeaveReportRow = {
  id: string
  startDayKey: string
  endDayKey: string
  timeSlot: string
  status: string
  /** Days this record takes inside the leave year (0.5 steps). */
  days: number
}

export type LeaveReport = {
  startDayKey: string
  endDayKey: string
  yearKey: string
  /** Records overlapping the year, newest start first. */
  rows: LeaveReportRow[]
  /** Sum of `days` over `rows`. */
  totalDays: number
}

export type LeaveReportInput = {
  records: ReadonlyArray<LeaveReportRecord> | null | undefined
  /** Every id the person goes by: their users id, former and same-email ids (`personIdSet`) and operative ids. */
  personIds: ReadonlyArray<string> | null | undefined
  /** Any organisation-zone day inside the leave year to report. */
  onDayKey: string
  /** `annualLeaveDefaults.startMonth` (or the person's own leave year start month). Missing = January. */
  startMonth?: number | null
  timeZone?: string | null
  /** Bank holidays of the organisation's region. */
  nonWorkingDayKeys?: ReadonlyArray<string> | null
  /** Which statuses to list (`normalizeHolidayStatus`). Default `['approved']`. */
  statuses?: ReadonlyArray<string> | null
}

/** Days one record takes inside a range (both day keys inclusive): `leaveDaysInRange`, snapped to half days. */
export function leaveReportDayCount(
  record: { startDayKey: string; endDayKey?: string | null; timeSlot?: string | null },
  range: { startDayKey: string; endDayKey: string },
  timeZone?: string | null,
  nonWorkingDayKeys?: ReadonlyArray<string> | null
): number {
  return snapLeaveDays(leaveDaysInRange(record, range, timeZone, nonWorkingDayKeys))
}

/** The Holiday Report for one person and one leave year (§9). */
export function leaveReportRows(input: LeaveReportInput): LeaveReport {
  const zone = zoneOrLondon(input.timeZone)
  const year = leaveYearBounds({ startMonth: input.startMonth ?? 1, onDayKey: input.onDayKey })
  const ids = new Set((input.personIds || []).map((id) => normalizeDocumentId(id)).filter(Boolean))
  const statuses = new Set((input.statuses && input.statuses.length > 0 ? input.statuses : ['approved']).map((s) => normalizeHolidayStatus(s)))
  const nonWorking = input.nonWorkingDayKeys ?? []
  const range = { startDayKey: year.startDayKey, endDayKey: year.endDayKey }
  const rows: LeaveReportRow[] = []
  for (const record of input.records || []) {
    if (!record) continue
    const mine =
      (record.userId != null && ids.has(normalizeDocumentId(record.userId))) ||
      (record.operativeId != null && ids.has(normalizeDocumentId(record.operativeId)))
    if (!mine) continue
    const status = normalizeHolidayStatus(record.status)
    if (!statuses.has(status)) continue
    const start = String(record.startDayKey || '').trim()
    const endRaw = String(record.endDayKey || '').trim()
    const end = endRaw && endRaw >= start ? endRaw : start
    if (!start || end < range.startDayKey || start > range.endDayKey) continue
    const days = leaveReportDayCount({ startDayKey: start, endDayKey: end, timeSlot: record.timeSlot }, range, zone, nonWorking)
    rows.push({ id: String(record.id ?? ''), startDayKey: start, endDayKey: end, timeSlot: normalizeHolidayTimeSlot(record.timeSlot), status, days })
  }
  rows.sort((a, b) => (a.startDayKey === b.startDayKey ? a.id.localeCompare(b.id) : a.startDayKey < b.startDayKey ? 1 : -1))
  return {
    startDayKey: year.startDayKey,
    endDayKey: year.endDayKey,
    yearKey: year.yearKey,
    rows,
    totalDays: snapLeaveDays(rows.reduce((sum, row) => sum + row.days, 0)),
  }
}

/**
 * The leave years a Holiday Report offers: from the year containing `firstDayKey` (the person's start date or first
 * leave) to the year containing `todayDayKey`, newest first, as `leaveYearBounds` rows. `leaveRecordDayKeys` is
 * re-exported beside it so a report screen needs no other import.
 */
export function leaveReportYears(input: { firstDayKey?: string | null; todayDayKey: string; startMonth?: number | null }): Array<{
  startDayKey: string
  endDayKey: string
  yearKey: string
}> {
  const startMonth = input.startMonth ?? 1
  const last = leaveYearBounds({ startMonth, onDayKey: input.todayDayKey })
  const firstKey = /^\d{4}-\d{2}-\d{2}$/.test(String(input.firstDayKey || '').trim()) ? String(input.firstDayKey).trim() : input.todayDayKey
  const first = leaveYearBounds({ startMonth, onDayKey: firstKey <= input.todayDayKey ? firstKey : input.todayDayKey })
  const out: Array<{ startDayKey: string; endDayKey: string; yearKey: string }> = []
  let cursor = last
  for (let guard = 0; guard < 100; guard += 1) {
    out.push(cursor)
    if (cursor.startDayKey <= first.startDayKey) break
    const year = Number(cursor.startDayKey.slice(0, 4)) - 1
    cursor = leaveYearBounds({ startMonth, onDayKey: `${year}${cursor.startDayKey.slice(4)}` })
  }
  return out
}

export { leaveRecordDayKeys }

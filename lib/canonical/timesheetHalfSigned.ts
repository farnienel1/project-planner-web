/**
 * Rulebook 1.54.0 §8 / §11 (owner decision 16 Nov, answer (a) + (c) to the 14 Nov question): Settings → Data health
 * "Timesheets half signed". Before 1.43.0, adding price work or expenses after the line manager had signed cleared only
 * the person's own signature, leaving the line manager's signature and snapshot stored. Such a sheet reads `unsigned` in
 * `timesheetListBucket` (neither Awaiting nor Signed off) and nobody can generate its invoice until the person signs
 * again. Admins see the list with a link to each sheet; nothing is written — the person signs again and the sheet
 * returns to Signed off (their line manager's signature is kept).
 */

import { parseTimesheetStatusFields, timesheetDocumentSubjectId } from './timesheetPeriod'

export const TIMESHEETS_HALF_SIGNED_HEADING = 'Timesheets half signed'
export const TIMESHEETS_HALF_SIGNED_HELP =
  'The line manager signed these timesheets but the person’s own signature is missing (an older app cleared it when price work or expenses were added). They show as not signed and cannot be generated or exported. Ask the person to open the timesheet and sign it again — their line manager’s signature is kept.'
export const TIMESHEETS_HALF_SIGNED_NONE = 'No timesheet is missing the person’s signature.'

export type TimesheetHalfSignedRow = {
  /** The settings document id (`timesheet_{uid}_{period}`). */
  sheetId: string
  /** The sheet's person: its stored `userId`, else the id its document is filed under. */
  userId: string
  /** The pay run as stored (`weekStartKey` / `weekEndKey`), '' when not stored. */
  startDayKey: string
  endDayKey: string
  managerSignedAtMs: number
  managerSignedByName: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Rulebook 1.54.0: the timesheets the line manager signed whose person signature is missing and that are not exported
 * (exported sheets are frozen). `sheets` are `organizations/{orgId}/settings` documents (`{ id, data }`); anything that
 * is not a timesheet document is skipped. Oldest pay run first.
 */
export function timesheetsHalfSigned(
  sheets: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined } | null | undefined>
): TimesheetHalfSignedRow[] {
  const rows: TimesheetHalfSignedRow[] = []
  for (const sheet of sheets) {
    if (!sheet || !text(sheet.id).startsWith('timesheet_')) continue
    const data = sheet.data && typeof sheet.data === 'object' ? sheet.data : {}
    const status = parseTimesheetStatusFields(data)
    if (status.exportedAtMs != null) continue
    if (status.operativeSignedAtMs != null || status.managerSignedAtMs == null) continue
    rows.push({
      sheetId: sheet.id,
      userId: text(data.userId) || timesheetDocumentSubjectId(sheet.id),
      startDayKey: text(data.weekStartKey),
      endDayKey: text(data.weekEndKey),
      managerSignedAtMs: status.managerSignedAtMs,
      managerSignedByName: status.managerSignedByName,
    })
  }
  return rows.sort((a, b) => (a.startDayKey || a.sheetId).localeCompare(b.startDayKey || b.sheetId))
}

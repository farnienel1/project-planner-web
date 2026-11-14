/**
 * Rulebook 1.43.0 (review r318): the order of a User Timesheets export, as one testable runner.
 *
 * 1. Prepare every sheet first (fresh read, snapshot built — rebuilt if frozen empty), checking the bookings gate
 *    before each person. Nothing is written in this pass, so a gate that closes stops the export with nobody stamped.
 * 2. Stamp the prepared sheets exported, one by one.
 * 3. Deliver (PDF, storage backup, email) every sheet that WAS stamped — also when a later stamp failed — and forget
 *    the cached exported history, so no sheet is ever left exported without its invoice.
 */

export type TimesheetExportPrepared<T> = { memberId: string; name: string; sheet: T }

export type TimesheetExportRunInput<M, T> = {
  members: ReadonlyArray<M>
  memberId: (member: M) => string
  memberName: (member: M) => string
  /** The bookings gate as it is now (re-read before each person). */
  gateReady: () => boolean
  /** Fresh read + built snapshot with `exportedAt`; `{ skip: 'exported' }` for a sheet already exported, `null` to leave out. */
  prepare: (member: M) => Promise<T | { skip: 'exported' } | null>
  stamp: (prepared: TimesheetExportPrepared<T>) => Promise<void>
  deliver: (stamped: ReadonlyArray<TimesheetExportPrepared<T>>) => Promise<void>
  forgetHistory: () => void
}

export type TimesheetExportRunResult<T> = {
  stamped: Array<TimesheetExportPrepared<T>>
  /** Names of sheets already exported (left exactly as they are). */
  skipped: string[]
  /** Why the export stopped, or null. `gate` = nothing was stamped; `stamp` = some were, and were still delivered. */
  stopped: { reason: 'gate' | 'stamp'; error?: unknown } | null
}

function isSkip(value: unknown): value is { skip: 'exported' } {
  return Boolean(value && typeof value === 'object' && (value as { skip?: unknown }).skip === 'exported')
}

export async function runTimesheetExport<M, T>(input: TimesheetExportRunInput<M, T>): Promise<TimesheetExportRunResult<T>> {
  const prepared: Array<TimesheetExportPrepared<T>> = []
  const skipped: string[] = []
  for (const member of input.members) {
    if (!input.gateReady()) return { stamped: [], skipped, stopped: { reason: 'gate' } }
    const sheet = await input.prepare(member)
    if (sheet == null) continue
    if (isSkip(sheet)) {
      skipped.push(input.memberName(member))
      continue
    }
    prepared.push({ memberId: input.memberId(member), name: input.memberName(member), sheet })
  }
  // The gate once more after the last read, still before anything is written.
  if (prepared.length > 0 && !input.gateReady()) return { stamped: [], skipped, stopped: { reason: 'gate' } }
  const stamped: Array<TimesheetExportPrepared<T>> = []
  let stopped: TimesheetExportRunResult<T>['stopped'] = null
  for (const row of prepared) {
    try {
      await input.stamp(row)
      stamped.push(row)
    } catch (error) {
      stopped = { reason: 'stamp', error }
      break
    }
  }
  if (stamped.length > 0) {
    input.forgetHistory()
    await input.deliver(stamped)
  }
  return { stamped, skipped, stopped }
}

/** Where an exported sheet's PDF can be fetched again (the Exported tab rebuilds it from the saved snapshot). */
export const EXPORT_RECOVER_HINT = 'Open Exported to download any timesheet again.'

/**
 * The message after an export (review r318): what was exported, what was sent, what could not be sent and why —
 * never "Export failed." once anything was stamped.
 */
export function exportSummaryMessage(input: {
  stamped: ReadonlyArray<string>
  notSent: ReadonlyArray<string>
  emailProblem: string | null
  recipientEmail: string | null
  sentCount: number
  backupSkipped: ReadonlyArray<string>
  skipped: ReadonlyArray<string>
  stampError: string | null
}): string {
  const parts: string[] = []
  const n = input.stamped.length
  if (n === 0) {
    parts.push(input.stampError ? `Nothing was exported (${input.stampError}).` : 'Nothing to export.')
  } else {
    parts.push(`${n} exported.`)
    if (input.sentCount > 0 && !input.emailProblem && input.recipientEmail) {
      parts.push(`Sent: ${input.sentCount} emailed to ${input.recipientEmail} for filing.`)
    }
    const couldNot: string[] = [...input.notSent]
    if (input.emailProblem) couldNot.push(`the email (${input.emailProblem})`)
    if (couldNot.length > 0) parts.push(`Couldn't send: ${couldNot.join(', ')}.`)
    if (input.stampError) parts.push(`Export stopped before the rest (${input.stampError}); try again for them.`)
    if (input.backupSkipped.length > 0) parts.push(`Storage backup skipped: ${input.backupSkipped.join(', ')}.`)
  }
  if (input.skipped.length > 0) parts.push(`Already exported, left as it was: ${input.skipped.join(', ')}.`)
  if (n > 0 && (input.notSent.length > 0 || input.emailProblem || input.stampError)) parts.push(EXPORT_RECOVER_HINT)
  return parts.join(' ')
}

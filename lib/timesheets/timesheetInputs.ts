/**
 * Whether the inputs a timesheet is priced from have loaded: the organisation settings (working-hours policy,
 * payment runs, zone) and the pay-rate history. Until both are `loaded`, sign-off, Generate invoice, export and
 * building `weeklyReportOverride` are blocked — a failed or slow load must never be priced as
 * `emptyDayRateHistory()` / `DEFAULT_PAYROLL_POLICY` / `DEFAULT_INVOICING` (rulebook §8: a failed history load is
 * never treated as empty).
 */
import { timesheetSnapshotReady } from '@/lib/canonical'

export type TimesheetInputLoad = 'loading' | 'loaded' | 'failed'

/** 1.43.0: the period page could not check the person's earlier timesheets; nothing is saved until a Retry loads it. */
export const TIMESHEET_HISTORY_LOAD_FAILED_MESSAGE = "Couldn't check older timesheets — try again."

export type TimesheetInputsState = {
  ready: boolean
  failed: boolean
  message: string | null
  retry: () => void
}

export const TIMESHEET_INPUTS_LOADING_MESSAGE = 'Loading pay settings and rate history…'
export const TIMESHEET_INPUTS_FAILED_MESSAGE =
  'Could not load the pay settings or pay-rate history, so this timesheet cannot be signed, invoiced or exported yet.'

export function timesheetInputsStatus(input: {
  details: TimesheetInputLoad
  history: TimesheetInputLoad
}): { ready: boolean; failed: boolean; message: string | null } {
  if (input.details === 'failed' || input.history === 'failed') {
    return { ready: false, failed: true, message: TIMESHEET_INPUTS_FAILED_MESSAGE }
  }
  if (input.details === 'loaded' && input.history === 'loaded') return { ready: true, failed: false, message: null }
  return { ready: false, failed: false, message: TIMESHEET_INPUTS_LOADING_MESSAGE }
}

/** A ready state for callers that already hold loaded inputs (tests, other screens). */
export const TIMESHEET_INPUTS_READY: TimesheetInputsState = { ready: true, failed: false, message: null, retry: () => {} }

/** Thrown by a save that would build or write pay figures before the inputs loaded. */
export class TimesheetInputsNotReadyError extends Error {
  constructor(message: string = TIMESHEET_INPUTS_FAILED_MESSAGE) {
    super(message)
    this.name = 'TimesheetInputsNotReadyError'
  }
}

/**
 * Rulebook 1.43.0 (`timesheetSnapshotReady`): the pay inputs AND the period's bookings, as one state for every screen
 * that signs, counter-signs, invoices or exports a sheet (each builds or stamps `weeklyReportOverride`). `bookingsLoaded`
 * is a server answer of the booking listeners' whole query (the stores' `coverage`), never cached or partial rows.
 */
export function withBookingsGate(
  inputs: TimesheetInputsState,
  bookings: { bookingsLoaded: boolean; bookingsFailed?: boolean }
): TimesheetInputsState {
  if (!inputs.ready) return inputs
  const snapshot = timesheetSnapshotReady({
    bookingsLoaded: bookings.bookingsLoaded,
    bookingsFailed: bookings.bookingsFailed === true,
    payProfileLoaded: true,
    rateHistoryLoaded: true,
  })
  return snapshot.ready ? inputs : { ready: false, failed: snapshot.failed, message: snapshot.message, retry: inputs.retry }
}

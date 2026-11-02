/**
 * Lower bound of the live bookings and managerSiteBookings listeners.
 *
 * The rule is canonical `bookingLoadStart` (lib/canonical/scheduleSources.ts), the same
 * function iOS calls in `FirebaseBackend.launchScheduleLowerBound` / `noteScheduleNeedsDate`:
 * the download starts at the earlier of this week's Monday and the warning window start,
 * and moves earlier (reload) when a screen asks for an older day. A screen that needs the
 * whole archive (weekly report, timesheets history, job totals) asks for full history,
 * like iOS `noteScheduleNeedsFullHistory`.
 *
 * This file only builds the inputs and the Firestore bound; it decides nothing itself.
 */
import { where, type QueryConstraint } from 'firebase/firestore'
import { bookingLoadStart, organizationTimeZone } from '@/lib/canonical'
import {
  parseInvoicing,
  parseWarningDetection,
  resolveWarningDetectionRaw,
} from '@/lib/canonical/organizationSettings'
import { computeWarningCoverageWindow } from '@/lib/warnings/warningLookahead'
import { addLondonDays, dateFromDayKey, dayKey, startOfLondonWeek } from '@/lib/ios-parity/londonTime'

export type BookingDownload = {
  /** First day the live listener covers; null with `fullHistory` false means nothing is loaded yet. */
  loadedFromDayKey: string | null
  fullHistory: boolean
}

export type BookingDownloadRequest = {
  /** A screen needs bookings from this day (organisation day key, YYYY-MM-DD). */
  fromDayKey?: string | null
  /** A screen needs every booking ever written. */
  fullHistory?: boolean
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Days the launch download must cover: this week's Monday and the warning window start.
 * Without the organisation document the warning window is not known yet, so the first day of
 * the previous month stands in: every warning window (N days from today, this working week, or
 * the payment-run segment containing today) starts on or after it.
 */
export function launchBookingNeededDayKeys(
  now: Date,
  organizationData: Record<string, unknown> | null | undefined
): string[] {
  const timeZone = organizationTimeZone(
    typeof organizationData?.countryCode === 'string' ? organizationData.countryCode : null
  )
  const monday = dayKey(startOfLondonWeek(now, timeZone), timeZone)
  if (organizationData) {
    try {
      const settings = record(organizationData.settings) ?? {}
      const detection = parseWarningDetection(
        resolveWarningDetectionRaw(organizationData.warningDetection, settings.warningDetection)
      )
      const invoicing = parseInvoicing(record(organizationData.invoicing))
      const window = computeWarningCoverageWindow(now, detection, invoicing, timeZone)
      return [monday, window.startDayKey]
    } catch {
      /* Fall through to the widest window. */
    }
  }
  const today = dayKey(now, timeZone)
  const [year, month] = today.split('-').map(Number)
  const previous = month === 1 ? `${year - 1}-12-01` : `${year}-${String(month - 1).padStart(2, '0')}-01`
  return [monday, previous]
}

/** Where the download must now start, via canonical `bookingLoadStart`. */
export function nextBookingDownload(
  current: BookingDownload,
  launchNeeded: readonly string[],
  request?: BookingDownloadRequest
): BookingDownload & { changed: boolean } {
  if (current.fullHistory) return { ...current, changed: false }
  if (request?.fullHistory) return { loadedFromDayKey: null, fullHistory: true, changed: true }
  const start = bookingLoadStart({
    loadedFromDayKey: current.loadedFromDayKey,
    fullHistory: false,
    neededDayKeys: [...launchNeeded, request?.fromDayKey ?? null],
  })
  const changed = start.startDayKey !== current.loadedFromDayKey
  return { loadedFromDayKey: start.startDayKey, fullHistory: start.startDayKey === null, changed }
}

/** Stable listener id for subscribeOrgCollection. */
export function bookingDownloadQueryId(download: BookingDownload): string {
  return download.fullHistory || !download.loadedFromDayKey ? '' : `from:${download.loadedFromDayKey}`
}

/**
 * Firestore bound on the booking `date` Timestamp (single-field range, no composite index).
 * One extra day of margin: bookings are stored at London midnight, and an organisation in
 * another zone must not lose its first day to a few hours' offset.
 */
export function bookingDownloadConstraints(download: BookingDownload): QueryConstraint[] {
  if (download.fullHistory || !download.loadedFromDayKey) return []
  const start = addLondonDays(dateFromDayKey(download.loadedFromDayKey), -1)
  return [where('date', '>=', start)]
}

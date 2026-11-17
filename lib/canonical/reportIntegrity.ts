/**
 * Rulebook 1.65.0 §25 / §26 (mass-assignment audit 17 Nov, owner decision B): a server-side check that a saved PAYE
 * overtime report (`overtimeReports/{id}`) or price work / expenses report (`payeClaimReports/{id}`) agrees with the
 * records it was built from.
 *
 * Both reports are created by the person, once, from their own device (the security rules accept the person's own
 * create and cannot walk its lists). A changed app, or a hand-made write, could therefore save figures that are not the
 * reviewed or live ones. This check never blocks, edits or deletes a report: the `reportIntegrityChecks` Cloud Function
 * runs it when a report is created and stores the result as a flag that only admins read
 * (`organizations/{orgId}/reportChecks/{reportId}`, `REPORT_CHECKS_COLLECTION`).
 *
 * What is compared (stored data only, every figure from the rulebook):
 *   - Overtime: the stored totals against the sum of the stored lines; each booking once; a line the line manager
 *     declined (or an approved red X deleted) must be 0h; every other line must carry its booking's fingerprint, its
 *     review (`overtimeReviews/{userId}_{bookingId}`) must exist with that same fingerprint, and its clock hours,
 *     multiplier and overtime hours are priced again with `overtimeForBooking` under the working hours in effect that
 *     day — from the live booking while unchanged, else from the booking the fingerprint describes. The report's own
 *     clock hours and multiplier are never trusted.
 *   - Price work / expenses: the stored totals against the sum of the stored items (`payeClaimsTotal`); each item once;
 *     each item must
 *     exist, be the person's, have the same amount (`roundPennies`); an item a reviewer rejected for that same version
 *     (`payeClaimReviewState`) is noted, not refused (the review never gates the report, 1.32.0).
 * A booking or item changed or deleted after the report was made is not a mismatch (the report is simply older); only
 * a figure that cannot have come from the records at the time is flagged.
 */
import { overtimeFingerprintsMatch } from './bookingFingerprint'
import { idKey } from './personIds'
import { roundPennies } from './payRate'
import {
  overtimeBookingFingerprint,
  overtimeForBooking,
  parseOvertimeReportDocument,
  parseOvertimeReviewDocument,
  type OvertimeBookingInput,
  type OvertimeOrganization,
} from './payeOvertime'
import { parseExpenseDocument, parsePayeClaimReportDocument, parsePriceWorkDocument, payeClaimsTotal, type PayeClaimItem } from './payeClaims'
import { parsePayeClaimReviewDocument, payeClaimReviewState } from './payeClaimReviews'

/** Where the server stores one check per report (admins read; nobody but the server writes). */
export const REPORT_CHECKS_COLLECTION = 'reportChecks'

export type ReportIntegrityProblemCode =
  | 'totals_differ'
  | 'line_count_differs'
  | 'missing_fingerprint'
  | 'clock_differs'
  | 'duplicate_line'
  | 'duplicate_item'
  | 'declined_line_counted'
  | 'not_reviewed'
  | 'differs_from_review'
  | 'hours_differ'
  | 'item_missing'
  | 'not_their_item'
  | 'amount_differs'
  | 'rejected_item'

export type ReportIntegrityProblem = {
  code: ReportIntegrityProblemCode
  /** The booking or item the problem is about ('' for the totals). */
  recordId: string
  message: string
  /** `note`: worth a look, not a wrong figure (a rejected item in a claims report). */
  severity: 'mismatch' | 'note'
}

export type ReportIntegrityResult = {
  ok: boolean
  kind: 'overtime' | 'priceWork' | 'expense'
  userId: string
  /** The report's own total (hours for overtime, money for claims) and the total worked out again here. */
  reportedTotal: number
  recomputedTotal: number
  problems: ReportIntegrityProblem[]
}

const EPSILON = 0.011

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function storedNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

const ZERO_STATES = new Set(['returnedDeclined', 'deleted'])
const ZERO_DECISIONS = new Set(['declined', 'deleted', 'cancelled'])

/**
 * The booking a fingerprint (`dayKey|slot|start|end|rate|nb|status`, `overtimeBookingFingerprint`) describes, so a line
 * whose booking changed or was deleted after the report is still priced from the booking as reviewed — never from the
 * report's own clock hours or multiplier. Null when the fingerprint is blank or has no day.
 */
function bookingFromFingerprint(id: string, fingerprint: string): OvertimeBookingInput | null {
  const parts = text(fingerprint).split('|')
  if (parts.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) return null
  const rate = parts[4] === '' ? null : Number(parts[4])
  return {
    id,
    personId: '',
    dayKey: parts[0],
    timeSlot: parts[1] || null,
    workStartTime: parts[2] || null,
    workEndTime: parts[3] || null,
    otMultiplierOverride: rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
    isBreakRemoved: parts[5] === 'nb',
    status: parts[6] || null,
  }
}

/**
 * Checks a saved overtime report against its reviews and the bookings they describe.
 * `reviews` are the `overtimeReviews` documents of the report's person (`{ id, data }`); `bookings` the live labour and
 * manager site bookings the report names, as `OvertimeBookingInput` (missing ones are simply absent).
 *
 * Every counted line must carry the booking's fingerprint, that fingerprint must be the one its review stored, and the
 * line's clock hours, multiplier and overtime hours must be the ones `overtimeForBooking` gives for that booking (the
 * live booking while unchanged, else the booking as the fingerprint describes it). A booking named twice is flagged.
 */
export function overtimeReportIntegrity(input: {
  reportId: string
  report: Record<string, unknown> | null | undefined
  reviews?: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }> | null
  bookings?: ReadonlyArray<OvertimeBookingInput> | null
  organization: OvertimeOrganization
  timeZone?: string | null
}): ReportIntegrityResult {
  const raw = record(input.report)
  const report = parseOvertimeReportDocument(input.reportId, raw)
  const problems: ReportIntegrityProblem[] = []
  const sum = round2(report.lines.reduce((total, line) => total + line.overtimeHours, 0))
  const storedTotals = record(raw.totals)
  const storedHours = storedNumber(storedTotals.overtimeHours)
  const storedCount = storedNumber(storedTotals.lineCount)
  if (storedHours != null && Math.abs(round2(storedHours) - sum) > EPSILON) {
    problems.push({
      code: 'totals_differ',
      recordId: '',
      severity: 'mismatch',
      message: `The report's total is ${round2(storedHours)}h but its lines add up to ${sum}h.`,
    })
  }
  if (storedCount != null && storedCount !== report.lines.length) {
    problems.push({
      code: 'line_count_differs',
      recordId: '',
      severity: 'mismatch',
      message: `The report says ${storedCount} lines but lists ${report.lines.length}.`,
    })
  }
  const reviews = (input.reviews || []).map((row) => parseOvertimeReviewDocument(row.id, row.data))
  const bookings = new Map((input.bookings || []).filter(Boolean).map((booking) => [idKey(booking.id), booking]))
  const seen = new Set<string>()
  let recomputed = 0
  for (const line of report.lines) {
    const id = line.bookingId
    const label = `${line.dayLabel || line.dayKey} ${line.jobNumber}`.trim()
    const key = idKey(id)
    if (!key || seen.has(key)) {
      problems.push({
        code: 'duplicate_line',
        recordId: id,
        severity: 'mismatch',
        message: key ? `${label}: this booking is listed more than once.` : `${label}: the line names no booking.`,
      })
      continue
    }
    seen.add(key)
    const zero = ZERO_STATES.has(text(line.state)) || line.declined === true
    if (zero && line.overtimeHours > EPSILON) {
      problems.push({
        code: 'declined_line_counted',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: a declined or removed line counts ${line.overtimeHours}h (it should be 0h).`,
      })
    }
    const fingerprint = text(line.fingerprint)
    const review = reviews.find((row) => idKey(row.bookingId) === key && idKey(row.userId) === idKey(report.userId))
    if (!review) {
      problems.push({
        code: 'not_reviewed',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: no confirmation or line-manager decision is stored for this line.`,
      })
    } else if (ZERO_DECISIONS.has(review.decision) && line.overtimeHours > EPSILON) {
      problems.push({
        code: 'declined_line_counted',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: the line was ${review.decision} but the report counts ${line.overtimeHours}h.`,
      })
    }
    if (zero || (review && ZERO_DECISIONS.has(review.decision))) continue
    if (!fingerprint) {
      problems.push({
        code: 'missing_fingerprint',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: the line does not say which booking it was priced from.`,
      })
      continue
    }
    if (review && !overtimeFingerprintsMatch(review.fingerprint, fingerprint)) {
      problems.push({
        code: 'differs_from_review',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: the report's booking is not the one that was reviewed.`,
      })
    }
    const live = bookings.get(key)
    const booking = live && overtimeFingerprintsMatch(overtimeBookingFingerprint(live), fingerprint) ? live : bookingFromFingerprint(id, fingerprint)
    if (booking && text(line.dayKey) && text(line.dayKey) !== text(booking.dayKey)) {
      problems.push({
        code: 'differs_from_review',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: the line's day is not the booking's day.`,
      })
    }
    const figures = booking ? overtimeForBooking({ booking, organization: input.organization, timeZone: input.timeZone }) : null
    const priced = figures ? figures.overtimeHours : 0
    const clock = figures ? figures.clockHours : 0
    const multiplier = figures ? figures.multiplier : null
    if (
      Math.abs(clock - line.clockHours) > EPSILON ||
      (multiplier != null && Math.abs(multiplier - line.multiplier) > 0.001)
    ) {
      problems.push({
        code: 'clock_differs',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: the report says ${line.clockHours}h × ${line.multiplier}; the booking gives ${clock}h × ${multiplier ?? '—'}.`,
      })
    }
    if (Math.abs(priced - line.overtimeHours) > EPSILON) {
      problems.push({
        code: 'hours_differ',
        recordId: id,
        severity: 'mismatch',
        message: `${label}: the report says ${line.overtimeHours}h; the booking gives ${priced}h.`,
      })
    }
    recomputed += priced
  }
  return {
    ok: problems.length === 0,
    kind: 'overtime',
    userId: report.userId,
    reportedTotal: round2(storedHours ?? sum),
    recomputedTotal: round2(recomputed),
    problems,
  }
}

/**
 * Checks a saved price work or expenses report against the stored items and their reviews.
 * `items` are the `priceWorkItems` / `expenseItems` documents the report names (`{ id, data }`; a missing one is absent);
 * `reviews` the `payeClaimReviews` documents of those items.
 */
export function payeClaimReportIntegrity(input: {
  reportId: string
  report: Record<string, unknown> | null | undefined
  items?: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }> | null
  reviews?: ReadonlyArray<{ id: string; data: Record<string, unknown> | null | undefined }> | null
  timeZone?: string | null
  organizationId?: string | null
  /** Every id the report's person goes by (`personIdSet`); the report's `userId` when not given. */
  personIds?: ReadonlyArray<string> | null
}): ReportIntegrityResult {
  const raw = record(input.report)
  const report = parsePayeClaimReportDocument(input.reportId, raw)
  const problems: ReportIntegrityProblem[] = []
  const sum = payeClaimsTotal(report.items)
  const storedTotals = record(raw.totals)
  const storedAmount = storedNumber(storedTotals.amount)
  const storedCount = storedNumber(storedTotals.itemCount)
  if (storedAmount != null && Math.abs(roundPennies(storedAmount) - roundPennies(sum)) > 0.001) {
    problems.push({
      code: 'totals_differ',
      recordId: '',
      severity: 'mismatch',
      message: `The report's total is ${roundPennies(storedAmount).toFixed(2)} but its items add up to ${roundPennies(sum).toFixed(2)}.`,
    })
  }
  if (storedCount != null && storedCount !== report.items.length) {
    problems.push({
      code: 'line_count_differs',
      recordId: '',
      severity: 'mismatch',
      message: `The report says ${storedCount} items but lists ${report.items.length}.`,
    })
  }
  const ids = new Set([report.userId, ...(input.personIds || [])].map(idKey).filter(Boolean))
  const options = { timeZone: input.timeZone, organizationId: input.organizationId }
  const live = new Map<string, PayeClaimItem>()
  for (const row of input.items || []) {
    if (!row || !row.data) continue
    const item = report.kind === 'priceWork' ? parsePriceWorkDocument(row.id, row.data, options) : parseExpenseDocument(row.id, row.data, options)
    live.set(idKey(row.id), item)
  }
  const reviews = (input.reviews || []).map((row) => parsePayeClaimReviewDocument(row.id, row.data))
  let recomputed = 0
  const seenItems = new Set<string>()
  for (const entry of report.items) {
    const itemKey = idKey(entry.id)
    if (!itemKey || seenItems.has(itemKey)) {
      problems.push({
        code: 'duplicate_item',
        recordId: entry.id,
        severity: 'mismatch',
        message: itemKey ? `"${entry.title || entry.id}" is listed more than once.` : `"${entry.title}" names no item.`,
      })
      continue
    }
    seenItems.add(itemKey)
    const item = live.get(itemKey)
    const label = entry.title || entry.id
    if (!item) {
      problems.push({
        code: 'item_missing',
        recordId: entry.id,
        severity: 'mismatch',
        message: `"${label}" is in the report but no longer stored (deleted after the report, or never saved).`,
      })
      recomputed += entry.amount
      continue
    }
    if (!ids.has(idKey(item.userId))) {
      problems.push({
        code: 'not_their_item',
        recordId: entry.id,
        severity: 'mismatch',
        message: `"${label}" belongs to someone else.`,
      })
      continue
    }
    if (Math.abs(roundPennies(item.amount) - roundPennies(entry.amount)) > 0.001) {
      problems.push({
        code: 'amount_differs',
        recordId: entry.id,
        severity: 'mismatch',
        message: `"${label}": the report says ${roundPennies(entry.amount).toFixed(2)}; the stored item is ${roundPennies(item.amount).toFixed(2)}.`,
      })
    }
    recomputed += item.amount
    if (payeClaimReviewState(item, reviews).state === 'rejected') {
      problems.push({
        code: 'rejected_item',
        recordId: entry.id,
        severity: 'note',
        message: `"${label}" was rejected by a reviewer.`,
      })
    }
  }
  return {
    ok: problems.every((problem) => problem.severity === 'note'),
    kind: report.kind,
    userId: report.userId,
    reportedTotal: roundPennies(storedAmount ?? sum),
    recomputedTotal: roundPennies(recomputed),
    problems,
  }
}

/** The document the server stores at `organizations/{orgId}/reportChecks/{reportId}` (the app adds `checkedAt`). */
export function reportCheckWriteFields(input: {
  reportId: string
  collection: 'overtimeReports' | 'payeClaimReports'
  result: ReportIntegrityResult
}): Record<string, unknown> {
  return {
    reportId: text(input.reportId),
    collection: input.collection,
    kind: input.result.kind,
    userId: input.result.userId,
    ok: input.result.ok,
    reportedTotal: input.result.reportedTotal,
    recomputedTotal: input.result.recomputedTotal,
    problems: input.result.problems.map((problem) => ({ ...problem })),
  }
}

/** Reads `reportChecks/{id}` (Data health). Never throws. */
export function parseReportCheckDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined
): {
  id: string
  reportId: string
  collection: string
  kind: string
  userId: string
  ok: boolean
  reportedTotal: number
  recomputedTotal: number
  problems: ReportIntegrityProblem[]
} {
  const row = record(data)
  return {
    id: text(docId),
    reportId: text(row.reportId) || text(docId),
    collection: text(row.collection),
    kind: text(row.kind),
    userId: text(row.userId),
    ok: row.ok === true,
    reportedTotal: storedNumber(row.reportedTotal) ?? 0,
    recomputedTotal: storedNumber(row.recomputedTotal) ?? 0,
    problems: (Array.isArray(row.problems) ? row.problems : []).map((raw) => {
      const p = record(raw)
      return {
        code: text(p.code) as ReportIntegrityProblemCode,
        recordId: text(p.recordId),
        message: text(p.message),
        severity: text(p.severity) === 'note' ? 'note' : 'mismatch',
      }
    }),
  }
}

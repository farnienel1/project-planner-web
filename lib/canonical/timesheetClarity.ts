/**
 * Rulebook 1.77.0 §8 (owner decisions 23 Nov, points 1, 2, 3, 5 and 6): what a timesheet says about itself, the same on
 * web and iOS. Wording and display only — every decision is the existing rules': `signedTimesheetBookingChanges`
 * (1.47.0, with the 1.74.0 reviewer edits), `timesheetChangesWithLateExtras` (1.54.0), `timesheetSignedEntryChanges`
 * (1.76.0), `timesheetMakeChangesAction` (1.76.0), `timesheetRevisionDue` / `canCreateTimesheetRevision` (1.55.0) and
 * `timesheetOwnerCanAddLateExtras` (1.54.0). Nothing here writes, prices or decides who may do what.
 *
 * - `timesheetNextStep` — one "whose turn / what next" line at the top of every timesheet (point 2), including
 *   "Signed off — next: generate your invoice" (point 5).
 * - `signedTimesheetChangeDetails` — the "Changed since you signed" card: one row per changed, added or removed
 *   booking (before → after) and per signed price work / expense whose pay changed (point 3).
 * - `timesheetCorrectionOption` — the one "Correct this timesheet" entry point over the existing correction paths
 *   (point 1).
 * - `timesheetReportWaiting` / `TIMESHEET_REPORT_AWAITING_RESIGN_LABEL` / `TIMESHEET_REPORT_AWAITING_APPROVAL_LABEL` /
 *   `TIMESHEET_SNAPSHOT_AWAITING_APPROVAL_LABEL` — the weekly report check line and the Payrun Snapshot say whom a
 *   waiting sheet waits for, and the check line when it shows the last signed figures (point 6, owner chose (a)).
 */

import { overtimeBookingFingerprint } from './payeOvertime'
import { bookingFingerprintSlot } from './bookingFingerprint'
import { formatMoney } from './money'
import { documentInstantMs } from './peopleDocuments'
import { normalizeDocumentId } from './scheduleSources'
import {
  signedTimesheetBookingChanges,
  signedTimesheetBookingPlace,
  signedTimesheetChangeForReports,
  signedTimesheetLineBookingKey,
  type SignedTimesheetBookingDocument,
  type SignedTimesheetLine,
  type SignedTimesheetSheet,
} from './timesheetBookingChanges'
import { timesheetSignedEntryChanges, type TimesheetSignedEntryChange } from './timesheetLateExtras'
import { isTimesheetManagerSigned, isTimesheetOperativeSigned, parseTimesheetStatusFields, resolveTimesheetExportedAtMs } from './timesheetPeriod'
import { timesheetMakeChangesAction, TIMESHEET_MAKE_CHANGES_REOPEN_HELP } from './timesheetMakeChanges'
import { timesheetRevisionIsDraft } from './timesheetRevisionDraft'
import { dayKeyInZone } from '../orgTime/zoneTime'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayParts(dayKey: string): { weekday: number; day: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(dayKey))
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  // A calendar date's weekday is the same in every time zone.
  return { weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), day: d, month: m - 1 }
}

/** "Tue 11 Nov" for an organisation-zone day key ('' when it is not one). */
export function timesheetChangeDayLabel(dayKey: string): string {
  const parts = dayParts(dayKey)
  return parts ? `${WEEKDAYS_SHORT[parts.weekday]} ${parts.day} ${MONTHS_SHORT[parts.month]}` : ''
}

/** "Tuesday 11 Nov" (screen readers). */
function longDayLabel(dayKey: string): string {
  const parts = dayParts(dayKey)
  return parts ? `${WEEKDAYS_LONG[parts.weekday]} ${parts.day} ${MONTHS_SHORT[parts.month]}` : ''
}

// MARK: - Booking fingerprints (read back)

/** One booking as a fingerprint describes it (`overtimeBookingFingerprint`: `dayKey|slot|start|end|rate|nb|status`). */
export type TimesheetBookingFingerprintParts = {
  dayKey: string
  /** Canonical slot (`bookingFingerprintSlot`): `FULL DAY`, `AM`, `PM`, `CUSTOM_HOURS` … ('' when none). */
  slot: string
  start: string
  finish: string
  /** The booking's own overtime rate; null = the organisation's. */
  rate: number | null
  breakRemoved: boolean
}

/**
 * Rulebook 1.77.0: a stored booking fingerprint read back into its parts, or null when blank or not a fingerprint
 * (fewer than six parts). Nothing is guessed: a part that is blank stays blank.
 */
export function parseTimesheetBookingFingerprint(fingerprint: unknown): TimesheetBookingFingerprintParts | null {
  const value = text(fingerprint)
  if (!value) return null
  const parts = value.split('|')
  if (parts.length < 6) return null
  const rateNumber = Number(parts[4])
  return {
    dayKey: text(parts[0]),
    slot: text(parts[1]) ? bookingFingerprintSlot(parts[1]) : '',
    start: text(parts[2]),
    finish: text(parts[3]),
    rate: text(parts[4]) && Number.isFinite(rateNumber) ? rateNumber : null,
    breakRemoved: text(parts[5]) === 'nb',
  }
}

/** "07:00–16:00", "Full day", "AM", "PM" (or '' when nothing is known). */
function timesText(parts: Pick<TimesheetBookingFingerprintParts, 'slot' | 'start' | 'finish'>): string {
  if (parts.start && parts.finish) return `${parts.start}–${parts.finish}`
  if (parts.slot === 'FULL DAY') return 'Full day'
  if (parts.slot === 'AM' || parts.slot === 'PM') return parts.slot
  if (parts.slot === 'OVERTIME') return 'Overtime'
  return parts.start || parts.finish || ''
}

// MARK: - Places

export type TimesheetChangeJob = { id: string; jobNumber?: string | null; name?: string | null }

const PLACE_LABELS: Record<string, string> = {
  office: 'Office',
  working_from_home: 'Working from home',
  site_survey: 'Site survey',
}

function jobLabel(jobId: string, jobs: ReadonlyMap<string, TimesheetChangeJob>): string {
  const job = jobs.get(normalizeDocumentId(jobId))
  if (!job) return ''
  const number = text(job.jobNumber)
  const name = text(job.name)
  return number && name ? `${number} · ${name}` : number || name
}

/** A `signedTimesheetBookingPlace` key as a label ("J-1042 · Carnaby St", "Office", a custom place), '' when unknown. */
function placeLabel(place: string, jobs: ReadonlyMap<string, TimesheetChangeJob>, customName?: string): string {
  if (!place) return ''
  const [kind, id, custom] = place.split('|')
  if (kind === 'job') return jobLabel(id ?? '', jobs) || 'A job'
  if (PLACE_LABELS[kind]) return PLACE_LABELS[kind]
  if (kind === 'project' || kind === 'small_work' || kind === 'smallworks' || kind === 'small_works') return jobLabel(id ?? '', jobs) || 'A job'
  const name = text(customName) || text(custom)
  if (name) return name.charAt(0).toUpperCase() + name.slice(1)
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, ' ') : ''
}

// MARK: - Change details (point 3)

export type TimesheetChangeSide = {
  dayKey: string
  dayLabel: string
  start: string
  finish: string
  slot: string
  /** "07:00–16:00", "Full day", "AM" … */
  timesText: string
  /** "×2" when the booking has its own overtime rate, else null. */
  rateText: string | null
  breakRemoved: boolean
  /** Where the booking is: a job ("J-1042 · Carnaby St"), Office … ('' when unknown). */
  placeLabel: string
  /** The stored place key (`signedTimesheetBookingPlace`), '' when unknown. */
  place: string
  /** Older signed copies only: the line's stored wording, shown as stored when no fingerprint is held. */
  storedText: string | null
}

export type TimesheetChangeKind = 'added' | 'removed' | 'changed'
export type TimesheetChangePart = 'times' | 'job' | 'rate' | 'break' | 'day'

export type TimesheetChangeRow = {
  key: string
  type: 'booking' | 'entry'
  kind: TimesheetChangeKind
  /** Chip text: Added / Removed / Changed. */
  chipLabel: string
  /** Chip colour: added green, removed red, changed amber. */
  tone: 'green' | 'red' | 'amber'
  /** Booking rows: the day ("Tue 11 Nov"); entry rows ''. */
  dayKey: string
  dayLabel: string
  /** Booking rows: the job or place; entry rows: "Price work · {title}" / "Expense · {title}". */
  title: string
  /** What it was (struck through), null when added. */
  beforeText: string | null
  /** What it is now (bold), null when removed. */
  afterText: string | null
  changedParts: TimesheetChangePart[]
  /** Booking rows only. */
  bookingId: string | null
  before: TimesheetChangeSide | null
  after: TimesheetChangeSide | null
  /** One sentence for screen readers. */
  accessibilityLabel: string
}

export type SignedTimesheetChangeDetails = {
  rows: TimesheetChangeRow[]
  bookingRows: number
  entryRows: number
  /** The first changed booking's day ("Tue 11 Nov"), or '' — what `timesheetNextStep` names. */
  firstDayLabel: string
  /** The card heading: `TIMESHEET_CHANGE_DETAILS_HEADING`. */
  heading: string
  /** "2 bookings and 1 expense changed" … ('' with no rows). */
  summary: string
  /** Rows the card shows before "Show all (N)" (`TIMESHEET_CHANGE_DETAILS_COLLAPSED_ROWS`). */
  collapsedCount: number
  showAllLabel: string | null
}

export const TIMESHEET_CHANGE_DETAILS_HEADING = 'Changed since you signed'
/** The heading the reviewer sees (the line manager signed the copy being compared). */
export const TIMESHEET_CHANGE_DETAILS_REVIEWER_HEADING = 'Changed since it was signed'
export const TIMESHEET_CHANGE_DETAILS_COLLAPSED_ROWS = 3
/** Review of 1.77.0 (nit c): the chip of a self-signed sheet's snapshot-gap booking (on the sheet, not in its signed copy). */
export const TIMESHEET_CHANGE_NOT_IN_SIGNED_COPY_LABEL = 'Not in your signed copy'
const CHIP: Record<TimesheetChangeKind, { label: string; tone: 'green' | 'red' | 'amber' }> = {
  added: { label: 'Added', tone: 'green' },
  removed: { label: 'Removed', tone: 'red' },
  changed: { label: 'Changed', tone: 'amber' },
}
const PART_WORDS: Record<TimesheetChangePart, string> = {
  times: 'times',
  job: 'job',
  rate: 'overtime rate',
  break: 'unpaid break',
  day: 'day',
}

type RefRow = { fingerprint: string; place: string; storedText: string | null; dayKey: string; storedJob: string }

function snapshotDayKey(raw: unknown, timeZone: string): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  const ms = documentInstantMs(raw as never)
  return ms == null ? '' : dayKeyInZone(new Date(ms), timeZone)
}

function sideFrom(
  ref: { fingerprint: string; place: string; storedText?: string | null; dayKey?: string; storedJob?: string; customName?: string },
  jobs: ReadonlyMap<string, TimesheetChangeJob>
): TimesheetChangeSide {
  const parts = parseTimesheetBookingFingerprint(ref.fingerprint)
  const dayKey = parts?.dayKey || text(ref.dayKey)
  const label = placeLabel(ref.place, jobs, ref.customName) || text(ref.storedJob)
  return {
    dayKey,
    dayLabel: timesheetChangeDayLabel(dayKey),
    start: parts?.start ?? '',
    finish: parts?.finish ?? '',
    slot: parts?.slot ?? '',
    timesText: parts ? timesText(parts) : '',
    rateText: parts?.rate != null ? `×${parts.rate}` : null,
    breakRemoved: parts?.breakRemoved === true,
    placeLabel: label,
    place: ref.place,
    storedText: parts ? null : text(ref.storedText) || null,
  }
}

function sideText(side: TimesheetChangeSide, parts: ReadonlyArray<TimesheetChangePart> | null): string {
  const show = (part: TimesheetChangePart) => parts == null || parts.includes(part)
  const out: string[] = []
  if (parts != null && show('day') && side.dayLabel) out.push(side.dayLabel)
  if (parts != null && show('job') && side.placeLabel) out.push(side.placeLabel)
  const times = side.timesText || side.storedText || ''
  if (times) out.push(times)
  if (side.rateText && (parts == null || show('rate'))) out.push(`OT ${side.rateText}`)
  if (show('rate') && parts != null && !side.rateText) out.push('organisation OT rate')
  if (show('break') && side.breakRemoved) out.push('no unpaid break')
  if (show('break') && parts != null && !side.breakRemoved) out.push('unpaid break taken off')
  return out.join(' · ')
}

/** A place label good enough to compare ("A job" names no job, so it is never compared). */
function comparablePlaceLabel(side: TimesheetChangeSide): string {
  const label = text(side.placeLabel)
  return label && label !== 'A job' ? label.toLowerCase() : ''
}

function changedPartsOf(before: TimesheetChangeSide, after: TimesheetChangeSide): TimesheetChangePart[] {
  const parts: TimesheetChangePart[] = []
  if (before.dayKey && after.dayKey && before.dayKey !== after.dayKey) parts.push('day')
  if (before.place && after.place) {
    if (before.place !== after.place) parts.push('job')
  } else {
    // Review of 1.77.0 (nit b): one side's place key is unknown (an older signed copy holds only its stored job words) —
    // compare the job words when both sides name a job, never present a job move as a times change.
    const left = comparablePlaceLabel(before)
    const right = comparablePlaceLabel(after)
    if (left && right && left !== right) parts.push('job')
  }
  if (before.timesText && after.timesText && before.timesText !== after.timesText) parts.push('times')
  if (before.timesText && after.timesText && before.rateText !== after.rateText) parts.push('rate')
  if (before.timesText && after.timesText && before.breakRemoved !== after.breakRemoved) parts.push('break')
  return parts
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * Rulebook 1.77.0 §8 (point 3, owner 23 Nov: "make this really clear and not a clunky looking list"): what changed on a
 * signed timesheet, one row per booking and per signed price work / expense, from exactly the comparison
 * `signedTimesheetBookingChanges` makes (its `changedBookingIds`, `addedBookingIds`, `removedBookingIds` and
 * `snapshotGapBookingIds`, which this function computes from the same input) and `timesheetSignedEntryChanges`.
 *
 * "Before" is what was signed: for a sheet waiting for the person (or exported), the person's current signed record
 * (`operativeSignedBookings`, its fingerprint and place); for a sheet waiting for the line manager, the signed copy's lines
 * (`weeklyReportOverride.lines`, the copy the line manager signed); each falls back to the other. A fingerprint is read
 * back with `parseTimesheetBookingFingerprint`; an older signed line with none shows its stored wording, never a guess.
 * "After" is the booking document as it is now (`liveBookings`), else the live line's fingerprint. Rows are sorted by day,
 * bookings first. Nothing here is a second comparison: a booking is listed only when the rule lists it.
 */
export function signedTimesheetChangeDetails(input: {
  sheet: (SignedTimesheetSheet & Record<string, unknown>) | null | undefined
  liveLines: ReadonlyArray<SignedTimesheetLine | null | undefined> | null | undefined
  liveLoaded: boolean
  selfSigned?: boolean | null
  liveBookings?: ReadonlyArray<SignedTimesheetBookingDocument | null | undefined> | null
  tombstonedBookingIds?: ReadonlyArray<{ collection?: unknown; bookingId?: unknown } | null | undefined> | null
  personIds?: ReadonlyArray<string | null | undefined> | null
  /** Jobs to name (`projects` and `smallWorks` ids with their job number and name). */
  jobs?: ReadonlyArray<TimesheetChangeJob | null | undefined> | null
  timeZone: string
  /** For the signed price work and expenses (1.76.0): the same options `timesheetLateExtrasSummary` takes. */
  entryOptions?: { entryFingerprints?: Record<string, string> | null; exportedAtStored?: boolean | null; sheetDocId?: string | null } | null
  currency?: string | null
  /** The viewer is the sheet's reviewer (heading `TIMESHEET_CHANGE_DETAILS_REVIEWER_HEADING`). */
  viewerIsReviewer?: boolean | null
}): SignedTimesheetChangeDetails {
  const jobs = new Map<string, TimesheetChangeJob>()
  for (const job of input.jobs ?? []) if (job && text(job.id)) jobs.set(normalizeDocumentId(job.id), job)
  const sheet = input.sheet ?? null
  const change = signedTimesheetBookingChanges({
    sheet,
    liveLines: input.liveLines,
    liveLoaded: input.liveLoaded,
    selfSigned: input.selfSigned,
    liveBookings: input.liveBookings,
    tombstonedBookingIds: input.tombstonedBookingIds,
    personIds: input.personIds,
  })

  // What was signed, by booking id (without case): the person's record and the signed copy's lines.
  const record = new Map<string, RefRow>()
  for (const raw of Array.isArray(sheet?.operativeSignedBookings) ? (sheet?.operativeSignedBookings as unknown[]) : []) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const id = normalizeDocumentId(text(row.bookingId))
    if (id && !record.has(id)) record.set(id, { fingerprint: text(row.fingerprint), place: text(row.place), storedText: null, dayKey: '', storedJob: '' })
  }
  const snapshot = new Map<string, RefRow>()
  const override = sheet?.weeklyReportOverride
  for (const raw of Array.isArray(override?.lines) ? override.lines : []) {
    if (!raw || typeof raw !== 'object') continue
    const line = raw as Record<string, unknown>
    if (line.isLeave === true || line.isPayeDay === true) continue
    const key = signedTimesheetLineBookingKey(line as SignedTimesheetLine)
    if (!key) continue
    const id = key.slice(key.indexOf('|') + 1)
    const held = snapshot.get(id)
    const jobNumber = text(line.jobNumber)
    const projectName = text(line.projectName)
    const storedJob = jobNumber && projectName ? `${jobNumber} · ${projectName}` : jobNumber || projectName || PLACE_LABELS[text(line.locationKind)] || ''
    const row: RefRow = {
      fingerprint: text(line.bookingFingerprint),
      place: '',
      storedText: text(line.details) || null,
      dayKey: snapshotDayKey(line.date, input.timeZone),
      storedJob,
    }
    // The booking's standard line first (an overtime line `…-ot` only when nothing else is held).
    if (!held || (!held.fingerprint && row.fingerprint)) snapshot.set(id, row)
  }
  const docs = new Map<string, SignedTimesheetBookingDocument>()
  for (const doc of input.liveBookings ?? []) if (doc && text(doc.bookingId)) docs.set(normalizeDocumentId(doc.bookingId), doc)
  const live = new Map<string, string>()
  for (const line of input.liveLines ?? []) {
    if (!line || line.isLeave === true || line.isPayeDay === true) continue
    const key = signedTimesheetLineBookingKey(line)
    if (!key) continue
    const id = key.slice(key.indexOf('|') + 1)
    const fingerprint = text(line.bookingFingerprint)
    if (!live.has(id) || (!live.get(id) && fingerprint)) live.set(id, fingerprint)
  }

  const preferSnapshot = change.waitingFor === 'lineManager'
  const beforeOf = (id: string): TimesheetChangeSide | null => {
    const fromRecord = record.get(id)
    const fromSnapshot = snapshot.get(id)
    const first = preferSnapshot ? fromSnapshot ?? fromRecord : fromRecord ?? fromSnapshot
    if (!first) return null
    // A record row knows the place; a snapshot row its stored job words.
    const merged: RefRow = {
      fingerprint: first.fingerprint || (first === fromRecord ? fromSnapshot?.fingerprint : fromRecord?.fingerprint) || '',
      place: first.place || fromRecord?.place || '',
      storedText: first.storedText ?? fromSnapshot?.storedText ?? null,
      dayKey: first.dayKey || fromSnapshot?.dayKey || '',
      storedJob: first.storedJob || fromSnapshot?.storedJob || '',
    }
    return sideFrom(merged, jobs)
  }
  const afterOf = (id: string): TimesheetChangeSide | null => {
    const doc = docs.get(id)
    if (doc) {
      const fingerprint = overtimeBookingFingerprint({
        id: doc.bookingId,
        personId: '',
        dayKey: text(doc.dayKey),
        timeSlot: text(doc.timeSlot),
        workStartTime: text(doc.workStartTime) || undefined,
        workEndTime: text(doc.workEndTime) || undefined,
        isBreakRemoved: doc.isBreakRemoved === true,
        otMultiplierOverride: typeof doc.otMultiplierOverride === 'number' ? doc.otMultiplierOverride : null,
      } as Parameters<typeof overtimeBookingFingerprint>[0])
      return sideFrom({ fingerprint, place: signedTimesheetBookingPlace(doc), customName: text(doc.customLocationName) }, jobs)
    }
    const fingerprint = live.get(id)
    if (fingerprint == null) return null
    return sideFrom({ fingerprint, place: '', storedJob: snapshot.get(id)?.storedJob ?? '' }, jobs)
  }

  const rows: TimesheetChangeRow[] = []
  const seen = new Set<string>()
  const add = (bookingId: string, kind: TimesheetChangeKind, chipOverride?: string) => {
    const id = normalizeDocumentId(bookingId)
    if (!id || seen.has(id)) return
    seen.add(id)
    const before = kind === 'added' ? null : beforeOf(id)
    const after = kind === 'removed' ? null : afterOf(id)
    const side = after ?? before
    const dayKey = side?.dayKey ?? ''
    const dayLabel = side?.dayLabel ?? ''
    const title = after?.placeLabel || before?.placeLabel || 'A booking'
    let changedParts: TimesheetChangePart[] = []
    let beforeText: string | null = null
    let afterText: string | null = null
    if (kind === 'changed' && before && after) {
      changedParts = changedPartsOf(before, after)
      // Times are always shown so the row reads on its own; day and job only when they changed. When nothing could be
      // compared (an older signed copy: no fingerprint or place on one side), the job is shown too so a move reads.
      const shown = Array.from(new Set<TimesheetChangePart>(['times', ...(changedParts.length ? changedParts : (['job'] as TimesheetChangePart[]))]))
      beforeText = sideText(before, shown) || null
      afterText = sideText(after, shown) || null
    } else {
      if (before) beforeText = sideText(before, null) || null
      if (after) afterText = sideText(after, null) || null
    }
    const where = [longDayLabel(dayKey), title].filter(Boolean).join(', ')
    const accessibilityLabel =
      kind === 'added'
        ? `${where}: added${afterText ? `, ${afterText}` : ''}`
        : kind === 'removed'
        ? `${where}: removed${beforeText ? `, was ${beforeText}` : ''}`
        : `${where}: ${changedParts.length ? `${changedParts.map((part) => PART_WORDS[part]).join(' and ')} changed` : 'booking changed'}${
            beforeText && afterText ? ` from ${beforeText} to ${afterText}` : ''
          }`
    rows.push({
      key: `booking:${id}`,
      type: 'booking',
      kind,
      chipLabel: chipOverride ?? CHIP[kind].label,
      tone: chipOverride ? 'amber' : CHIP[kind].tone,
      dayKey,
      dayLabel,
      title,
      beforeText,
      afterText,
      changedParts,
      bookingId: bookingId,
      before,
      after,
      accessibilityLabel,
    })
  }
  for (const id of change.changedBookingIds) add(id, 'changed')
  for (const id of change.addedBookingIds) add(id, 'added')
  for (const id of change.removedBookingIds) add(id, 'removed')
  // 1.57.0: a booking the person signed that the signed copy lacks — added to what the line manager signs. On a
  // self-signed sheet nobody else signs: the person's own signed copy lacks it (review of 1.77.0, nit c).
  for (const id of change.snapshotGapBookingIds) add(id, 'added', input.selfSigned === true ? TIMESHEET_CHANGE_NOT_IN_SIGNED_COPY_LABEL : undefined)
  rows.sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0))

  const currency = text(input.currency) || 'GBP'
  const entries: TimesheetSignedEntryChange[] = timesheetSignedEntryChanges(sheet as Record<string, unknown> | null, input.entryOptions ?? {})
  for (const entry of entries) {
    const kind: TimesheetChangeKind = entry.removed ? 'removed' : 'changed'
    const label = `${entry.kind === 'priceWork' ? 'Price work' : 'Expense'}${entry.title ? ` · ${entry.title}` : ''}`
    const beforeText = formatMoney(entry.signedAmount, currency)
    const afterText = entry.removed ? null : formatMoney(entry.paidAmount, currency)
    rows.push({
      key: `entry:${normalizeDocumentId(entry.id)}`,
      type: 'entry',
      kind,
      chipLabel: CHIP[kind].label,
      tone: CHIP[kind].tone,
      dayKey: '',
      dayLabel: '',
      title: label,
      beforeText,
      afterText,
      changedParts: [],
      bookingId: null,
      before: null,
      after: null,
      accessibilityLabel: entry.removed ? `${label}: removed, was ${beforeText}` : `${label}: amount changed from ${beforeText} to ${afterText}`,
    })
  }

  const bookingRows = rows.filter((row) => row.type === 'booking').length
  const entryRows = rows.length - bookingRows
  const summaryParts: string[] = []
  if (bookingRows) summaryParts.push(plural(bookingRows, 'booking', 'bookings'))
  if (entryRows) summaryParts.push(plural(entryRows, 'price work or expense item', 'price work or expense items'))
  const collapsedCount = Math.min(rows.length, TIMESHEET_CHANGE_DETAILS_COLLAPSED_ROWS)
  return {
    rows,
    bookingRows,
    entryRows,
    firstDayLabel: rows.find((row) => row.type === 'booking' && row.dayLabel)?.dayLabel ?? '',
    heading: input.viewerIsReviewer === true ? TIMESHEET_CHANGE_DETAILS_REVIEWER_HEADING : TIMESHEET_CHANGE_DETAILS_HEADING,
    summary: summaryParts.length ? `${summaryParts.join(' and ')} changed` : '',
    collapsedCount,
    showAllLabel: rows.length > TIMESHEET_CHANGE_DETAILS_COLLAPSED_ROWS ? `Show all (${rows.length})` : null,
  }
}

// MARK: - Whose turn (points 2 and 5)

export type TimesheetNextStepTurn = 'person' | 'lineManager' | 'admin' | 'nobody'
export type TimesheetNextStepTone = 'action' | 'waiting' | 'done'
export type TimesheetNextStep = {
  whoseTurn: TimesheetNextStepTurn
  /** The viewer is the one who acts. */
  viewerActs: boolean
  text: string
  tone: TimesheetNextStepTone
  /** Point 5: the person's signed-off sheet — show Generate invoice right here. */
  generateInvoice: boolean
}

export const TIMESHEET_NEXT_STEP_INVOICE_TEXT = 'Signed off — next: generate your timesheet'
export const TIMESHEET_NEXT_STEP_EXPORTED_TEXT = 'Exported — no further changes (corrections go into a revision)'
/**
 * Review of 1.77.0 (fix 4): who signs off when the person has no active line manager (and is not self-signed) — the
 * other admins (rulebook §8, `timesheetSubmittedRecipients`): "Waiting for an admin to sign off".
 */
export const TIMESHEET_NEXT_STEP_ADMIN_SIGNER = 'an admin'
/** Point 5: the line on the person's signed-off sheet above Generate invoice. */
export const TIMESHEET_GENERATE_INVOICE_PROMPT = 'Next: generate your timesheet'
/**
 * 1.96.0 (owner 26 Nov, CIS): the person's generated document is a timesheet, not an invoice — wording only. Both apps
 * label the button, the done dialog, the save / share actions and the document itself with these (the number keeps its
 * `TS-…` form from `timesheetInvoiceNumber`; stored fields such as `invoiceGeneratedAt` keep their names).
 */
export const TIMESHEET_GENERATE_LABEL = 'Generate Timesheet'
export const TIMESHEET_GENERATED_TITLE = 'Timesheet generated successfully'
export const TIMESHEET_DOWNLOAD_LABEL = 'Download timesheet'
export const TIMESHEET_SHARE_LABEL = 'Share timesheet'
/** The heading at the top of the generated PDF. */
export const TIMESHEET_DOCUMENT_TITLE = 'Timesheet'
export const TIMESHEET_DOCUMENT_TOTAL_LABEL = 'Total timesheet amount'
export const TIMESHEET_DOCUMENT_NUMBER_LABEL = 'Timesheet no.'

/**
 * Rulebook 1.77.0 §8 (point 2): one line on every timesheet saying whose turn it is and what happens next, the same on web
 * and iOS for the person and the reviewer (lists keep their short status word). Reads only what the sheet and the existing
 * rules already say:
 * - `change` — `timesheetChangesWithLateExtras` (1.47.0 / 1.54.0 / 1.76.0);
 * - `revision` — `{ due, label }` from `timesheetRevisionDue` for this pay run (exported and a booking changed);
 * - `revisionLabel` — "REV 1" when the sheet shown is an open revision (`timesheetRevisionLabel`);
 * - `selfSigned` — `timesheetSelfSigned` (nobody counter-signs).
 * `viewerRole`: `person` (their own sheet), `reviewer` (their line manager, or an admin reviewing), `admin` (an admin, who
 * exports). Names come from the roster when the app has them, else neutral words ("your line manager", "the person").
 */
export function timesheetNextStep(input: {
  sheet: Record<string, unknown> | null | undefined
  viewerRole: 'person' | 'reviewer' | 'admin'
  selfSigned?: boolean | null
  change?: {
    reopened?: boolean | null
    waitingFor?: 'person' | 'lineManager' | null
    bookingsChanged?: boolean | null
    lateExtrasWaiting?: boolean | null
    signedEntriesChanged?: boolean | null
    exported?: boolean | null
    changed?: boolean | null
  } | null
  revision?: { due?: boolean | null; label?: string | null } | null
  revisionLabel?: string | null
  personName?: string | null
  lineManagerName?: string | null
  /** The first changed booking's day ("Tue 11 Nov", `signedTimesheetChangeDetails(...).firstDayLabel`). */
  changedDayLabel?: string | null
  /** How many bookings changed (rows of the details card); a single one names its day. */
  changedBookingCount?: number | null
  /** The person has self-employed days on this sheet (`showsMyTimesheets`); default true. */
  hasInvoiceDays?: boolean | null
  /**
   * The person has an active line manager (`hasActiveLineManager`). False: the other admins sign off (rulebook §8), so
   * the line names "an admin" (`TIMESHEET_NEXT_STEP_ADMIN_SIGNER`). Missing = true (as before).
   */
  hasLineManager?: boolean | null
}): TimesheetNextStep {
  const sheet = input.sheet ?? {}
  const role = input.viewerRole
  const isPerson = role === 'person'
  const person = text(input.personName) || (isPerson ? 'you' : 'the person')
  const lineManager = input.hasLineManager === false ? TIMESHEET_NEXT_STEP_ADMIN_SIGNER : text(input.lineManagerName) || 'your line manager'
  const rev = text(input.revisionLabel)
  const change = input.change ?? null
  const exported = resolveTimesheetExportedAtMs(sheet) != null
  const fields = parseTimesheetStatusFields(sheet)
  const personSigned = isTimesheetOperativeSigned(fields)
  const managerSigned = isTimesheetManagerSigned(fields)
  const step = (whoseTurn: TimesheetNextStepTurn, textValue: string, generateInvoice = false): TimesheetNextStep => {
    const viewerActs =
      (whoseTurn === 'person' && isPerson) ||
      (whoseTurn === 'lineManager' && !isPerson) ||
      (whoseTurn === 'admin' && role === 'admin')
    return { whoseTurn, viewerActs, text: textValue, tone: whoseTurn === 'nobody' ? 'done' : viewerActs ? 'action' : 'waiting', generateInvoice }
  }
  const why = (() => {
    const count = input.changedBookingCount ?? 0
    const day = text(input.changedDayLabel)
    if (count === 1 && day) return `a booking changed on ${day}`
    if (count > 1) return `${count} bookings changed`
    return 'bookings changed'
  })()

  if (exported) {
    if (input.revision?.due === true) {
      const label = text(input.revision.label)
      return isPerson
        ? step('person', `Your turn: review and sign the update to your exported timesheet${label ? ` (${label})` : ''}`)
        : step('person', `Waiting for ${person} to review and sign the update${label ? ` (${label})` : ''} — ${why}`)
    }
    return step('nobody', TIMESHEET_NEXT_STEP_EXPORTED_TEXT)
  }
  if (!personSigned) {
    // Rulebook 1.90.0 (owner 24 Nov, point 4): a reviewer's draft revision is with the reviewer until they send it.
    if (timesheetRevisionIsDraft(sheet)) {
      const draftName = rev || 'this timesheet'
      return isPerson
        ? step('lineManager', `${lineManager.charAt(0).toUpperCase()}${lineManager.slice(1)} is making changes to ${draftName} — you can sign it once it is sent to you`)
        : step('lineManager', `Your turn: make your changes to ${draftName}, then send it to ${person}`)
    }
    if (rev) return isPerson ? step('person', `Your turn: sign ${rev}`) : step('person', `${rev} waiting for ${person} to sign`)
    return isPerson ? step('person', 'Your turn: sign your timesheet') : step('person', `Waiting for ${person} to sign`)
  }
  if (change?.reopened === true) {
    if (change.waitingFor === 'person') {
      return isPerson ? step('person', `Your turn: sign again — ${why}`) : step('person', `Waiting for ${person} to sign again — ${why}`)
    }
    // Waiting for the line manager: the person signed again, late extras wait, or signed price work changed (1.76.0).
    const reason = change.bookingsChanged === false ? 'price work or expenses changed' : why
    if (change.bookingsChanged === false && change.signedEntriesChanged !== true) {
      return isPerson
        ? step('lineManager', `Waiting for ${lineManager} to review what you added after sign-off`)
        : step('lineManager', `Your turn: review what ${person} added after sign-off`)
    }
    return isPerson
      ? step('lineManager', `Waiting for ${lineManager} to sign off again — ${reason}`)
      : step('lineManager', `Your turn: sign off again — ${reason}`)
  }
  const signedOff = managerSigned || input.selfSigned === true
  if (!signedOff) {
    if (rev) return isPerson ? step('lineManager', `${rev} waiting for ${lineManager} to sign off`) : step('lineManager', `Your turn: sign off ${rev}`)
    return isPerson ? step('lineManager', `Waiting for ${lineManager} to sign off`) : step('lineManager', 'Your turn: sign off')
  }
  if (isPerson) {
    return input.hasInvoiceDays === false ? step('admin', 'Signed off — waiting for an admin to export') : step('person', TIMESHEET_NEXT_STEP_INVOICE_TEXT, true)
  }
  if (role === 'admin') return step('admin', 'Signed off — ready to export')
  return step('admin', 'Signed off — waiting for an admin to export')
}

// MARK: - One correction entry point (point 1)

export const TIMESHEET_CORRECTION_LABEL = 'Correct this timesheet'
/**
 * Review of 1.77.0 (nit e): the 1.76.0 B1 sentence the reviewer's revision help kept (`TIMESHEET_MAKE_CHANGES_REVISION_HELP`)
 * — on a revision the person has not signed yet, the reviewer may change its bookings first.
 */
export const TIMESHEET_CORRECTION_REVISION_BOOKINGS_HELP = 'You can change its bookings before they sign it.'
export type TimesheetCorrectionAction = 'makeChanges' | 'createRevision' | 'addLateExtras' | 'reviewAndSignAgain' | 'askLineManager'
export type TimesheetCorrectionOption = {
  action: TimesheetCorrectionAction | null
  label: string
  /** One line saying exactly what will happen. */
  help: string | null
  /** `askLineManager` is guidance only: no button. */
  hasButton: boolean
}

/**
 * Rulebook 1.77.0 §8 (point 1, owner: "ok if best and not too hard"): one "Correct this timesheet" entry over the
 * existing correction paths only — no new behaviour:
 * - reviewer, signed off and not exported → `makeChanges` (1.76.0 A1, `timesheetMakeChangesAction` `reopenReview`);
 * - reviewer, exported, next revision allowed → `createRevision` ("This creates REV 2 — Sam signs it, then you sign it off");
 * - the person, revision due and allowed → `reviewAndSignAgain` (creates REV N, 1.55.0);
 * - the person, signed off by the line manager and not exported → `addLateExtras` (1.54.0) when allowed, with "To change
 *   bookings, ask your line manager";
 * - the person, exported with no revision due → `askLineManager` (guidance only);
 * - anything else (still being signed, a reopened sheet with its own Sign again, a self-signed sheet before export) →
 *   no entry (`action` null).
 */
export function timesheetCorrectionOption(input: {
  sheet: Record<string, unknown> | null | undefined
  viewerIsSubject: boolean
  viewerIsReviewer: boolean
  selfSigned?: boolean | null
  change?: { reopened?: boolean | null } | null
  /** Reviewer: `canCreateTimesheetRevision(...).allowed`; the person: the same with `writerIsSubject`. */
  revisionAllowed?: boolean | null
  /** The next revision's label ("REV 2"). */
  nextRevisionLabel?: string | null
  /** The person: `timesheetRevisionDue(...).due`. */
  revisionDue?: boolean | null
  /** The person: `timesheetOwnerCanAddLateExtras(...).allowed`. */
  lateExtrasAllowed?: boolean | null
  personName?: string | null
  lineManagerName?: string | null
  /** As `timesheetNextStep`: false names "an admin" in place of the line manager. */
  hasLineManager?: boolean | null
  /**
   * Rulebook 1.90.0: the app creates the reviewer's revision as a draft (`timesheetRevisionCreateFields({ draft: true })`),
   * so the help says nothing is sent until they send it. Missing: the 1.77.0 wording (an app without drafts).
   */
  revisionDraft?: boolean | null
}): TimesheetCorrectionOption {
  const none: TimesheetCorrectionOption = { action: null, label: TIMESHEET_CORRECTION_LABEL, help: null, hasButton: false }
  const sheet = input.sheet ?? null
  if (!sheet) return none
  const exported = resolveTimesheetExportedAtMs(sheet) != null
  const next = text(input.nextRevisionLabel) || 'a new revision'
  const person = text(input.personName) || 'the person'
  const lineManager = input.hasLineManager === false ? TIMESHEET_NEXT_STEP_ADMIN_SIGNER : text(input.lineManagerName) || 'your line manager'
  const option = (action: TimesheetCorrectionAction, help: string): TimesheetCorrectionOption => ({
    action,
    label: TIMESHEET_CORRECTION_LABEL,
    help,
    hasButton: action !== 'askLineManager',
  })
  if (input.viewerIsReviewer && !input.viewerIsSubject) {
    const action = timesheetMakeChangesAction(sheet, {
      viewerIsReviewer: true,
      viewerIsSubject: false,
      selfSigned: input.selfSigned,
      change: input.change ?? null,
      revisionAllowed: input.revisionAllowed,
    })
    if (action === 'reopenReview') return option('makeChanges', TIMESHEET_MAKE_CHANGES_REOPEN_HELP)
    if (action === 'createRevision') {
      if (input.revisionDraft === true) {
        return option('createRevision', `This creates ${next} as a draft: change its bookings, then send it to ${person} to sign. Nothing is sent until you do.`)
      }
      return option('createRevision', `This creates ${next} — ${person} signs it, then you sign it off. ${TIMESHEET_CORRECTION_REVISION_BOOKINGS_HELP}`)
    }
    return none
  }
  if (!input.viewerIsSubject) return none
  if (exported) {
    if (input.revisionDue === true && input.revisionAllowed === true) {
      return option(
        'reviewAndSignAgain',
        input.selfSigned === true ? `This creates ${next} — you sign it and it is ready to export.` : `This creates ${next} — you sign it, then ${lineManager} signs it off.`
      )
    }
    return option(
      'askLineManager',
      input.selfSigned === true
        ? 'This timesheet has been exported. Corrections go into a revision — ask an admin.'
        : `This timesheet has been exported. To correct it, ask ${lineManager} — they can make changes in a revision.`
    )
  }
  if (input.selfSigned === true || input.change?.reopened === true) return none
  const fields = parseTimesheetStatusFields(sheet)
  if (!isTimesheetManagerSigned(fields)) return none
  if (input.lateExtrasAllowed === true) {
    return option('addLateExtras', `Add price work or expenses after sign-off — ${lineManager} approves them. To change bookings, ask ${lineManager}.`)
  }
  return option('askLineManager', `To change this timesheet, ask ${lineManager}.`)
}

// MARK: - Reports (point 6)

/**
 * Rulebook 1.77.0 §7 (point 6, owner chose (a), 23 Nov): the sheet is back with the person to sign again — a booking
 * change reopened it (`waitingFor: 'person'`), or a revision is due or open and waits for the person. Reports show the
 * live figures, as before; this label only says why.
 */
export const TIMESHEET_REPORT_AWAITING_RESIGN_LABEL = 'Awaiting re-sign'
/**
 * Rulebook 1.77.0 §7 (point 6, owner chose (a)): the person need not sign again but the line manager must approve (late
 * extras waiting, signed price work / expenses changed in Make changes, a J1 snapshot gap) — the weekly report check line
 * keeps the last signed figures and says so.
 */
export const TIMESHEET_REPORT_AWAITING_APPROVAL_LABEL = 'Awaiting line manager approval — showing last signed figures'
/** The same state on the Payrun Snapshot timesheet cell, which shows no figures. */
export const TIMESHEET_SNAPSHOT_AWAITING_APPROVAL_LABEL = 'Awaiting line manager approval'

/**
 * Rulebook 1.77.0 §7 (point 6): the report (weekly report check line, Payrun Snapshot) is showing a waiting sheet's last
 * signed figures — the sheet is reopened for signing (or approval) again, but reports keep its signed copy: only late
 * extras or changed signed price work / expenses wait (1.54.0 / 1.76.0, `bookingsChanged` false), or the only change is a
 * snapshot gap under J1 (1.57.0). A booking change (J4) reports the live bookings instead — not this. Never on an
 * exported sheet.
 */
export function timesheetReportKeepsSignedFigures(
  change:
    | {
        reopened?: boolean | null
        exported?: boolean | null
        snapshotGapOnly?: boolean | null
        bookingsChanged?: boolean | null
        lateExtrasWaiting?: boolean | null
        changed?: boolean | null
      }
    | null
    | undefined
): boolean {
  if (!change || change.exported === true || change.reopened !== true) return false
  if (change.snapshotGapOnly === true) {
    // J1 (`SNAPSHOT_GAP_REPORTS`): a gap-only change keeps the signed figures (null), or reads as late extras waiting.
    const forReports = signedTimesheetChangeForReports(change)
    return forReports == null || forReports.bookingsChanged === false
  }
  return change.bookingsChanged === false
}

export type TimesheetReportWaiting = 'person' | 'lineManager' | null

/**
 * Rulebook 1.77.0 §7 (point 6, owner chose (a), 23 Nov): who a run's sheet waits for, for the report labels only —
 * `'person'` (`TIMESHEET_REPORT_AWAITING_RESIGN_LABEL`) when a booking change sent it back to the person, or its revision
 * is due, or open and not yet signed by the person (`revision`); `'lineManager'` (`TIMESHEET_REPORT_AWAITING_APPROVAL_LABEL`,
 * `TIMESHEET_SNAPSHOT_AWAITING_APPROVAL_LABEL`) when the report keeps its last signed figures
 * (`timesheetReportKeepsSignedFigures`); else null. Wording only: no figure depends on it.
 */
export function timesheetReportWaiting(
  change:
    | (Parameters<typeof timesheetReportKeepsSignedFigures>[0] & { waitingFor?: 'person' | 'lineManager' | null })
    | null
    | undefined,
  revision: { state?: 'none' | 'due' | 'open' | null; personSigned?: boolean | null; draft?: boolean | null } | null = null
): TimesheetReportWaiting {
  if (revision?.state === 'due') return 'person'
  // 1.90.0: a reviewer's draft revision waits for the line manager to send it, not for the person.
  if (revision?.state === 'open' && revision.draft === true) return 'lineManager'
  if (revision?.state === 'open' && revision.personSigned !== true) return 'person'
  if (timesheetReportKeepsSignedFigures(change)) return 'lineManager'
  if (change && change.exported !== true && change.reopened === true && change.waitingFor === 'person') return 'person'
  return null
}

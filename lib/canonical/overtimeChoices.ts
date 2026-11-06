/**
 * PAYE overtime ✓ ✕ ⚙ choices and button readiness (rulebook §25, 1.33.0, owner decisions 6 Nov).
 *
 * One state machine (`overtimeChoiceAfter`) for the person's marks before Send for approval and the line manager's
 * (or deciding admin's) marks before Return overtime; one drawing rule (`overtimeChoiceView`) both apps paint from;
 * and one readiness rule per button: `overtimeSubmitReady` (Send for approval), `overtimeReturnReady` (Return overtime,
 * in payeOvertime.ts beside the Return writes) and `overtimeGenerateReady` / `canGenerateOvertimeReport` (Generate
 * overtime report). Screens only pass inputs and draw the result.
 *
 * A choice is `{ mark: 'none' | 'tick' | 'cross', edit }`:
 *   - ✓ fills green (a second ✓ clears it); ✓ after ✕ reverses it;
 *   - ✕ fills red with the figure struck through (a second ✕ clears it); ✕ drops a cog edit;
 *   - ⚙ stores new start / finish / rate and clears the mark: the old figure is struck through with the new one below,
 *     and the line then needs ✓ (or ✕). Using the cog again unticks and replaces the figure.
 * Choices are kept on the screen only (Q-A7) until they are sent or returned.
 */

import { formatClockMinutes, parseClockMinutes } from './engine'
import { idKey } from './personIds'
import {
  OVERTIME_DONE_LINE_STATES,
  OVERTIME_GENERATE_NOT_MARKED_MESSAGE,
  OVERTIME_GENERATE_NOT_READY_MESSAGE,
  OVERTIME_GENERATE_SAVED_MESSAGE,
  OVERTIME_GENERATE_UNSENT_MESSAGE,
  OVERTIME_NO_LINES_MESSAGE,
  OVERTIME_RETURNED_LINE_STATES,
  OVERTIME_SUBMIT_NOTHING_CHANGED_MESSAGE,
  OVERTIME_SUBMIT_UNDECIDED_MESSAGE,
  overtimeCogPreview,
  overtimeEditValidationError,
  overtimeRequestLineFields,
  overtimeReportOutOfDate,
  overtimeStrikeOutcome,
  type OvertimeBookingInput,
  type OvertimeDecision,
  type OvertimeLine,
  type OvertimeLineState,
  type OvertimeOrganization,
  type OvertimeReportSnapshot,
  type OvertimeRequestLine,
} from './payeOvertime'

export type OvertimeChoiceMark = 'none' | 'tick' | 'cross'
export type OvertimeChoiceEdit = { start: string; end: string; multiplier: number | null }
export type OvertimeChoice = { mark: OvertimeChoiceMark; edit: OvertimeChoiceEdit | null }
export type OvertimeChoiceEvent =
  | { kind: 'tick' }
  | { kind: 'cross' }
  | { kind: 'cog'; start: string; end: string; multiplier: number | null }
  | { kind: 'reset' }
export type OvertimeChoiceRole = 'person' | 'decider'

export const OVERTIME_EMPTY_CHOICE: OvertimeChoice = Object.freeze({ mark: 'none', edit: null }) as OvertimeChoice

/** Person-stage words (Q-A5): ✓ "Confirmed", ✕ "Not worked", ⚙ + ✓ "Changed"; decider: "Approved" / "Declined" / "Changed". */
export const OVERTIME_PERSON_CHOICE_LABELS = {
  tick: 'Confirmed',
  cross: 'Not worked',
  changed: 'Changed',
  needsMark: 'Changed — tick or cross it',
} as const
export const OVERTIME_DECIDER_LABELS = {
  tick: 'Approved',
  cross: 'Declined',
  changed: 'Changed',
  needsMark: 'Changed — tick or cross it',
} as const

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function clock(value: unknown): string {
  const minutes = parseClockMinutes(text(value))
  return minutes == null ? '' : formatClockMinutes(minutes)
}

function multiplierOf(value: unknown): number | null {
  const n = Number(value)
  return value != null && value !== '' && Number.isFinite(n) && n > 0 ? n : null
}

function normalChoice(choice: OvertimeChoice | null | undefined): OvertimeChoice {
  if (!choice || typeof choice !== 'object') return OVERTIME_EMPTY_CHOICE
  const mark: OvertimeChoiceMark = choice.mark === 'tick' || choice.mark === 'cross' ? choice.mark : 'none'
  const edit =
    choice.edit && clock(choice.edit.start) && clock(choice.edit.end)
      ? { start: clock(choice.edit.start), end: clock(choice.edit.end), multiplier: multiplierOf(choice.edit.multiplier) }
      : null
  return { mark, edit: mark === 'cross' ? null : edit }
}

/** The one ✓ ✕ ⚙ state machine (person and decider). An invalid cog leaves the choice as it was. */
export function overtimeChoiceAfter(choice: OvertimeChoice | null | undefined, event: OvertimeChoiceEvent): OvertimeChoice {
  const now = normalChoice(choice)
  switch (event?.kind) {
    case 'tick':
      return now.mark === 'tick' ? { mark: 'none', edit: now.edit } : { mark: 'tick', edit: now.edit }
    case 'cross':
      return now.mark === 'cross' ? { mark: 'none', edit: null } : { mark: 'cross', edit: null }
    case 'cog': {
      if (overtimeEditValidationError(event)) return now
      return { mark: 'none', edit: { start: clock(event.start), end: clock(event.end), multiplier: multiplierOf(event.multiplier) } }
    }
    case 'reset':
      return OVERTIME_EMPTY_CHOICE
    default:
      return now
  }
}

/** True when two choices are the same marks and values. */
export function overtimeChoicesEqual(a: OvertimeChoice | null | undefined, b: OvertimeChoice | null | undefined): boolean {
  const x = normalChoice(a)
  const y = normalChoice(b)
  if (x.mark !== y.mark) return false
  if (!x.edit || !y.edit) return !x.edit && !y.edit
  return x.edit.start === y.edit.start && x.edit.end === y.edit.end && x.edit.multiplier === y.edit.multiplier
}

/** A finished choice as a decision: ✓ → approve, ⚙ + ✓ → edit, ✕ → strike; null while unmarked. */
export function overtimeChoiceDecision(choice: OvertimeChoice | null | undefined): OvertimeDecision | null {
  const now = normalChoice(choice)
  if (now.mark === 'cross') return { action: 'strike' }
  if (now.mark !== 'tick') return null
  return now.edit ? { action: 'edit', start: now.edit.start, end: now.edit.end, multiplier: now.edit.multiplier } : { action: 'approve' }
}

/** The choice a stored decision or a request line stands for (keep → ✓, edit → ⚙ + ✓, strike → ✕). */
export function overtimeChoiceFromDecision(decision: OvertimeDecision | null | undefined): OvertimeChoice {
  if (!decision) return OVERTIME_EMPTY_CHOICE
  if (decision.action === 'strike') return { mark: 'cross', edit: null }
  if (decision.action === 'edit') return normalChoice({ mark: 'tick', edit: { start: decision.start, end: decision.end, multiplier: decision.multiplier } })
  return { mark: 'tick', edit: null }
}

function choiceFromRequestLine(line: OvertimeRequestLine | null | undefined): OvertimeChoice {
  if (!line) return OVERTIME_EMPTY_CHOICE
  if (line.action === 'strike') return { mark: 'cross', edit: null }
  if (line.action === 'edit' && line.proposedStart && line.proposedEnd) {
    return normalChoice({ mark: 'tick', edit: { start: line.proposedStart, end: line.proposedEnd, multiplier: line.proposedMultiplier } })
  }
  return { mark: 'tick', edit: null }
}

/**
 * The person's starting choice for a line (what Send for approval compares with): after a Return the outcome they see
 * — Approved / Changed by {name} → ✓, Declined → ✕ (owner 6 Nov: "the person sees it red ✕"); while waiting, what they
 * sent; a confirmed line ✓; otherwise nothing (the line must be marked). Null for a line that cannot be marked
 * (deleted, cancelled).
 */
export function overtimeLineBaselineChoice(line: Pick<OvertimeLine, 'state' | 'requestLine' | 'sentLine'>): OvertimeChoice | null {
  switch (line.state) {
    case 'returnedApproved':
    case 'returnedChanged':
    case 'confirmed':
      return { mark: 'tick', edit: null }
    case 'returnedDeclined':
      return { mark: 'cross', edit: null }
    case 'waiting':
      return choiceFromRequestLine(line.requestLine ?? line.sentLine)
    case 'deleted':
    case 'cancelled':
      return null
    default:
      return OVERTIME_EMPTY_CHOICE
  }
}

/** Lines the person must mark before sending (never sent, changed since sent, or reopened). */
const SEND_STATES: ReadonlyArray<OvertimeLineState> = ['needsReview', 'changedSinceRequest', 'reopened']
/** Returned lines: sent again only when the person changes the mark (✕→✓, ✓→✕, or ⚙). */
const RESEND_STATES: ReadonlyArray<OvertimeLineState> = ['returnedApproved', 'returnedChanged', 'returnedDeclined']

function choiceFor(choices: Record<string, OvertimeChoice | null | undefined> | null | undefined, bookingId: string): OvertimeChoice | null {
  for (const [key, value] of Object.entries(choices || {})) if (idKey(key) === idKey(bookingId)) return value ?? null
  return null
}

/** The person's current choice for a line: what they marked on screen, else the line's baseline. */
export function overtimeLineChoice(
  line: Pick<OvertimeLine, 'bookingId' | 'state' | 'requestLine' | 'sentLine'>,
  choices?: Record<string, OvertimeChoice | null | undefined> | null
): OvertimeChoice | null {
  const baseline = overtimeLineBaselineChoice(line)
  if (!baseline) return null
  if (line.state === 'waiting') return baseline
  return choiceFor(choices, line.bookingId) ?? baseline
}

/**
 * Send for approval (person with a line manager), owner 6 Nov: green only when every line in the range is marked
 * (✓, ✕, or ⚙ + ✓) and there is something to send. After a Return it stays grey until the person changes a line
 * (✕→✓, ✓→✕ or ⚙); only changed lines are sent. Lines waiting for the line manager are locked (withdraw to change
 * them); deleted and cancelled lines are done. → `{ ready, undecidedCount, bookingIds (the lines to send), message }`.
 */
export function overtimeSubmitReady(input: {
  lines: ReadonlyArray<Pick<OvertimeLine, 'bookingId' | 'state' | 'requestLine' | 'sentLine'>>
  choices?: Record<string, OvertimeChoice | null | undefined> | null
}): { ready: boolean; undecidedCount: number; bookingIds: string[]; message: string | null } {
  const lines = input.lines || []
  if (lines.length === 0) return { ready: false, undecidedCount: 0, bookingIds: [], message: OVERTIME_NO_LINES_MESSAGE }
  let undecidedCount = 0
  const bookingIds: string[] = []
  for (const line of lines) {
    const current = overtimeLineChoice(line, input.choices)
    if (!current) continue
    if (SEND_STATES.includes(line.state)) {
      if (current.mark === 'none') undecidedCount += 1
      else bookingIds.push(line.bookingId)
    } else if (RESEND_STATES.includes(line.state)) {
      if (current.mark === 'none') undecidedCount += 1
      else if (!overtimeChoicesEqual(current, overtimeLineBaselineChoice(line))) bookingIds.push(line.bookingId)
    }
  }
  if (undecidedCount > 0) return { ready: false, undecidedCount, bookingIds, message: OVERTIME_SUBMIT_UNDECIDED_MESSAGE }
  if (bookingIds.length === 0) return { ready: false, undecidedCount: 0, bookingIds, message: OVERTIME_SUBMIT_NOTHING_CHANGED_MESSAGE }
  return { ready: true, undecidedCount: 0, bookingIds, message: null }
}

/**
 * The request lines Send for approval writes: one per line `overtimeSubmitReady` names, built by
 * `overtimeRequestLineFields` from the choice (✓ keep, ⚙ + ✓ edit, ✕ strike — a trim, or removing an all-overtime
 * booking). An unmarked line is refused (never sent); `refused` names lines whose ✕ is not allowed. Empty when not ready.
 */
export function overtimeSubmitLines(input: {
  lines: ReadonlyArray<Pick<OvertimeLine, 'bookingId' | 'state' | 'requestLine' | 'sentLine'>>
  choices?: Record<string, OvertimeChoice | null | undefined> | null
  bookings: ReadonlyArray<OvertimeBookingInput>
  organization: OvertimeOrganization
  timeZone?: string | null
  personIds: ReadonlyArray<string>
}): { lines: OvertimeRequestLine[]; refused: string[] } {
  const ready = overtimeSubmitReady({ lines: input.lines, choices: input.choices })
  if (!ready.ready) return { lines: [], refused: [] }
  const byId = new Map((input.bookings || []).map((row) => [idKey(row.id), row]))
  const out: OvertimeRequestLine[] = []
  const refused: string[] = []
  for (const bookingId of ready.bookingIds) {
    const line = input.lines.find((row) => idKey(row.bookingId) === idKey(bookingId))
    const booking = byId.get(idKey(bookingId))
    const decision = line ? overtimeChoiceDecision(overtimeLineChoice(line, input.choices)) : null
    if (!booking || !decision) {
      refused.push(bookingId)
      continue
    }
    const proposal =
      decision.action === 'approve' ? ({ action: 'keep' } as const) : decision.action === 'strike' ? ({ action: 'strike' } as const) : decision
    const built = overtimeRequestLineFields({ booking, organization: input.organization, timeZone: input.timeZone, proposal, personIds: input.personIds })
    if (built) out.push(built)
    else refused.push(bookingId)
  }
  return { lines: out, refused }
}

export type OvertimeButtonLook = 'filled' | 'grey' | 'idle'

/**
 * What both apps draw for one line's choice. `tick` / `cross` fill when chosen (green / red) and turn grey when the
 * other is chosen; `cog` fills while an edit is held. `figureStruck` strikes the booking's figure through (✕, or a cog
 * edit); `newFigure` is the cog's new figure ("3h × 2 = 6h"), or for the person's ✕ what it leaves ("1h" after a trim,
 * "Booking removed" on an all-overtime day); the decider's ✕ leaves the booking as it was (no new figure). `label` is the
 * person's or the decider's word (Q-A5); `complete` is true once ✓ or ✕ is set.
 */
export function overtimeChoiceView(input: {
  choice: OvertimeChoice | null | undefined
  booking: OvertimeBookingInput | null | undefined
  organization: OvertimeOrganization
  timeZone?: string | null
  role: OvertimeChoiceRole
}): {
  tick: OvertimeButtonLook
  cross: OvertimeButtonLook
  cog: OvertimeButtonLook
  figureStruck: boolean
  oldFigure: string
  newFigure: string | null
  label: string
  complete: boolean
} {
  const choice = normalChoice(input.choice)
  const labels = input.role === 'decider' ? OVERTIME_DECIDER_LABELS : OVERTIME_PERSON_CHOICE_LABELS
  const tick: OvertimeButtonLook = choice.mark === 'tick' ? 'filled' : choice.mark === 'cross' ? 'grey' : 'idle'
  const cross: OvertimeButtonLook = choice.mark === 'cross' ? 'filled' : choice.mark === 'tick' ? 'grey' : 'idle'
  const cog: OvertimeButtonLook = choice.edit ? 'filled' : choice.mark === 'none' ? 'idle' : 'grey'
  let oldFigure = ''
  let newFigure: string | null = null
  if (input.booking) {
    if (choice.edit) {
      const preview = overtimeCogPreview({
        booking: input.booking,
        organization: input.organization,
        timeZone: input.timeZone,
        start: choice.edit.start,
        end: choice.edit.end,
        multiplier: choice.edit.multiplier,
      })
      oldFigure = preview.beforeText
      newFigure = preview.afterText
    } else {
      const preview = overtimeCogPreview({
        booking: input.booking,
        organization: input.organization,
        timeZone: input.timeZone,
        start: text(input.booking.workStartTime),
        end: text(input.booking.workEndTime),
        multiplier: multiplierOf(input.booking.otMultiplierOverride),
      })
      oldFigure = preview.beforeText
      if (choice.mark === 'cross' && input.role === 'person') {
        const outcome = overtimeStrikeOutcome({ booking: input.booking, organization: input.organization, timeZone: input.timeZone })
        if (outcome.kind === 'delete') newFigure = 'Booking removed'
        else if (outcome.kind === 'trim') {
          const trimmed = overtimeCogPreview({
            booking: input.booking,
            organization: input.organization,
            timeZone: input.timeZone,
            start: outcome.start,
            end: outcome.end,
            multiplier: multiplierOf(input.booking.otMultiplierOverride),
          })
          newFigure = trimmed.afterText
        }
      }
    }
  }
  const label =
    choice.mark === 'cross' ? labels.cross : choice.mark === 'tick' ? (choice.edit ? labels.changed : labels.tick) : choice.edit ? labels.needsMark : ''
  return {
    tick,
    cross,
    cog,
    figureStruck: choice.mark === 'cross' || choice.edit != null,
    oldFigure,
    newFigure,
    label,
    complete: choice.mark !== 'none',
  }
}

/**
 * Generate overtime report (owner 6 Nov). With an active line manager: green only when every line in the range is
 * returned (Approved, Changed by {name} or Declined — a declined line goes in the report at 0h, "Declined by {name}") or
 * deleted, and unchanged since (a reopened, waiting or changed-since line blocks it), and the person has no unsent
 * change. Without a line manager: every line ✓ / ✕ / ⚙ (confirmed). Either way a line confirmed before a line manager
 * was set, and 1.29–1.32 cancelled lines, count as finished. When `reports` (saved reports of exactly this range) holds
 * one that is not out of date, Generate stays grey (`OVERTIME_GENERATE_SAVED_MESSAGE`); once a line changes the saved
 * report reads out of date and Generate turns green again for a replacement.
 */
export function overtimeGenerateReady(input: {
  lines: ReadonlyArray<OvertimeLine>
  hasLineManager?: boolean | null
  choices?: Record<string, OvertimeChoice | null | undefined> | null
  reports?: ReadonlyArray<Pick<OvertimeReportSnapshot, 'lines' | 'rangeStart' | 'rangeEnd'>> | null
}): { ready: boolean; message: string | null } {
  const lines = input.lines || []
  if (lines.length === 0) return { ready: false, message: OVERTIME_NO_LINES_MESSAGE }
  const finished = (state: OvertimeLineState) =>
    input.hasLineManager === true
      ? OVERTIME_RETURNED_LINE_STATES.includes(state) || state === 'deleted' || state === 'cancelled' || state === 'confirmed'
      : OVERTIME_DONE_LINE_STATES.includes(state)
  if (!lines.every((line) => finished(line.state))) {
    return { ready: false, message: input.hasLineManager === true ? OVERTIME_GENERATE_NOT_READY_MESSAGE : OVERTIME_GENERATE_NOT_MARKED_MESSAGE }
  }
  if (input.hasLineManager === true && input.choices) {
    const unsent = lines.some((line) => {
      const baseline = overtimeLineBaselineChoice(line)
      const current = overtimeLineChoice(line, input.choices)
      return baseline != null && current != null && !overtimeChoicesEqual(current, baseline)
    })
    if (unsent) return { ready: false, message: OVERTIME_GENERATE_UNSENT_MESSAGE }
  }
  if ((input.reports || []).some((report) => !overtimeReportOutOfDate({ report, lines }))) {
    return { ready: false, message: OVERTIME_GENERATE_SAVED_MESSAGE }
  }
  return { ready: true, message: null }
}

/**
 * Generate overtime report is enabled (`overtimeGenerateReady(...).ready`). Called with the lines alone (1.29–1.32
 * callers) every line must be finished in any way (`OVERTIME_DONE_LINE_STATES`).
 */
export function canGenerateOvertimeReport(
  lines: ReadonlyArray<OvertimeLine>,
  options?: {
    hasLineManager?: boolean | null
    choices?: Record<string, OvertimeChoice | null | undefined> | null
    reports?: ReadonlyArray<Pick<OvertimeReportSnapshot, 'lines' | 'rangeStart' | 'rangeEnd'>> | null
  } | null
): boolean {
  return overtimeGenerateReady({ lines, ...(options || {}) }).ready
}

/**
 * The person's pending requests a new Send for approval replaces (withdrawn in the same batch): those whose every line
 * still waiting is sent again now. A pending request with any other line still waiting is kept (those lines are locked
 * until it is returned or withdrawn).
 */
export function overtimeRequestsSuperseded(
  requests: ReadonlyArray<{ id: string; userId: string; status: string; lines: ReadonlyArray<{ bookingId: string }>; appliedBookingIds?: ReadonlyArray<string>; droppedBookingIds?: ReadonlyArray<string> }>,
  userId: string,
  bookingIds: ReadonlyArray<string>
): string[] {
  const sending = new Set((bookingIds || []).map(idKey))
  return (requests || [])
    .filter((row) => row.status === 'pending' && idKey(row.userId) === idKey(userId))
    .filter((row) => {
      const done = new Set([...(row.appliedBookingIds || []), ...(row.droppedBookingIds || [])].map(idKey))
      const open = row.lines.filter((line) => !done.has(idKey(line.bookingId)))
      return open.length > 0 && open.every((line) => sending.has(idKey(line.bookingId)))
    })
    .map((row) => row.id)
}

/**
 * PAYE payday and payruns (rulebook §4.5, 1.29.0, owner decisions 4 Nov).
 *
 * A company sets one PAYE payday: a day of the month, 1–31 (`invoicing.payePayday`). A PAYE payrun runs from the
 * day after the previous month's payday to this month's payday, inclusive, and is paid on that payday
 * (payday the 25th → 26 Oct – 25 Nov, paid 25 Nov; payday the 16th → 17th – 16th). A payday of 29–31 is the last day
 * of a shorter month (payday the 31st → 1 Feb – 28 Feb). Paydays never move off weekends.
 *
 * The payday is dated history, like the working hours (`invoicing.payePaydayHistory`, append-only
 * `{ day, effectiveFrom }[]`): a change applies from the next payrun, so past payruns keep their dates and saved
 * reports never shift. The first payday set applies from the start of the payrun that contains the day it was set,
 * so the current payrun works at once. A change made later applies from the day after the payrun that contains the
 * day of the change; the first payrun on the new day runs from there to the first new payday on or after it (it can
 * be shorter or longer than a month). Entries on the same day: the later one wins.
 *
 * Until a payday is set there is no PAYE payrun: the Overtime screens say `PAYE_PAYDAY_NOT_SET_MESSAGE` and only a
 * custom date range works. Every function here is pure calendar arithmetic over `YYYY-MM-DD` day keys in the
 * organisation zone; no device zone.
 */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export const PAYE_PAYDAY_MIN = 1
export const PAYE_PAYDAY_MAX = 31
export const PAYE_PAYDAY_NOT_SET_MESSAGE = 'Ask an admin to set the PAYE payday'
export const PAYE_PAYDAY_INVALID_MESSAGE = 'Choose a PAYE payday between the 1st and the 31st.'
export const PAYE_PAYDAY_CONTROL_LABEL = 'Set PAYE payday'
export const PAYE_PAYDAY_HELP =
  'The day of the month PAYE staff are paid. A payday of the 29th–31st is the last day of shorter months; paydays never move off weekends. A change applies from the next payrun.'

/** One entry of `invoicing.payePaydayHistory`: the payday in force from `effectiveFrom` on. */
export type PayePaydayHistoryEntry = { day: number; effectiveFrom: string }

/** A PAYE payrun: the work period and its pay date (the payday), organisation-zone day keys, inclusive. */
export type PayePayrun = { start: string; end: string; payDate: string; payday: number }

export type PayePayrunSummary =
  | { notConfigured: true; message: string }
  | { notConfigured: false; start: string; end: string; payDate: string; payday: number; label: string }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** The `invoicing` map from an organisation document or the map itself. */
function invoicingOf(source: unknown): Record<string, unknown> | null {
  const row = record(source)
  if (!row) return null
  const nested = record(row.invoicing)
  if (nested) return nested
  if ('payePayday' in row || 'payePaydayHistory' in row || 'paymentRunMode' in row) return row
  return null
}

function dayOfMonth(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value)
  if (!Number.isInteger(n) || n < PAYE_PAYDAY_MIN || n > PAYE_PAYDAY_MAX) return null
  return n
}

function parts(dayKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dayKey.split('-').map(Number)
  return { y, m, d }
}

function key(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function addDays(dayKey: string, days: number): string {
  const { y, m, d } = parts(dayKey)
  return key(y, m, d + days)
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** The payday in month `m` of year `y` (1-based month; months outside 1–12 roll over), clamped to short months. */
function paydayIn(y: number, m: number, day: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1))
  const yy = first.getUTCFullYear()
  const mm = first.getUTCMonth() + 1
  return key(yy, mm, Math.min(day, daysInMonth(yy, mm)))
}

/** `2026-11-25` → `25 Nov`. */
export function formatPayePayrunDay(dayKey: string): string {
  if (!DAY_KEY.test(String(dayKey || ''))) return String(dayKey || '')
  const { m, d } = parts(dayKey)
  return `${d} ${MONTH_SHORT[m - 1]}`
}

/** "PAYE payrun: 26 Oct – 25 Nov · paid 25 Nov". */
export function payePayrunLabel(payrun: Pick<PayePayrun, 'start' | 'end' | 'payDate'>): string {
  return `PAYE payrun: ${formatPayePayrunDay(payrun.start)} – ${formatPayePayrunDay(payrun.end)} · paid ${formatPayePayrunDay(payrun.payDate)}`
}

/**
 * `invoicing.payePaydayHistory` as stored, in date order (entries on the same day keep their stored order; the later
 * one wins). A company that saved `payePayday` without history (an older writer) reads as that payday from
 * `1970-01-01`. Bad entries are dropped. Empty when no payday is set.
 */
export function payePaydayHistory(source: unknown): PayePaydayHistoryEntry[] {
  const inv = invoicingOf(source)
  if (!inv) return []
  const raw = Array.isArray(inv.payePaydayHistory) ? inv.payePaydayHistory : []
  const rows: Array<PayePaydayHistoryEntry & { index: number }> = []
  raw.forEach((entry, index) => {
    const row = record(entry)
    const day = dayOfMonth(row?.day)
    const from = String(row?.effectiveFrom ?? '').trim()
    if (day != null && DAY_KEY.test(from)) rows.push({ day, effectiveFrom: from, index })
  })
  rows.sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? a.index - b.index : a.effectiveFrom < b.effectiveFrom ? -1 : 1))
  const out = rows.map(({ day, effectiveFrom }) => ({ day, effectiveFrom }))
  if (out.length === 0) {
    const day = dayOfMonth(inv.payePayday)
    if (day != null) return [{ day, effectiveFrom: '1970-01-01' }]
  }
  return out
}

/** The current PAYE payday (the latest history entry, else the stored `payePayday`), or null when none is set. */
export function payePayday(source: unknown): number | null {
  const history = payePaydayHistory(source)
  return history.length > 0 ? history[history.length - 1].day : null
}

/** The payrun under one payday that contains `dayKey`, ignoring history. */
function payrunUnder(day: number, dayKey: string): PayePayrun {
  const { y, m } = parts(dayKey)
  const thisPayday = paydayIn(y, m, day)
  const end = dayKey <= thisPayday ? thisPayday : paydayIn(y, m + 1, day)
  const { y: ey, m: em } = parts(end)
  const start = addDays(paydayIn(ey, em - 1, day), 1)
  return { start, end, payDate: end, payday: day }
}

/** The history entry in force on `dayKey` (latest `effectiveFrom` on or before it; same day: the later one). */
function entryIndexOn(history: PayePaydayHistoryEntry[], dayKey: string): number {
  let found = -1
  for (let i = 0; i < history.length; i += 1) if (history[i].effectiveFrom <= dayKey) found = i
  return found
}

/**
 * The PAYE payrun that contains `dayKey` (organisation-zone `YYYY-MM-DD`), or null when no payday is set or the day
 * is before the first payday took effect (only a custom range reaches those days). A run never crosses a payday
 * change: it starts no earlier than its entry's `effectiveFrom` and ends the day before the next entry's.
 */
export function payePayrunPeriod(source: unknown, dayKey: string): PayePayrun | null {
  if (!DAY_KEY.test(String(dayKey || ''))) return null
  const history = payePaydayHistory(source)
  const index = entryIndexOn(history, dayKey)
  if (index < 0) return null
  const entry = history[index]
  const run = payrunUnder(entry.day, dayKey)
  const start = run.start < entry.effectiveFrom ? entry.effectiveFrom : run.start
  let end = run.end
  const next = history.slice(index + 1).find((row) => row.effectiveFrom > dayKey)
  if (next && next.effectiveFrom <= end) end = addDays(next.effectiveFrom, -1)
  return { start, end, payDate: end, payday: entry.day }
}

/** The payrun containing `todayKey` with its label, or `notConfigured` with `PAYE_PAYDAY_NOT_SET_MESSAGE`. */
export function payePayrunSummary(source: unknown, todayKey: string): PayePayrunSummary {
  const run = payePayrunPeriod(source, todayKey)
  if (!run) return { notConfigured: true, message: PAYE_PAYDAY_NOT_SET_MESSAGE }
  return { notConfigured: false, ...run, label: payePayrunLabel(run) }
}

/**
 * Past PAYE payruns, newest first: every payrun that ended before the one containing `todayKey`, back to the first
 * payrun after the payday was set. Capped at `limit` (default 60).
 */
export function payePastPayruns(source: unknown, todayKey: string, limit = 60): PayePayrun[] {
  const history = payePaydayHistory(source)
  if (history.length === 0 || !DAY_KEY.test(String(todayKey || ''))) return []
  const first = history[0].effectiveFrom
  const current = payePayrunPeriod(source, todayKey)
  let cursor = current ? addDays(current.start, -1) : todayKey
  const out: PayePayrun[] = []
  while (cursor >= first && out.length < Math.max(0, limit)) {
    const run = payePayrunPeriod(source, cursor)
    if (!run) break
    out.push(run)
    cursor = addDays(run.start, -1)
  }
  return out
}

/** Null when `day` is a whole number 1–31, else `PAYE_PAYDAY_INVALID_MESSAGE`. */
export function payePaydayValidationError(day: unknown): string | null {
  return dayOfMonth(day) == null ? PAYE_PAYDAY_INVALID_MESSAGE : null
}

/**
 * The partial update that sets the PAYE payday (admins, online only): `invoicing.payePayday` and the whole
 * `invoicing.payePaydayHistory` with one entry appended (never rewritten). The first payday applies from the start of
 * the payrun containing `todayKey`; a change applies from the day after the current payrun ends. Null when `day` is
 * invalid or unchanged.
 */
export function payePaydayWriteFields(source: unknown, day: unknown, todayKey: string): Record<string, unknown> | null {
  const next = dayOfMonth(day)
  if (next == null || !DAY_KEY.test(String(todayKey || ''))) return null
  const history = payePaydayHistory(source)
  const current = payePayrunPeriod(source, todayKey)
  if (current && current.payday === next) {
    // Unchanged, unless a different payday is already waiting to start after this run.
    const pending = history.filter((row) => row.effectiveFrom > todayKey)
    if (pending.length === 0 || pending[pending.length - 1].day === next) return null
  }
  const effectiveFrom = current ? addDays(current.end, 1) : payrunUnder(next, todayKey).start
  const stored = invoicingOf(source)
  const storedHistory = Array.isArray(stored?.payePaydayHistory) ? (stored?.payePaydayHistory as unknown[]) : []
  // Keep the stored rows exactly (append-only); seed one from a bare stored `payePayday` so it is not lost.
  const base = storedHistory.length > 0 ? storedHistory.map((row) => ({ ...(record(row) ?? {}) })) : history.map((row) => ({ ...row }))
  return {
    'invoicing.payePayday': next,
    'invoicing.payePaydayHistory': [...base, { day: next, effectiveFrom }],
  }
}

/** The day keys a range covers, inclusive (`start` ≤ `end`), capped at 400. */
export function payeRangeDayKeys(start: string, end: string): string[] {
  if (!DAY_KEY.test(String(start || '')) || !DAY_KEY.test(String(end || '')) || start > end) return []
  const out: string[] = []
  let cursor = start
  while (cursor <= end && out.length <= 400) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

/** `{ start, end }` with the two day keys in order; null when either is not a day key. */
export function payeCustomRange(start: unknown, end: unknown): { start: string; end: string } | null {
  const a = String(start ?? '').trim()
  const b = String(end ?? '').trim()
  if (!DAY_KEY.test(a) || !DAY_KEY.test(b)) return null
  return a <= b ? { start: a, end: b } : { start: b, end: a }
}

/**
 * Display-only helpers for User Timesheets → Exported (owner 24 Nov: compact list at 100% zoom, versions collapsed by
 * default). Every date is read in the organisation's time zone (guardrail 2); nothing here decides pay, hours or who
 * sees what.
 */

function zoneParts(date: Date, timeZone: string): { day: string; month: string; year: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { day: pick('day'), month: pick('month'), year: pick('year'), hour: pick('hour'), minute: pick('minute') }
}

/**
 * "24 Nov, 20:07" — the year only when it is not the current year in the organisation zone ("24 Nov 2025, 20:07").
 * `now` is passed so the result is testable.
 */
export function formatExportedStamp(date: Date, timeZone: string, now: Date = new Date()): string {
  const at = zoneParts(date, timeZone)
  const today = zoneParts(now, timeZone)
  const day = at.year === today.year ? `${at.day} ${at.month}` : `${at.day} ${at.month} ${at.year}`
  return `${day}, ${at.hour}:${at.minute}`
}

/**
 * A pay run on one line: "16–30 Nov 2026"; across months "26 Oct – 25 Nov 2026"; across years
 * "29 Dec 2025 – 4 Jan 2026". The long form (`formatPaymentPeriodLine`) stays for search and the run picker.
 */
export function formatCompactPayRun(start: Date, end: Date, timeZone: string): string {
  const from = zoneParts(start, timeZone)
  const to = zoneParts(end, timeZone)
  if (from.year === to.year && from.month === to.month) return `${from.day}–${to.day} ${to.month} ${to.year}`
  if (from.year === to.year) return `${from.day} ${from.month} – ${to.day} ${to.month} ${to.year}`
  return `${from.day} ${from.month} ${from.year} – ${to.day} ${to.month} ${to.year}`
}

/**
 * Which rows have their "Versions of this pay run" list open. Collapsed by default; kept for this browser session only
 * (module memory, no storage), so switching tabs and back keeps the choice.
 */
const sessionExpandedVersionRows = new Set<string>()

export function expandedVersionRowsForSession(): ReadonlySet<string> {
  return new Set(sessionExpandedVersionRows)
}

/** Opens or closes one row's versions list; returns the new set and remembers it for the session. */
export function toggleVersionRow(current: ReadonlySet<string>, rowId: string): Set<string> {
  const next = new Set(current)
  if (next.has(rowId)) next.delete(rowId)
  else next.add(rowId)
  sessionExpandedVersionRows.clear()
  for (const id of next) sessionExpandedVersionRows.add(id)
  return next
}

/** Test hook: forget the session's open rows. */
export function resetVersionRowsForTests(): void {
  sessionExpandedVersionRows.clear()
}

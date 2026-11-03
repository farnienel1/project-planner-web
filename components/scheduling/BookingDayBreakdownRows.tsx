'use client'

/**
 * Rulebook 1.18.0 (`weekendBookingBreakdown`): the per-day hours of a weekend booking, one row per day as the pay rule
 * prices it (e.g. "Saturday 07:30–14:00 = 8h (counts as a full day)", "Sunday 07:30–14:00 = 6.5h × 2 = 13h"). Days whose
 * figures are identical share one row ("Saturday/Sunday …"), as the rulebook allows. No figure is computed here.
 */
import type { BookingDayBreakdownRow } from '@/lib/canonical'

function collapsed(rows: ReadonlyArray<BookingDayBreakdownRow>): string[] {
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const body = row.line.slice(row.weekdayLabel.length)
    const labels = groups.get(body) ?? []
    if (!labels.includes(row.weekdayLabel)) labels.push(row.weekdayLabel)
    groups.set(body, labels)
  }
  return Array.from(groups.entries()).map(([body, labels]) => `${labels.join('/')}${body}`)
}

export function BookingDayBreakdownRows({
  rows,
  title = 'Hours by day',
}: {
  rows: ReadonlyArray<BookingDayBreakdownRow>
  title?: string
}) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {collapsed(rows).map((line) => (
          <li key={line} className="text-sm font-semibold tabular-nums text-slate-800">
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

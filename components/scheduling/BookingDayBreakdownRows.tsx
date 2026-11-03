'use client'

/**
 * Rulebook 1.18.0 / 1.19.0 (`weekendBookingBreakdown`): the per-day hours of a weekend booking, one row per day as the
 * pay rule prices it (e.g. "Saturday 07:30–14:00 = 8h − 0.5h unpaid break = 7.5h", "Sunday 07:30–14:00 = 6.5h × 2 = 13h").
 * Under each row its figures in the Mon–Fri breakdown style (set hours / unpaid break / outside hours × rate / total,
 * the row's canonical `lines`). Days whose figures are identical share one row ("Saturday/Sunday …"), as the rulebook
 * allows. No figure is computed here.
 */
import type { BookingDayBreakdownLine, BookingDayBreakdownRow } from '@/lib/canonical'

type Group = { line: string; lines: ReadonlyArray<BookingDayBreakdownLine> }

function collapsed(rows: ReadonlyArray<BookingDayBreakdownRow>): Group[] {
  const groups = new Map<string, { labels: string[]; lines: ReadonlyArray<BookingDayBreakdownLine> }>()
  for (const row of rows) {
    const body = row.line.slice(row.weekdayLabel.length)
    const group = groups.get(body) ?? { labels: [], lines: row.lines ?? [] }
    if (!group.labels.includes(row.weekdayLabel)) group.labels.push(row.weekdayLabel)
    groups.set(body, group)
  }
  return Array.from(groups.entries()).map(([body, group]) => ({ line: `${group.labels.join('/')}${body}`, lines: group.lines }))
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
      <ul className="mt-2 space-y-2">
        {collapsed(rows).map((group) => (
          <li key={group.line}>
            <p className="text-sm font-semibold tabular-nums text-slate-800">{group.line}</p>
            {group.lines.length > 1 ? (
              <dl className="mt-1 space-y-0.5">
                {group.lines.map((detail) => (
                  <div key={`${detail.kind}-${detail.label}`} className="flex items-baseline justify-between gap-3">
                    <dt className={`text-xs ${detail.kind === 'total' ? 'font-semibold text-slate-700' : 'font-medium text-slate-500'}`}>
                      {detail.label}
                    </dt>
                    <dd
                      className={`text-right text-xs tabular-nums ${
                        detail.kind === 'outside' ? 'font-semibold text-amber-800' : 'font-semibold text-slate-800'
                      }`}
                    >
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

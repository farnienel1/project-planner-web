'use client'

/**
 * Rulebook 1.18.0 / 1.19.0 (`weekendBookingBreakdown`): the per-day hours of a weekend booking, one row per day as the
 * pay rule prices it (e.g. "Saturday 07:30–14:00 = 8h − 0.5h unpaid break = 7.5h", "Sunday 07:30–14:00 = 6.5h × 2 = 13h").
 * Under each row its figures in the Mon–Fri breakdown style (set hours / unpaid break / outside hours × rate / total,
 * the row's canonical `lines`). Days whose figures are identical share one row ("Saturday/Sunday …"), as the rulebook
 * allows. No figure is computed here. Rulebook 1.39.0: under each row the explanation (`row.explanation`: the day's
 * rule and the steps, e.g. "Booked 07:30–10:30 = 3h of the 6.5h window → 8h × 3 ÷ 6.5 = 3.69h") replaces the
 * label/value list, so the figure says why it is what it is.
 */
import type { BookingDayBreakdownLine, BookingDayBreakdownRow } from '@/lib/canonical'
import { BookingHoursExplanation } from '@/components/scheduling/BookingHoursExplanation'

type Group = { line: string; lines: ReadonlyArray<BookingDayBreakdownLine>; rule: string; steps: ReadonlyArray<string> }

function withoutLabel(text: string, label: string): string {
  return text.startsWith(label) ? text.slice(label.length) : ` ${text}`
}

function collapsed(rows: ReadonlyArray<BookingDayBreakdownRow>): Group[] {
  const groups = new Map<
    string,
    { labels: string[]; body: string; ruleBody: string; lines: ReadonlyArray<BookingDayBreakdownLine>; steps: ReadonlyArray<string> }
  >()
  for (const row of rows) {
    const body = withoutLabel(row.line, row.weekdayLabel)
    const ruleBody = row.explanation?.rule ? withoutLabel(row.explanation.rule, row.weekdayLabel) : ''
    const steps = row.explanation?.steps ?? []
    // Days share a row only when the figure and its explanation read the same once the day name is taken off.
    const key = `${body}|${ruleBody}|${steps.join('|')}`
    const group = groups.get(key) ?? { labels: [], body, ruleBody, lines: row.lines ?? [], steps }
    if (!group.labels.includes(row.weekdayLabel)) group.labels.push(row.weekdayLabel)
    groups.set(key, group)
  }
  return Array.from(groups.values()).map((group) => {
    const label = group.labels.join('/')
    return { line: `${label}${group.body}`, lines: group.lines, rule: group.ruleBody ? `${label}${group.ruleBody}` : '', steps: group.steps }
  })
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
            {group.rule || group.steps.length > 0 ? (
              <BookingHoursExplanation rule={group.rule} steps={group.steps} className="mt-1" />
            ) : group.lines.length > 1 ? (
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

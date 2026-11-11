import type { HoursBreakdown } from '@/lib/scheduling/paidHours'
import type { BookingDayBreakdownRow } from '@/lib/canonical'
import { BookingDayBreakdownRows } from '@/components/scheduling/BookingDayBreakdownRows'
import { BookingHoursExplanation } from '@/components/scheduling/BookingHoursExplanation'

/**
 * The hours breakdown of one booking. Rulebook 1.18.0: on a Saturday or Sunday, `dayRows`
 * (`weekendBookingBreakdown`) replace the weekday summary, so the day's own rule is shown. Rulebook 1.39.0: on a weekday,
 * `explanation` (`bookingHoursExplanation`) is shown under the figures — the working day, unpaid break and overtime.
 */
export function HoursBreakdownCard({
  breakdown,
  dayRows,
  explanation,
}: {
  breakdown: HoursBreakdown
  dayRows?: ReadonlyArray<BookingDayBreakdownRow>
  explanation?: { rule: string; steps: ReadonlyArray<string> } | null
}) {
  if (dayRows && dayRows.length > 0) return <BookingDayBreakdownRows rows={dayRows} title="Hours breakdown" />
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hours breakdown</p>
      <dl className="mt-2 space-y-1.5">
        {breakdown.lines.map((line, index) => {
          if (line.kind === 'overtime-heading') {
            return (
              <p key={`${line.kind}-${index}`} className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                Overtime
              </p>
            )
          }
          if (line.kind === 'overtime') {
            return (
              <p
                key={`${line.kind}-${index}`}
                className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-semibold leading-snug text-amber-800"
              >
                {line.value}
              </p>
            )
          }
          if (line.kind === 'total') {
            return (
              <div key={`${line.kind}-${index}`} className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2">
                <dt className="text-sm font-semibold text-slate-700">{line.label}</dt>
                <dd className="text-lg font-bold tabular-nums text-slate-900">{line.value}</dd>
              </div>
            )
          }
          return (
            <div key={`${line.kind}-${index}`} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-medium text-slate-500">{line.label}</dt>
              <dd className="text-right text-sm font-semibold tabular-nums text-slate-800">{line.value}</dd>
            </div>
          )
        })}
      </dl>
      {explanation ? (
        <BookingHoursExplanation rule={explanation.rule} steps={explanation.steps} className="mt-2 border-t border-slate-200 pt-2" />
      ) : null}
    </div>
  )
}

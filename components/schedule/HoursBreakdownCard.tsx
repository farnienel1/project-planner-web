import type { HoursBreakdown } from '@/lib/scheduling/paidHours'

export function HoursBreakdownCard({ breakdown }: { breakdown: HoursBreakdown }) {
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
    </div>
  )
}

'use client'

/**
 * Rulebook 1.69.0 §4.3 (owner request 17 Nov, docs/design/hours-breakdown/): the booking hours summary line and the
 * Hours breakdown box — Normal hours, Overtime, Total paid hours — on every web booking screen. Shows the rulebook's
 * text only (`bookingHoursBreakdownDays` / `bookingHoursBreakdownRows`); nothing is worked out here. iOS draws the same
 * rows ("How the hours add up").
 */
import type { BookingHoursBreakdown, BookingHoursBreakdownDays } from '@/lib/canonical'
import '@/app/hours-breakdown.css'

/** "06:00–17:30 · 12.25 paid hours" under the timeline. */
export function HoursBreakdownSummary({ breakdown, className = '' }: { breakdown: BookingHoursBreakdownDays | null; className?: string }) {
  if (!breakdown) return null
  return (
    <p className={`hb-summary ${className}`} data-testid="hours-breakdown-summary">
      {breakdown.range} · <b>{breakdown.summaryHours}</b>
    </p>
  )
}

function Box({ day, title }: { day: BookingHoursBreakdown; title: string }) {
  return (
    <section className="hb-box" aria-label={`${title}, ${day.headerDetail}`} data-testid="hours-breakdown">
      <div className="hb-head">
        <span>{title}</span>
        <em>{day.headerDetail}</em>
      </div>
      <dl className="hb-rows">
        {day.rows.map((row) => (
          <div
            key={row.kind}
            className={`hb-row ${row.kind === 'overtime' ? 'ot' : row.kind === 'total' ? 'total' : ''}`}
            aria-label={row.accessibilityLabel}
            role="group"
          >
            <dt>
              <span className="hb-t">{row.label}</span>
              {row.details.map((detail) => (
                <span key={detail} className="hb-d">
                  {detail}
                </span>
              ))}
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** One box per group of days that read the same ("Tuesday/Wednesday, full day"). Nothing when there is no breakdown. */
export function HoursBreakdownBox({
  breakdown,
  title = 'Hours breakdown',
  className = '',
}: {
  breakdown: BookingHoursBreakdownDays | null
  title?: string
  className?: string
}) {
  if (!breakdown || breakdown.groups.length === 0) return null
  return (
    <div className={className}>
      {breakdown.groups.map((group) => (
        <Box key={group.dayKeys.join('|')} day={group} title={title} />
      ))}
    </div>
  )
}

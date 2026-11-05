/**
 * Labour Summary (admins; owner decisions 3, 7 and 10, 5 Nov 2026). Presentational: every figure is passed in from
 * existing sources — active projects (`activeJobsCount`, as the header), today's hours from Daily Overview's model
 * (`buildDailyOverview`: `labourHours`, `overtimeWorkedHours`, `overtimeMultiplier`), and the ring's booked / unbooked
 * / on-leave counts from the same model. "…" while a source is still loading. No period selector (today only).
 */

import type { ReactNode } from 'react'

export type TeamTodayCounts = { booked: number; unbooked: number; onLeave: number }

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function percent(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((100 * part) / total)}%`
}

export function TeamTodayRing({ counts }: { counts: TeamTodayCounts | null }) {
  const segments = counts
    ? [
        { key: 'booked', label: 'Booked', value: counts.booked, className: 'seg-booked' },
        { key: 'unbooked', label: 'Unbooked', value: counts.unbooked, className: 'seg-unbooked' },
        { key: 'leave', label: 'On annual leave', value: counts.onLeave, className: 'seg-leave' },
      ]
    : []
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  let offset = 0
  const label = counts
    ? `Today: ${counts.booked} booked, ${counts.unbooked} unbooked, ${counts.onLeave} on annual leave`
    : 'Today: loading'
  return (
    <div className="dash-today">
      <svg className="dash-donut" viewBox="0 0 120 120" role="img" aria-label={label}>
        <circle className="track" cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="14" />
        {total > 0
          ? segments.map((segment) => {
              const length = (segment.value / total) * CIRCUMFERENCE
              const circle =
                segment.value > 0 ? (
                  <circle
                    key={segment.key}
                    className={segment.className}
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    fill="none"
                    strokeWidth="14"
                    strokeDasharray={`${length} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 60 60)"
                  />
                ) : null
              offset += length
              return circle
            })
          : null}
        <text className="total" x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="600">
          {counts ? total : '…'}
        </text>
        <text className="cap" x="60" y="74" textAnchor="middle" fontSize="9.5">
          today
        </text>
      </svg>
      <ul className="dash-leg">
        {(counts ? segments : [
          { key: 'booked', label: 'Booked', value: null, className: 'seg-booked' },
          { key: 'unbooked', label: 'Unbooked', value: null, className: 'seg-unbooked' },
          { key: 'leave', label: 'On annual leave', value: null, className: 'seg-leave' },
        ]).map((segment) => (
          <li key={segment.key}>
            <i className={segment.className} aria-hidden />
            {segment.label}
            <b>{segment.value == null ? '…' : segment.value}</b>
            <span className="p">{segment.value == null ? '' : percent(segment.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LabourSummaryCard(props: {
  activeProjects: string
  hoursBooked: string
  overtimeHours: string
  overtimeLabel: string
  counts: TeamTodayCounts | null
  banner?: ReactNode
}) {
  return (
    <section className="dash-card" aria-labelledby="labour-summary-title">
      <div className="dash-ch">
        <h2 id="labour-summary-title">
          Labour Summary <small>Today</small>
        </h2>
      </div>
      <div className="dash-box">
        <div>
          <span className="n">{props.activeProjects}</span>
          <span className="l">Active projects</span>
        </div>
        <div>
          <span className="n">{props.hoursBooked}</span>
          <span className="l">Hours booked</span>
        </div>
        <div>
          <span className="n">{props.overtimeHours}</span>
          <span className="l">{props.overtimeLabel}</span>
        </div>
      </div>
      <TeamTodayRing counts={props.counts} />
      {props.banner}
    </section>
  )
}

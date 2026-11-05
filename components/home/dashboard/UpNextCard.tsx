/**
 * Up next (`upcomingDaySections`, unchanged) with See all → My Schedule, and the Maintenance "Soon" row at the
 * bottom (hidden for operatives, as before). Presentational.
 */

import Link from 'next/link'
import { WrenchIcon } from '@heroicons/react/24/outline'
import type { HomeUpNextDaySection } from '@/lib/home/upNext'

export function UpNextCard({ sections, showMaintenance }: { sections: HomeUpNextDaySection[]; showMaintenance: boolean }) {
  const rows = sections.flatMap((day) => day.rows.map((row) => ({ day, row })))
  return (
    <section className="dash-card" aria-labelledby="up-next-title">
      <div className="dash-ch">
        <h2 id="up-next-title">Up next</h2>
        <Link href="/dashboard/my-schedule" className="dash-link">
          See all
        </Link>
      </div>
      <div className="dash-list">
        {rows.length === 0 ? (
          <p className="dash-empty dash-li">No upcoming bookings on your schedule.</p>
        ) : (
          rows.map(({ day, row }) => (
            <Link key={row.id} href="/dashboard/my-schedule" className="dash-li">
              <span className="day" aria-label={day.heading}>
                {day.heading.slice(0, 3).toUpperCase()}
              </span>
              <span className="grow">
                <span className="t">{row.title}</span>
                <span className="s">{row.subtitle}</span>
              </span>
            </Link>
          ))
        )}
        {showMaintenance ? (
          <div className="dash-li soon">
            <span className="day grey">
              <WrenchIcon aria-hidden style={{ width: 15, height: 15 }} />
            </span>
            <span className="grow">
              <span className="t">
                Maintenance <span className="dash-tag t-amber">Soon</span>
              </span>
              <span className="s">Coming in a future update</span>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

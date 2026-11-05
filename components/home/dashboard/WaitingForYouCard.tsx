/**
 * "Waiting for you" (owner decision 12, 5 Nov 2026): only items that need no new data loading, each linking to its
 * existing page — leave requests to decide (`leaveDecisionQueue`), people missing a line manager
 * (`usersMissingLineManager`, admins), PAYE payday not set (`payePaydayBanner`, admins), pending invites
 * (`userRosterSegment` Pending). Hidden when nothing is waiting. Presentational.
 */

import Link from 'next/link'

export type WaitingItem = { key: string; label: string; detail: string; count: number | null; href: string }

export function WaitingForYouCard({ items }: { items: WaitingItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="dash-card" aria-labelledby="waiting-title">
      <div className="dash-ch">
        <h2 id="waiting-title">Waiting for you</h2>
      </div>
      <div className="dash-list">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className="dash-li">
            <span className="grow">
              <span className="t">{item.label}</span>
              <span className="s">{item.detail}</span>
            </span>
            {item.count != null ? <span className="dash-count">{item.count}</span> : null}
          </Link>
        ))}
      </div>
    </section>
  )
}

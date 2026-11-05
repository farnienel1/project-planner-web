'use client'

/**
 * "Who's on today" (admins). A read-only table of Daily Overview's rows for today (`whosOnRows`). Filter and Sort run
 * in memory on those rows only. "View all" opens Daily Overview (today).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { WHOS_ON_KIND_LABELS, type WhosOnKind, type WhosOnRow } from './whosOnRows'

type Sort = 'list' | 'name' | 'type'

export function WhosOnTodayCard({ rows }: { rows: WhosOnRow[] | null }) {
  const [filter, setFilter] = useState<'all' | WhosOnKind>('all')
  const [sort, setSort] = useState<Sort>('list')
  const shown = useMemo(() => {
    if (!rows) return null
    const filtered = filter === 'all' ? rows : rows.filter((row) => row.kind === filter)
    if (sort === 'list') return filtered
    const sorted = [...filtered]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    else sorted.sort((a, b) => a.typeLabel.localeCompare(b.typeLabel) || a.name.localeCompare(b.name))
    return sorted
  }, [rows, filter, sort])

  return (
    <section className="dash-card" aria-labelledby="whos-on-title">
      <div className="dash-ch" style={{ flexWrap: 'wrap' }}>
        <h2 id="whos-on-title">Who&apos;s on today</h2>
        <select className="dash-sel" aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | WhosOnKind)}>
          <option value="all">All</option>
          {(Object.keys(WHOS_ON_KIND_LABELS) as WhosOnKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {WHOS_ON_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
        <select className="dash-sel" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="list">As Daily overview</option>
          <option value="name">Name</option>
          <option value="type">Type</option>
        </select>
        <Link href="/dashboard/daily-overview" className="dash-link">
          View all
        </Link>
      </div>
      {shown == null ? (
        <p className="dash-empty">Loading today…</p>
      ) : shown.length === 0 ? (
        <p className="dash-empty">{rows && rows.length > 0 ? 'Nobody in this filter today.' : 'Nobody is on Daily overview today.'}</p>
      ) : (
        <div className="dash-tw" style={{ maxHeight: 420 }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Booking</th>
                <th scope="col">Type</th>
                <th scope="col">Hours</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.key}>
                  <td>{row.name}</td>
                  <td>{row.booking}</td>
                  <td>
                    <span className={`dash-tag t-${row.tone}`}>{row.typeLabel}</span>
                  </td>
                  <td>{row.hours}</td>
                  <td className="time">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

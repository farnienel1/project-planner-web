'use client'

/**
 * Rulebook 1.38.0 §27: Settings → Data health "Data check" (admins). Shows this browser's last data-check result
 * (`dataParitySummary`, organisation time zone) and its recent history, with a Check now button. Read-only: the
 * check compares counts and re-reads a list that differs; it never writes to Firestore.
 */

import { useEffect, useMemo } from 'react'
import { dataParitySummary } from '@/lib/canonical'
import { useDataParityStore } from '@/lib/dataParity/dataParityMonitor'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

export function DataParityCheck({ organizationId }: { organizationId: string }) {
  const { log, running, load, run } = useDataParityStore()

  useEffect(() => {
    load(organizationId)
  }, [organizationId, load])

  const timeZone = organizationZoneOr(null)
  const latest = log.length > 0 ? log[log.length - 1] : null
  const summary = useMemo(() => dataParitySummary({ entry: latest, timeZone }), [latest, timeZone])
  const history = useMemo(
    () => [...log].reverse().slice(1, 6).map((entry) => ({ entry, text: dataParitySummary({ entry, timeZone }).title })),
    [log, timeZone]
  )

  return (
    <section className="card p-4" aria-label="Data check">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">Data check</h2>
        <button
          type="button"
          className="btn sm"
          disabled={running}
          onClick={() => void run(organizationId, 'manual').catch(() => undefined)}
        >
          {running ? 'Checking…' : 'Check now'}
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--ink3)]">
        Compares the number of projects, small works, people, clients, bookings, annual leave and tasks this browser
        holds with the database, and reloads a list that differs. Read-only.
      </p>
      <p className={`mt-2 text-sm font-semibold${summary.tone === 'warning' ? ' text-[var(--red)]' : ''}`}>
        {summary.title}
      </p>
      {summary.lines.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-sm">
          {summary.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {history.length > 0 ? (
        <details className="mt-2 text-sm text-[var(--ink3)]">
          <summary>Earlier checks on this device</summary>
          <ul className="mt-1 space-y-0.5">
            {history.map(({ entry, text }) => (
              <li key={`${entry.atMs}-${entry.trigger}`}>{text}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  CONTENT_REPORT_REASON_LABELS,
  CONTENT_REPORTS_COLLECTION,
  CONTENT_REPORT_STATUS_OPEN,
  parseContentReportRow,
  type ContentReportReason,
  type ContentReportRow,
} from '@/lib/reports/contentReport'

function reasonLabel(reason: string): string {
  if (reason in CONTENT_REPORT_REASON_LABELS) {
    return CONTENT_REPORT_REASON_LABELS[reason as ContentReportReason]
  }
  return reason || '—'
}

export function DeveloperReportsList() {
  const [rows, setRows] = useState<ContentReportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!db) {
      setLoading(false)
      return
    }
    getDocs(query(collection(db, CONTENT_REPORTS_COLLECTION), where('status', '==', CONTENT_REPORT_STATUS_OPEN)))
      .then((snapshot) => {
        if (cancelled) return
        const next = snapshot.docs
          .map((item) => parseContentReportRow(item.id, item.data() as Record<string, unknown>))
          .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        setRows(next)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load reports.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="card pad">
      <h2 className="h2">Reports</h2>
      <p className="mt-1 text-xs text-[var(--ink3)]">Open file reports. Org, reason, path, reporter.</p>
      {loading ? <p className="mt-2 text-sm text-[var(--ink3)]">Loading reports…</p> : null}
      {error ? <p className="mt-2 text-sm font-semibold text-[var(--red)]">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--ink3)]">No open file reports.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl bg-[var(--soft)] px-3 py-2 text-sm">
              <p className="font-semibold">
                {row.orgName || row.orgId || 'Organisation'} · {reasonLabel(row.reason)}
              </p>
              <p className="mt-0.5 break-all text-xs text-[var(--ink3)]">{row.storagePath || row.fileUrl || '—'}</p>
              <p className="mt-0.5 text-xs text-[var(--ink3)]">
                {row.reporterEmail || row.reportedByUid || 'Reporter'}
                {row.createdAt ? ` · ${row.createdAt.toLocaleString('en-GB')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

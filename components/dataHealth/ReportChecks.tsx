'use client'

/**
 * Rulebook 1.65.0 §25 / §26 (mass-assignment audit 17 Nov, owner decision B): Settings → Data health "Reports that
 * don't match their records". The server checks every new overtime report and price work / expenses report against the
 * reviews, bookings and items it was built from (`overtimeReportIntegrity`, `payeClaimReportIntegrity`, Cloud Functions
 * `overtimeReportIntegrityCheck` / `payeClaimReportIntegrityCheck`) and stores one document per report at
 * `organizations/{orgId}/reportChecks/{reportId}` (`REPORT_CHECKS_COLLECTION`). This card lists the ones with a
 * mismatch. Admin only. Never writes; the reports themselves are never changed.
 */

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { parseReportCheckDocument, personIdSet, REPORT_CHECKS_COLLECTION } from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'

const HEADING = "Reports that don't match their records"
const HELP =
  'Each new overtime, price work or expenses report is checked against the bookings, reviews and items it was built from. These did not match. The report itself is unchanged; open the person’s Overtime, Expenses & Price Work to compare.'
const KIND_LABEL: Record<string, string> = { overtime: 'Overtime report', priceWork: 'Price work report', expense: 'Expenses report' }

export function ReportChecks({ organizationId }: { organizationId: string }) {
  const { users, loadUsers } = useOrgUserStore()
  const [rows, setRows] = useState<ReturnType<typeof parseReportCheckDocument>[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadUsers(organizationId)
  }, [organizationId, loadUsers])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    const checks = collection(getFirebaseDb(), 'organizations', organizationId, REPORT_CHECKS_COLLECTION)
    getDocs(query(checks, where('ok', '==', false), limit(200)))
      .then((snap) => {
        if (cancelled) return
        setRows(snap.docs.map((entry) => parseReportCheckDocument(entry.id, entry.data() as Record<string, unknown>)))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not read the report checks.')
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const nameOf = useMemo(
    () => (userId: string) => {
      // The report's userId may be a former invite id or a same-email account: match under every id (`personIdSet`).
      const key = userId.trim().toLowerCase()
      const person = users.find((row) => personIdSet(row, users).some((id) => id.trim().toLowerCase() === key))
      return person ? rosterDisplayName(person) : `Person ${userId.slice(0, 8)}`
    },
    [users]
  )

  return (
    <section className="card p-4" aria-label={HEADING}>
      <h2 className="text-[15px] font-bold">{HEADING}</h2>
      {error ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Could not check reports: {error}</p>
      ) : rows == null ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Checking reports…</p>
      ) : rows.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Every checked report matches its records.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--ink3)]">{HELP}</p>
          <ul className="mt-2 space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="text-sm">
                <span className="font-semibold">{nameOf(row.userId)}</span>
                <span className="text-[var(--ink3)]">
                  {' '}
                  — {KIND_LABEL[row.kind] ?? 'Report'} · report {row.reportedTotal} · records {row.recomputedTotal}
                </span>
                <ul className="ml-4 list-disc text-[var(--ink3)]">
                  {row.problems.map((problem, index) => (
                    <li key={`${row.id}-${index}`}>{problem.message}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

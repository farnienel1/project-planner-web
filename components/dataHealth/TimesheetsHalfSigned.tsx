'use client'

/**
 * Rulebook 1.54.0 §8 / §11 (owner decision 16 Nov, (a) + (c)): Settings → Data health "Timesheets half signed"
 * (`timesheetsHalfSigned`). Sheets the line manager signed whose person signature is missing (cleared by an older app
 * when price work or expenses were added) and that are not exported. Each row links to the sheet; the person signs it
 * again. Admin only. Reads the organisation's signed timesheet documents; never writes.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  TIMESHEETS_HALF_SIGNED_HEADING,
  TIMESHEETS_HALF_SIGNED_HELP,
  TIMESHEETS_HALF_SIGNED_NONE,
  timesheetsHalfSigned,
} from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'
import { timesheetsTeamHref } from '@/lib/timesheets/timesheetRoutes'

type SheetDoc = { id: string; data: Record<string, unknown> }

export function TimesheetsHalfSigned({ organizationId }: { organizationId: string }) {
  const { users, loadUsers } = useOrgUserStore()
  const [sheets, setSheets] = useState<SheetDoc[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadUsers(organizationId)
  }, [organizationId, loadUsers])

  useEffect(() => {
    let cancelled = false
    setSheets(null)
    setError(null)
    const db = getFirebaseDb()
    const settings = collection(db, 'organizations', organizationId, 'settings')
    // The line manager's signature is `managerSignedAt`; older sheets have only `approvedAt` (both read the same).
    Promise.all([getDocs(query(settings, where('managerSignedAt', '!=', null))), getDocs(query(settings, where('approvedAt', '!=', null)))])
      .then(([signed, approved]) => {
        if (cancelled) return
        const byId = new Map<string, SheetDoc>()
        for (const snap of [signed, approved]) {
          for (const entry of snap.docs) byId.set(entry.id, { id: entry.id, data: entry.data() as Record<string, unknown> })
        }
        setSheets([...byId.values()])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not read the timesheets.')
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const rows = useMemo(() => (sheets ? timesheetsHalfSigned(sheets) : []), [sheets])
  const nameOf = (userId: string) => {
    const person = users.find((row) => row.id === userId)
    return person ? rosterDisplayName(person) : `Person ${userId.slice(0, 8)}`
  }

  return (
    <section className="card p-4" aria-label={TIMESHEETS_HALF_SIGNED_HEADING}>
      <h2 className="text-[15px] font-bold">{TIMESHEETS_HALF_SIGNED_HEADING}</h2>
      {error ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Could not check timesheets: {error}</p>
      ) : sheets == null ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Checking timesheets…</p>
      ) : rows.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">{TIMESHEETS_HALF_SIGNED_NONE}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--ink3)]">{TIMESHEETS_HALF_SIGNED_HELP}</p>
          <ul className="mt-2 space-y-1.5">
            {rows.map((row) => (
              <li key={row.sheetId} className="text-sm">
                <Link
                  className="font-semibold underline"
                  href={timesheetsTeamHref({
                    tab: 'awaiting',
                    user: row.userId,
                    period: row.startDayKey || null,
                    periodEnd: row.endDayKey || null,
                  })}
                >
                  {nameOf(row.userId)}
                </Link>
                <span className="text-[var(--ink3)]">
                  {' '}
                  — {row.startDayKey || 'pay run'}
                  {row.endDayKey && row.endDayKey !== row.startDayKey ? ` to ${row.endDayKey}` : ''}
                  {row.managerSignedByName ? ` · signed by ${row.managerSignedByName}` : ''} · {row.sheetId}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/**
 * Dev-only read sample of each collection. Never writes.
 * Spec: docs/ios-parity/IOS_PARITY_REBUILD.md Phase 2 item 10
 */

'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  parseAppUserDocument,
  parseBooking,
  parseClient,
  parseHoliday,
  parseManager,
  parseManagerSiteBooking,
  parseNotification,
  parseOperative,
  parseProject,
  parseTask,
} from '@/lib/ios-parity/converters'

type Row = {
  collection: string
  sampled: number
  ok: number
  skipped: number
  examples: string[]
}

const isDev = process.env.NODE_ENV !== 'production'

async function sample(
  collectionName: string,
  orgId: string,
  parse: (id: string, data: Record<string, unknown>) => { ok: boolean; errors?: string[] }
): Promise<Row> {
  const db = getFirebaseDb()
  const snap = await getDocs(query(collection(db, 'organizations', orgId, collectionName), limit(25)))
  const examples: string[] = []
  let ok = 0
  let skipped = 0
  for (const docSnap of snap.docs) {
    const result = parse(docSnap.id, docSnap.data() as Record<string, unknown>)
    if (result.ok) ok += 1
    else {
      skipped += 1
      if (examples.length < 5) examples.push(`${docSnap.id}: ${(result.errors || []).join('; ')}`)
    }
  }
  return { collection: collectionName, sampled: snap.size, ok, skipped, examples }
}

export default function DataHealthPage() {
  const { user, organization } = useAuthStore()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!isDev) return
    const orgId = organization?.id
    if (!orgId || !user) return
    let cancelled = false
    setRunning(true)
    ;(async () => {
      try {
        const db = getFirebaseDb()
        const userSnap = await getDocs(query(collection(db, 'users'), limit(10)))
        const userRow: Row = { collection: 'users', sampled: 0, ok: 0, skipped: 0, examples: [] }
        for (const docSnap of userSnap.docs) {
          const data = docSnap.data() as Record<string, unknown>
          if (data.organizationId !== orgId) continue
          userRow.sampled += 1
          const parsed = parseAppUserDocument(docSnap.id, data)
          if (parsed.ok) userRow.ok += 1
          else {
            userRow.skipped += 1
            if (userRow.examples.length < 5) userRow.examples.push(`${docSnap.id}: ${parsed.errors.join('; ')}`)
          }
        }
        const rest = await Promise.all([
          sample('projects', orgId, (id, data) => parseProject(id, data, orgId)),
          sample('smallWorks', orgId, (id, data) => parseProject(id, data, orgId)),
          sample('bookings', orgId, (id, data) => parseBooking(id, data, orgId)),
          sample('managerSiteBookings', orgId, (id, data) => parseManagerSiteBooking(id, data, orgId)),
          sample('tasks', orgId, (id, data) => parseTask(id, data, orgId)),
          sample('clients', orgId, (id, data) => parseClient(id, data, orgId)),
          sample('operatives', orgId, (id, data) => parseOperative(id, data, orgId)),
          sample('managers', orgId, (id, data) => parseManager(id, data, orgId)),
          sample('holidayBookings', orgId, (id, data) => parseHoliday(id, data, orgId)),
          sample('notifications', orgId, (id, data) => parseNotification(id, data, orgId)),
        ])
        if (!cancelled) setRows([userRow, ...rest])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Health check failed')
      } finally {
        if (!cancelled) setRunning(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organization?.id, user])

  if (!isDev) {
    return <p className="text-sm text-ios-muted">Data health is only available in development builds.</p>
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-ios-chip-amber px-4 py-3 text-sm text-ios-icon-amber">
        Development only. Reads up to 25 documents per collection. Never writes.
      </p>
      {error ? <p className="text-sm text-ios-icon-red">{error}</p> : null}
      {running ? <p className="text-sm text-ios-muted">Sampling collections…</p> : null}
      <div className="overflow-hidden rounded-[16px] border border-ios-border bg-ios-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-[12px] uppercase tracking-wide text-ios-muted">
            <tr>
              <th className="px-4 py-2">Collection</th>
              <th className="px-4 py-2">Sampled</th>
              <th className="px-4 py-2">OK</th>
              <th className="px-4 py-2">Skipped</th>
              <th className="px-4 py-2">Examples</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.collection} className="border-t border-ios-border align-top">
                <td className="px-4 py-2 font-medium">{row.collection}</td>
                <td className="px-4 py-2">{row.sampled}</td>
                <td className="px-4 py-2">{row.ok}</td>
                <td className="px-4 py-2">{row.skipped}</td>
                <td className="px-4 py-2 text-xs text-ios-muted">
                  {row.examples.length === 0 ? '—' : row.examples.map((ex) => <div key={ex}>{ex}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

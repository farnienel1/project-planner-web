'use client'

/**
 * Admin-only, read-only scan of every booking in the open organisation.
 * Which rows are a problem comes from the rulebook (bookingHealthRows):
 * refused or repaired documents, a missing person or job, and ids iOS
 * cannot hold. Never writes.
 */

import { useState } from 'react'
import {
  collection,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  doc,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { bookingHealthRows, type BookingHealthKind, type BookingHealthRow } from '@/lib/canonical'

const PAGE = 500

const KIND_COPY: Record<BookingHealthKind, string> = {
  refused: 'Unreadable — hidden on both apps',
  repaired: 'Legacy spelling — readable, re-save to fix',
  missing_operative: 'Person no longer exists',
  missing_job: 'Job deleted — shows as “Deleted job”',
  ios_cannot_read: 'Id iOS cannot hold — hidden on iOS',
}

async function allIds(orgId: string, name: string): Promise<string[]> {
  const db = getFirebaseDb()
  const snap = await getDocs(collection(db, 'organizations', orgId, name))
  return snap.docs.map((row) => row.id)
}

export function BookingHealthScan({ organizationId }: { organizationId: string }) {
  const [running, setRunning] = useState(false)
  const [scanned, setScanned] = useState<number | null>(null)
  const [rows, setRows] = useState<BookingHealthRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setRunning(true)
    setError(null)
    setRows([])
    setScanned(null)
    try {
      const db = getFirebaseDb()
      const [operativeIds, projectIds, smallWorkIds, usersSnap, orgSnap] = await Promise.all([
        allIds(organizationId, 'operatives'),
        allIds(organizationId, 'projects'),
        allIds(organizationId, 'smallWorks'),
        getDocs(query(collection(db, 'users'), where('organizationId', '==', organizationId))),
        getDoc(doc(db, 'organizations', organizationId)),
      ])
      const members = Object.keys((orgSnap.data()?.members as Record<string, unknown> | undefined) ?? {})
      const userIds = [...usersSnap.docs.map((row) => row.id), ...members]

      const docs: Array<{ id: string; data: Record<string, unknown> }> = []
      let cursor: QueryDocumentSnapshot | null = null
      for (;;) {
        const base = collection(db, 'organizations', organizationId, 'bookings')
        const page: Query = cursor
          ? query(base, orderBy(documentId()), startAfter(cursor), limit(PAGE))
          : query(base, orderBy(documentId()), limit(PAGE))
        const snap: QuerySnapshot = await getDocs(page)
        for (const row of snap.docs) docs.push({ id: row.id, data: row.data() as Record<string, unknown> })
        setScanned(docs.length)
        if (snap.size < PAGE) break
        cursor = snap.docs[snap.docs.length - 1]
      }
      setRows(
        bookingHealthRows({
          docs,
          operativeIds,
          userIds,
          projectIds: [...projectIds, ...smallWorkIds],
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking scan failed')
    } finally {
      setRunning(false)
    }
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Bookings — full scan</h2>
          <p className="text-sm text-[var(--ink3)]">Admins only. Reads every booking in this company. Never writes.</p>
        </div>
        <button type="button" className="btn primary sm" disabled={running} onClick={() => void run()}>
          {running ? 'Scanning…' : 'Scan bookings'}
        </button>
      </div>
      {error ? <p className="banner" data-hue="red">{error}</p> : null}
      {scanned != null ? (
        <p className="text-sm text-[var(--ink2)]">
          {scanned} bookings read · {rows.length === 0 && !running ? 'no problems found' : `${rows.length} problems`}
          {Object.entries(counts).map(([kind, count]) => ` · ${KIND_COPY[kind as BookingHealthKind]}: ${count}`)}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-[12px] uppercase tracking-wide text-[var(--ink3)]">
              <tr>
                <th className="px-4 py-2">Booking</th>
                <th className="px-4 py-2">Problem</th>
                <th className="px-4 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.id}-${row.kind}`} className="border-t border-[var(--line)] align-top">
                  <td className="px-4 py-2 font-mono text-xs">{row.id}</td>
                  <td className="px-4 py-2">{KIND_COPY[row.kind]}</td>
                  <td className="px-4 py-2 text-xs text-[var(--ink3)]">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

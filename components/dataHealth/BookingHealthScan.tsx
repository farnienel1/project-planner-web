'use client'

/**
 * Admin-only scan of every booking in the open organisation.
 * Which rows are a problem comes from the rulebook (bookingHealthRows):
 * refused or repaired documents, a missing person or job, and ids iOS
 * cannot hold. The scan itself never writes. Two admin actions (owner, 3 Nov):
 * - "Fix all" for a legacy status spelling re-saves only `status` to the rulebook's spelling
 *   (`parseBookingDocument` → `normalizeBookingStatus`, written as a partial update with `bookingUpdateWriteFields`
 *   and write metadata).
 * - "Remove placeholder" deletes the old `INITIAL-PLACEHOLDER` setup row (with its tombstone, rulebook §2), after a
 *   confirm. Admins may delete bookings (`bookingWriteAllowed`, firestore.rules).
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
import { bookingStatusRepairs, isLegacyPlaceholderBookingRow } from '@/lib/dataHealth/bookingHealthActions'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { bookingUpdateWriteFields } from '@/lib/canonical/workDocumentReaders'
import { deleteBookingWithTombstone } from '@/lib/bookings/bookingTombstoneWrite'
import { auth } from '@/lib/firebase/config'

const PAGE = 500

const KIND_COPY: Record<BookingHealthKind, string> = {
  refused: 'Unreadable — hidden on both apps',
  repaired: 'Legacy spelling — readable, re-save to fix',
  missing_operative: 'Person no longer exists',
  missing_job: 'Job deleted — shows as “Deleted job”',
  ios_cannot_read: 'Id is not a UUID — iOS keeps it as a stored id',
}

/** Short in-page help for each problem (owner, 3 Nov). */
const KIND_HELP: Record<BookingHealthKind, string> = {
  refused:
    'Neither app can read this document, so it is hidden everywhere. An INITIAL-PLACEHOLDER row is an old setup placeholder, not a real booking, and can be removed.',
  repaired:
    'Both apps read it, but a field is stored in an old spelling (for example the status). Re-saving it in the current spelling removes the warning; nothing else changes.',
  missing_operative: 'The booked person was removed. The booking still counts and shows the stored name.',
  missing_job: 'The job was deleted. The booking stays and shows as “Deleted job”.',
  ios_cannot_read: 'An id that is not a UUID. iOS keeps it as stored; it is shown here so it can be checked.',
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
  const [docs, setDocs] = useState<Array<{ id: string; data: Record<string, unknown> }>>([])
  const [fixing, setFixing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const statusRepairs = bookingStatusRepairs(docs)
  const placeholderRows = rows.filter(isLegacyPlaceholderBookingRow)

  const fixStatuses = async () => {
    if (statusRepairs.length === 0) return
    setFixing(true)
    setError(null)
    setNotice(null)
    let fixed = 0
    const failed: string[] = []
    try {
      const db = getFirebaseDb()
      for (const repair of statusRepairs) {
        try {
          const wrote = await savePartialDocument(
            doc(db, 'organizations', organizationId, 'bookings', repair.id),
            { ...repair.data, status: repair.status },
            bookingUpdateWriteFields,
            { userId: auth?.currentUser?.uid ?? null, missing: 'refuse', base: repair.data }
          )
          if (wrote) fixed += 1
        } catch {
          failed.push(repair.id)
        }
      }
      setNotice(
        `Fixed ${fixed} booking${fixed === 1 ? '' : 's'}${failed.length ? ` · ${failed.length} could not be saved (${failed.slice(0, 3).join(', ')})` : ''}.`
      )
    } finally {
      setFixing(false)
    }
    await run()
  }

  const removePlaceholder = async (bookingId: string) => {
    if (!window.confirm('Remove this old setup placeholder? It is not a real booking. This cannot be undone.')) return
    setFixing(true)
    setError(null)
    setNotice(null)
    try {
      await deleteBookingWithTombstone(getFirebaseDb(), { organizationId, collection: 'bookings', bookingId })
      setNotice('Placeholder removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the placeholder')
    } finally {
      setFixing(false)
    }
    await run()
  }

  const run = async () => {
    setRunning(true)
    setError(null)
    setRows([])
    setDocs([])
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
      setDocs(docs)
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
          <p className="text-sm text-[var(--ink3)]">
            Admins only. Reads every booking in this company. The scan never writes; the fix buttons below change only
            what they say.
          </p>
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
      {notice ? <p className="banner" data-hue="green">{notice}</p> : null}
      {Object.keys(counts).length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {(Object.keys(counts) as BookingHealthKind[]).map((kind) => (
            <li key={kind}>
              <b>{KIND_COPY[kind]}</b> <span className="text-[var(--ink3)]">— {KIND_HELP[kind]}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {statusRepairs.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn sm" disabled={fixing || running} onClick={() => void fixStatuses()}>
            {fixing ? 'Fixing…' : `Fix all (${statusRepairs.length})`}
          </button>
          <span className="text-sm text-[var(--ink3)]">Re-saves only the status in the current spelling.</span>
        </div>
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
                  <td className="px-4 py-2 text-xs text-[var(--ink3)]">
                    {row.detail}
                    {placeholderRows.includes(row) ? (
                      <button
                        type="button"
                        className="btn xs ghost ml-2"
                        disabled={fixing || running}
                        onClick={() => void removePlaceholder(row.id)}
                      >
                        Remove placeholder
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

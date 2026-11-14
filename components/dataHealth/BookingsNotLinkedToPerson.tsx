'use client'

/**
 * Rulebook 1.44.0 §11, §21 (owner decision 14 Nov, question H option 1): Settings → Data health "Bookings not linked
 * to a person". Every stored person id on a labour or manager site booking that nobody in the company resolves to
 * (`unresolvedBookingPeople` over `resolveBookingPerson`), with its bookings' count, dates, jobs and bookers, and one
 * action per id: "Link to a person…" — after a confirm, the id is added to that person's `users/{uid}.formerUserIds`
 * (`linkBookingPersonWriteFields`, a partial update with write metadata; an admin Manage Users write, §16). Every
 * booking under the id then shows as that person everywhere, on both apps. Admin only. Reads whole collections.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { auth } from '@/lib/firebase/config'
import {
  LINK_BOOKING_PERSON_ACTION,
  UNRESOLVED_BOOKINGS_EMPTY,
  UNRESOLVED_BOOKINGS_HEADING,
  UNRESOLVED_BOOKINGS_HELP,
  linkBookingPersonCandidates,
  linkBookingPersonConfirmMessage,
  linkBookingPersonDoneMessage,
  linkBookingPersonWriteFields,
  parseBookingDocument,
  parseManagerSiteBookingDocument,
  rosterAliasIdsFor,
  unresolvedBookingPeople,
  type UnresolvedBookingInput,
  type UnresolvedBookingPerson,
} from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { formatLongDayKey } from '@/lib/canonical/dayKeys'

type Loaded = { bookings: UnresolvedBookingInput[] }

function jobLabel(data: Record<string, unknown>): string {
  const number = typeof data.jobNumber === 'string' || typeof data.jobNumber === 'number' ? String(data.jobNumber).trim() : ''
  const name = typeof data.siteName === 'string' ? data.siteName.trim() : typeof data.name === 'string' ? data.name.trim() : ''
  return [number, name].filter(Boolean).join(' · ')
}

export function BookingsNotLinkedToPerson({ organizationId }: { organizationId: string }) {
  const { users, userIdAliases, loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [choice, setChoice] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadUsers(organizationId)
    void loadOperatives(organizationId)
  }, [organizationId, loadUsers, loadOperatives])

  const run = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      const db = getFirebaseDb()
      const zone = organizationZoneOr()
      const [bookingSnap, managerSnap, projectSnap, smallWorkSnap] = await Promise.all([
        getDocs(collection(db, 'organizations', organizationId, 'bookings')),
        getDocs(collection(db, 'organizations', organizationId, 'managerSiteBookings')),
        getDocs(collection(db, 'organizations', organizationId, 'projects')),
        getDocs(collection(db, 'organizations', organizationId, 'smallWorks')),
      ])
      const jobs = new Map<string, string>()
      for (const row of [...projectSnap.docs, ...smallWorkSnap.docs]) jobs.set(row.id.toLowerCase(), jobLabel(row.data()))
      const jobName = (id: string | undefined) => (id ? jobs.get(id.toLowerCase()) ?? '' : '')
      const rows: UnresolvedBookingInput[] = []
      for (const snap of bookingSnap.docs) {
        const parsed = parseBookingDocument(snap.id, snap.data(), { timeZone: zone })
        if (!parsed.ok) continue
        const b = parsed.booking
        rows.push({
          id: b.id,
          personId: b.operativeId,
          dayKey: dayKeyInZone(new Date(b.dateMs), zone),
          jobId: b.projectId,
          jobName: jobName(b.projectId),
          bookedBy: b.bookedBy,
          collection: 'bookings',
        })
      }
      for (const snap of managerSnap.docs) {
        const parsed = parseManagerSiteBookingDocument(snap.id, snap.data(), { timeZone: zone })
        if (!parsed.ok) continue
        const b = parsed.booking
        rows.push({
          id: b.id,
          personId: b.userId,
          dayKey: dayKeyInZone(new Date(b.dateMs), zone),
          jobId: b.locationId ?? '',
          jobName: jobName(b.locationId),
          bookedBy: typeof snap.data().bookedBy === 'string' ? (snap.data().bookedBy as string) : '',
          collection: 'managerSiteBookings',
        })
      }
      setLoaded({ bookings: rows })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the bookings')
    } finally {
      setRunning(false)
    }
  }, [organizationId])

  useEffect(() => {
    void run()
  }, [run])

  const people = useMemo(
    () => ({
      accounts: users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        formerIds: u.formerUserIds ?? [],
        aliasIds: rosterAliasIdsFor(u.id, userIdAliases),
      })),
      operatives: operatives.map((o) => ({ id: o.id, email: o.email ?? null })),
    }),
    [users, userIdAliases, operatives]
  )

  const rows: UnresolvedBookingPerson[] = useMemo(
    () => (loaded ? unresolvedBookingPeople({ ...people, bookings: loaded.bookings }) : []),
    [loaded, people]
  )

  const candidates = useMemo(
    () =>
      linkBookingPersonCandidates(
        users.map((u) => ({
          id: u.id,
          firstName: u.firstName ?? null,
          surname: u.surname ?? null,
          name: (u as { name?: string | null }).name ?? null,
          email: u.email ?? null,
          organizationId: u.organizationId ?? null,
          isActive: u.isActive ?? null,
        })),
        organizationId
      ),
    [users, organizationId]
  )

  const link = async (row: UnresolvedBookingPerson) => {
    const person = candidates.find((c) => c.id === choice)
    if (!person) return
    if (!window.confirm(linkBookingPersonConfirmMessage(row.count, person.name))) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const db = getFirebaseDb()
      const ref = doc(db, 'users', person.id)
      // Read the stored list now, so a link added elsewhere is kept (append only).
      const stored = await getDoc(ref)
      const formerUserIds = stored.data()?.formerUserIds
      const write = linkBookingPersonWriteFields({
        person: { id: person.id, formerUserIds: Array.isArray(formerUserIds) ? formerUserIds : [] },
        personId: row.personId,
        actorUserId: auth?.currentUser?.uid ?? '',
        platform: 'web',
      })
      if (write) await updateDoc(ref, { ...write.set, updatedAt: serverTimestamp() })
      setNotice(linkBookingPersonDoneMessage(row.count, person.name))
      setPicking(null)
      setChoice('')
      await loadUsers(organizationId, { force: true })
    } catch (err) {
      setError(
        err instanceof Error && /permission/i.test(err.message)
          ? 'You do not have permission to change this person. Only an admin of this company can link bookings.'
          : err instanceof Error
            ? err.message
            : 'Could not link the bookings'
      )
    } finally {
      setSaving(false)
    }
  }

  if (rosterLoadedOrgId !== organizationId) return null

  return (
    <section className="card p-4" aria-label={UNRESOLVED_BOOKINGS_HEADING}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-bold">
          {UNRESOLVED_BOOKINGS_HEADING}
          {rows.length > 0 ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-px text-[12px] text-amber-800">{rows.length}</span> : null}
        </h2>
        <button type="button" className="btn sm" onClick={() => void run()} disabled={running}>
          {running ? 'Checking…' : 'Check again'}
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--ink3)]">{UNRESOLVED_BOOKINGS_HELP}</p>
      {error ? <p className="banner mt-2" data-hue="red">{error}</p> : null}
      {notice ? <p className="banner mt-2" data-hue="green">{notice}</p> : null}
      {!loaded ? (
        <p className="mt-2 text-sm text-[var(--ink3)]">Checking bookings…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--ink3)]">{UNRESOLVED_BOOKINGS_EMPTY}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.personId} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
              <p className="font-semibold">
                Unknown person · ID {row.idHint}
                <span className="ml-2 font-normal text-[var(--ink3)]">
                  {row.count} booking{row.count === 1 ? '' : 's'} ·{' '}
                  {row.firstDayKey === row.lastDayKey
                    ? formatLongDayKey(row.firstDayKey, organizationZoneOr())
                    : `${formatLongDayKey(row.firstDayKey, organizationZoneOr())} – ${formatLongDayKey(row.lastDayKey, organizationZoneOr())}`}
                </span>
              </p>
              <p className="mt-0.5 break-all text-[11px] text-[var(--ink3)]">Full ID: {row.personId}</p>
              {row.jobs.length > 0 ? (
                <p className="mt-1">
                  Jobs: {row.jobs.map((job) => `${job.jobName || job.jobId} (${job.count})`).join(', ')}
                </p>
              ) : null}
              {row.bookedBy.length > 0 ? <p className="mt-0.5 text-[var(--ink3)]">Booked by: {row.bookedBy.join(', ')}</p> : null}
              {picking === row.personId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`link-${row.personId}`}>Who is this?</label>
                  <select
                    id={`link-${row.personId}`}
                    className="input max-w-xs"
                    value={choice}
                    onChange={(event) => setChoice(event.target.value)}
                  >
                    <option value="">Choose who this is…</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.email ? ` (${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn primary sm" disabled={!choice || saving} onClick={() => void link(row)}>
                    {saving ? 'Linking…' : 'Link'}
                  </button>
                  <button type="button" className="btn sm ghost" disabled={saving} onClick={() => { setPicking(null); setChoice('') }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="btn sm mt-2" onClick={() => { setPicking(row.personId); setChoice('') }}>
                  {LINK_BOOKING_PERSON_ACTION}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

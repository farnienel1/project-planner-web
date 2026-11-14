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
import { arrayUnion, collection, doc, documentId, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { auth } from '@/lib/firebase/config'
import {
  LINK_BOOKING_PERSON_ACTION,
  LINK_BOOKING_PERSON_ALREADY_MESSAGE,
  LINK_BOOKING_PERSON_PAY_ACK_LABEL,
  LINK_BOOKING_PERSON_SELF_NOTE,
  UNRESOLVED_BOOKINGS_EMPTY,
  UNRESOLVED_BOOKINGS_HEADING,
  UNRESOLVED_BOOKINGS_HELP,
  linkBookingPersonCandidates,
  linkBookingPersonConfirmMessage,
  linkBookingPersonDoneMessage,
  linkBookingPersonImpact,
  linkBookingPersonRefusal,
  linkBookingPersonWriteFields,
  parseBookingDocument,
  parseManagerSiteBookingDocument,
  rosterAliasIdsFor,
  unresolvedBookingPeople,
  type LinkBookingPersonFiledUnder,
  type LinkBookingPersonImpact,
  type LinkCandidateProfile,
  type UnresolvedBookingInput,
  type UnresolvedBookingPerson,
} from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { formatLongDayKey } from '@/lib/canonical/dayKeys'

type Loaded = { bookings: UnresolvedBookingInput[] }

/** A users document as the link rules read it (every document of the organisation, never the email fold). */
function linkProfile(id: string, data: Record<string, unknown>): LinkCandidateProfile {
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  const str = (value: unknown) => (typeof value === 'string' ? value : null)
  return {
    id,
    firstName: str(data.firstName),
    surname: str(data.surname) ?? str(data.lastName),
    name: str(data.name),
    displayName: str(data.displayName),
    email: str(data.email),
    organizationId: str(data.organizationId),
    isActive: typeof data.isActive === 'boolean' ? data.isActive : null,
    passwordSet: typeof data.passwordSet === 'boolean' ? data.passwordSet : null,
    ghost: data.ghost === true,
    formerUserIds: list(data.formerUserIds),
    sameEmailUserIds: list(data.sameEmailUserIds),
  }
}

/** Every users document of the organisation, read from the server (the picker and the re-check). */
async function loadOrgRoster(organizationId: string): Promise<LinkCandidateProfile[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), 'users'), where('organizationId', '==', organizationId)))
  return snap.docs.map((row) => linkProfile(row.id, row.data()))
}

/**
 * Rulebook 1.44.0 §11 (`linkBookingPersonImpact`): what else is filed under the id — counted once per document,
 * whichever field names it. Admin reads; a collection the viewer may not read counts as 0 rather than blocking the link.
 */
async function loadFiledUnder(organizationId: string, personId: string): Promise<LinkBookingPersonFiledUnder> {
  const db = getFirebaseDb()
  const org = (name: string) => collection(db, 'organizations', organizationId, name)
  const count = async (queries: Array<ReturnType<typeof query>>): Promise<number> => {
    const ids = new Set<string>()
    for (const q of queries) {
      try {
        const snap = await getDocs(q)
        for (const d of snap.docs) ids.add(d.id)
      } catch {
        // Not readable for this viewer: leave it out of the count.
      }
    }
    return ids.size
  }
  const prefix = `timesheet_${personId}_`
  const [rateHistoryRows, leaveRecords, timesheets, overtimeRequests, priceWorkItems, expenseItems] = await Promise.all([
    count([
      query(org('operativeDayRateHistory'), where('userId', '==', personId)),
      query(org('operativeDayRateHistory'), where('operativeId', '==', personId)),
    ]),
    count([
      query(org('holidayBookings'), where('userId', '==', personId)),
      query(org('holidayBookings'), where('operativeId', '==', personId)),
    ]),
    count([
      query(org('settings'), where(documentId(), '>=', prefix), where(documentId(), '<', `${prefix}\uf8ff`)),
      query(org('settings'), where('userId', '==', personId)),
    ]),
    count([query(org('overtimeRequests'), where('userId', '==', personId))]),
    count([query(org('priceWorkItems'), where('userId', '==', personId))]),
    count([query(org('expenseItems'), where('userId', '==', personId))]),
  ])
  return { rateHistoryRows, leaveRecords, timesheets, overtimeRequests, priceWorkItems, expenseItems }
}

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
  const [impact, setImpact] = useState<LinkBookingPersonImpact | null>(null)
  const [payAck, setPayAck] = useState(false)
  const [choice, setChoice] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<LinkCandidateProfile[]>([])
  const viewer = useAuthStore((state) => state.user)
  const viewerIds = useMemo(
    () => [viewer?.id, ...(viewer?.formerUserIds ?? [])].filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
    [viewer]
  )

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
      const [bookingSnap, managerSnap, projectSnap, smallWorkSnap, orgRoster] = await Promise.all([
        getDocs(collection(db, 'organizations', organizationId, 'bookings')),
        getDocs(collection(db, 'organizations', organizationId, 'managerSiteBookings')),
        getDocs(collection(db, 'organizations', organizationId, 'projects')),
        getDocs(collection(db, 'organizations', organizationId, 'smallWorks')),
        loadOrgRoster(organizationId),
      ])
      setRoster(orgRoster)
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

  // Rulebook 1.44.0 §11: every users document of the organisation (not the email fold), one option per person, never the
  // viewer (nobody writes their own identity links — the rules refuse it, §16).
  const candidates = useMemo(
    () => linkBookingPersonCandidates(roster, organizationId, { viewerIds }),
    [roster, organizationId, viewerIds]
  )

  const link = async (row: UnresolvedBookingPerson) => {
    const person = candidates.find((c) => c.id === choice)
    if (!person) return
    if (!impact || (impact.requiresPayAck && !payAck)) return
    const confirmText = [linkBookingPersonConfirmMessage(row.count, person.name), impact.alsoText].filter(Boolean).join('\n\n')
    if (!window.confirm(confirmText)) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const db = getFirebaseDb()
      // A fresh read of the organisation's people and catalogue rows for the re-check (`linkBookingPersonRefusal`).
      const [freshRoster, operativeSnap] = await Promise.all([
        loadOrgRoster(organizationId),
        getDocs(collection(db, 'organizations', organizationId, 'operatives')),
      ])
      const freshOperatives = operativeSnap.docs.map((d) => ({
        id: d.id,
        email: typeof d.data().email === 'string' ? (d.data().email as string) : null,
      }))
      const ref = doc(db, 'users', person.id)
      const outcome = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists()) return { refused: 'That person no longer exists. Check again to refresh the list.' }
        // The chosen person as stored right now, laid over the fresh roster.
        const target = linkProfile(snap.id, snap.data())
        const rosterNow = [...freshRoster.filter((r) => r.id !== snap.id), target]
        const refusal = linkBookingPersonRefusal({
          personId: row.personId,
          targetId: person.id,
          roster: rosterNow,
          operatives: freshOperatives,
          organizationId,
          viewerIds,
        })
        if (refusal) return { refused: refusal.message }
        const write = linkBookingPersonWriteFields({
          person: { id: snap.id, formerUserIds: target.formerUserIds ?? [] },
          personId: row.personId,
          actorUserId: auth?.currentUser?.uid ?? '',
          platform: 'web',
        })
        if (!write) return { wrote: false }
        tx.update(ref, {
          formerUserIds: arrayUnion(...write.arrayUnion.formerUserIds),
          ...write.set,
          updatedAt: serverTimestamp(),
        })
        return { wrote: true }
      })
      if ('refused' in outcome) {
        setError(outcome.refused ?? null)
      } else {
        setNotice(outcome.wrote ? linkBookingPersonDoneMessage(row.count, person.name) : LINK_BOOKING_PERSON_ALREADY_MESSAGE)
        setPicking(null)
        setChoice('')
        setImpact(null)
        setPayAck(false)
        await loadUsers(organizationId, { force: true })
        await run()
      }
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
                  <span className="w-full text-[12px] text-[var(--ink3)]">{LINK_BOOKING_PERSON_SELF_NOTE}</span>
                  {!impact ? (
                    <span className="w-full text-[12px] text-[var(--ink3)]">Checking what else is filed under this ID…</span>
                  ) : impact.alsoText ? (
                    <span className="w-full text-[12px] font-medium text-amber-800">{impact.alsoText}</span>
                  ) : null}
                  {impact?.requiresPayAck ? (
                    <label className="flex w-full items-center gap-2 text-[12px]">
                      <input type="checkbox" checked={payAck} onChange={(event) => setPayAck(event.target.checked)} />
                      {LINK_BOOKING_PERSON_PAY_ACK_LABEL}
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="btn primary sm"
                    disabled={!choice || saving || !impact || (impact.requiresPayAck && !payAck)}
                    onClick={() => void link(row)}
                  >
                    {saving ? 'Linking…' : 'Link'}
                  </button>
                  <button type="button" className="btn sm ghost" disabled={saving} onClick={() => { setPicking(null); setChoice(''); setImpact(null); setPayAck(false) }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn sm mt-2"
                  onClick={() => {
                    setPicking(row.personId)
                    setChoice('')
                    setImpact(null)
                    setPayAck(false)
                    void loadFiledUnder(organizationId, row.personId).then((filed) => setImpact(linkBookingPersonImpact(filed)))
                  }}
                >
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

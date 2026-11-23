'use client'

/**
 * Rulebook 1.44.0 §11, §21 (owner decision 14 Nov, question H option 1): Settings → Data health "Bookings not linked
 * to a person". Every stored person id on a labour or manager site booking that nobody in the company resolves to
 * (`unresolvedBookingPeople` over `resolveBookingPerson`), with its bookings' count, dates, jobs and bookers, and one
 * action per id: "Link to a person…" — after a confirm, the id is added to that person's `users/{uid}.formerUserIds`
 * (`linkBookingPersonWriteFields`, a partial update with write metadata; an admin Manage Users write, §16). Every
 * booking under the id then shows as that person everywhere, on both apps. Admin only. Reads whole collections.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { linkPersonIdErrorMessage, linkPersonIdToPerson, loadFiledUnder, loadOrgRoster } from '@/lib/dataHealth/linkPersonId'
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
  parseBookingDocument,
  parseManagerSiteBookingDocument,
  rosterAliasIdsFor,
  unresolvedBookingPeople,
  type LinkBookingPersonImpact,
  type LinkCandidateProfile,
  type UnresolvedBookingInput,
  type UnresolvedBookingPerson,
} from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useFormerPeople } from '@/lib/people/formerPeople'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { createLatestRequest } from '@/lib/dataHealth/latestRequest'
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
  const { operatives, loadOperatives, managers, loadManagers } = useOperativeStore()
  // Rulebook 1.59.0 §11: deleted people's ids are listed apart, "Former person · Jane Smith".
  const formerPeople = useFormerPeople(organizationId)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [impact, setImpact] = useState<LinkBookingPersonImpact | null>(null)
  const [payAck, setPayAck] = useState(false)
  // Review r319: only the open row's latest count may land (row A's late answer never shows as row B's).
  const impactRequest = useRef(createLatestRequest())
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
    void loadManagers(organizationId)
  }, [organizationId, loadUsers, loadOperatives, loadManagers])

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
      managers: managers.map((m) => ({
        id: m.id,
        email: m.email ?? null,
        // Review of #370 (N3): an older row may carry only a single `name`.
        name:
          `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() ||
          (typeof (m as { name?: unknown }).name === 'string' ? ((m as { name?: string }).name ?? '').trim() : '') ||
          null,
      })),
      formerPeople,
    }),
    [users, userIdAliases, operatives, managers, formerPeople]
  )

  const rows: UnresolvedBookingPerson[] = useMemo(
    () => (loaded ? unresolvedBookingPeople({ ...people, bookings: loaded.bookings }) : []),
    [loaded, people]
  )
  // Rulebook 1.59.0: former people are listed apart, after the ids nobody can name.
  const sections = useMemo(
    () =>
      [
        { title: null as string | null, rows: rows.filter((row) => !row.former && !row.unlinkedManagerRow) },
        // Review of #370 (M2): managers list rows that match no account.
        { title: 'Managers list rows not linked to an account' as string | null, rows: rows.filter((row) => row.unlinkedManagerRow) },
        { title: 'Former people' as string | null, rows: rows.filter((row) => row.former) },
      ].filter((section) => section.rows.length > 0),
    [rows]
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
      const outcome = await linkPersonIdToPerson({ organizationId, personId: row.personId, targetId: person.id, viewerIds })
      if ('refused' in outcome) {
        setError(outcome.refused ?? null)
      } else {
        setNotice(outcome.wrote ? linkBookingPersonDoneMessage(row.count, person.name) : LINK_BOOKING_PERSON_ALREADY_MESSAGE)
        setPicking(null)
        setChoice('')
        setImpact(null)
        setPayAck(false)
        impactRequest.current.clear()
        await loadUsers(organizationId, { force: true })
        await run()
      }
    } catch (err) {
      setError(linkPersonIdErrorMessage(err, 'Could not link the bookings'))
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
      <p className="mt-1 text-sm text-(--ink3)">{UNRESOLVED_BOOKINGS_HELP}</p>
      {error ? <p className="banner mt-2" data-hue="red">{error}</p> : null}
      {notice ? <p className="banner mt-2" data-hue="green">{notice}</p> : null}
      {!loaded ? (
        <p className="mt-2 text-sm text-(--ink3)">Checking bookings…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-(--ink3)">{UNRESOLVED_BOOKINGS_EMPTY}</p>
      ) : (
        sections.map((section) => (
        <div key={section.title ?? 'unknown'}>
        {section.title ? <h3 className="mt-4 text-[13px] font-bold">{section.title}</h3> : null}
        <ul className="mt-3 space-y-3">
          {section.rows.map((row) => (
            <li key={row.personId} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
              <p className="font-semibold">
                {row.former || row.unlinkedManagerRow ? row.label : `Unknown person · ID ${row.idHint}`}
                <span className="ml-2 font-normal text-(--ink3)">
                  {row.count} booking{row.count === 1 ? '' : 's'} ·{' '}
                  {row.firstDayKey === row.lastDayKey
                    ? formatLongDayKey(row.firstDayKey, organizationZoneOr())
                    : `${formatLongDayKey(row.firstDayKey, organizationZoneOr())} – ${formatLongDayKey(row.lastDayKey, organizationZoneOr())}`}
                </span>
              </p>
              <p className="mt-0.5 break-all text-[11px] text-(--ink3)">Full ID: {row.personId}</p>
              {row.jobs.length > 0 ? (
                <p className="mt-1">
                  Jobs: {row.jobs.map((job) => `${job.jobName || job.jobId} (${job.count})`).join(', ')}
                </p>
              ) : null}
              {row.bookedBy.length > 0 ? <p className="mt-0.5 text-(--ink3)">Booked by: {row.bookedBy.join(', ')}</p> : null}
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
                  <span className="w-full text-[12px] text-(--ink3)">{LINK_BOOKING_PERSON_SELF_NOTE}</span>
                  {!impact ? (
                    <span className="w-full text-[12px] text-(--ink3)">Checking what else is filed under this ID…</span>
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
                  <button type="button" className="btn sm ghost" disabled={saving} onClick={() => { setPicking(null); setChoice(''); setImpact(null); setPayAck(false); impactRequest.current.clear() }}>
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
                    const token = impactRequest.current.begin(row.personId)
                    void loadFiledUnder(organizationId, row.personId).then((filed) => {
                      if (impactRequest.current.isCurrent(token)) setImpact(linkBookingPersonImpact(filed))
                    })
                  }}
                >
                  {LINK_BOOKING_PERSON_ACTION}
                </button>
              )}
            </li>
          ))}
        </ul>
        </div>
        ))
      )}
    </section>
  )
}

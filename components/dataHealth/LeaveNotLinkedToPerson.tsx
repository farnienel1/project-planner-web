'use client'

/**
 * Rulebook 1.51.0 §7 (Q4b): Settings → Data health "Leave not linked to a person" (`leaveRecordsWithoutPerson`). Annual
 * leave records whose person id matches nobody under any id or email — the weekly report lists them as "Person not
 * found (id …)". Admin only.
 * Rulebook 1.70.0 §7, §11: leave of a deleted person kept as a former-person record (`deletedPeople`) is listed apart,
 * "Former person · Jane Smith" (`leaveRecordFormerPerson`, `formerPersonDataHealthLabel`); nothing is hidden.
 * Owner decision 23 Nov: each stored id gets the same "Link to a person…" action as "Bookings not linked to a person"
 * (rulebook 1.44.0 §11: `linkBookingPersonCandidates`, `linkBookingPersonImpact`, `linkBookingPersonRefusal`,
 * `linkBookingPersonWriteFields` — an arrayUnion of the id onto the chosen person's `formerUserIds`, one transaction,
 * never the viewer; shared code in `lib/dataHealth/linkPersonId.ts`). The id linked is the record's stored `userId`,
 * else its `operativeId`. A stored email is never linked (linking adds an id, not an email).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LINK_BOOKING_PERSON_ACTION,
  LINK_BOOKING_PERSON_ALREADY_MESSAGE,
  LINK_BOOKING_PERSON_PAY_ACK_LABEL,
  formerPersonDataHealthLabel,
  leaveRecordFormerPerson,
  leaveRecordsWithoutPerson,
  linkBookingPersonCandidates,
  linkBookingPersonImpact,
  organizationTimeZone,
  type LinkBookingPersonImpact,
  type LinkCandidateProfile,
} from '@/lib/canonical'
import { useFormerPeople } from '@/lib/people/formerPeople'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { weeklyReportLeavePeople } from '@/lib/weekly-report/weeklyReportData'
import { createLatestRequest } from '@/lib/dataHealth/latestRequest'
import { linkPersonIdErrorMessage, linkPersonIdToPerson, loadFiledUnder, loadOrgRoster } from '@/lib/dataHealth/linkPersonId'
import { leaveLinkTarget } from '@/lib/dataHealth/leaveLinkTarget'

const LEAVE_LINK_PERMISSION_MESSAGE =
  'You do not have permission to change this person. Only an admin of this company can link leave.'

export function LeaveNotLinkedToPerson({ organizationId }: { organizationId: string }) {
  const { bookings: holidays, loadBookings, loadedOrgId } = useHolidayStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, userIdAliases, loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const { data: organization } = useOrganizationDocument()
  const timeZone = organizationTimeZone((organization as { countryCode?: string } | null)?.countryCode)
  const formerPeople = useFormerPeople(organizationId)
  const viewer = useAuthStore((state) => state.user)
  const viewerIds = useMemo(
    () => [viewer?.id, ...(viewer?.formerUserIds ?? [])].filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
    [viewer]
  )
  const [roster, setRoster] = useState<LinkCandidateProfile[]>([])
  const [picking, setPicking] = useState<string | null>(null)
  const [choice, setChoice] = useState('')
  const [impact, setImpact] = useState<LinkBookingPersonImpact | null>(null)
  const [payAck, setPayAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const impactRequest = useRef(createLatestRequest())
  // Only the open row's roster read may land (review of #414: a slow read for an earlier row never fills this one).
  const rosterRequest = useRef(createLatestRequest())

  useEffect(() => {
    void loadBookings(organizationId)
    void loadOperatives(organizationId)
    void loadUsers(organizationId)
  }, [organizationId, loadBookings, loadOperatives, loadUsers])

  const rows = useMemo(
    () =>
      leaveRecordsWithoutPerson({
        records: holidays.map((holiday) => ({
          ...holidayBookingDayKeys(holiday, timeZone),
          id: holiday.id,
          userId: holiday.userId ?? null,
          operativeId: holiday.operativeId ?? null,
          timeSlot: holiday.timeSlot,
          status: holiday.status,
        })),
        people: weeklyReportLeavePeople(users, operatives, userIdAliases),
      }).map((row) => ({ ...row, former: leaveRecordFormerPerson(row, formerPeople), link: leaveLinkTarget(row) })),
    [holidays, users, operatives, userIdAliases, timeZone, formerPeople]
  )
  // Former people first under their own heading; every other record stays listed as before.
  const formerRows = rows.filter((row) => row.former)
  const notFoundRows = rows.filter((row) => !row.former)
  // How many listed records share each stored id (linking one id links them all).
  const recordsPerId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) if (row.link.id) counts.set(row.link.key, (counts.get(row.link.key) ?? 0) + 1)
    return counts
  }, [rows])

  const candidates = useMemo(
    () => linkBookingPersonCandidates(roster, organizationId, { viewerIds }),
    [roster, organizationId, viewerIds]
  )

  const reset = () => {
    setPicking(null)
    setChoice('')
    setImpact(null)
    setPayAck(false)
    impactRequest.current.clear()
    rosterRequest.current.clear()
  }

  const open = (rowId: string, personId: string) => {
    setPicking(rowId)
    setChoice('')
    setImpact(null)
    setPayAck(false)
    setError(null)
    setNotice(null)
    // Review of #414: the previous row's people list is cleared, so the picker never offers a stale list.
    setRoster([])
    // Rulebook 1.44.0 §11: every users document of the organisation (never the email fold), read fresh.
    const rosterToken = rosterRequest.current.begin(rowId)
    void loadOrgRoster(organizationId)
      .then((next) => {
        if (rosterRequest.current.isCurrent(rosterToken)) setRoster(next)
      })
      .catch((err) => {
        if (rosterRequest.current.isCurrent(rosterToken)) setError(linkPersonIdErrorMessage(err, 'Could not read the people list', LEAVE_LINK_PERMISSION_MESSAGE))
      })
    const token = impactRequest.current.begin(personId)
    void loadFiledUnder(organizationId, personId).then((filed) => {
      if (impactRequest.current.isCurrent(token)) setImpact(linkBookingPersonImpact(filed))
    })
  }

  const link = async (personId: string, count: number) => {
    const person = candidates.find((c) => c.id === choice)
    if (!person || !impact || (impact.requiresPayAck && !payAck)) return
    const confirmText = [
      `All ${count} leave record${count === 1 ? '' : 's'} under this ID will show as ${person.name || 'this person'}.`,
      impact.alsoText,
    ]
      .filter(Boolean)
      .join('\n\n')
    if (!window.confirm(confirmText)) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const outcome = await linkPersonIdToPerson({ organizationId, personId, targetId: person.id, viewerIds })
      if ('refused' in outcome) {
        setError(outcome.refused)
      } else {
        setNotice(
          outcome.wrote
            ? `Linked: ${count} leave record${count === 1 ? '' : 's'} now show${count === 1 ? 's' : ''} as ${person.name || 'this person'}.`
            : LINK_BOOKING_PERSON_ALREADY_MESSAGE
        )
        reset()
        await loadUsers(organizationId, { force: true })
      }
    } catch (err) {
      setError(linkPersonIdErrorMessage(err, 'Could not link the leave', LEAVE_LINK_PERMISSION_MESSAGE))
    } finally {
      setSaving(false)
    }
  }

  if (loadedOrgId !== organizationId || rosterLoadedOrgId !== organizationId) return null

  return (
    <section className="card p-4" aria-label="Leave not linked to a person">
      <h2 className="text-[15px] font-bold">Leave not linked to a person</h2>
      {error ? <p className="banner mt-2" data-hue="red">{error}</p> : null}
      {notice ? <p className="banner mt-2" data-hue="green">{notice}</p> : null}
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-(--ink3)">Every annual leave record matches a person.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {[...formerRows, ...notFoundRows].map((row) => (
            <li key={row.id} className="text-sm">
              <span className="font-semibold">
                {row.former
                  ? formerPersonDataHealthLabel(row.former.displayName)
                  : `Person not found (id ${row.userId || row.operativeId || '—'})`}
              </span>
              <span className="text-(--ink3)">
                {' '}
                — {row.startDayKey}
                {row.endDayKey && row.endDayKey !== row.startDayKey ? ` to ${row.endDayKey}` : ''} · {row.status} · leave record {row.id}
              </span>
              {row.link.reason === 'email' ? (
                <p className="mt-0.5 text-[12px] text-(--ink3)">
                  This record is stored under the email {row.link.value}, not an ID, so it can&apos;t be linked here. Give the person
                  that email on their account, or correct the record.
                </p>
              ) : row.link.reason === 'blank' ? (
                <p className="mt-0.5 text-[12px] text-(--ink3)">This record has no person ID to link.</p>
              ) : picking === row.id ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`link-leave-${row.id}`}>Who is this?</label>
                  <select
                    id={`link-leave-${row.id}`}
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
                  <span className="w-full text-[12px] text-(--ink3)">To link leave to yourself, ask another admin.</span>
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
                    onClick={() => void link(row.link.id, recordsPerId.get(row.link.key) ?? 1)}
                  >
                    {saving ? 'Linking…' : 'Link'}
                  </button>
                  <button type="button" className="btn sm ghost" disabled={saving} onClick={reset}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <button type="button" className="btn sm mt-1.5" disabled={saving} onClick={() => open(row.id, row.link.id)}>
                    {LINK_BOOKING_PERSON_ACTION}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

'use client'

/**
 * Rulebook 1.75.0 §5 (owner 23 Nov, C12): Settings → Data health "Qualifications with no expiry date of their own"
 * (`qualificationsMissingOwnExpiry`). People who hold a qualification whose library entry has an end date but who
 * have no expiry of their own for it, so they get no expiry warning or reminder. One row per person + qualification,
 * each linked to the person's qualifications editor. Admin only (the page's gate). Never writes.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { qualificationsMissingOwnExpiry } from '@/lib/canonical'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { hasOrgCollectionSnapshot } from '@/lib/firebase/subscribeOrgCollection'

/** The operative store's library listener key (`loadQualifications`). */
const LIBRARY_LISTENER_KEY = 'operativeStore:qualifications'

export const QUALIFICATION_LIBRARY_LOAD_FAILED_MESSAGE =
  'The qualification library did not load, so this list cannot be checked. Check the connection and try again.'

export function QualificationsMissingOwnExpiry({ organizationId }: { organizationId: string }) {
  const { operatives, qualifications, loadOperatives, loadQualifications, operativesLoadedOrgId } = useOperativeStore()
  const { loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const roster = useRosterDocuments(organizationId)
  const [libraryLoadedOrgId, setLibraryLoadedOrgId] = useState<string | null>(null)
  const [libraryFailedOrgId, setLibraryFailedOrgId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    void loadUsers(organizationId)
    void loadOperatives(organizationId)
  }, [organizationId, loadUsers, loadOperatives])

  // The store's `loadQualifications` keeps its listener error to itself (review of #426): a load that ends without a
  // snapshot is a failure here, shown as an error — never a list built without the library.
  useEffect(() => {
    let cancelled = false
    setLibraryFailedOrgId(null)
    void loadQualifications(organizationId)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return
        if (hasOrgCollectionSnapshot(LIBRARY_LISTENER_KEY, organizationId)) setLibraryLoadedOrgId(organizationId)
        else setLibraryFailedOrgId(organizationId)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, loadQualifications, attempt])

  const rows = useMemo(
    () =>
      qualificationsMissingOwnExpiry({
        operatives: operatives as never,
        qualifications: qualifications as never,
        roster: roster as never,
      }),
    [operatives, qualifications, roster]
  )

  if (libraryFailedOrgId === organizationId && libraryLoadedOrgId !== organizationId) {
    return (
      <section className="card p-4" aria-label="Qualifications with no expiry date of their own">
        <h2 className="text-[15px] font-bold">Qualifications with no expiry date of their own</h2>
        <p className="banner mt-2" data-hue="red">
          {QUALIFICATION_LIBRARY_LOAD_FAILED_MESSAGE}
        </p>
        <button type="button" className="btn sm mt-2" onClick={() => setAttempt((n) => n + 1)}>
          Retry
        </button>
      </section>
    )
  }

  const loaded =
    rosterLoadedOrgId === organizationId &&
    operativesLoadedOrgId === organizationId &&
    libraryLoadedOrgId === organizationId
  if (!loaded) return null

  return (
    <section className="card p-4" aria-label="Qualifications with no expiry date of their own">
      <h2 className="text-[15px] font-bold">Qualifications with no expiry date of their own</h2>
      <p className="mt-1 text-sm text-(--ink3)">
        The qualification library has an end date for these, but the person has no expiry date of their own, so they
        get no expiry warning or reminder. Open the person and set the date in their qualifications.
      </p>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-(--ink3)">Everyone with a qualification that expires has their own date.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => {
            const href = row.userId
              ? `/dashboard/users/${encodeURIComponent(row.userId)}/edit?from=users`
              : `/dashboard/operatives/${encodeURIComponent(row.operativeId)}/edit`
            return (
              <li key={`${row.personKey}|${row.qualificationId.toLowerCase()}`} className="text-sm">
                <Link className="font-semibold underline" href={href}>
                  {row.personName || row.operativeId}
                </Link>
                <span className="text-(--ink3)">
                  {' '}
                  — {row.qualificationName}
                  {row.active ? '' : ' (inactive)'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

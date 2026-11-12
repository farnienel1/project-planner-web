'use client'

/**
 * Rulebook 1.40.0 (review r306 #4): people with no stored employment type read as self-employed (§8), so from 1.40.0
 * they have no annual-leave allowance. Lists `usersMissingEmploymentType` over the organisation's users documents as
 * stored (the parsed roster fills in a default, so it cannot tell), with the pay profile laid over while `privatePay`
 * is on (`overlayRosterPay`: the employment type then lives there). Each row links to the person in Manage Users.
 * Admin only. Never writes.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { USER_MISSING_EMPLOYMENT_TYPE_MESSAGE, usersMissingEmploymentType } from '@/lib/canonical'
import { db } from '@/lib/firebase/config'
import { overlayRosterPay } from '@/lib/pay/payProfileOverlay'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'

type Row = { id: string; firstName?: string; surname?: string; email?: string }

export function UsersMissingEmploymentType({ organizationId }: { organizationId: string }) {
  const { loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const [missing, setMissing] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadUsers(organizationId)
  }, [organizationId, loadUsers])

  useEffect(() => {
    if (rosterLoadedOrgId !== organizationId) return
    let cancelled = false
    getDocs(query(collection(db, 'users'), where('organizationId', '==', organizationId)))
      .then((snap) => {
        if (cancelled) return
        const docs: Array<Record<string, unknown> & { id: string }> = snap.docs.map((row) => ({
          ...overlayRosterPay(organizationId, row.id, row.data() as Record<string, unknown>),
          id: row.id,
        }))
        const ids = new Set(usersMissingEmploymentType(docs as never))
        setMissing(
          docs
            .filter((row) => ids.has(row.id))
            .map((row) => ({
              id: row.id,
              firstName: typeof row.firstName === 'string' ? row.firstName : undefined,
              surname: typeof row.surname === 'string' ? row.surname : undefined,
              email: typeof row.email === 'string' ? row.email : undefined,
            }))
        )
      })
      .catch(() => {
        if (!cancelled) setError('Could not read the people list for this check.')
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, rosterLoadedOrgId])

  if (rosterLoadedOrgId !== organizationId) return null

  return (
    <section className="card p-4" aria-label="People with no employment type">
      <h2 className="text-[15px] font-bold">People with no employment type</h2>
      {error ? (
        <p className="mt-1 text-sm text-[var(--red)]">{error}</p>
      ) : missing == null ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Checking…</p>
      ) : missing.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Everyone has an employment type.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {missing.map((row) => (
            <li key={row.id} className="text-sm">
              <Link className="font-semibold underline" href={`/dashboard/users/${row.id}?from=users`}>
                {rosterDisplayName(row as never) || row.id}
              </Link>
              <span className="text-[var(--ink3)]"> — {USER_MISSING_EMPLOYMENT_TYPE_MESSAGE}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

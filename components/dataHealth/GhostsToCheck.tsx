'use client'

/**
 * Rulebook 1.34.0 §11: Settings → Data health "Ghosts to check" (`ghostsToCheck`). Ghost operatives with a missing
 * name, rate or active line manager, and every ghost converted from a no-login operatives row, each linked to their
 * profile. Admin only. Never writes.
 */

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { GHOST_CHECK_ISSUE_LABELS, ghostsToCheck } from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'

export function GhostsToCheck({ organizationId }: { organizationId: string }) {
  const { users, loadUsers, rosterLoadedOrgId } = useOrgUserStore()

  useEffect(() => {
    void loadUsers(organizationId)
  }, [organizationId, loadUsers])

  const rows = useMemo(() => ghostsToCheck(users as never), [users])
  const byId = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  if (rosterLoadedOrgId !== organizationId) return null

  return (
    <section className="card p-4" aria-label="Ghosts to check">
      <h2 className="text-[15px] font-bold">Ghosts to check</h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">No ghost operatives need checking.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => {
            const user = byId.get(row.id)
            return (
              <li key={row.id} className="text-sm">
                <Link className="font-semibold underline" href={`/dashboard/users/${row.id}/edit?from=users`}>
                  {(user && rosterDisplayName(user)) || row.id}
                </Link>
                <span className="text-[var(--ink3)]"> — {row.issues.map((issue) => GHOST_CHECK_ISSUE_LABELS[issue]).join('; ')}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

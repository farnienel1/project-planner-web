'use client'

/**
 * Rulebook 1.23.1 §11 (owner decision): every user is created with a level, so a person with none is a data fault.
 * Lists the roster rows `usersMissingLevel` reports, each linked to the person in Manage Users, where an admin picks
 * a level with Change user type. Admin only. Never writes.
 */

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { USER_MISSING_LEVEL_MESSAGE, usersMissingLevel } from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'

export function UsersMissingLevel({ organizationId }: { organizationId: string }) {
  const { users, loadUsers, rosterLoadedOrgId } = useOrgUserStore()

  useEffect(() => {
    void loadUsers(organizationId)
  }, [organizationId, loadUsers])

  const missing = useMemo(
    () =>
      usersMissingLevel(
        users.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          surname: user.surname,
          role: user.role ?? null,
          isSuperAdmin: user.isSuperAdmin ?? null,
          permissions: (user.permissions ?? null) as unknown as Record<string, unknown> | null,
        }))
      ),
    [users]
  )

  if (rosterLoadedOrgId !== organizationId) return null

  return (
    <section className="card p-4" aria-label="People with no user level">
      <h2 className="text-[15px] font-bold">People with no user level</h2>
      {missing.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Everyone has a user level.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {missing.map((row) => (
            <li key={row.id} className="text-sm">
              <Link className="font-semibold underline" href={`/dashboard/users/${row.id}?from=users`}>
                {rosterDisplayName(row) || row.id}
              </Link>
              <span className="text-[var(--ink3)]"> — {USER_MISSING_LEVEL_MESSAGE}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

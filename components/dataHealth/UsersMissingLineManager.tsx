'use client'

/**
 * Rulebook 1.28.0 §8, §11: active people who need a line manager and have none (`usersMissingLineManager`) — operatives
 * and managers, and admins whose self-manage toggles are not both on (Annual Leave Management, and Timesheet self-sign
 * unless PAYE). Each row links to the person in Manage Users and says what fixes it (`lineManagerRequiredError`).
 * Until fixed their timesheets and leave go to the other active admins (`leaveApproverIds`). Admin only. Never writes.
 */

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { matchesRosterSegment } from '@/lib/canonical'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'
import { userLineManagerRequiredError, usersWithoutRequiredLineManager } from '@/lib/annualLeave/holidayApprovalUtils'

export function UsersMissingLineManager({ organizationId }: { organizationId: string }) {
  const { users, loadUsers, rosterLoadedOrgId } = useOrgUserStore()

  useEffect(() => {
    void loadUsers(organizationId)
  }, [organizationId, loadUsers])

  const missing = useMemo(
    () =>
      usersWithoutRequiredLineManager(users)
        .filter((user) => matchesRosterSegment(user, 'active'))
        .map((user) => ({ user, message: userLineManagerRequiredError(user, users) })),
    [users]
  )

  if (rosterLoadedOrgId !== organizationId) return null

  return (
    <section className="card p-4" aria-label="People who need a line manager">
      <h2 className="text-[15px] font-bold">People who need a line manager</h2>
      {missing.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ink3)]">Everyone who needs a line manager has one.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {missing.map(({ user, message }) => (
            <li key={user.id} className="text-sm">
              <Link className="font-semibold underline" href={`/dashboard/users/${user.id}?from=users`}>
                {rosterDisplayName(user) || user.id}
              </Link>
              {message ? <span className="text-[var(--ink3)]"> — {message}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { directoryActiveUsers, organisationActivityRows } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import { formatOwnerWhen, matchesOwnerSearch, ownerPersonName, ownerRoleLabel } from '@/lib/analytics/ownerDirectory'
import { rosterStatusLabel } from '@/lib/staff/userRosterUtils'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import type { DateRangePreset } from '@/lib/analytics/events'
import { MaskedEmail } from '@/components/developer/MaskedEmail'
import { unfinishedSetupLabel } from '@/lib/owner/unfinishedSetup'
import { auditOwnerAction, ownerDeleteOrganisation } from '@/lib/owner/ownerActions'
import { OwnerUserAccountMenu } from '@/components/developer/OwnerUserAccountMenu'
import { collapseDirectoryUsers } from '@/lib/owner/collapseDirectoryUsers'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'

export function DeveloperOrganisationDetailScreen({ organisationId }: { organisationId: string }) {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const [query, setQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { organisations, users, events, loading, error, load } = useAnalyticsStore()
  const { suggestions, loadBoard } = useFeedbackStore()
  const { showFullEmails } = useConsolePrefs()

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

  const orgUsers = useMemo(
    () => collapseDirectoryUsers(users.filter((user) => user.organizationId === organisationId)).users,
    [users, organisationId]
  )
  const org = organisations.find((row) => row.id === organisationId)
  const activity = useMemo(
    () =>
      organisationActivityRows({
        organisations: org ? [org] : organisations.filter((row) => row.id === organisationId),
        users: orgUsers,
        events: events.filter((event) => event.organizationId === organisationId),
        ideas: suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.organizationId === organisationId),
        range,
      })[0],
    [org, organisations, organisationId, orgUsers, events, suggestions, range]
  )

  const visibleUsers = useMemo(
    () =>
      [...orgUsers]
        .sort((a, b) => ownerPersonName(a).localeCompare(ownerPersonName(b)))
        .filter((user) =>
          matchesOwnerSearch([ownerPersonName(user), user.email, user.role, rosterStatusLabel(user)], query)
        ),
    [orgUsers, query]
  )

  if (loading && users.length === 0 && organisations.length === 0 && !error) {
    return <LoadingSpinner label="Loading organisation…" />
  }

  const name = org?.name || activity?.name || unfinishedSetupLabel(orgUsers[0]?.email)
  if (!org && orgUsers.length === 0 && !loading) {
    return (
      <DeveloperShell title="Organisation" back={{ href: '/developer/organisations', label: 'Organisations' }}>
        <EmptyState title="Organisation not found" description="It may have been removed, or the owner console cannot read that tenant yet." />
      </DeveloperShell>
    )
  }

  return (
    <DeveloperShell title={name} back={{ href: '/developer/organisations', label: 'Organisations' }}>
      <p className="text-xs text-[var(--ink3)]">{organisationId}</p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <DeveloperStatus error={error} loading={loading} />
      {notice ? (
        <p className="banner" data-hue="green">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Registered users" value={orgUsers.length} />
        <MetricCard label="Active in range" value={Math.max(activity?.activeUsers || 0, directoryActiveUsers(orgUsers, range))} />
        {events.length > 0 ? (
          <MetricCard label="Product events" value={activity?.events || 0} />
        ) : null}
        <MetricCard label="Feedback" value={activity?.ideaCount || 0} />
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h2">Users</h2>
          <SearchField value={query} onChange={setQuery} placeholder="Search this organisation" />
        </div>
        {orgUsers.length === 0 ? (
          <EmptyState
            title="No users on this organisation"
            description="Live user records for this tenant will appear here as soon as they exist in Firestore."
          />
        ) : visibleUsers.length === 0 ? (
          <EmptyState title="No matching users" description="Try a different name or email." />
        ) : (
          <div className="card overflow-visible">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last seen</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-semibold">{ownerPersonName(user)}</td>
                    <td className="px-4 py-3">
                      <MaskedEmail
                        email={user.email}
                        reveal={showFullEmails}
                        onReveal={() => void auditOwnerAction('reveal_email', { targetUserId: user.id, targetOrgId: organisationId })}
                      />
                    </td>
                    <td className="px-4 py-3">{ownerRoleLabel(user.role)}</td>
                    <td className="px-4 py-3">{rosterStatusLabel(user)}</td>
                    <td className="px-4 py-3 text-[var(--ink2)]">{formatOwnerWhen(user.lastSeenAt, 'Never')}</td>
                    <OwnerUserAccountMenu
                      user={user}
                      onDone={(message) => {
                        setNotice(message)
                        void load()
                      }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[var(--ink3)]">
          Invite placeholders (UUID ids, last seen Never) are hidden when the same email later signed in as a Firebase Auth account. Future sign-ins delete the leftover row.{' '}
          <Link href="/developer/users">All users</Link>
        </p>
      </section>
      <section className="card pad space-y-3">
        <h2 className="h2">Danger zone</h2>
        <p className="text-sm text-[var(--ink2)]">
          Delete this organisation and its users, projects, bookings, timesheets and plan. This cannot be undone.
        </p>
        <button type="button" className="btn sm" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setConfirmDelete(true)}>
          Delete organisation…
        </button>
      </section>
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-org-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="delete-org-title" className="text-lg font-extrabold">
              Delete {name}?
            </h2>
            <p className="mt-2 text-sm text-[var(--ink2)]">
              Are you sure you want to delete this organisation? <strong>This can&apos;t be undone.</strong>
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ink2)]">
              <li>{orgUsers.length} users</li>
              <li>Projects, bookings, timesheets and timesheet value</li>
              <li>Plan / subscription (cancel in Stripe first if a refund is needed)</li>
            </ul>
            {busy ? <p className="banner mt-3" data-hue="red">{busy}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn sm ghost" autoFocus onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ background: 'var(--red)', color: 'white', borderColor: 'transparent' }}
                onClick={async () => {
                  setBusy('Working…')
                  try {
                    await ownerDeleteOrganisation(organisationId)
                    setConfirmDelete(false)
                  } catch (err) {
                    setBusy(err instanceof Error ? err.message : 'Could not delete.')
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DeveloperShell>
  )
}

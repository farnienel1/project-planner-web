'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { DeveloperShell, DeveloperStatus } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { MaskedEmail } from '@/components/developer/MaskedEmail'
import { ownerPersonName } from '@/lib/analytics/ownerDirectory'
import { isUnfinishedSetupName, isAbandonedUnfinishedSignup, unfinishedSetupLabel } from '@/lib/owner/unfinishedSetup'
import { isTestRecord, useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { auditOwnerAction, ownerDeleteUnfinishedUser, ownerMarkInternal } from '@/lib/owner/ownerActions'
import { formatOwnerWhen } from '@/lib/analytics/ownerDirectory'

export function DeveloperDataQualityScreen() {
  const { organisations, users, events, loading, error, load, refresh } = useAnalyticsStore()
  const { showFullEmails } = useConsolePrefs()
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const orgById = new Map(organisations.map((org) => [org.id, org]))
    const unfinishedUsers = users.filter((user) => {
      const org = orgById.get(user.organizationId)
      return !org || org.unfinishedSetup || isUnfinishedSetupName(org.name)
    })
    const abandoned = unfinishedUsers.filter((user) => isAbandonedUnfinishedSignup(user.createdAt))
    const testOrgs = organisations.filter((org) => isTestRecord(org))
    const missingSource = events.filter((event) => !event.source && !event.path)
    return { unfinishedUsers, abandoned, testOrgs, missingSource }
  }, [organisations, users, events])

  if (loading && users.length === 0 && !error) return <LoadingSpinner label="Loading data quality…" />

  return (
    <DeveloperShell
      title="Data quality"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-[var(--ink2)]">
        Unfinished sign-ups whose organisation document is missing are labelled Unfinished setup, never Unknown
        organisation. Personal data from abandoned sign-ups should not be kept indefinitely — delete after 12 months.
      </p>
      {notice ? (
        <p className="banner" data-hue={notice.startsWith('Could') ? 'red' : 'green'}>
          {notice}
        </p>
      ) : null}
      <DeveloperStatus error={error} loading={loading && users.length > 0} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card pad">
          <p className="eyebrow">Unfinished setup</p>
          <p className="mt-1 text-2xl font-extrabold">{rows.unfinishedUsers.length}</p>
        </div>
        <div className="card pad">
          <p className="eyebrow">Older than 12 months</p>
          <p className="mt-1 text-2xl font-extrabold">{rows.abandoned.length}</p>
        </div>
        <div className="card pad">
          <p className="eyebrow">Marked / likely test orgs</p>
          <p className="mt-1 text-2xl font-extrabold">{rows.testOrgs.length}</p>
        </div>
      </div>
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="h2">Orphaned and unfinished users</h2>
        </div>
        {rows.unfinishedUsers.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState title="No unfinished accounts" description="Every live user is attached to an organisation document." />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Organisation</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.unfinishedUsers.map((user) => (
                <tr key={user.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-semibold">{ownerPersonName(user)}</td>
                  <td className="px-4 py-3">
                    <MaskedEmail
                      email={user.email}
                      reveal={showFullEmails}
                      onReveal={() => void auditOwnerAction('reveal_email', { targetUserId: user.id })}
                    />
                  </td>
                  <td className="px-4 py-3">{unfinishedSetupLabel(user.email, showFullEmails)}</td>
                  <td className="px-4 py-3">
                    {formatOwnerWhen(user.createdAt)}
                    {isAbandonedUnfinishedSignup(user.createdAt) ? (
                      <span className="ml-2 rounded-full bg-[var(--warn-bg,#fef3c7)] px-2 py-0.5 text-[11px] font-bold">12-month cleanup</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn sm ghost"
                        disabled={busy === user.id}
                        onClick={async () => {
                          setBusy(user.id)
                          try {
                            await ownerMarkInternal({ uid: user.id, isInternal: true })
                            setNotice('Marked internal / test.')
                            await refresh()
                          } catch (err) {
                            setNotice(err instanceof Error ? err.message : 'Could not mark internal.')
                          } finally {
                            setBusy('')
                          }
                        }}
                      >
                        Mark internal
                      </button>
                      <button
                        type="button"
                        className="btn sm ghost"
                        disabled={busy === user.id}
                        onClick={async () => {
                          if (!window.confirm(`Delete unfinished account ${user.email}?`)) return
                          setBusy(user.id)
                          try {
                            await ownerDeleteUnfinishedUser(user.id)
                            setNotice('Deleted unfinished account.')
                            await refresh()
                          } catch (err) {
                            setNotice(err instanceof Error ? err.message : 'Could not delete.')
                          } finally {
                            setBusy('')
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="card pad space-y-2">
        <h2 className="h2">Test organisations</h2>
        {rows.testOrgs.length === 0 ? (
          <p className="text-sm text-[var(--ink3)]">None marked internal, and no obvious test names.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.testOrgs.map((org) => (
              <li key={org.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--soft)] px-3 py-2">
                <Link href={`/developer/organisations/${encodeURIComponent(org.id)}`} className="font-semibold">
                  {org.name}
                </Link>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={async () => {
                    try {
                      await ownerMarkInternal({ orgId: org.id, isInternal: true })
                      setNotice('Organisation marked internal.')
                      await refresh()
                    } catch (err) {
                      setNotice(err instanceof Error ? err.message : 'Could not mark internal.')
                    }
                  }}
                >
                  Mark internal
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DeveloperShell>
  )
}

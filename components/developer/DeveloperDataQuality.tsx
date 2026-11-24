'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { consoleEventsSince } from '@/lib/analytics/consolePeriod'
import { DeveloperShell, DeveloperStatus } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { MaskedEmail } from '@/components/developer/MaskedEmail'
import { ownerPersonName } from '@/lib/analytics/ownerDirectory'
import { isUnfinishedSetupName, isAbandonedUnfinishedSignup, unfinishedSetupLabel } from '@/lib/owner/unfinishedSetup'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { dataQualityTestOrgSections, filterMarkableOrgs, settledMarkOverrides } from '@/lib/owner/dataQualityTestOrgs'
import { auditOwnerAction, ownerDeleteUnfinishedUser, ownerMarkInternal } from '@/lib/owner/ownerActions'
import { formatOwnerWhen } from '@/lib/analytics/ownerDirectory'
import { useOwnerFreshAction } from '@/components/developer/OwnerReverify'

export function DeveloperDataQualityScreen() {
  const { organisations, users, events, loading, error, load, refresh } = useAnalyticsStore()
  const period = useConsolePrefs((state) => state.period)
  const { showFullEmails } = useConsolePrefs()
  const [notice, setNotice] = useState('')
  // Owner console PR 5: deleting needs a code from the last 10 minutes; asked for here when it is older.
  const { run: runFresh, dialog: reverifyDialog } = useOwnerFreshAction()
  /** Rows with a save in flight (several at once: one row finishing never re-enables another). */
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const isBusy = (id: string) => busyIds.has(id)
  const startBusy = (id: string) => setBusyIds((current) => new Set(current).add(id))
  const endBusy = (id: string) =>
    setBusyIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  /** Owner bug 17 Nov: each click shows its own progress and result on its row, never only a banner at the top. */
  const [rowNotice, setRowNotice] = useState<Record<string, RowNotice>>({})
  /** Organisations whose flag a click changed; shown at once, until the reload agrees (`settledMarkOverrides`). */
  const [orgOverrides, setOrgOverrides] = useState<Record<string, boolean>>({})
  const [markedUsers, setMarkedUsers] = useState<Record<string, true>>({})
  const [orgQuery, setOrgQuery] = useState('')

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
    const { marked: testOrgs, unmarked: markableOrgs } = dataQualityTestOrgSections(organisations, orgOverrides)
    const missingSource = events.filter((event) => !event.source && !event.path)
    return { unfinishedUsers, abandoned, testOrgs, markableOrgs, missingSource }
  }, [organisations, users, events, orgOverrides])

  useEffect(() => {
    setOrgOverrides((current) => {
      if (!Object.keys(current).length) return current
      const next = settledMarkOverrides(organisations, current)
      return Object.keys(next).length === Object.keys(current).length ? current : next
    })
  }, [organisations])

  const shownMarkable = filterMarkableOrgs(rows.markableOrgs, orgQuery)

  async function setOrgInternal(orgId: string, isInternal: boolean) {
    startBusy(orgId)
    setRowNotice((current) => ({ ...current, [orgId]: { tone: 'info', text: isInternal ? 'Marking…' : 'Unmarking…' } }))
    try {
      await ownerMarkInternal({ orgId, isInternal })
      setOrgOverrides((current) => ({ ...current, [orgId]: isInternal }))
      setRowNotice((current) => ({
        ...current,
        [orgId]: {
          tone: 'green',
          text: isInternal ? 'Marked internal. It is now hidden from customer counts.' : 'Unmarked. It counts as a customer again.',
        },
      }))
      void refresh()
    } catch (err) {
      setRowNotice((current) => ({
        ...current,
        [orgId]: { tone: 'red', text: err instanceof Error ? err.message : 'Could not update the internal flag.' },
      }))
    } finally {
      endBusy(orgId)
    }
  }

  if (loading && users.length === 0 && !error) return <LoadingSpinner label="Loading data quality…" />

  return (
    <DeveloperShell
      title="Data quality"
      eventsFrom={consoleEventsSince(period)}
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-(--ink2)">
        Unfinished sign-ups whose organisation document is missing are labelled Unfinished setup, never Unknown
        organisation. Personal data from abandoned sign-ups should not be kept indefinitely — delete after 12 months.
      </p>
      {notice ? (
        <p className="banner" data-hue={notice.startsWith('Could') ? 'red' : 'green'}>
          {notice}
        </p>
      ) : null}
      <DeveloperStatus error={error} loading={loading && users.length > 0} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card pad">
          <p className="eyebrow">Unfinished setup</p>
          <p className="mt-1 text-2xl font-extrabold">{rows.unfinishedUsers.length}</p>
        </div>
        <div className="card pad">
          <p className="eyebrow">Older than 12 months</p>
          <p className="mt-1 text-2xl font-extrabold">{rows.abandoned.length}</p>
        </div>
        <div className="card pad">
          <p className="eyebrow">Marked internal orgs</p>
          <p className="mt-1 text-2xl font-extrabold">{rows.testOrgs.length}</p>
        </div>
      </div>
      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="h2">Orphaned and unfinished users</h2>
        </div>
        {rows.unfinishedUsers.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState title="No unfinished accounts" description="Every live user is attached to an organisation document." />
          </div>
        ) : (
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-(--soft) text-xs uppercase text-(--ink3)">
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
                <tr key={user.id} className="border-t border-(--line)">
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
                      <span className="ml-2 rounded-full bg-(--warn-t) px-2 py-0.5 text-[11px] font-bold">12-month cleanup</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {user.isInternal === true || markedUsers[user.id] ? (
                        <span className="pill" data-hue="green">Marked internal</span>
                      ) : (
                        <button
                          type="button"
                          className="btn sm ghost"
                          disabled={isBusy(user.id)}
                          aria-busy={isBusy(user.id)}
                          onClick={async () => {
                            startBusy(user.id)
                            setRowNotice((current) => ({ ...current, [user.id]: { tone: 'info', text: 'Marking…' } }))
                            try {
                              await ownerMarkInternal({ uid: user.id, isInternal: true })
                              setMarkedUsers((current) => ({ ...current, [user.id]: true }))
                              setRowNotice((current) => ({ ...current, [user.id]: { tone: 'green', text: 'Marked internal.' } }))
                              void refresh()
                            } catch (err) {
                              setRowNotice((current) => ({
                                ...current,
                                [user.id]: { tone: 'red', text: err instanceof Error ? err.message : 'Could not mark internal.' },
                              }))
                            } finally {
                              endBusy(user.id)
                            }
                          }}
                        >
                          {isBusy(user.id) ? 'Marking…' : 'Mark internal'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn sm ghost"
                        disabled={isBusy(user.id)}
                        onClick={async () => {
                          if (!window.confirm(`Delete unfinished account ${user.email}?`)) return
                          startBusy(user.id)
                          try {
                            await runFresh(() => ownerDeleteUnfinishedUser(user.id, 'Data quality: unfinished sign-up'))
                            setNotice('Deleted unfinished account.')
                            await refresh()
                          } catch (err) {
                            setNotice(err instanceof Error ? err.message : 'Could not delete.')
                          } finally {
                            endBusy(user.id)
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <RowStatus notice={rowNotice[user.id]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="card pad space-y-3">
        <h2 className="h2">Test organisations</h2>
        <p className="text-sm text-(--ink2)">
          Organisations marked internal are your own test or demo companies. They are left out of customer counts.
        </p>
        {rows.testOrgs.length === 0 ? (
          <p className="text-sm text-(--ink3)">No organisation is marked internal yet.</p>
        ) : (
          <ul className="space-y-2 text-sm" aria-label="Organisations marked internal">
            {rows.testOrgs.map((org) => (
              <li key={org.id} className="rounded-xl bg-(--soft) px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/developer/organisations/${encodeURIComponent(org.id)}`} className="font-semibold">
                    {org.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="pill" data-hue="green">Marked internal</span>
                    <button
                      type="button"
                      className="btn sm ghost"
                      disabled={isBusy(org.id)}
                      aria-busy={isBusy(org.id)}
                      onClick={() => void setOrgInternal(org.id, false)}
                    >
                      {isBusy(org.id) ? 'Unmarking…' : 'Unmark'}
                    </button>
                  </div>
                </div>
                <RowStatus notice={rowNotice[org.id]} />
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2 border-t border-(--line) pt-3">
          <h3 className="text-sm font-bold">Mark another organisation as internal</h3>
          <input
            type="search"
            className="pp-in w-full sm:max-w-sm"
            placeholder="Search organisations by name"
            aria-label="Search organisations to mark internal"
            value={orgQuery}
            onChange={(event) => setOrgQuery(event.target.value)}
          />
          {rows.markableOrgs.length === 0 ? (
            <p className="text-sm text-(--ink3)">Every organisation is already marked internal.</p>
          ) : shownMarkable.length === 0 ? (
            <p className="text-sm text-(--ink3)">No organisation matches that search.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm" aria-label="Organisations not marked internal">
              {shownMarkable.map((org) => (
                <li key={org.id} className="rounded-xl bg-(--soft) px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={`/developer/organisations/${encodeURIComponent(org.id)}`} className="font-semibold">
                      {org.name}
                    </Link>
                    <button
                      type="button"
                      className="btn sm ghost"
                      disabled={isBusy(org.id)}
                      aria-busy={isBusy(org.id)}
                      onClick={() => void setOrgInternal(org.id, true)}
                    >
                      {isBusy(org.id) ? 'Marking…' : 'Mark internal'}
                    </button>
                  </div>
                  <RowStatus notice={rowNotice[org.id]} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {reverifyDialog}
    </DeveloperShell>
  )
}

type RowNotice = { tone: 'info' | 'green' | 'red'; text: string }

/** The result of the last click on a row, right under it (announced to screen readers). */
function RowStatus({ notice }: { notice?: RowNotice }) {
  if (!notice) return null
  return (
    <p
      className="banner mt-2 px-3! py-2! text-xs font-semibold"
      data-hue={notice.tone === 'info' ? 'blue' : notice.tone}
      role={notice.tone === 'red' ? 'alert' : 'status'}
    >
      {notice.text}
    </p>
  )
}

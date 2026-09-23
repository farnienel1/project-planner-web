'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { directoryActiveUsers } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import { formatOwnerWhen, matchesOwnerSearch, ownerPersonName, ownerRoleLabel } from '@/lib/analytics/ownerDirectory'
import { rosterStatusLabel } from '@/lib/staff/userRosterUtils'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import type { DateRangePreset } from '@/lib/analytics/events'
import { MaskedEmail } from '@/components/developer/MaskedEmail'
import { emailTypoHint } from '@/lib/auth/emailTypo'
import { isTestRecord, useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { unfinishedSetupLabel } from '@/lib/owner/unfinishedSetup'
import { auditOwnerAction, ownerSendPasswordReset } from '@/lib/owner/ownerActions'
import { emailsMatchIgnoreMask } from '@/lib/auth/maskEmail'

export function DeveloperUsersScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const searchParams = useSearchParams()
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { organisations, users, loading, error, load, refresh } = useAnalyticsStore()
  const { includeTestData, showFullEmails, setShowFullEmails, jumpQuery } = useConsolePrefs()

  useEffect(() => {
    void load()
  }, [load])

  const orgName = useMemo(() => {
    const map = new Map(organisations.map((org) => [org.id, org]))
    return (id: string, email?: string) => {
      const org = map.get(id)
      if (org?.unfinishedSetup || !org) return unfinishedSetupLabel(email, showFullEmails)
      return org.name
    }
  }, [organisations, showFullEmails])

  const filteredUsers = useMemo(
    () => (includeTestData ? users : users.filter((user) => !isTestRecord(user))),
    [includeTestData, users]
  )

  const visible = useMemo(() => {
    const needle = (query || jumpQuery).trim()
    return [...filteredUsers]
      .sort((a, b) => ownerPersonName(a).localeCompare(ownerPersonName(b)))
      .filter((user) =>
        matchesOwnerSearch(
          [ownerPersonName(user), user.email, orgName(user.organizationId, user.email), user.organizationId, user.role],
          needle
        ) || emailsMatchIgnoreMask(user.email, needle)
      )
  }, [filteredUsers, query, jumpQuery, orgName])

  if (loading && users.length === 0 && !error) {
    return <LoadingSpinner label="Loading users…" />
  }

  return (
    <DeveloperShell
      title="Users"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn sm ${showFullEmails ? 'primary' : 'ghost'}`}
            onClick={() => {
              const next = !showFullEmails
              setShowFullEmails(next)
              if (next) void auditOwnerAction('reveal_all_emails', { reason: 'users_table' })
            }}
          >
            {showFullEmails ? 'Hide full emails' : 'Show full emails'}
          </button>
          <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-[var(--ink2)]">
        Every live account across every organisation. Emails are masked until you reveal them. Each reveal is written to
        the audit log.
      </p>
      {searchParams.get('fix') ? (
        <p className="banner" data-hue="warn">
          Open support request for user {searchParams.get('fix')}. Use Send password reset here; changing the login email
          needs the Admin SDK on the server.
        </p>
      ) : null}
      <DateRangePicker preset={preset} onChange={setPreset} />
      <SearchField value={query} onChange={setQuery} placeholder="Search users, emails or organisations" />
      <DeveloperStatus error={error} loading={loading && users.length > 0} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Registered users" value={filteredUsers.length} />
        <MetricCard label="Active in range" value={directoryActiveUsers(filteredUsers, range)} hint="From last-seen on user records" />
        <MetricCard label="Organisations" value={organisations.length} href="/developer/organisations" />
      </div>
      {filteredUsers.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Accounts appear here as soon as someone completes organisation setup."
        />
      ) : visible.length === 0 ? (
        <EmptyState title="No matching users" description="Try a different name, email or organisation." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Login email</th>
                <th className="px-4 py-2">Organisation</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last login</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const typo = emailTypoHint(user.email)
                return (
                  <tr key={user.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-semibold">{ownerPersonName(user)}</td>
                    <td className="px-4 py-3">
                      <MaskedEmail
                        email={user.email}
                        reveal={showFullEmails}
                        onReveal={() => void auditOwnerAction('reveal_email', { targetUserId: user.id })}
                      />
                      {typo ? <p className="text-[11px] font-bold text-[var(--warn,#b45309)]">⚠ check · {typo}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/developer/organisations/${encodeURIComponent(user.organizationId)}`} className="font-semibold">
                        {orgName(user.organizationId, user.email)}
                      </Link>
                      <p className="text-[11px] text-[var(--ink3)]">{user.organizationId}</p>
                    </td>
                    <td className="px-4 py-3">{ownerRoleLabel(user.role)}</td>
                    <td className="px-4 py-3">{rosterStatusLabel(user)}</td>
                    <td className="px-4 py-3 text-[var(--ink2)]">{formatOwnerWhen(user.lastSeenAt, 'Never')}</td>
                    <td className="relative px-4 py-3">
                      <button type="button" className="btn sm ghost" onClick={() => setMenuFor(menuFor === user.id ? null : user.id)}>
                        ⋯
                      </button>
                      {menuFor === user.id ? (
                        <div className="absolute right-4 z-20 mt-1 w-52 rounded-xl border border-[var(--line)] bg-white p-1 shadow-lg">
                          <Link href={`/developer/organisations/${encodeURIComponent(user.organizationId)}`} className="block rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--soft)]">
                            View organisation
                          </Link>
                          <button
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--soft)]"
                            disabled={busy === user.id}
                            onClick={() => {
                              void navigator.clipboard.writeText(user.id)
                              setNotice('User id copied.')
                              setMenuFor(null)
                            }}
                          >
                            Copy user ID
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--soft)]"
                            disabled={busy === user.id}
                            onClick={async () => {
                              setBusy(user.id)
                              setNotice('')
                              try {
                                await ownerSendPasswordReset(user.id, user.email)
                                setNotice(`Reset sent for ${ownerPersonName(user)}.`)
                              } catch (err) {
                                setNotice(err instanceof Error ? err.message : 'Could not send reset.')
                              } finally {
                                setBusy('')
                                setMenuFor(null)
                              }
                            }}
                          >
                            Send password reset…
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </DeveloperShell>
  )
}

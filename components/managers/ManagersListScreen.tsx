/**
 * iOS parity source: Views/ManagersView.swift
 * Spec: docs/ios-parity/sections/10-managers.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BriefcaseIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { hasAdminAccess, canViewManagers } from '@/lib/permissions'
import { PLACEHOLDER_MANAGER_EXPLANATION } from '@/lib/staff/managerRosterUtils'
import {
  emptyRosterTitle,
  filterRosterByNameQuery,
  getManagersRosterUsers,
  matchesRosterSegment,
  rosterStatusLabel,
  type RosterSegment,
} from '@/lib/staff/userRosterUtils'
import { EmptyState, FilterChip, PageHeader, SearchField, StatusPill } from '@/components/ios/primitives'
import { UserAvatar } from '@/components/users/UserAvatar'

export function ManagersListScreen() {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const {
    managers,
    placeholderManagerCount,
    loading: managersLoading,
    loadManagers,
    cleanupLegacyPlaceholderManagers,
  } = useOperativeStore()
  const { users, loading: usersLoading, loadUsers } = useOrgUserStore()
  const [segment, setSegment] = useState<RosterSegment>('active')
  const [search, setSearch] = useState('')
  const [cleaning, setCleaning] = useState(false)
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)

  const canView = canViewManagers(user)

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard')
  }, [user, canView, router])

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadManagers(organization.id)
  }, [organization?.id, loadUsers, loadManagers])

  const allManagerUsers = useMemo(() => getManagersRosterUsers(users), [users])
  const phones = useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of allManagerUsers) {
      const record = managers.find((m) => m.email.trim().toLowerCase() === row.email.trim().toLowerCase())
      map[row.id] = row.mobileNumber || record?.mobile || record?.phone || ''
    }
    return map
  }, [allManagerUsers, managers])

  const filteredRows = useMemo(() => {
    const bySegment = allManagerUsers.filter((entry) => matchesRosterSegment(entry, segment))
    return filterRosterByNameQuery(bySegment, search, phones)
  }, [allManagerUsers, segment, search, phones])

  const loading = usersLoading || managersLoading
  const counts = {
    active: allManagerUsers.filter((entry) => matchesRosterSegment(entry, 'active')).length,
    inactive: allManagerUsers.filter((entry) => matchesRosterSegment(entry, 'inactive')).length,
    pending: allManagerUsers.filter((entry) => matchesRosterSegment(entry, 'pending')).length,
  }

  if (!user || !canView || (loading && users.length === 0)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="muted">Loading managers...</p>
      </div>
    )
  }

  const emptyTitle = emptyRosterTitle(segment, 'managers', allManagerUsers.length > 0)

  return (
    <div className="stack" data-hue="user">
      <PageHeader
        title="Managers"
        subtitle="Who runs the jobs and signs off time"
        hue="user"
        icon={<BriefcaseIcon className="h-7 w-7" />}
      />

      <div className="chips">
        <FilterChip title={`Active · ${counts.active}`} selected={segment === 'active'} onClick={() => setSegment('active')} />
        <FilterChip
          title={`Inactive · ${counts.inactive}`}
          selected={segment === 'inactive'}
          onClick={() => setSegment('inactive')}
        />
        <FilterChip
          title={`Pending · ${counts.pending}`}
          selected={segment === 'pending'}
          onClick={() => setSegment('pending')}
        />
      </div>

      <SearchField value={search} onChange={setSearch} placeholder="Search managers" />

      {hasAdminAccess(user) && placeholderManagerCount > 0 ? (
        <div className="banner" data-hue="warn">
          <div>
            <b>
              {placeholderManagerCount} legacy placeholder manager record
              {placeholderManagerCount === 1 ? '' : 's'} in Firestore
            </b>
            <p className="muted small">{PLACEHOLDER_MANAGER_EXPLANATION}</p>
            <button
              type="button"
              disabled={cleaning || !organization?.id}
              onClick={async () => {
                if (!organization?.id) return
                if (
                  !window.confirm(
                    `Remove ${placeholderManagerCount} placeholder manager record${placeholderManagerCount === 1 ? '' : 's'} from Firestore? This cannot be undone.`
                  )
                ) {
                  return
                }
                setCleaning(true)
                try {
                  const removed = await cleanupLegacyPlaceholderManagers(organization.id)
                  setCleanupMessage(`Removed ${removed} placeholder manager record${removed === 1 ? '' : 's'}.`)
                } finally {
                  setCleaning(false)
                }
              }}
              className="btn sm hue mt-3"
              data-hue="warn"
            >
              {cleaning ? 'Removing…' : 'Remove placeholder managers from Firestore'}
            </button>
            {cleanupMessage ? <p className="small mt-2" style={{ color: 'var(--green)' }}>{cleanupMessage}</p> : null}
          </div>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <EmptyState icon={<BriefcaseIcon className="h-12 w-12" />} title={emptyTitle} hue="user" />
      ) : (
        <div className="rows">
          {filteredRows.map((row) => {
            const record = managers.find((m) => m.email.trim().toLowerCase() === row.email.trim().toLowerCase())
            const status = rosterStatusLabel(row)
            const name = `${row.firstName} ${row.surname}`.trim() || row.email
            const trade = row.tradeTypePreset || record?.tradeTypePreset
            const mobile = phones[row.id]
            return (
              <Link key={row.id} href={`/dashboard/users/${row.id}?from=managers`} className="ritem" data-hue="user">
                <UserAvatar user={row} size={40} />
                <span className="grow">
                  <span className="t">{name}</span>
                  <span className="s">{row.email}{mobile ? ` · ${mobile}` : ''}</span>
                </span>
                {trade ? <span className="pill" data-hue="lib">{trade}</span> : null}
                {status === 'Pending' ? <StatusPill label="Pending" tone="amber" /> : null}
                {status === 'Inactive' ? <StatusPill label="Inactive" tone="grey" /> : null}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

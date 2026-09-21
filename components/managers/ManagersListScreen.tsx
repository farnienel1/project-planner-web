/**
 * iOS parity source: Views/ManagersView.swift
 * Spec: docs/ios-parity/sections/10-managers.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, BriefcaseIcon } from '@heroicons/react/24/outline'
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
import { EmptyState, FilterChip, PageHeader, StatusPill } from '@/components/ios/primitives'
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
        <p className="text-sm text-ios-muted">Loading managers...</p>
      </div>
    )
  }

  const emptyTitle = emptyRosterTitle(segment, 'managers', allManagerUsers.length > 0)

  return (
    <div className="stack" data-hue="user">
      <PageHeader title="Managers" subtitle="Leadership and ownership" hue="user" />

      <div className="flex flex-wrap gap-1.5">
        <FilterChip title={`Active · ${counts.active}`} selected={segment === 'active'} onClick={() => setSegment('active')} />
        <FilterChip
          title={`Inactive · ${counts.inactive}`}
          selected={segment === 'inactive'}
          onClick={() => setSegment('inactive')}
          selectedClass="bg-[#F2F3F5] text-[#6B7280]"
        />
        <FilterChip
          title={`Pending · ${counts.pending}`}
          selected={segment === 'pending'}
          onClick={() => setSegment('pending')}
          selectedClass="bg-[#FFF6E1] text-[#854F0B]"
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-ios-search-border bg-ios-card px-3 py-2">
        <MagnifyingGlassIcon className="h-4 w-4 text-ios-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search managers"
          className="w-full bg-transparent text-[14px] outline-none placeholder:text-ios-placeholder"
        />
      </div>

      {hasAdminAccess(user) && placeholderManagerCount > 0 ? (
        <div className="rounded-2xl border border-[#F4C0C0] bg-[#FFF6E1] px-4 py-4 text-[13px]">
          <p className="font-semibold">
            {placeholderManagerCount} legacy placeholder manager record
            {placeholderManagerCount === 1 ? '' : 's'} in Firestore
          </p>
          <p className="mt-2 text-[12px] text-ios-muted">{PLACEHOLDER_MANAGER_EXPLANATION}</p>
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
            className="mt-3 rounded-lg bg-[#854F0B] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {cleaning ? 'Removing…' : 'Remove placeholder managers from Firestore'}
          </button>
          {cleanupMessage ? <p className="mt-2 text-[12px] font-medium text-[#0F6E56]">{cleanupMessage}</p> : null}
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <EmptyState icon={<BriefcaseIcon className="h-12 w-12" />} title={emptyTitle} />
      ) : (
        <div className="divide-y divide-ios-border overflow-hidden rounded-2xl border border-ios-border bg-ios-card">
          {filteredRows.map((row) => {
            const record = managers.find((m) => m.email.trim().toLowerCase() === row.email.trim().toLowerCase())
            const status = rosterStatusLabel(row)
            const name = `${row.firstName} ${row.surname}`.trim() || row.email
            const trade = row.tradeTypePreset || record?.tradeTypePreset
            const mobile = phones[row.id]
            return (
              <Link
                key={row.id}
                href={`/dashboard/users/${row.id}?from=managers`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F8FA]"
              >
                <UserAvatar user={row} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{name}</p>
                  <p className="truncate text-[13px] text-ios-muted">{row.email}</p>
                  {mobile ? <p className="truncate text-[12px] text-ios-muted">{mobile}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {trade ? <span className="text-[11px] text-ios-muted">{trade}</span> : null}
                  {status === 'Pending' ? <StatusPill label="Pending" tone="amber" /> : null}
                  {status === 'Inactive' ? <StatusPill label="Inactive" tone="grey" /> : null}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

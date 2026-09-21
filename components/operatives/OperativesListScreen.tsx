/**
 * iOS parity source: Views/OperativesView.swift
 * Spec: docs/ios-parity/sections/11-operatives.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserGroupIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { canViewOperatives } from '@/lib/permissions'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import {
  emptyRosterTitle,
  filterRosterByNameQuery,
  getOperativeModeUsers,
  matchesRosterSegment,
  rosterStatusLabel,
  type RosterSegment,
} from '@/lib/staff/userRosterUtils'
import { EmptyState, FilterChip, PageHeader, SearchField, StatusPill } from '@/components/ios/primitives'
import { UserAvatar } from '@/components/users/UserAvatar'

export function OperativesListScreen() {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const { operatives, loading: operativesLoading, loadOperatives } = useOperativeStore()
  const { users, loading: usersLoading, loadUsers } = useOrgUserStore()
  const [segment, setSegment] = useState<RosterSegment>('active')
  const [search, setSearch] = useState('')

  const canView = canViewOperatives(user)

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard')
  }, [user, canView, router])

  useEffect(() => {
    if (!organization?.id) return
    loadOperatives(organization.id)
    loadUsers(organization.id)
  }, [organization?.id, loadOperatives, loadUsers])

  const allOperativeUsers = useMemo(() => getOperativeModeUsers(users), [users])
  const phones = useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of allOperativeUsers) {
      const op = findOperativeForUser(row, operatives)
      map[row.id] = op?.phone || row.mobileNumber || ''
    }
    return map
  }, [allOperativeUsers, operatives])

  const filteredRows = useMemo(() => {
    const bySegment = allOperativeUsers.filter((entry) => matchesRosterSegment(entry, segment))
    return filterRosterByNameQuery(bySegment, search, phones)
  }, [allOperativeUsers, segment, search, phones])

  const loading = operativesLoading || usersLoading
  const counts = {
    active: allOperativeUsers.filter((entry) => matchesRosterSegment(entry, 'active')).length,
    inactive: allOperativeUsers.filter((entry) => matchesRosterSegment(entry, 'inactive')).length,
    pending: allOperativeUsers.filter((entry) => matchesRosterSegment(entry, 'pending')).length,
  }

  if (!user || !canView || (loading && users.length === 0)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="muted">Loading operatives...</p>
      </div>
    )
  }

  const emptyTitle = emptyRosterTitle(segment, 'operatives', allOperativeUsers.length > 0)

  return (
    <div className="stack" data-hue="ops">
      <PageHeader
        title="Operatives"
        subtitle="Your field team, trades and day rates"
        hue="ops"
        icon={<UserGroupIcon className="h-7 w-7" />}
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

      <SearchField value={search} onChange={setSearch} placeholder="Search operatives by name" />

      {filteredRows.length === 0 ? (
        <EmptyState icon={<UserGroupIcon className="h-12 w-12" />} title={emptyTitle} hue="ops" />
      ) : (
        <div className="rows">
          {filteredRows.map((row) => {
            const operative = findOperativeForUser(row, operatives)
            const status = rosterStatusLabel(row)
            const name = `${row.firstName} ${row.surname}`.trim() || row.email
            return (
              <Link key={row.id} href={`/dashboard/users/${row.id}?from=operatives`} className="ritem" data-hue="ops">
                <UserAvatar user={row} size={40} />
                <span className="grow">
                  <span className="t">{name}</span>
                  <span className="s">{row.email}</span>
                </span>
                {operative?.tradeTypePreset ? <span className="pill" data-hue="lib">{operative.tradeTypePreset}</span> : null}
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

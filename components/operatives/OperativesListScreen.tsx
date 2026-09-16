/**
 * iOS parity source: Views/OperativesView.swift
 * Spec: docs/ios-parity/sections/11-operatives.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline'
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
import { EmptyState, FilterChip, PageHeader, StatusPill } from '@/components/ios/primitives'
import { initialsFrom } from '@/lib/daily-overview/buildDailyOverview'

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
        <p className="text-sm text-ios-muted">Loading operatives...</p>
      </div>
    )
  }

  const emptyTitle = emptyRosterTitle(segment, 'operatives', allOperativeUsers.length > 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manage Operatives"
        actions={
          canView ? (
            <Link
              href="/dashboard/operatives/new"
              aria-label="New Operative"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#185FA5] text-white"
            >
              <PlusIcon className="h-5 w-5" />
            </Link>
          ) : null
        }
      />

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
          placeholder="Search operatives by name"
          className="w-full bg-transparent text-[14px] outline-none placeholder:text-ios-placeholder"
        />
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState icon={<UserGroupIcon className="h-12 w-12" />} title={emptyTitle} />
      ) : (
        <div className="divide-y divide-ios-border overflow-hidden rounded-2xl border border-ios-border bg-ios-card">
          {filteredRows.map((row) => {
            const operative = findOperativeForUser(row, operatives)
            const status = rosterStatusLabel(row)
            const name = `${row.firstName} ${row.surname}`.trim() || row.email
            return (
              <Link
                key={row.id}
                href={`/dashboard/users/${row.id}?from=operatives`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F8FA]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#185FA5] to-[#378ADD] text-[12px] font-medium text-white">
                  {initialsFrom(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{name}</p>
                  <p className="truncate text-[13px] text-ios-muted">{row.email}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {status === 'Pending' ? <StatusPill label="Pending" tone="amber" /> : null}
                  {status === 'Inactive' ? <StatusPill label="Inactive" tone="grey" /> : null}
                  {operative?.tradeTypePreset ? (
                    <span className="hidden text-[11px] text-ios-muted sm:inline">{operative.tradeTypePreset}</span>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

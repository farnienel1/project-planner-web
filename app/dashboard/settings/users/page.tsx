'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { canManageUsers, getManageUsersLabel } from '@/lib/navigation/menuPermissions'
import {
  countUsersForTab,
  filterUsersForManageTabAndSegment,
  type ManageUsersTab,
} from '@/lib/staff/manageUsersUtils'
import { filterUsersBySearch, rosterStatusLabel, type RosterSegment } from '@/lib/staff/userRosterUtils'
import { EmptyState, ErrorBanner, LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'
import { RosterStatusBadge } from '@/components/staff/StaffRosterFilters'

const TABS: { id: ManageUsersTab; label: string }[] = [
  { id: 'admins', label: 'Admins' },
  { id: 'managers', label: 'Managers' },
  { id: 'operatives', label: 'Operatives' },
]

const SEGMENTS: { id: RosterSegment; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'pending', label: 'Pending' },
]

function roleLabelForTab(tab: ManageUsersTab): string {
  if (tab === 'admins') return 'Admin'
  if (tab === 'managers') return 'Manager'
  return 'Operative'
}

export default function ManageUsersPage() {
  const { organization, user: currentUser } = useAuthStore()
  const { users, loading, error, loadUsers } = useOrgUserStore()
  const [tab, setTab] = useState<ManageUsersTab>('admins')
  const [segment, setSegment] = useState<RosterSegment>('active')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization, loadUsers])

  const title = getManageUsersLabel(currentUser, organization)
  const canManage = canManageUsers(currentUser)

  const visibleUsers = useMemo(() => {
    if (!canManage) {
      return filterUsersForManageTabAndSegment(users, 'operatives', segment)
    }
    return filterUsersForManageTabAndSegment(users, tab, segment)
  }, [users, tab, segment, canManage])

  const rows = useMemo(
    () => filterUsersBySearch(visibleUsers, search, 'firstName'),
    [visibleUsers, search]
  )

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Same tabs and filters as iOS Manage Users — duplicate invite records are merged by email."
        meta={`${rows.length} shown`}
        actions={
          canManage ? (
            <Link
              href="/dashboard/settings/users/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add user
            </Link>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}

      {canManage && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 min-w-[100px] rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
              <span className={`ml-1.5 text-xs font-medium ${tab === item.id ? 'text-blue-100' : 'text-slate-400'}`}>
                ({countUsersForTab(users, item.id, segment)})
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSegment(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              segment === item.id
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <svg
          className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={`No ${roleLabelForTab(tab).toLowerCase()}s`}
          description={
            segment === 'pending'
              ? 'Pending invites appear here after you send them from Add user.'
              : 'Try another tab or segment.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    {[user.firstName, user.surname].filter(Boolean).join(' ') || '—'}
                    {user.isSuperAdmin && (
                      <span className="ml-2 rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-700">
                        Super admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <RosterStatusBadge status={rosterStatusLabel(user)} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{format(user.updatedAt, 'd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`/dashboard/users/${user.id}?from=users`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

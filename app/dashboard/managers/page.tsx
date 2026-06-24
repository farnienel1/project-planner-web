'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  emptyRosterTitle,
  filterUsersBySearch,
  getManagerUsers,
  matchesRosterSegment,
  rosterStatusLabel,
  type ManagerFilterField,
  type RosterSegment,
} from '@/lib/staff/userRosterUtils'
import { PLACEHOLDER_MANAGER_EXPLANATION } from '@/lib/staff/managerRosterUtils'
import { hasAdminAccess, canViewManagers } from '@/lib/navigation/menuPermissions'
import { RosterStatusBadge, StaffRosterFilters } from '@/components/staff/StaffRosterFilters'
import { ClickableRosterRow } from '@/components/staff/ClickableRosterRow'

const FILTER_OPTIONS: { value: ManagerFilterField; label: string }[] = [
  { value: 'firstName', label: 'First name' },
  { value: 'surname', label: 'Surname' },
  { value: 'email', label: 'Email' },
  { value: 'mobileNumber', label: 'Mobile number' },
]

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export default function ManagersPage() {
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
  const [filterField, setFilterField] = useState<ManagerFilterField>('firstName')
  const [cleaning, setCleaning] = useState(false)
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)

  const canView = canViewManagers(user)

  useEffect(() => {
    if (user && !canView) {
      router.replace('/dashboard')
    }
  }, [user, canView, router])

  useEffect(() => {
    if (organization?.id) {
      loadUsers(organization.id)
      loadManagers(organization.id)
    }
  }, [organization, loadUsers, loadManagers])

  const allManagerUsers = useMemo(() => getManagerUsers(users), [users])

  const filteredRows = useMemo(() => {
    const bySegment = allManagerUsers.filter((user) => matchesRosterSegment(user, segment))
    return filterUsersBySearch(bySegment, search, filterField)
  }, [allManagerUsers, segment, search, filterField])

  const loading = usersLoading || managersLoading

  if (!user || !canView) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  const emptyTitle = emptyRosterTitle(segment, 'managers', allManagerUsers.length > 0)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Managers</h1>
            <p className="mt-1 text-slate-600">Manage manager accounts — same roster as iOS ManagersView</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {allManagerUsers.filter((user) => matchesRosterSegment(user, 'active')).length} active ·{' '}
            {allManagerUsers.length} total
          </div>
        </div>

        <StaffRosterFilters
          segment={segment}
          onSegmentChange={setSegment}
          search={search}
          onSearchChange={setSearch}
          filterField={filterField}
          onFilterFieldChange={setFilterField}
          filterOptions={FILTER_OPTIONS}
          searchPlaceholder="Search managers…"
        />
      </div>

      {hasAdminAccess(user) && placeholderManagerCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-semibold">
            {placeholderManagerCount} legacy placeholder manager record
            {placeholderManagerCount === 1 ? '' : 's'} in Firestore
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">{PLACEHOLDER_MANAGER_EXPLANATION}</p>
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
            className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {cleaning ? 'Removing…' : 'Remove placeholder managers from Firestore'}
          </button>
          {cleanupMessage && <p className="mt-2 text-xs font-medium text-emerald-800">{cleanupMessage}</p>}
        </div>
      )}

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h3 className="text-lg font-medium capitalize text-slate-900">{emptyTitle}</h3>
          <p className="mt-2 text-slate-500">Try another tab or clear your search filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500" aria-hidden>
                  <span className="sr-only">Open profile</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRows.map((user) => {
                const managerRecord = managers.find(
                  (manager) => normalizeEmail(manager.email) === normalizeEmail(user.email)
                )
                const role = user.permissions.adminAccess || user.isSuperAdmin ? 'Admin' : 'Manager'
                const status = rosterStatusLabel(user)

                return (
                  <ClickableRosterRow key={user.id} href={`/dashboard/users/${user.id}?from=managers`}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">
                        {user.firstName} {user.surname}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{user.email}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {user.mobileNumber || managerRecord?.phone || managerRecord?.mobile || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{role}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <RosterStatusBadge status={status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-slate-300">
                      <svg className="ml-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </ClickableRosterRow>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

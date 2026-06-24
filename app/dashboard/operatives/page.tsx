'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { resolveOperativeSkillLabels } from '@/lib/staff/skillDisplayUtils'
import {
  emptyRosterTitle,
  filterUsersBySearch,
  getOperativeModeUsers,
  matchesRosterSegment,
  rosterStatusLabel,
  type OperativeFilterField,
  type RosterSegment,
} from '@/lib/staff/userRosterUtils'
import { RosterStatusBadge, StaffRosterFilters } from '@/components/staff/StaffRosterFilters'
import { ClickableRosterRow } from '@/components/staff/ClickableRosterRow'

const FILTER_OPTIONS: { value: OperativeFilterField; label: string }[] = [
  { value: 'firstName', label: 'First name' },
  { value: 'surname', label: 'Surname' },
  { value: 'email', label: 'Email' },
]

export default function OperativesPage() {
  const { organization } = useAuthStore()
  const { operatives, skills, loading: operativesLoading, loadOperatives, loadSkills } = useOperativeStore()
  const { users, loading: usersLoading, loadUsers } = useOrgUserStore()
  const [segment, setSegment] = useState<RosterSegment>('active')
  const [search, setSearch] = useState('')
  const [filterField, setFilterField] = useState<OperativeFilterField>('firstName')

  useEffect(() => {
    if (organization?.id) {
      loadOperatives(organization.id)
      loadSkills(organization.id)
      loadUsers(organization.id)
    }
  }, [organization, loadOperatives, loadSkills, loadUsers])

  const allOperativeUsers = useMemo(() => getOperativeModeUsers(users), [users])

  const filteredRows = useMemo(() => {
    const bySegment = allOperativeUsers.filter((user) => matchesRosterSegment(user, segment))
    return filterUsersBySearch(bySegment, search, filterField)
  }, [allOperativeUsers, segment, search, filterField])

  const loading = operativesLoading || usersLoading

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  const emptyTitle = emptyRosterTitle(segment, 'operatives', allOperativeUsers.length > 0)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Operatives</h1>
            <p className="mt-1 text-slate-600">Manage operative accounts — same roster as iOS OperativesView</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {allOperativeUsers.filter((user) => matchesRosterSegment(user, 'active')).length} active ·{' '}
            {allOperativeUsers.length} total
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
          searchPlaceholder="Search operatives…"
        />
      </div>

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
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Skills</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500" aria-hidden>
                  <span className="sr-only">Open profile</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRows.map((user) => {
                const operative = findOperativeForUser(user, operatives)
                const skillLabels = operative ? resolveOperativeSkillLabels(operative, skills) : []
                const status = rosterStatusLabel(user)

                return (
                  <ClickableRosterRow
                    key={user.id}
                    href={`/dashboard/users/${user.id}?from=operatives`}
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">
                        {user.firstName} {user.surname}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{user.email}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {operative?.phone || user.mobileNumber || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {user.dayRate != null && user.dayRate > 0
                        ? `£${user.dayRate.toFixed(2)}/day`
                        : operative
                          ? `£${operative.hourlyRate.toFixed(2)}/hr`
                          : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {skillLabels.length > 0 ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {skillLabels.slice(0, 3).map((label) => (
                            <span key={label} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                              {label}
                            </span>
                          ))}
                          {skillLabels.length > 3 && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              +{skillLabels.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
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

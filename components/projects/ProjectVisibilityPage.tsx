'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { projectToSaveInput } from '@/lib/firebase/projectPayload'
import {
  getManagerUsers,
  getOperativeModeUsers,
  matchesRosterSegment,
  rosterStatusLabel,
  type RosterSegment,
} from '@/lib/staff/userRosterUtils'
import { RosterStatusBadge } from '@/components/staff/StaffRosterFilters'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import type { Project, User } from '@/types'

type VisibilityTab = 'managers' | 'operatives'

export function ProjectVisibilityPage({
  project,
  collection,
}: {
  project: Project
  collection: 'projects' | 'smallWorks'
}) {
  const { organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { saveProject } = useProjectStore()
  const [tab, setTab] = useState<VisibilityTab>('managers')
  const [segment, setSegment] = useState<RosterSegment>('active')
  const [search, setSearch] = useState('')
  const [hiddenManagers, setHiddenManagers] = useState<Set<string>>(
    () => new Set(project.hiddenManagerUserIds ?? [])
  )
  const [hiddenOperatives, setHiddenOperatives] = useState<Set<string>>(
    () => new Set(project.hiddenOperativeUserIds ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization, loadUsers])

  const roster = useMemo(() => {
    const base = tab === 'managers' ? getManagerUsers(users) : getOperativeModeUsers(users)
    return base.filter((user) => {
      if (user.isSuperAdmin || user.permissions.adminAccess) return false
      return matchesRosterSegment(user, segment)
    })
  }, [users, tab, segment])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((user) => {
      const name = `${user.firstName} ${user.surname}`.toLowerCase()
      return name.includes(q) || user.email.toLowerCase().includes(q)
    })
  }, [roster, search])

  const isHidden = (userId: string) =>
    tab === 'managers' ? hiddenManagers.has(userId) : hiddenOperatives.has(userId)

  const toggleHidden = async (user: User) => {
    if (!organization?.id) return
    const wasHidden = isHidden(user.id)
    const nextManagers = new Set(hiddenManagers)
    const nextOperatives = new Set(hiddenOperatives)
    if (tab === 'managers') {
      if (nextManagers.has(user.id)) nextManagers.delete(user.id)
      else nextManagers.add(user.id)
      setHiddenManagers(nextManagers)
    } else {
      if (nextOperatives.has(user.id)) nextOperatives.delete(user.id)
      else nextOperatives.add(user.id)
      setHiddenOperatives(nextOperatives)
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const input = projectToSaveInput(
        {
          ...project,
          hiddenManagerUserIds: Array.from(tab === 'managers' ? nextManagers : hiddenManagers),
          hiddenOperativeUserIds: Array.from(tab === 'operatives' ? nextOperatives : hiddenOperatives),
          updatedAt: new Date(),
        },
        organization.id
      )
      await saveProject(input, collection)
      setSuccess(wasHidden ? 'User can view this job again.' : 'User hidden from this job.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save visibility')
      if (tab === 'managers') setHiddenManagers(hiddenManagers)
      else setHiddenOperatives(hiddenOperatives)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">View</h2>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          Choose who cannot see this {collection === 'smallWorks' ? 'small work' : 'project'}. Administrators
          always have access and cannot be hidden.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {(['managers', 'operatives'] as VisibilityTab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-colors ${
              tab === item ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['active', 'inactive', 'pending'] as RosterSegment[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSegment(item)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              segment === item
                ? 'bg-slate-800 text-white'
                : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users…"
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
      />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No users match this filter.</p>
        ) : (
          filtered.map((user) => {
            const hidden = isHidden(user.id)
            return (
              <div key={user.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user.firstName} {user.surname}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RosterStatusBadge status={rosterStatusLabel(user)} />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleHidden(user)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                      hidden
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {hidden ? 'Hidden' : 'Visible'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/**
 * iOS parity source: Views/ProjectDetailView.swift ProjectVisibilitySettingsView ~L2517
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { projectToSaveInput } from '@/lib/firebase/projectPayload'
import {
  getManagerUsers,
  getOperativeModeUsers,
  matchesRosterSegment,
  type RosterSegment,
} from '@/lib/staff/userRosterUtils'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { FeatureCard } from '@/components/projects/features/featureUi'
import type { Project, User } from '@/types'

type VisibilityTab = 'managers' | 'operatives'
type VisibilitySegment = 'all' | RosterSegment

const FILTERS: { id: VisibilitySegment; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'pending', label: 'Pending' },
]

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
  const [segment, setSegment] = useState<VisibilitySegment>('active')
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [hiddenManagers, setHiddenManagers] = useState<Set<string>>(
    () => new Set(project.hiddenManagerUserIds ?? [])
  )
  const [hiddenOperatives, setHiddenOperatives] = useState<Set<string>>(
    () => new Set(project.hiddenOperativeUserIds ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization, loadUsers])

  const roster = useMemo(() => {
    const base = tab === 'managers' ? getManagerUsers(users) : getOperativeModeUsers(users)
    return base.filter((user) => {
      if (user.isSuperAdmin || user.permissions.adminAccess) return false
      if (segment === 'all') return true
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save visibility')
      if (tab === 'managers') setHiddenManagers(hiddenManagers)
      else setHiddenOperatives(hiddenOperatives)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 xl:grid xl:grid-cols-12 xl:items-start xl:gap-6 xl:space-y-0">
      <div className="xl:col-span-4">
        <h2 className="text-[22px] font-bold text-slate-900">View</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          This feature can be used to select who will not be able to view the project or small works. Admins always
          have access and cannot be hidden.
        </p>
      </div>

      <div className="space-y-4 xl:col-span-8">
        {error && <ErrorBanner message={error} />}

        <div className="flex gap-1 rounded-[13px] bg-[#e7ebf1] p-1">
          {(['managers', 'operatives'] as VisibilityTab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`flex-1 rounded-[10px] py-2 text-sm font-semibold capitalize transition-colors ${
                tab === item ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            Filter:
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as VisibilitySegment)}
              className="bg-transparent font-semibold outline-none"
            >
              {FILTERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setShowSearch((v) => !v)
              if (showSearch) setSearch('')
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Search
          </button>
        </div>

        {showSearch && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-400"
          />
        )}

        <FeatureCard className="overflow-hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No users match this filter.</p>
          ) : (
            filtered.map((user) => {
              const hidden = isHidden(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={saving}
                  onClick={() => void toggleHidden(user)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {user.firstName} {user.surname}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  {hidden ? (
                    <span className="h-6 w-6 rounded-full border border-slate-300" />
                  ) : (
                    <CheckCircleIcon className="h-6 w-6 text-[#185FA5]" />
                  )}
                </button>
              )
            })
          )}
        </FeatureCard>
      </div>
    </div>
  )
}

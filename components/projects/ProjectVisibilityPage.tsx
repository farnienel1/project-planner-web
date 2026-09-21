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
import type { Project, User } from '@/types'

type VisibilityTab = 'managers' | 'operatives'
type VisibilitySegment = 'all' | RosterSegment

const FILTERS: { id: VisibilitySegment; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'pending', label: 'Pending' },
]

function sameIds(a: Set<string>, b: string[] | undefined): boolean {
  const other = new Set(b ?? [])
  if (a.size !== other.size) return false
  for (const id of a) if (!other.has(id)) return false
  return true
}

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
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization, loadUsers])

  useEffect(() => {
    setHiddenManagers(new Set(project.hiddenManagerUserIds ?? []))
    setHiddenOperatives(new Set(project.hiddenOperativeUserIds ?? []))
  }, [project.id, project.hiddenManagerUserIds, project.hiddenOperativeUserIds])

  const dirty =
    !sameIds(hiddenManagers, project.hiddenManagerUserIds) ||
    !sameIds(hiddenOperatives, project.hiddenOperativeUserIds)

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

  const toggleHidden = (user: User) => {
    setSaved(false)
    setError(null)
    if (tab === 'managers') {
      const next = new Set(hiddenManagers)
      if (next.has(user.id)) next.delete(user.id)
      else next.add(user.id)
      setHiddenManagers(next)
    } else {
      const next = new Set(hiddenOperatives)
      if (next.has(user.id)) next.delete(user.id)
      else next.add(user.id)
      setHiddenOperatives(next)
    }
  }

  const saveVisibility = async () => {
    if (!organization?.id) return
    setSaving(true)
    setError(null)
    try {
      const input = projectToSaveInput(
        {
          ...project,
          hiddenManagerUserIds: Array.from(hiddenManagers),
          hiddenOperativeUserIds: Array.from(hiddenOperatives),
          updatedAt: new Date(),
        },
        organization.id
      )
      await saveProject(input, collection)
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save visibility')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gmain">
      <div>
        <h2 className="h2">View access</h2>
        <p className="mt-2 muted small" style={{ lineHeight: 1.55 }}>
          This feature can be used to select who will not be able to view the project or small works. Admins always
          have access and cannot be hidden.
        </p>
        <p className="mt-2 muted small" style={{ lineHeight: 1.55 }}>
          When unselected the user will not see this job within their account.
        </p>
      </div>

      <div className="stack">
        {error && <ErrorBanner message={error} />}

        <div className="seg">
          {(['managers', 'operatives'] as VisibilityTab[]).map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? 'on' : ''}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="row wrap">
          <label className="f" style={{ margin: 0 }}>
            <span className="sr-only">Filter</span>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as VisibilitySegment)}
              className="in"
              aria-label="Filter"
              style={{ width: 160, height: 44 }}
            >
              {FILTERS.map((item) => (
                <option key={item.id} value={item.id}>
                  Filter: {item.label}
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
            className="btn"
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
            className="in"
            aria-label="Search user"
          />
        )}

        <section className="card overflow-hidden">
          {filtered.length === 0 ? (
            <p className="card-b muted small" style={{ textAlign: 'center' }}>
              No users match this filter.
            </p>
          ) : (
            <div className="card-b rows">
              {filtered.map((user) => {
                const hidden = isHidden(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleHidden(user)}
                    className="ritem"
                    aria-pressed={!hidden}
                  >
                    <span className="grow">
                      <span className="t">
                        {user.firstName} {user.surname}
                      </span>
                      <span className="s">{user.email}</span>
                    </span>
                    {hidden ? (
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full"
                        style={{ boxShadow: 'inset 0 0 0 2px var(--line2)' }}
                        aria-label="Hidden"
                      />
                    ) : (
                      <CheckCircleIcon className="h-6 w-6 text-[var(--blue)]" aria-label="Visible" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <div className="row wrap">
          <button
            type="button"
            className="btn primary"
            disabled={saving || !dirty}
            onClick={() => void saveVisibility()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && !dirty ? <span className="muted small">View access saved.</span> : null}
          {dirty ? <span className="muted small">Unsaved changes</span> : null}
        </div>
      </div>
    </div>
  )
}

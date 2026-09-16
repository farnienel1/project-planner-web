/**
 * iOS parity source: Views/ProjectsView.swift
 * Spec: docs/ios-parity/sections/12-projects.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MagnifyingGlassIcon, FolderIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { canManageWorkCatalogue, isOperativeMode } from '@/lib/permissions'
import { visibleWorks } from '@/lib/access/workAccess'
import {
  countWorksByTab,
  filterWorksByTab,
  searchWorks,
} from '@/lib/projects/workStatus'
import { EmptyState, FilterChip, PageHeader, StatsRow } from '@/components/ios/primitives'
import { WorkCard } from '@/components/projects/WorkCard'

type Filter = 'all' | 'active' | 'upcoming' | 'completed'

export function ProjectsListScreen() {
  const { organization, user } = useAuthStore()
  const { projects, loading, loadProjects } = useProjectStore()
  const { tasks, loadTasks } = useTaskStore()
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    loadProjects(organization.id)
    loadTasks(organization.id)
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadManagers(organization.id)
  }, [
    organization?.id,
    loadProjects,
    loadTasks,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadManagers,
  ])

  const visible = useMemo(
    () =>
      visibleWorks({
        projects,
        catalogue: 'projects',
        user,
        operatives,
        managers,
        bookings,
        managerBookings: managerSiteBookings,
        tasks,
      }),
    [projects, user, operatives, managers, bookings, managerSiteBookings, tasks]
  )

  const counts = useMemo(() => countWorksByTab(visible), [visible])
  const filtered = useMemo(() => {
    const byTab = filterWorksByTab(visible, filter)
    return searchWorks(byTab, search)
  }, [visible, filter, search])

  const canCreate = canManageWorkCatalogue(user, 'projects')
  const compact = isOperativeMode(user)
  const emptyDueToFilter = visible.length > 0 && filter !== 'all' && filterWorksByTab(visible, filter).length === 0
  const emptySearch = search.trim().length > 0 && filtered.length === 0 && filterWorksByTab(visible, filter).length > 0

  const managerName = (project: (typeof projects)[number]) => {
    const id = project.managerId || project.managerIds?.[0]
    if (id) {
      const m = managers.find((row) => row.id === id)
      if (m) return `${m.firstName} ${m.lastName}`.trim()
    }
    return project.manager?.name
  }

  if (loading && projects.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-ios-muted">Loading projects...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        actions={
          canCreate ? (
            <Link
              href="/dashboard/projects/new"
              aria-label="New project"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#185FA5] text-white"
            >
              <PlusIcon className="h-5 w-5" />
            </Link>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<FolderIcon className="h-12 w-12" />}
          title="No projects found"
          subtitle="Get started by adding your first project"
        />
      ) : (
        <>
          <StatsRow
            items={[
              { value: counts.active, label: 'Active', valueClass: 'text-[#0F6E56]' },
              { value: counts.upcoming, label: 'Upcoming', valueClass: 'text-[#854F0B]' },
              { value: counts.completed, label: 'Completed', valueClass: 'text-ios-muted' },
            ]}
          />

          <div className="flex items-center gap-2 rounded-xl border border-ios-search-border bg-ios-card px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 text-ios-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, addresses…"
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-ios-placeholder"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip title={`All · ${counts.all}`} selected={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterChip
              title={`Active · ${counts.active}`}
              selected={filter === 'active'}
              onClick={() => setFilter('active')}
            />
            <FilterChip
              title={`Upcoming · ${counts.upcoming}`}
              selected={filter === 'upcoming'}
              onClick={() => setFilter('upcoming')}
              selectedClass="bg-[#FFF6E1] text-[#854F0B]"
            />
            <FilterChip
              title={`Completed · ${counts.completed}`}
              selected={filter === 'completed'}
              onClick={() => setFilter('completed')}
              selectedClass="bg-[#F2F3F5] text-[#6B7280]"
            />
          </div>

          {emptySearch ? (
            <p className="py-10 text-center text-[15px] text-ios-muted">No projects match your search.</p>
          ) : emptyDueToFilter ? (
            <EmptyState
              title="No projects found"
              subtitle='The current filter hides older or completed jobs. Choose “All” or “Completed” above to see everything.'
            />
          ) : filtered.length === 0 ? (
            <EmptyState title="No projects found" subtitle="Get started by adding your first project" />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((project) => (
                <WorkCard
                  key={project.id}
                  project={project}
                  href={`/dashboard/projects/${project.id}`}
                  compact={compact}
                  managerName={managerName(project)}
                />
              ))}
            </div>
          )}

          {emptyDueToFilter ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="rounded-xl bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white"
              >
                Show all projects
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

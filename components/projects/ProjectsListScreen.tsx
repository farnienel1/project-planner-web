/**
 * iOS parity source: Views/ProjectsView.swift
 * Spec: docs/ios-parity/sections/12-projects.md
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FolderIcon, PlusIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { canCreateProject, isOperativeMode } from '@/lib/permissions'
import { operativeMatching, visibleWorks, worksListContext } from '@/lib/access/workAccess'
import { useDeadlineAssignedProjectIds } from '@/lib/deadlines/useDeadlineAssignedProjectIds'
import { searchWorks } from '@/lib/projects/workStatus'
import {
  defaultWorksListTab,
  myWorksEmptyActionLabel,
  myWorksEmptyTitle,
  myWorksTabLabel,
  worksInTab,
  worksTabCounts,
  type WorksListTab,
} from '@/lib/canonical'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
import { useMyWorksList } from '@/lib/works/useMyWorksPicks'
import { MyWorksPicker } from '@/components/projects/MyWorksPicker'
import { useOrganizationDayKey } from '@/lib/warnings/useOrganizationDayKey'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { EmptyState, PageHeader, SearchField, StatsRow } from '@/components/ios/primitives'
import { WorkCard } from '@/components/projects/WorkCard'
import { assignedManagerLabel } from '@/lib/projects/assignedManagers'

type Filter = WorksListTab

export function ProjectsListScreen() {
  const { organization, user } = useAuthStore()
  const { projects, loading, loadProjects } = useProjectStore()
  const { tasks, loadTasks } = useTaskStore()
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const managerRoster = useRosterDocuments(organization?.id)
  const loadUsers = useOrgUserStore((state) => state.loadUsers)
  const deadlineAssignedProjectIds = useDeadlineAssignedProjectIds()
  // Rulebook 1.33.0 §21: My Projects / My Small works is the first filter and the default for admins and managers
  // (`defaultWorksListTab`); operatives keep Active.
  const [filterChoice, setFilter] = useState<Filter | null>(null)
  const filter: Filter = filterChoice ?? defaultWorksListTab(jobAccessViewer(user))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    loadProjects(organization.id)
    loadTasks(organization.id)
    loadBookings(organization.id, { fullHistory: true })
    loadManagerSiteBookings(organization.id, { fullHistory: true })
    loadOperatives(organization.id)
    loadManagers(organization.id)
    loadUsers(organization.id)
  }, [
    organization?.id,
    loadProjects,
    loadTasks,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadManagers,
    loadUsers,
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
        deadlineAssignedProjectIds,
      }),
    [projects, user, operatives, managers, bookings, managerSiteBookings, tasks, deadlineAssignedProjectIds]
  )

  const listContext = useMemo(
    () => worksListContext({ operatives, managers, bookings, managerBookings: managerSiteBookings, tasks, deadlineAssignedProjectIds }),
    [operatives, managers, bookings, managerSiteBookings, tasks, deadlineAssignedProjectIds]
  )
  // Rulebook 1.33.0 §21: the person's own list (`myWorksList`: saved picks, else the jobs they manage), synced with iPhone.
  const mine = useMyWorksList({ kind: 'projects', organizationId: organization?.id, user, jobs: projects, context: listContext })

  // Rulebook 1.21.0 §21: tabs and counts are `worksInTab` / `worksTabCounts` on the organisation's day (inactive →
  // Completed; All = every row listed).
  const timeZone = useOrganizationTimeZone()
  const todayKey = useOrganizationDayKey(timeZone)
  const byTab = useMemo(
    () => (filter === 'mine' ? mine.list : worksInTab(visible, filter, todayKey, timeZone)),
    [filter, mine.list, visible, todayKey, timeZone]
  )
  const counts = useMemo(() => worksTabCounts(visible, todayKey, timeZone), [visible, todayKey, timeZone])
  const filtered = useMemo(() => searchWorks(byTab, search), [byTab, search])

  const canCreate = canCreateProject(user)
  const emptySubtitle = canCreate
    ? 'Nothing here right now. Tap + to start a project.'
    : 'Nothing here right now.'
  const unmatchedOperative =
    isOperativeMode(user) &&
    !operativeMatching(user?.email, operatives, { firstName: user?.firstName, surname: user?.surname })
  const compact = isOperativeMode(user)
  const emptyMine = filter === 'mine' && mine.loaded && byTab.length === 0
  const emptyDueToFilter = visible.length > 0 && filter !== 'all' && filter !== 'mine' && byTab.length === 0
  const emptySearch = search.trim().length > 0 && filtered.length === 0 && byTab.length > 0

  const managerName = (project: (typeof projects)[number]) =>
    assignedManagerLabel(project, managers, managerRoster, organization?.id)

  if (loading && projects.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-[var(--ink3)]">Loading projects...</p>
      </div>
    )
  }

  return (
    <div className="stack work-list" data-hue="proj">
      <PageHeader
        title="Projects"
        subtitle="Main project pipeline"
        hue="proj"
        icon={<FolderIcon className="h-7 w-7" />}
        actions={
          canCreate ? (
            <Link href="/dashboard/projects/new" className="btn primary">
              <PlusIcon className="h-4 w-4" />
              New project
            </Link>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<FolderIcon className="h-12 w-12" />}
          title={unmatchedOperative ? 'Jobs couldn’t be matched to you' : 'No projects found'}
          subtitle={unmatchedOperative ? undefined : emptySubtitle}
        />
      ) : (
        <>
          <StatsRow
            items={[
              ...(mine.available
                ? [
                    {
                      value: mine.list.length,
                      label: myWorksTabLabel('projects'),
                      hue: 'proj' as const,
                      selected: filter === 'mine',
                      onClick: () => setFilter('mine'),
                    },
                  ]
                : []),
              {
                value: counts.all,
                label: 'All',
                hue: 'lib',
                selected: filter === 'all',
                onClick: () => setFilter('all'),
              },
              {
                value: counts.active,
                label: 'Active',
                hue: 'proj',
                selected: filter === 'active',
                onClick: () => setFilter('active'),
              },
              {
                value: counts.upcoming,
                label: 'Upcoming',
                hue: 'blue',
                selected: filter === 'upcoming',
                onClick: () => setFilter('upcoming'),
              },
              {
                value: counts.completed,
                label: 'Completed',
                hue: 'lib',
                selected: filter === 'completed',
                onClick: () => setFilter('completed'),
              },
            ]}
          />

          {filter === 'mine' ? (
            <div className="flex justify-end">
              <button type="button" className="btn sm ghost" onClick={() => setPickerOpen(true)} aria-label="Choose projects for your list">
                ⚙ {myWorksTabLabel('projects')}
              </button>
            </div>
          ) : null}

          {mine.saveNotice ? (
            <p
              role="status"
              className={`text-sm ${mine.saveNotice.status === 'refused' ? 'text-[var(--red)]' : 'text-[var(--ink3)]'}`}
            >
              {mine.saveNotice.message}
            </p>
          ) : null}

          <SearchField value={search} onChange={setSearch} placeholder="Search projects, addresses…" />

          {emptySearch ? (
            <p className="py-8 text-center text-[15px] text-[var(--ink3)]">No projects match your search.</p>
          ) : filter === 'mine' && !mine.loaded ? (
            <p className="py-8 text-center text-[15px] text-[var(--ink3)]">Loading your list…</p>
          ) : emptyMine ? (
            <EmptyState
              title={myWorksEmptyTitle('projects')}
              action={
                <button type="button" className="btn primary" onClick={() => setPickerOpen(true)}>
                  {myWorksEmptyActionLabel('projects')}
                </button>
              }
            />
          ) : emptyDueToFilter ? (
            <EmptyState
              title="No projects found"
              subtitle='The current filter hides older or completed jobs. Choose “All” or “Completed” above to see everything.'
            />
          ) : filtered.length === 0 ? (
            <EmptyState title="No projects found" subtitle={emptySubtitle} />
          ) : (
            <div className="work-grid grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
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
                className="btn primary"
              >
                Show all projects
              </button>
            </div>
          ) : null}
        </>
      )}

      {pickerOpen && mine.available ? (
        <MyWorksPicker
          kind="projects"
          rows={mine.pickerRows}
          todayKey={todayKey}
          timeZone={timeZone}
          onCancel={() => setPickerOpen(false)}
          onSave={(ids) => {
            mine.save(ids)
            setPickerOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

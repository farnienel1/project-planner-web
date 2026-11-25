'use client'

/**
 * One task list for the main Tasks page and the Tasks tab of Projects and Small works (F4, F5, F11, F18, F19, F20;
 * bugs B9, B13). Header + New task → tabs with counts (`taskTabCounts`; Overdue red above 0; the main page adds the
 * leave Approvals tab only while it has items) → My tasks / Everyone (staff only, `taskScopeFor`, remembered on this
 * device) + search + filters → rows sorted by the rulebook (`sortTasksForTab`), grouped by project / small works on the
 * main page and flat on a location tab. Every task opens in the shared popup over the page.
 */

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AdjustmentsHorizontalIcon, CheckIcon, EllipsisHorizontalIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  TASK_ACTION_LABELS,
  TASK_COPY,
  TASK_DUE_FILTERS,
  TASK_NO_FILTERS,
  TASK_SORTS,
  taskSortLabel,
  filterTasks,
  parseTaskFilters,
  parseTaskSort,
  sortTasks,
  taskActiveFilterCount,
  taskFilterOptions,
  type TaskFilters,
  type TaskSortKey,
  TASK_PRIORITY_OPTIONS,
  TASK_SCOPES,
  TASK_TABS,
  taskActions,
  taskCompleteStep,
  taskCopyText,
  taskDueLabel,
  taskInTab,
  taskPriorityLabel,
  taskPriorityTone,
  taskScopeFor,
  taskStatusKey,
  taskStatusLabel,
  taskTabCounts,
  type TaskScopeKey,
  type TaskTabKey,
} from '@/lib/canonical'
import { LoadingSpinner, ErrorBanner } from '@/components/dashboard/PageShell'
import { useToast } from '@/components/ui/ToastProvider'
import { allAssignedManagerIds, allAssignedOperativeIds } from '@/lib/tasks/projectTaskFilters'
import { foldTaskFilterPeople, taskAssigneeNames } from '@/lib/tasks/taskAssigneePeople'
import type { ProjectTask } from '@/types'
import { ConfirmDialog } from './TaskDialog'
import { TaskPopup, type TaskPopupMode } from './TaskPopup'
import { initialsOf } from './TaskPeopleField'
import { deleteTaskById, personDisplay, runStatusAction } from './taskActions'
import { useTaskWorkspace, type TaskLocation, type TaskWorkspace } from './useTaskWorkspace'
import '@/app/pages-ui.css'
import '@/app/tasks-ui.css'

const SCOPE_KEY = 'pp.tasks.scope'
/** 1.91.0 decision B: filters and sort are remembered on this device, per page kind (like the scope). */
const FILTERS_KEY = 'pp.tasks.filters'
const SORT_KEY = 'pp.tasks.sort'

type TabKey = TaskTabKey | 'approvals'

export type TaskListProps = {
  mode: 'main' | 'location'
  /** The location tab's project or small works. */
  location?: TaskLocation
  /** Main page: the leave approvals the old Approvals stat card counted (rulebook §9, unchanged). */
  approvals?: { count: number; content: ReactNode }
}

export function TaskList(props: TaskListProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TaskListInner {...props} />
    </Suspense>
  )
}

function readStored(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* this device does not keep it */
  }
}

function readScope(): unknown {
  return readStored(SCOPE_KEY)
}

function readFilters(mode: 'main' | 'location'): Required<TaskFilters> {
  try {
    const parsed = parseTaskFilters(JSON.parse(readStored(`${FILTERS_KEY}.${mode}`) || 'null'))
    // A location tab is already one job: its project / small works filters never apply.
    return mode === 'location' ? { ...parsed, projectId: '', smallWorksId: '' } : parsed
  } catch {
    return { ...TASK_NO_FILTERS }
  }
}

/**
 * Review of #458: the select never shows "All" while a remembered value still applies — a value that exists but has
 * no task in this tab stays listed with a count of 0.
 */
function withSelected(
  list: ReadonlyArray<{ value: string; label: string; count: number }>,
  value: string,
  source: ReadonlyArray<{ value: string; label: string }> | ReadonlyArray<{ id: string; code: string; name: string }>
): ReadonlyArray<{ value: string; label: string; count: number }> {
  if (!value || list.some((row) => row.value === value)) return list
  const found = (source as ReadonlyArray<Record<string, string>>).find((row) => (row.value ?? row.id) === value)
  if (!found) return list
  const label = found.label ?? ([found.code, found.name].filter(Boolean).join(' · ') || 'Untitled')
  return [{ value, label, count: 0 }, ...list]
}

function TaskListInner({ mode, location, approvals }: TaskListProps) {
  const ws = useTaskWorkspace()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const toast = useToast()
  const taskParam = params.get('task')
  const modeParam = (params.get('mode') as TaskPopupMode | null) ?? 'view'
  const pushed = useRef(false)

  const [tabChoice, setTab] = useState<TabKey>('active')
  const [scopeChoice, setScopeChoice] = useState<unknown>(() => readScope())
  const [search, setSearch] = useState('')
  const [filters, setFiltersState] = useState<Required<TaskFilters>>(() => readFilters(mode))
  const [sort, setSortState] = useState<TaskSortKey>(() => parseTaskSort(readStored(`${SORT_KEY}.${mode}`)))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const setFilters = (next: Required<TaskFilters>) => {
    setFiltersState(next)
    writeStored(`${FILTERS_KEY}.${mode}`, JSON.stringify(next))
  }
  const setFilter = <K extends keyof TaskFilters>(key: K, value: Required<TaskFilters>[K]) => setFilters({ ...filters, [key]: value })
  const chooseSort = (next: TaskSortKey) => {
    setSortState(next)
    writeStored(`${SORT_KEY}.${mode}`, next)
  }
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Bug B9 / F4: staff land on Everyone, operatives on My tasks; a person's last choice is kept on this device.
  const scope: TaskScopeKey = taskScopeFor(ws.role, scopeChoice)

  const chooseScope = (next: TaskScopeKey) => {
    setScopeChoice(next)
    try {
      window.localStorage.setItem(SCOPE_KEY, next)
    } catch {
      /* this device does not keep it */
    }
  }

  const openTask = (task: string, popupMode: TaskPopupMode = 'view') => {
    const next = new URLSearchParams(params.toString())
    next.set('task', task)
    if (popupMode === 'view') next.delete('mode')
    else next.set('mode', popupMode)
    const url = `${pathname}?${next.toString()}`
    if (taskParam) router.replace(url, { scroll: false })
    else {
      pushed.current = true
      router.push(url, { scroll: false })
    }
  }
  const closeTask = () => {
    if (pushed.current) {
      pushed.current = false
      router.back()
      return
    }
    const next = new URLSearchParams(params.toString())
    next.delete('task')
    next.delete('mode')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const locationKey = (location?.id || '').toLowerCase()
  const inLocation = useMemo(
    () => (mode === 'location' ? ws.tasks.filter((task) => (task.projectId || '').toLowerCase() === locationKey) : ws.tasks),
    [mode, ws.tasks, locationKey]
  )
  const inScope = useMemo(
    () => (scope === 'everyone' && ws.access.seesEveryone ? inLocation : inLocation.filter((task) => ws.assignedIds.has(task.id))),
    [scope, ws.access.seesEveryone, inLocation, ws.assignedIds]
  )

  const assigneeOptions = useMemo(() => {
    const ops = foldTaskFilterPeople(ws.operatives, 'operative', ws.personIndex).map((row) => ({ kind: 'operative' as const, row }))
    const mgrs = foldTaskFilterPeople(ws.managers, 'manager', ws.personIndex).map((row) => ({ kind: 'manager' as const, row }))
    const seen = new Set<string>()
    const keyOf = (id: string) => ws.personKeys[id.toLowerCase()] || `id:${id.toLowerCase()}`
    return [...mgrs, ...ops]
      .map(({ row }) => ({ key: keyOf(row.id), name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email }))
      .filter((option) => option.name && !seen.has(option.key) && seen.add(option.key))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [ws.operatives, ws.managers, ws.personIndex, ws.personKeys])

  // Rulebook 1.91.0 §34 decision B: projects, small works and who assigned the tasks, with counts over this list.
  const filterLocations = useMemo(
    () => ws.locations.map((row) => ({ id: row.id, kind: row.kind, code: row.code, name: row.name })),
    [ws.locations]
  )
  const options = useMemo(
    () => taskFilterOptions({ tasks: inScope, locations: filterLocations, personKeys: ws.personKeys, roster: ws.namesRoster as never }),
    [inScope, filterLocations, ws.personKeys, ws.namesRoster]
  )
  const effectiveFilters = mode === 'location' ? { ...filters, projectId: '', smallWorksId: '' } : filters
  // Review of #458: a remembered project, small works or "assigned by" that no longer exists (a deleted job, a person
  // key changed by a roster fold) is dropped once everything has loaded, and saved again — never applied while the
  // select shows "All". Judged against every task the person can see and every job, not only this tab.
  const allOptions = useMemo(
    () => taskFilterOptions({ tasks: ws.tasks, locations: filterLocations, personKeys: ws.personKeys, roster: ws.namesRoster as never }),
    [ws.tasks, filterLocations, ws.personKeys, ws.namesRoster]
  )
  useEffect(() => {
    if (!ws.visibilityReady || ws.loading) return
    const known = (list: ReadonlyArray<{ value: string }>, value: string) => !value || list.some((row) => row.value === value)
    const locationKnown = (value: string, kind: 'project' | 'smallWorks') =>
      !value || filterLocations.some((row) => row.kind === kind && row.id === value)
    const next = { ...filters }
    if (!locationKnown(next.projectId, 'project')) next.projectId = ''
    if (!locationKnown(next.smallWorksId, 'smallWorks')) next.smallWorksId = ''
    if (!known(allOptions.creators, next.creatorKey)) next.creatorKey = ''
    if (next.projectId !== filters.projectId || next.smallWorksId !== filters.smallWorksId || next.creatorKey !== filters.creatorKey) {
      setFilters(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFilters is a plain setter that also saves
  }, [ws.visibilityReady, ws.loading, filters, filterLocations, allOptions])
  const activeCount = taskActiveFilterCount(effectiveFilters)

  const filtered = useMemo(
    () => filterTasks(inScope, effectiveFilters, { locations: filterLocations, personKeys: ws.personKeys, nowMs: now, timeZone: ws.timeZone }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effectiveFilters is derived from filters and mode
    [inScope, filters, mode, filterLocations, ws.personKeys, now, ws.timeZone]
  )

  /** The chips of the filters that are on, each with its own ✕. */
  const activeChips = (() => {
    const chips: Array<{ key: keyof TaskFilters; label: string }> = []
    const label = (list: ReadonlyArray<{ value: string; label: string }>, value: string, fallback: string) =>
      list.find((row) => row.value === value)?.label ?? fallback
    if (!ws.visibilityReady) return chips
    const locationLabel = (value: string, fallback: string) => {
      const row = filterLocations.find((loc) => loc.id === value)
      return row ? [row.code, row.name].filter(Boolean).join(' · ') || 'Untitled' : fallback
    }
    if (effectiveFilters.projectId) chips.push({ key: 'projectId', label: `Project: ${locationLabel(effectiveFilters.projectId, 'Project')}` })
    if (effectiveFilters.smallWorksId) chips.push({ key: 'smallWorksId', label: `Small works: ${locationLabel(effectiveFilters.smallWorksId, 'Small works')}` })
    if (effectiveFilters.creatorKey) chips.push({ key: 'creatorKey', label: `Assigned by: ${label(allOptions.creators, effectiveFilters.creatorKey, 'Unknown person')}` })
    if (effectiveFilters.assigneeKey) {
      chips.push({ key: 'assigneeKey', label: `Assignee: ${assigneeOptions.find((row) => row.key === effectiveFilters.assigneeKey)?.name ?? 'Unknown person'}` })
    }
    if (effectiveFilters.priority) chips.push({ key: 'priority', label: `Priority: ${taskPriorityLabel(effectiveFilters.priority)}` })
    if (effectiveFilters.due) chips.push({ key: 'due', label: TASK_DUE_FILTERS.find((row) => row.key === effectiveFilters.due)?.label ?? 'Due' })
    return chips
  })()

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter((task) => {
      const loc = ws.locationOf(task)
      const names = taskAssigneeNames(
        { managerIds: allAssignedManagerIds(task), operativeIds: allAssignedOperativeIds(task) },
        ws.nameRows
      )
      return [task.title, task.details ?? '', loc?.name ?? '', loc?.code ?? '', ...names.map((entry) => entry.name)].some((text) =>
        text.toLowerCase().includes(q)
      )
    })
  }, [filtered, search, ws])

  const counts = useMemo(() => taskTabCounts(filtered, now, ws.timeZone), [filtered, now, ws.timeZone])
  const showApprovals = Boolean(mode === 'main' && approvals && approvals.count > 0)
  const tab: TabKey = tabChoice === 'approvals' && !showApprovals ? 'active' : tabChoice
  const taskTab: TaskTabKey = tab === 'approvals' ? 'active' : tab
  const rows = useMemo(
    () => sortTasks(searched.filter((task) => taskInTab(task, taskTab, now, ws.timeZone)), sort, taskTab, now, ws.timeZone),
    [searched, sort, taskTab, now, ws.timeZone]
  )

  const groups = useMemo(() => {
    if (mode !== 'main') return null
    const out: Array<{ key: string; location: TaskLocation | null; tasks: ProjectTask[] }> = []
    const byKey = new Map<string, (typeof out)[number]>()
    for (const task of rows) {
      const key = (task.projectId || '__none__').toLowerCase()
      let group = byKey.get(key)
      if (!group) {
        group = { key, location: ws.locationOf(task), tasks: [] }
        byKey.set(key, group)
        out.push(group)
      }
      group.tasks.push(task)
    }
    return out
  }, [mode, rows, ws])

  // Review of #458: a non-admin's list waits for the jobs, the Managers / Operatives rows and the users roster, so it
  // never shows a short list or "No tasks" first.
  if ((ws.loading && ws.tasks.length === 0) || !ws.visibilityReady) return <LoadingSpinner label="Loading tasks…" />
  if (ws.error && ws.tasks.length === 0) return <ErrorBanner message={ws.error} />

  const emptyCopy = (() => {
    if (search.trim()) return { title: taskCopyText(TASK_COPY.empty.search.title, { query: search.trim() }), body: TASK_COPY.empty.search.body }
    if (taskTab === 'overdue') return TASK_COPY.empty.overdue
    if (taskTab === 'completed') return TASK_COPY.empty.completed
    return scope === 'mine' ? TASK_COPY.empty.active_mine : TASK_COPY.empty.active_everyone
  })()

  const renderRow = (task: ProjectTask) => (
    <TaskRow
      key={task.id}
      ws={ws}
      task={task}
      now={now}
      showLocation={mode === 'main'}
      onOpen={(popupMode) => openTask(task.id, popupMode)}
      onToast={toast}
    />
  )

  return (
    <div className="tk-page">
      <div className="tk-head">
        <div>
          {mode === 'main' ? <h1>{TASK_COPY.page.title}</h1> : <h2>{TASK_COPY.page.title}</h2>}
          {mode === 'main' ? <p>{TASK_COPY.page.subtitle}</p> : null}
        </div>
        {ws.access.canCreate ? (
          <button type="button" className="tk-btn primary" onClick={() => openTask('new')}>
            <PlusIcon width={18} height={18} aria-hidden />
            {TASK_COPY.page.newTask}
          </button>
        ) : null}
      </div>

      <div className="tk-tabs" role="tablist" aria-label="Task lists">
        {TASK_TABS.map((item) => (
          <button key={item.key} type="button" role="tab" className="tk-tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}>
            {item.label}
            <span className={`n${item.key === 'overdue' && counts.overdue > 0 ? ' red' : ''}`}>{counts[item.key]}</span>
          </button>
        ))}
        {showApprovals ? (
          <button type="button" role="tab" className="tk-tab" aria-selected={tab === 'approvals'} onClick={() => setTab('approvals')}>
            Approvals
            <span className="n">{approvals!.count}</span>
          </button>
        ) : null}
      </div>

      {tab === 'approvals' && showApprovals ? (
        approvals!.content
      ) : (
        <>
          <div className="tk-toolbar">
            {ws.access.seesEveryone ? (
              <div className="tk-seg" role="group" aria-label="Whose tasks">
                {TASK_SCOPES.map((item) => (
                  <button key={item.key} type="button" aria-pressed={scope === item.key} onClick={() => chooseScope(item.key)}>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="tk-search">
              <MagnifyingGlassIcon aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={mode === 'main' ? TASK_COPY.page.searchPlaceholder : TASK_COPY.page.searchPlaceholderLocation}
                aria-label="Search tasks"
              />
            </label>
            <button
              type="button"
              className="tk-btn"
              aria-expanded={filtersOpen}
              aria-controls="tk-filter-panel"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <AdjustmentsHorizontalIcon width={18} height={18} aria-hidden />
              {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
            </button>
            <label className="tk-sort">
              <span>Sort</span>
              <select className="tk-select" value={sort} onChange={(e) => chooseSort(parseTaskSort(e.target.value))} aria-label="Sort tasks">
                {TASK_SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {taskSortLabel(option.key, taskTab)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtersOpen ? (
            <div className="tk-filter-panel" id="tk-filter-panel" role="region" aria-label="Filter tasks">
              {mode === 'main' ? (
                <>
                  <label className="tk-filter-field">
                    <span>Project</span>
                    <select className="tk-select" value={effectiveFilters.projectId} onChange={(e) => setFilter('projectId', e.target.value)}>
                      <option value="">All projects</option>
                      {withSelected(options.projects, effectiveFilters.projectId, filterLocations).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="tk-filter-field">
                    <span>Small works</span>
                    <select className="tk-select" value={effectiveFilters.smallWorksId} onChange={(e) => setFilter('smallWorksId', e.target.value)}>
                      <option value="">All small works</option>
                      {withSelected(options.smallWorks, effectiveFilters.smallWorksId, filterLocations).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="tk-filter-field">
                <span>Assigned by</span>
                <select className="tk-select" value={effectiveFilters.creatorKey} onChange={(e) => setFilter('creatorKey', e.target.value)}>
                  <option value="">Anyone</option>
                  {withSelected(options.creators, effectiveFilters.creatorKey, allOptions.creators).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="tk-filter-field">
                <span>Assigned to</span>
                <select className="tk-select" value={effectiveFilters.assigneeKey} onChange={(e) => setFilter('assigneeKey', e.target.value)}>
                  <option value="">Anyone</option>
                  {assigneeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="tk-filter-field">
                <legend>Priority</legend>
                <div className="tk-chips">
                  {TASK_PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.token}
                      type="button"
                      className="tk-filter-chip"
                      aria-pressed={effectiveFilters.priority === option.token}
                      onClick={() => setFilter('priority', effectiveFilters.priority === option.token ? '' : option.token)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="tk-filter-field">
                <legend>Due</legend>
                <div className="tk-chips">
                  {TASK_DUE_FILTERS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className="tk-filter-chip"
                      aria-pressed={effectiveFilters.due === option.key}
                      onClick={() => setFilter('due', effectiveFilters.due === option.key ? '' : option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {activeChips.length > 0 ? (
            <div className="tk-active-filters" aria-label="Filters on">
              {activeChips.map((chip) => (
                <span key={chip.key} className="tk-filter-chip on">
                  {chip.label}
                  <button type="button" className="x" aria-label={`Remove ${chip.label}`} onClick={() => setFilter(chip.key, '' as never)}>
                    <XMarkIcon width={16} height={16} aria-hidden />
                  </button>
                </span>
              ))}
              <button type="button" className="tk-btn sm ghost" onClick={() => setFilters({ ...TASK_NO_FILTERS })}>
                Clear all
              </button>
              <span className="tk-muted" role="status">
                {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'} match
              </span>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <div className="tk-empty">
              <h3>{emptyCopy.title}</h3>
              <p>{emptyCopy.body}</p>
            </div>
          ) : groups ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {groups.map((group) => (
                <section key={group.key} className="tk-group">
                  <div className="tk-group-h">
                    <span className="tk-chip" data-tone={group.location?.kind === 'smallWorks' ? 'amber' : 'green'}>
                      {group.location?.kind === 'smallWorks' ? 'Small works' : 'Project'}
                    </span>
                    {group.location?.code ? <span className="meta">{group.location.code}</span> : null}
                    <span className="name">{group.location?.name ?? 'Unknown job'}</span>
                    <span className="meta">
                      {group.tasks.length} {taskTab === 'completed' ? 'completed' : taskTab === 'overdue' ? 'overdue' : 'active'}
                    </span>
                    <span className="grow" />
                    {group.location ? (
                      <Link className="tk-btn sm" href={group.location.href}>
                        {group.location.kind === 'smallWorks' ? 'Open small works' : 'Open project'}
                      </Link>
                    ) : null}
                  </div>
                  <div className="tk-list">{group.tasks.map(renderRow)}</div>
                </section>
              ))}
            </div>
          ) : (
            <div className="tk-list flat">{rows.map(renderRow)}</div>
          )}
        </>
      )}

      {taskParam ? (
        <TaskPopup
          ws={ws}
          taskParam={taskParam}
          mode={modeParam}
          lockedLocation={mode === 'location' ? location ?? null : null}
          showLocationLink={mode === 'main'}
          onNavigate={(next) => openTask(next.task, next.mode)}
          onClose={closeTask}
        />
      ) : null}
    </div>
  )
}

function TaskRow({
  ws,
  task,
  now,
  showLocation,
  onOpen,
  onToast,
}: {
  ws: TaskWorkspace
  task: ProjectTask
  now: number
  showLocation: boolean
  onOpen: (mode: TaskPopupMode) => void
  onToast: (message: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const access = ws.accessFor(task)
  const due = taskDueLabel(task, now, ws.timeZone)
  const actions = taskActions(task.status)
  const step = taskCompleteStep({ items: task.items, completedItemIds: task.completedItemIds })
  const files = (task.attachedImageURLs?.length ?? 0) + (task.attachedFileURL ? 1 : 0)
  const people = taskAssigneeNames(
    { managerIds: allAssignedManagerIds(task), operativeIds: allAssignedOperativeIds(task) },
    ws.nameRows
  )
  const location = ws.locationOf(task)
  const edge = due.overdue ? 'red' : due.tone === 'amber' ? 'amber' : undefined
  const statusKey = taskStatusKey(task.status)

  const runMain = async () => {
    if (!access.canAct || busy) return
    if (actions.primary === 'complete') {
      onOpen('complete')
      return
    }
    setBusy(true)
    setError(null)
    const failed = await runStatusAction(task, actions.primary, personDisplay(ws.user))
    setBusy(false)
    if (failed) setError(failed)
    else onToast(actions.primary === 'start' ? TASK_COPY.toasts.started : TASK_COPY.toasts.reopened)
  }

  const copyLink = async () => {
    setMenu(false)
    try {
      const url = new URL(location?.href ?? window.location.pathname, window.location.origin)
      url.searchParams.set('task', task.id)
      await navigator.clipboard.writeText(url.toString())
      onToast(TASK_COPY.toasts.linkCopied)
    } catch {
      setError('The link couldn’t be copied.')
    }
  }

  return (
    <div
      className="tk-row"
      data-edge={edge}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}, ${taskStatusLabel(task.status)}, ${due.label}`}
      onClick={() => onOpen('view')}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen('view')
        }
      }}
    >
      <button
        type="button"
        className="tk-circle circle"
        data-status={statusKey}
        disabled={!access.canAct || busy}
        aria-label={`${TASK_ACTION_LABELS[actions.primary]} ${task.title}`}
        onClick={(event) => {
          event.stopPropagation()
          void runMain()
        }}
      >
        {statusKey === 'completed' ? <CheckIcon aria-hidden /> : null}
      </button>
      <div className="main">
        <div className="title">{task.title}</div>
        <div className="meta">
          {showLocation && location ? <span>{[location.code, location.name].filter(Boolean).join(' ')}</span> : null}
          {step.total > 0 ? <span>Checklist {step.done}/{step.total}</span> : null}
          {files > 0 ? <span>{files} file{files === 1 ? '' : 's'}</span> : null}
          <span>{taskStatusLabel(task.status)}</span>
          {access.canEdit && people.some((entry) => entry.removed) ? <span style={{ color: 'var(--pu-c-red-ink)' }}>Removed user · reassign</span> : null}
        </div>
        {error ? (
          <div className="tk-error" role="alert" style={{ marginTop: 4 }}>
            {error}
          </div>
        ) : null}
      </div>
      <div className="bottom">
        <div className="tk-avatars" aria-label={`Assigned to ${people.map((entry) => entry.name).join(', ') || 'nobody'}`}>
          {people.slice(0, 3).map((entry) => (
            <span key={`${entry.kind}:${entry.id}`} className={`tk-avatar${entry.removed ? ' removed' : ''}`} title={entry.name} aria-hidden>
              {entry.removed ? '?' : initialsOf(entry.name)}
            </span>
          ))}
        </div>
        <div className={`due ${due.tone}`}>
          <b>{due.label}</b>
          {due.secondary ? <span>{due.secondary}</span> : null}
        </div>
        <span className="tk-chip" data-tone={taskPriorityTone(task.priority)}>
          <span className="dot" aria-hidden />
          {taskPriorityLabel(task.priority)}
        </span>
        {access.canAct ? (
          <button
            type="button"
            className={`tk-btn sm${actions.primary === 'complete' ? ' primary' : ''}`}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              void runMain()
            }}
          >
            {busy ? '…' : TASK_ACTION_LABELS[actions.primary]}
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="tk-menu-wrap more" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="tk-icon-btn" aria-label={`More actions for ${task.title}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <EllipsisHorizontalIcon aria-hidden />
        </button>
        {menu ? (
          <div className="tk-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => onOpen('view')}>
              Open
            </button>
            {/* The old project cards' gear icon opened Edit task; it lives here now. */}
            {access.canEdit ? (
              <button type="button" role="menuitem" onClick={() => onOpen('edit')}>
                Edit
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={() => void copyLink()}>
              {TASK_COPY.detail.copyLink}
            </button>
            {showLocation && location ? (
              <Link href={location.href} role="menuitem">
                {location.kind === 'smallWorks' ? 'Open small works' : 'Open project'}
              </Link>
            ) : null}
            {access.canDelete ? (
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenu(false)
                  setConfirmDelete(true)
                }}
              >
                {TASK_COPY.detail.delete}
              </button>
            ) : null}
          </div>
        ) : null}
        <ConfirmDialog
          open={confirmDelete}
          title={taskCopyText(TASK_COPY.delete.title, { title: task.title })}
          body={TASK_COPY.delete.body}
          confirm={TASK_COPY.delete.confirm}
          danger
          busy={busy}
          error={deleteError}
          onCancel={() => {
            setConfirmDelete(false)
            setDeleteError(null)
          }}
          onConfirm={async () => {
            if (!ws.organization?.id) return
            setBusy(true)
            const failed = await deleteTaskById(ws.organization.id, task.id)
            setBusy(false)
            if (failed) {
              setDeleteError(failed)
              return
            }
            setConfirmDelete(false)
            onToast(TASK_COPY.toasts.deleted)
          }}
        />
      </div>
    </div>
  )
}

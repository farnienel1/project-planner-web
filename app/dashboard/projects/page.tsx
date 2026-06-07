'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  countWorksByTab,
  daysLeftCaption,
  deriveWorkStatus,
  filterWorksByTab,
  timelineProgressPercent,
  workStatusLabel,
} from '@/lib/projects/workStatus'

type Filter = 'all' | 'active' | 'upcoming' | 'completed'

function safeFmt(val: unknown, fallback = '—') {
  try {
    const d = val instanceof Date ? val : new Date(val as string)
    if (isNaN(d.getTime())) return fallback
    return format(d, 'd MMM yy')
  } catch { return fallback }
}

export default function ProjectsPage() {
  const { organization } = useAuthStore()
  const { projects, clients, loading, loadProjects, loadClients } = useProjectStore()
  const { tasks, loadTasks } = useTaskStore()
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id)
      loadClients(organization.id)
      loadTasks(organization.id)
    }
  }, [organization, loadProjects, loadClients, loadTasks])

  const filtered = useMemo(() => {
    let list = filterWorksByTab(projects, filter === 'all' ? 'all' : filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.siteName?.toLowerCase().includes(q) ||
        p.jobNumber?.toLowerCase().includes(q) ||
        p.client?.name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [projects, filter, search])

  const counts = useMemo(() => countWorksByTab(projects), [projects])

  const openTasksForProject = (id: string) =>
    tasks.filter(t => t.projectId === id && t.status !== 'Completed').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {counts.active} active · {clients.length} clients
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New project
        </Link>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm"
        />
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'upcoming', 'completed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
              filter === f
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span className="ml-1.5 opacity-70">· {counts[f]}</span>}
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-700">No projects found</p>
          <p className="mt-1 text-xs text-slate-400">Try a different filter or create a new project.</p>
          <Link href="/dashboard/projects/new" className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(project => {
            const status = deriveWorkStatus(project)
            const progress = timelineProgressPercent(project.startDate, project.endDate, status)
            const openTasks = openTasksForProject(project.id)
            const label = workStatusLabel(status)
            const daysLabel = daysLeftCaption(project.endDate, status)

            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
              >
                {/* Card header — blue gradient like iOS */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {project.jobNumber}
                        </span>
                        {project.jobType && (
                          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-100">
                            {project.jobType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white leading-snug truncate">
                        {project.siteName || 'Untitled project'}
                      </h3>
                      <p className="text-xs text-blue-200 truncate mt-0.5">
                        {project.client?.name || '—'}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      status === 'completed' ? 'bg-white/15 text-blue-100' :
                      status === 'active' ? 'bg-emerald-400/25 text-emerald-100' :
                      status === 'upcoming' ? 'bg-amber-400/25 text-amber-100' :
                      'bg-white/15 text-blue-100'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        status === 'completed' ? 'bg-slate-300' :
                        status === 'active' ? 'bg-emerald-300' :
                        status === 'upcoming' ? 'bg-amber-300' :
                        'bg-slate-300'
                      }`} />
                      {label}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1 w-full rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-[10px] text-blue-200">{progress}% complete</span>
                    <span className="text-[10px] text-blue-200">{daysLabel}</span>
                  </div>
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col px-4 py-3 gap-2">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {safeFmt(project.startDate)} – {safeFmt(project.endDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{project.client?.name || '—'}</span>
                  </div>
                  {openTasks > 0 && (
                    <div className="mt-auto pt-2 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        {openTasks} open task{openTasks !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

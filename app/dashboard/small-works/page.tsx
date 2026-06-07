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

export default function SmallWorksPage() {
  const { organization } = useAuthStore()
  const { smallWorks, loading, loadSmallWorks } = useProjectStore()
  const { tasks, loadTasks } = useTaskStore()
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (organization?.id) {
      loadSmallWorks(organization.id)
      loadTasks(organization.id)
    }
  }, [organization, loadSmallWorks, loadTasks])

  const filtered = useMemo(() => {
    let list = filterWorksByTab(smallWorks, filter === 'all' ? 'all' : filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.siteName?.toLowerCase().includes(q) ||
        p.jobNumber?.toLowerCase().includes(q) ||
        p.client?.name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [smallWorks, filter, search])

  const counts = useMemo(() => countWorksByTab(smallWorks), [smallWorks])

  const openTasksForWork = (id: string) =>
    tasks.filter(t => t.projectId === id && t.status !== 'Completed').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Small Works</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {counts.active} active of {smallWorks.length} total
          </p>
        </div>
        <Link
          href="/dashboard/small-works/new"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 active:scale-95 transition-all"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New small work
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
          placeholder="Search small works…"
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 shadow-sm"
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
                ? 'border-amber-500 bg-amber-500 text-white'
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-700">No small works found</p>
          <p className="mt-1 text-xs text-slate-400">Try a different filter or create a new small work.</p>
          <Link href="/dashboard/small-works/new" className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New small work
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(work => {
            const status = deriveWorkStatus(work)
            const progress = timelineProgressPercent(work.startDate, work.endDate, status)
            const openTasks = openTasksForWork(work.id)
            const label = workStatusLabel(status)
            const daysLabel = daysLeftCaption(work.endDate, status)

            return (
              <Link
                key={work.id}
                href={`/dashboard/small-works/${work.id}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
              >
                {/* Amber gradient header for small works */}
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {work.jobNumber}
                        </span>
                        {work.jobType && (
                          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-100">
                            {work.jobType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white leading-snug truncate">
                        {work.siteName || 'Untitled small work'}
                      </h3>
                      <p className="text-xs text-amber-100 truncate mt-0.5">
                        {work.client?.name || '—'}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      status === 'completed' ? 'bg-white/15 text-amber-100' :
                      status === 'active' ? 'bg-emerald-400/25 text-emerald-100' :
                      status === 'upcoming' ? 'bg-amber-400/25 text-amber-100' :
                      'bg-white/15 text-amber-100'
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
                  <div className="mt-3 h-1 w-full rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-[10px] text-amber-100">{progress}% complete</span>
                    <span className="text-[10px] text-amber-100">{daysLabel}</span>
                  </div>
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col px-4 py-3 gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {safeFmt(work.startDate)} – {safeFmt(work.endDate)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                    </svg>
                    <span className="truncate">{work.client?.name || '—'}</span>
                  </div>
                  {openTasks > 0 && (
                    <div className="mt-auto pt-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
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

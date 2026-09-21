/**
 * iOS parity source: QuickMenuSheet / Edit main menu bar
 * Spec: docs/ios-parity/02-navigation-map.md
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project } from '@/types'
import type { DashboardNavItem } from '@/lib/navigation/dashboardNavigation'
import {
  addEntry,
  availableCatalogItems,
  entryKey,
  moveEntry,
  removeEntry,
  type NavigateConfig,
  type NavigateEntry,
} from '@/lib/navigation/navigateCustomization'
import { deriveWorkStatus, searchWorks } from '@/lib/projects/workStatus'

function sortByDateAdded(works: Project[]): Project[] {
  return [...works].sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
    return bTime - aTime
  })
}

export function CustomiseNavigateSheet({
  config,
  catalog,
  projects,
  smallWorks,
  onChange,
  onClose,
}: {
  config: NavigateConfig
  catalog: DashboardNavItem[]
  projects: Project[]
  smallWorks: Project[]
  onChange: (next: NavigateConfig) => void
  onClose: () => void
}) {
  const [picker, setPicker] = useState<'project' | 'smallWorks' | null>(null)
  const [workQuery, setWorkQuery] = useState('')
  const [pickerTick, setPickerTick] = useState(0)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const available = useMemo(() => availableCatalogItems(config, catalog), [config, catalog])
  const liveProjects = useMemo(
    () => sortByDateAdded(projects.filter((row) => deriveWorkStatus(row) !== 'inactive')),
    [projects]
  )
  const liveSmallWorks = useMemo(
    () => sortByDateAdded(smallWorks.filter((row) => deriveWorkStatus(row) !== 'inactive')),
    [smallWorks]
  )

  useEffect(() => {
    if (!picker) return
    pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [picker, pickerTick])

  const openPicker = (kind: 'project' | 'smallWorks') => {
    setPicker(kind)
    setWorkQuery('')
    setPickerTick((value) => value + 1)
  }

  const addWork = (kind: 'project' | 'smallWorks', work: Project) => {
    onChange(
      addEntry(config, {
        type: kind,
        id: work.id,
        label: work.siteName || work.jobNumber || work.id,
        jobNumber: work.jobNumber,
      })
    )
    setPicker(null)
  }

  const labelFor = (entry: NavigateEntry): string => {
    if (entry.type === 'item') {
      return catalog.find((item) => item.id === entry.id)?.label || entry.id
    }
    const prefix = entry.jobNumber ? `${entry.jobNumber} · ` : ''
    return `${prefix}${entry.label}`
  }

  const pickerWorks = picker
    ? searchWorks(picker === 'project' ? liveProjects : liveSmallWorks, workQuery)
    : []

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-16" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-base font-semibold">Customise Navigate</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[var(--blue)] px-3 py-1 text-[13px] font-semibold text-white"
          >
            Done
          </button>
        </div>
        <div className="max-h-[calc(85vh-52px)] space-y-5 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-[var(--ink3)]">
              Your Navigate list
            </p>
            <p className="mb-3 text-[12px] text-slate-500">
              Drag to reorder. Red × removes an item. Shortcuts stay even after a job finishes, until you remove them.
            </p>
            <div className="space-y-1.5">
              {config.entries.map((entry, index) => (
                <div
                  key={entryKey(entry)}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex == null) return
                    onChange(moveEntry(config, dragIndex, index))
                    setDragIndex(null)
                  }}
                  className="flex cursor-grab items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:cursor-grabbing"
                >
                  <span className="text-slate-300" aria-hidden>
                    ⋮⋮
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{labelFor(entry)}</span>
                  <span className="text-[11px] text-slate-400">
                    {entry.type === 'item' ? 'Page' : entry.type === 'smallWorks' ? 'Small work' : 'Project'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${labelFor(entry)}`}
                    onClick={() => onChange(removeEntry(config, entryKey(entry)))}
                    className="grid h-6 w-6 place-items-center rounded-full bg-[#E11D48] text-[11px] font-bold text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {config.entries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                  Nothing in Navigate yet. Add pages or jobs below.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-[var(--ink3)]">Add pages</p>
            <div className="flex flex-wrap gap-2">
              {available.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange(addEntry(config, { type: 'item', id: item.id }))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  + {item.label}
                </button>
              ))}
              {available.length === 0 ? (
                <p className="text-[13px] text-slate-500">Every available page is already in Navigate.</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPicker('project')}
              className="rounded-xl bg-[var(--blue)] px-3 py-2 text-[13px] font-semibold text-white"
            >
              Add project
            </button>
            <button
              type="button"
              onClick={() => openPicker('smallWorks')}
              className="rounded-xl bg-amber-600 px-3 py-2 text-[13px] font-semibold text-white"
            >
              Add small works
            </button>
          </div>

          {picker ? (
            <div ref={pickerRef} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {picker === 'project' ? 'Live projects' : 'Live small works'}
                </p>
                <button type="button" className="text-sm text-slate-500" onClick={() => setPicker(null)}>
                  Close
                </button>
              </div>
              <input
                value={workQuery}
                onChange={(event) => setWorkQuery(event.target.value)}
                placeholder={picker === 'project' ? 'Search projects' : 'Search small works'}
                className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
              />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {pickerWorks.map((work) => (
                  <button
                    key={work.id}
                    type="button"
                    onClick={() => addWork(picker, work)}
                    className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    <span className="truncate font-medium">
                      {work.jobNumber ? `${work.jobNumber} · ` : ''}
                      {work.siteName}
                    </span>
                    <span className="text-[11px] text-slate-400">{deriveWorkStatus(work)}</span>
                  </button>
                ))}
                {pickerWorks.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-slate-500">
                    {workQuery.trim() ? 'No jobs match that search.' : 'No live jobs to add.'}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

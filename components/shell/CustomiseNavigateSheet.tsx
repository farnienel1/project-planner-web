/**
 * iOS parity source: QuickMenuSheet / Edit main menu bar
 * Spec: docs/ios-parity/02-navigation-map.md
 */

'use client'

import { useMemo, useState } from 'react'
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
import { deriveWorkStatus } from '@/lib/projects/workStatus'

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
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const available = useMemo(() => availableCatalogItems(config, catalog), [config, catalog])
  const liveProjects = projects.filter((row) => deriveWorkStatus(row) !== 'inactive')
  const liveSmallWorks = smallWorks.filter((row) => deriveWorkStatus(row) !== 'inactive')

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
            className="rounded-full bg-[#185FA5] px-3 py-1 text-[13px] font-semibold text-white"
          >
            Done
          </button>
        </div>
        <div className="max-h-[calc(85vh-52px)] space-y-5 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-ios-muted">
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-ios-muted">Add pages</p>
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
              onClick={() => setPicker('project')}
              className="rounded-xl bg-[#185FA5] px-3 py-2 text-[13px] font-semibold text-white"
            >
              Add project
            </button>
            <button
              type="button"
              onClick={() => setPicker('smallWorks')}
              className="rounded-xl bg-amber-600 px-3 py-2 text-[13px] font-semibold text-white"
            >
              Add small works
            </button>
          </div>

          {picker ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {picker === 'project' ? 'Live projects' : 'Live small works'}
                </p>
                <button type="button" className="text-sm text-slate-500" onClick={() => setPicker(null)}>
                  Close
                </button>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {(picker === 'project' ? liveProjects : liveSmallWorks).map((work) => (
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
                {(picker === 'project' ? liveProjects : liveSmallWorks).length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-slate-500">No live jobs to add.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * iOS parity source: Views/ProjectDetailView.swift ProjectTaskFilterSheet ~L2858
 */
'use client'

import { useState } from 'react'
import { FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
import {
  JOB_TASK_FILTER_TYPES,
  personDisplayName,
  type JobTaskFilter,
  type JobTaskFilterType,
} from '@/lib/tasks/projectTaskFilters'
import type { Manager, Operative } from '@/types'

function toDateInput(date?: Date): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromDateInput(value: string): Date | undefined {
  if (!value) return undefined
  return new Date(`${value}T00:00:00`)
}

export function ProjectTaskFilterSheet({
  filter,
  operatives,
  managers,
  onApply,
  onClose,
}: {
  filter: JobTaskFilter
  operatives: Operative[]
  managers: Manager[]
  onApply: (next: JobTaskFilter) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<JobTaskFilter>(() => {
    if (filter.type === 'dateRange' && !filter.dateStart && !filter.dateEnd) {
      const today = new Date()
      return { ...filter, dateStart: today, dateEnd: today }
    }
    return filter
  })

  const setType = (type: JobTaskFilterType) => {
    setLocal((prev) => {
      const next: JobTaskFilter = { ...prev, type }
      if (type === 'dateRange' && !next.dateStart && !next.dateEnd) {
        const today = new Date()
        next.dateStart = today
        next.dateEnd = today
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--blue)]">
            Cancel
          </button>
          <p className="text-sm font-semibold text-slate-900">Task Filters</p>
          <button
            type="button"
            onClick={() => {
              onApply(local)
              onClose()
            }}
            className="text-sm font-semibold text-[var(--blue)]"
          >
            Apply
          </button>
        </header>
        <div className="space-y-5 overflow-y-auto p-5">
          <div>
            <FormLabel>Filter Type</FormLabel>
            <div className="mt-2 space-y-1">
              {JOB_TASK_FILTER_TYPES.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="task-filter-type"
                    checked={local.type === item.id}
                    onChange={() => setType(item.id)}
                    className="accent-[#185FA5]"
                  />
                  <span className="text-sm text-slate-800">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {local.type === 'operative' && (
            <div>
              <FormLabel>Operative</FormLabel>
              <FormSelect
                value={local.operativeId || operatives[0]?.id || ''}
                onChange={(e) => setLocal((prev) => ({ ...prev, operativeId: e.target.value }))}
              >
                {operatives.map((row) => (
                  <option key={row.id} value={row.id}>
                    {personDisplayName(row)}
                  </option>
                ))}
              </FormSelect>
            </div>
          )}

          {local.type === 'manager' && (
            <div>
              <FormLabel>Manager</FormLabel>
              <FormSelect
                value={local.managerId || managers[0]?.id || ''}
                onChange={(e) => setLocal((prev) => ({ ...prev, managerId: e.target.value }))}
              >
                {managers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {personDisplayName(row)}
                  </option>
                ))}
              </FormSelect>
            </div>
          )}

          {local.type === 'dateRange' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FormLabel>Start Date</FormLabel>
                <FormInput
                  type="date"
                  value={toDateInput(local.dateStart)}
                  onChange={(e) => setLocal((prev) => ({ ...prev, dateStart: fromDateInput(e.target.value) }))}
                />
              </div>
              <div>
                <FormLabel>End Date</FormLabel>
                <FormInput
                  type="date"
                  value={toDateInput(local.dateEnd)}
                  onChange={(e) => setLocal((prev) => ({ ...prev, dateEnd: fromDateInput(e.target.value) }))}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setLocal({ type: 'all' })}
            className="text-sm font-semibold text-[var(--blue)]"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  )
}

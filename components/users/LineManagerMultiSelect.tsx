'use client'

import type { User } from '@/types'

export function LineManagerMultiSelect({
  managers,
  selectedIds,
  onChange,
}: {
  managers: User[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((entry) => entry !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  if (managers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        No line managers available yet. You can leave this empty and assign later.
      </p>
    )
  }

  return (
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2">
      {managers.map((manager) => {
        const checked = selectedIds.includes(manager.id)
        return (
          <label
            key={manager.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition ${
              checked ? 'bg-white shadow-sm ring-1 ring-blue-100' : 'hover:bg-white/80'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(manager.id)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="min-w-0 text-sm leading-snug">
              <span className="font-semibold text-slate-900">
                {manager.firstName} {manager.surname}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{manager.email}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

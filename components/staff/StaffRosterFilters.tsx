'use client'

import type { RosterSegment } from '@/lib/staff/userRosterUtils'

const SEGMENTS: { id: RosterSegment; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'pending', label: 'Pending' },
]

export function StaffRosterFilters<T extends string>({
  segment,
  onSegmentChange,
  search,
  onSearchChange,
  filterField,
  onFilterFieldChange,
  filterOptions,
  searchPlaceholder,
}: {
  segment: RosterSegment
  onSegmentChange: (segment: RosterSegment) => void
  search: string
  onSearchChange: (value: string) => void
  filterField: T
  onFilterFieldChange: (field: T) => void
  filterOptions: { value: T; label: string }[]
  searchPlaceholder: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSegmentChange(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              segment === item.id
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Filter by
          <select
            value={filterField}
            onChange={(e) => onFilterFieldChange(e.target.value as T)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {search.trim() && (
        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          <span>
            Filtering {filterOptions.find((option) => option.value === filterField)?.label.toLowerCase()} for &quot;
            {search.trim()}&quot;
          </span>
          <button type="button" onClick={() => onSearchChange('')} className="font-medium text-blue-600 hover:text-blue-800">
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

export function RosterStatusBadge({ status }: { status: 'Active' | 'Inactive' | 'Pending' }) {
  const styles = {
    Active: 'bg-green-100 text-green-800',
    Inactive: 'bg-slate-100 text-slate-700',
    Pending: 'bg-amber-100 text-amber-800',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

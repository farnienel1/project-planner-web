'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { AcademicCapIcon, CheckIcon, PlusIcon } from '@heroicons/react/24/solid'
import type { Qualification } from '@/types'
import {
  qualificationLibraryFilterChips,
  qualificationSearchRecordFromItem,
  rankQualificationRecords,
} from '@/lib/canonical'
import { FilterChip, SearchField } from '@/components/ios/primitives'
import { IconChip } from '@/components/ui'

export function QualificationLibraryBrowser({
  items,
  selectedIds,
  onToggle,
  onSelect,
  activeId,
  emptyLabel,
  hint,
}: {
  items: Qualification[]
  selectedIds?: string[]
  onToggle?: (id: string) => void
  onSelect?: (row: Qualification) => void
  activeId?: string | null
  emptyLabel?: string
  hint?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('All')
  const chips = useMemo(() => qualificationLibraryFilterChips(items), [items])
  const visible = useMemo(() => {
    const records = items.map((row) => qualificationSearchRecordFromItem(row))
    return rankQualificationRecords(query, records, null, section).map((hit) => items[hit.index])
  }, [items, query, section])

  return (
    <div className="space-y-3">
      <SearchField value={query} onChange={setQuery} placeholder="Search qualifications…" />
      {chips.length > 1 ? (
        <div className="chips-scroll">
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              title={`${chip.label} · ${chip.count}`}
              selected={section === chip.key}
              onClick={() => setSection(chip.key)}
            />
          ))}
        </div>
      ) : null}
      {hint}
      {visible.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-[var(--ink3)]">
          {emptyLabel || (query.trim() || section !== 'All'
            ? 'No qualifications match that search.'
            : 'No qualifications in this list.')}
        </p>
      ) : (
        <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[18px] bg-[var(--card)] shadow-[var(--sh)]">
          {visible.map((row) => {
            const selected = selectedIds?.includes(row.id) === true
            const active = activeId === row.id
            const subtitle = [row.awardingBody, row.code].filter(Boolean).join(' · ')
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  if (onToggle) onToggle(row.id)
                  else onSelect?.(row)
                }}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--soft)] ${
                  selected || active ? 'bg-[var(--rep-t)]' : ''
                }`}
              >
                <IconChip hue="rep" size="sm">
                  <AcademicCapIcon className="h-4 w-4" />
                </IconChip>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium">{row.name}</span>
                  {subtitle ? <span className="block text-[13px] text-[var(--ink3)]">{subtitle}</span> : null}
                </span>
                {onToggle ? (
                  selected ? (
                    <CheckIcon className="h-5 w-5 shrink-0 text-[var(--blue)]" />
                  ) : (
                    <PlusIcon className="h-5 w-5 shrink-0 text-[var(--blue)]" />
                  )
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

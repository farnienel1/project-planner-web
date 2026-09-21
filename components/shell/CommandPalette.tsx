'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid'
import { IconChip } from '@/components/ui/IconChip'
import { filterPaletteItems, groupPaletteItems, type PaletteItem } from '@/lib/ui/commandPalette'

export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean
  onClose: () => void
  items: PaletteItem[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const groups = useMemo(
    () => groupPaletteItems(filterPaletteItems(items, query)),
    [items, query]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" className="absolute inset-0 bg-[rgba(10,20,40,0.4)] backdrop-blur-[3px]" aria-label="Close search" onClick={onClose} />
      <div className="absolute left-1/2 top-[11vh] w-[min(640px,94vw)] -translate-x-1/2 overflow-hidden rounded-[22px] bg-[var(--card)] shadow-[var(--sh-pop)]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-5">
          <MagnifyingGlassIcon className="h-5 w-5 text-[var(--ink3)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs, people, pages and actions"
            className="h-[62px] flex-1 border-0 bg-transparent text-[17px] outline-none"
          />
          <kbd className="rounded-md bg-[var(--soft2)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--ink2)]">esc</kbd>
        </div>
        <ul className="max-h-[420px] overflow-auto p-2">
          {groups.length === 0 ? (
            <li className="px-3 py-6 text-center text-[14px] text-[var(--ink3)]">No matches in this organisation.</li>
          ) : (
            groups.map((group) => (
              <li key={group.group}>
                <p className="px-3 pb-1 pt-2.5 text-[12px] font-semibold text-[var(--ink3)]">{group.group}</p>
                {group.items.map((hit) => (
                  <button
                    key={`${hit.group}-${hit.href}-${hit.label}`}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left hover:bg-[var(--blue-t)]"
                    onClick={() => {
                      onClose()
                      router.push(hit.href)
                    }}
                  >
                    <IconChip hue={hit.hue} size="sm">
                      <MagnifyingGlassIcon className="h-4 w-4" />
                    </IconChip>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{hit.label}</span>
                      {hit.meta ? <span className="block truncate text-[12.5px] text-[var(--ink3)]">{hit.meta}</span> : null}
                    </span>
                  </button>
                ))}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

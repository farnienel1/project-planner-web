'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DashboardNavItem } from '@/lib/navigation/dashboardNavigation'

export function DashboardJumpSearch({ items }: { items: DashboardNavItem[] }) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [items, query])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  function go(href: string) {
    setQuery('')
    setOpen(false)
    router.push(href)
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-[#f6f7f9] px-3 text-slate-400 focus-within:border-slate-300 focus-within:bg-white">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && matches[active]) {
              e.preventDefault()
              go(matches[active].href)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search…"
          className="w-full bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
          aria-label="Search the workspace"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => go(item.href)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                index === active ? 'bg-slate-50' : ''
              }`}
            >
              <span className="text-[13px] font-medium text-slate-900">{item.label}</span>
              <span className="truncate pl-4 text-[11px] text-slate-400">{item.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

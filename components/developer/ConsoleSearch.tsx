'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { ownerSearchRequest } from '@/lib/owner/client/ownerApi'
import { SEARCH_MIN_LENGTH, type OwnerSearchResult } from '@/lib/owner/directory'

/**
 * The console's global search (spec §4: ⌘K, organisations, people, emails, organisation ids, user ids). Results come
 * from /api/owner/search (server side, emails masked). Typing also keeps filtering the Organisations and People
 * pages, as the old Jump box did.
 */
export function ConsoleSearch() {
  const { jumpQuery, setJumpQuery, includeTestData } = useConsolePrefs()
  const [result, setResult] = useState<OwnerSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const query = jumpQuery.trim()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (query.length < SEARCH_MIN_LENGTH) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      ownerSearchRequest(query, includeTestData, controller.signal)
        .then((value) => {
          setResult(value)
          setError(null)
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Search failed.')
        })
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, includeTestData])

  const close = () => setOpen(false)
  // Only the answer to what is typed now is shown (an older answer never lingers).
  const current = result && result.query === query ? result : null
  const showPanel = open && query.length >= SEARCH_MIN_LENGTH

  return (
    <div className="relative min-w-0 flex-1 max-w-[420px]" onKeyDown={(event) => event.key === 'Escape' && close()}>
      <label className="tb-control tb-search flex h-9 min-w-0 items-center gap-2 px-2.5 text-[12.5px]">
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only">Search organisations and people</span>
        <input
          ref={inputRef}
          value={jumpQuery}
          onChange={(event) => {
            setJumpQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Organisation, person, email or id"
          className="w-full min-w-0 bg-transparent text-[var(--dash-ink)] outline-none placeholder:text-[var(--dash-muted)]"
          aria-controls="owner-search-results"
          aria-expanded={showPanel}
          role="combobox"
          aria-autocomplete="list"
          data-testid="owner-search"
        />
        <kbd className="hidden rounded-[5px] px-1.5 text-[10.5px] sm:inline">⌘K</kbd>
      </label>
      {showPanel ? (
        <div
          id="owner-search-results"
          className="absolute left-0 right-0 top-[42px] z-40 max-h-[60vh] overflow-auto rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-card)] p-2 text-sm shadow-lg"
        >
          {error ? <p className="px-2 py-1 text-[var(--dash-warn-ink)]">{error}</p> : null}
          {!error && !current ? <p className="px-2 py-1 text-[var(--dash-muted)]">Searching…</p> : null}
          {current && current.organisations.length + current.people.length === 0 ? (
            <p className="px-2 py-1 text-[var(--dash-muted)]">Nothing matches “{current.query}”.</p>
          ) : null}
          {current?.organisations.length ? (
            <div>
              <p className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--dash-muted)]">Organisations</p>
              {current.organisations.map((org) => (
                <Link
                  key={org.id}
                  href={`/developer/organisations/${encodeURIComponent(org.id)}`}
                  onClick={close}
                  className="block rounded-[7px] px-2 py-1.5 text-[var(--dash-ink)] hover:bg-[var(--dash-hover-bg)]"
                >
                  <span className="font-medium">{org.name}</span>
                  <span className="ml-2 text-xs text-[var(--dash-muted)]">{org.id}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {current?.people.length ? (
            <div>
              <p className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--dash-muted)]">People</p>
              {current.people.map((person) => (
                <Link
                  key={person.id}
                  href="/developer/users"
                  onClick={() => {
                    setJumpQuery(person.name)
                    close()
                  }}
                  className="block rounded-[7px] px-2 py-1.5 text-[var(--dash-ink)] hover:bg-[var(--dash-hover-bg)]"
                >
                  <span className="font-medium">{person.name}</span>
                  <span className="ml-2 text-xs text-[var(--dash-muted)]">
                    {[person.emailMasked, person.organizationNames.join(', ')].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

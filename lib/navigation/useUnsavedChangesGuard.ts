'use client'

import { useEffect } from 'react'
import {
  activeUnsavedChangesMessage,
  linkClickLeavesPage,
  registerUnsavedChangesGuard,
} from '@/lib/navigation/unsavedChangesGuard'

const SENTINEL_KEY = 'ppUnsavedGuard'

/**
 * While `active`, every in-app way out of the page asks `message` first (owner decision 23 Nov, site audit):
 *   - a click on an in-app link anywhere on the page — the sidebar, the job's workspace tabs, the header — is caught in
 *     the capture phase on `document`, before Next.js's `<Link>` handler sees it; Cancel keeps the person on the page,
 *     OK lets the click through unchanged;
 *   - the browser's back button: one extra history entry for this same page is added while active, so Back first lands
 *     on this page again (nothing visible changes); the question is asked there, Cancel puts the entry back and OK goes
 *     back for real;
 *   - code that navigates with `router.push` calls `confirmLeaveIfUnsaved()` (the command palette does).
 * Closing the tab or reloading is the page's own `beforeunload`. Nothing is asked while `active` is false (e.g. once a
 * save has started: the audit keeps uploading and stays listed).
 */
export function useUnsavedChangesGuard(active: boolean, message: string): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const unregister = registerUnsavedChangesGuard(message)

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const anchor = target?.closest('a')
      if (!anchor) return
      const leaves = linkClickLeavesPage({
        href: anchor.getAttribute('href') === null ? null : anchor.href,
        currentHref: window.location.href,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: anchor.getAttribute('target') ?? '',
        download: anchor.hasAttribute('download'),
        defaultPrevented: event.defaultPrevented,
      })
      if (!leaves) return
      const ask = activeUnsavedChangesMessage()
      if (!ask || window.confirm(ask)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    document.addEventListener('click', onClick, true)

    let armed = false
    const arm = () => {
      if (window.history.state?.[SENTINEL_KEY]) {
        armed = true
        return
      }
      // Next.js copies its own router state onto an entry pushed this way (no URL change, no navigation).
      window.history.pushState({ [SENTINEL_KEY]: true }, '')
      armed = true
    }
    arm()
    const onPopState = (event: PopStateEvent) => {
      if (!armed) return
      const state = event.state as Record<string, unknown> | null
      if (state?.[SENTINEL_KEY]) return
      // Back was pressed: we are on the page's own entry again.
      const ask = activeUnsavedChangesMessage()
      if (!ask || window.confirm(ask)) {
        armed = false
        unregister()
        window.history.back()
        return
      }
      arm()
    }
    window.addEventListener('popstate', onPopState, true)

    return () => {
      unregister()
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState, true)
    }
  }, [active, message])
}

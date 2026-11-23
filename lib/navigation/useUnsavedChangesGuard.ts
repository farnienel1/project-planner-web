'use client'

import { useEffect } from 'react'
import {
  activeUnsavedChangesMessage,
  linkClickLeavesPage,
  registerUnsavedChangesGuard,
} from '@/lib/navigation/unsavedChangesGuard'

/**
 * While `active`, every in-app link and the command palette ask `message` first (owner decision 23 Nov, site audit):
 *   - a click on an in-app link anywhere on the page — the sidebar, the job's workspace tabs, the header — is caught in
 *     the capture phase on `document`, before Next.js's `<Link>` handler sees it; Cancel keeps the person on the page,
 *     OK lets the click through unchanged;
 *   - code that navigates with `router.push` calls `confirmLeaveIfUnsaved()` (the command palette does).
 * Closing the tab or reloading is the page's own `beforeunload`. The browser's Back button is not guarded (follow-up:
 * a history-entry trick could switch the guard off with no page to go back to, or ask twice). Nothing is asked while
 * `active` is false (e.g. once a save has started: the audit keeps uploading and stays listed).
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
        // The attribute as written (an SVG <a> has no string `.href`), resolved against this page inside the check.
        href: anchor.getAttribute('href'),
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
      // Cancel: stop the navigation. stopImmediatePropagation also stops every other click listener for this one
      // click (Next.js's <Link> handler and any onClick on the link), which is intended — the person stays put.
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    document.addEventListener('click', onClick, true)

    return () => {
      unregister()
      document.removeEventListener('click', onClick, true)
    }
  }, [active, message])
}

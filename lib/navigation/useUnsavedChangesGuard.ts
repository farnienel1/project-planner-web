'use client'

import { useEffect } from 'react'
import { createBackNavigationGuard } from '@/lib/navigation/backNavigationGuard'
import {
  activeUnsavedChangesMessage,
  linkClickLeavesPage,
  registerUnsavedChangesGuard,
} from '@/lib/navigation/unsavedChangesGuard'

/**
 * While `active`, every in-app link, the command palette and the browser's Back / Forward ask `message` first (owner
 * decisions 23 Nov, site audit):
 *   - a click on an in-app link anywhere on the page — the sidebar, the job's workspace tabs, the header — is caught in
 *     the capture phase on `document`, before Next.js's `<Link>` handler sees it; Cancel keeps the person on the page,
 *     OK lets the click through unchanged;
 *   - code that navigates with `router.push` calls `confirmLeaveIfUnsaved()` (the command palette does);
 *   - the browser's Back / Forward inside the app (and `router.back()`) through the Navigation API
 *     (`lib/navigation/backNavigationGuard.ts`): no history entry is added, so nothing is left behind once the page is
 *     saved or closed. Browsers without the Navigation API are not guarded here.
 * Closing the tab, reloading, or Back out of the app to another site is the page's own `beforeunload`. Nothing is asked
 * while `active` is false (e.g. once a save has started: the audit keeps uploading and stays listed).
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
    const removeBackGuard = installBackNavigationGuard()

    return () => {
      unregister()
      document.removeEventListener('click', onClick, true)
      removeBackGuard()
    }
  }, [active, message])
}

/**
 * Wires `createBackNavigationGuard` to `window.navigation` and `popstate`. Installed once however many pages ask (a
 * count), so the question is never asked twice for one Back. Returns the function that removes it; when a return to
 * this page is still under way the listeners stay until it has finished, so its `popstate` never reaches Next.js.
 */
let backGuardUsers = 0
let installedBackGuard: { stop: () => void; resume: () => void } | null = null

function installBackNavigationGuard(): () => void {
  const found = (window as Window & { navigation?: Navigation }).navigation
  if (!found || typeof found.addEventListener !== 'function') return () => {}
  const nav: Navigation = found
  backGuardUsers += 1
  if (installedBackGuard) installedBackGuard.resume()
  else {
    const machine = createBackNavigationGuard()
    let closing = false
    const onNavigate = (event: NavigateEvent) => {
      if (closing) return
      const decision = machine.onNavigate(
        {
          navigationType: event.navigationType,
          sameDocument: event.destination.sameDocument,
          cancelable: event.cancelable,
          destinationKey: event.destination.key,
          destinationUrl: event.destination.url,
          currentKey: nav.currentEntry?.key ?? null,
          currentUrl: window.location.href,
        },
        () => {
          const ask = activeUnsavedChangesMessage()
          return !ask || window.confirm(ask)
        }
      )
      if (decision === 'prevent') event.preventDefault()
    }
    const onPopState = (event: PopStateEvent) => {
      const decision = machine.onPopState()
      if (decision.action === 'pass') return
      // Capture on window runs before Next.js's popstate listener, so the app router never sees this traversal.
      event.stopImmediatePropagation()
      if (decision.action === 'swallowAndReturn') {
        try {
          void nav.traverseTo(decision.key).finished?.catch(() => undefined)
        } catch {
          // The entry is gone (cannot happen for the entry we were on); nothing more can be done.
        }
      }
      if (closing && !machine.busy()) remove()
    }
    const remove = () => {
      nav.removeEventListener('navigate', onNavigate as EventListener)
      window.removeEventListener('popstate', onPopState, true)
      installedBackGuard = null
    }
    nav.addEventListener('navigate', onNavigate as EventListener)
    window.addEventListener('popstate', onPopState, true)
    installedBackGuard = {
      stop: () => {
        if (machine.busy()) closing = true
        else remove()
      },
      resume: () => {
        closing = false
      },
    }
  }
  let removed = false
  return () => {
    if (removed) return
    removed = true
    backGuardUsers -= 1
    if (backGuardUsers === 0) installedBackGuard?.stop()
  }
}

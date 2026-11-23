/**
 * Leave-the-page guard for unsaved work (owner decision 23 Nov, site audit before launch). A page with work that would
 * be lost (today only New site audit) registers a guard; these in-app ways out ask the same question first:
 *   - a click on an in-app link (the sidebar, the job's workspace tabs, the header links, any `<a>` / Next `<Link>`),
 *     caught by `useUnsavedChangesGuard` before Next.js sees it;
 *   - a programmatic navigation that calls `confirmLeaveIfUnsaved()` first (the command palette);
 *   - closing the tab or a full reload stays the page's own `beforeunload` (the browser's own wording).
 *   - the browser's Back / Forward inside the app, through the Navigation API (`backNavigationGuard.ts`).
 * UI only: nothing is written and no business rule is involved.
 */

type Guard = { id: number; message: string }

let guards: Guard[] = []
let nextId = 1

/** Registers a guard; the returned function removes it. The newest guard's message is the one asked. */
export function registerUnsavedChangesGuard(message: string): () => void {
  const guard = { id: nextId++, message }
  guards = [...guards, guard]
  return () => {
    guards = guards.filter((entry) => entry.id !== guard.id)
  }
}

/** The question to ask before leaving, or null when nothing would be lost. */
export function activeUnsavedChangesMessage(): string | null {
  return guards.length ? guards[guards.length - 1].message : null
}

/**
 * True when it is fine to leave: no guard is registered, or the person confirmed. `ask` is `window.confirm` in the
 * app (passed in for tests).
 */
export function confirmLeaveIfUnsaved(ask: (message: string) => boolean = defaultAsk): boolean {
  const message = activeUnsavedChangesMessage()
  if (!message) return true
  return ask(message)
}

function defaultAsk(message: string): boolean {
  if (typeof window === 'undefined') return true
  return window.confirm(message)
}

/** Test helper: removes every guard. */
export function resetUnsavedChangesGuardsForTests(): void {
  guards = []
}

export type LinkClickInput = {
  /** The link's resolved href (`anchor.href`), or null for an anchor with none. */
  href: string | null
  /** The page's current URL (`location.href`). */
  currentHref: string
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  /** The anchor's `target` attribute ('' when none). */
  target: string
  /** The anchor has a `download` attribute. */
  download: boolean
  defaultPrevented: boolean
}

/**
 * Whether a click on a link would leave this page inside the app, so the guard must ask first. Not asked for: a click
 * something else already handled, any button but the main one, a modifier click or `target` other than `_self` (a new
 * tab or window — nothing is lost), a download, a link to another site (the browser's `beforeunload` asks), and a link
 * to this same page (only its `#hash` differs, or the same URL).
 */
export function linkClickLeavesPage(input: LinkClickInput): boolean {
  if (input.defaultPrevented) return false
  if (input.button !== 0) return false
  if (input.metaKey || input.ctrlKey || input.shiftKey || input.altKey) return false
  if (input.download) return false
  const target = input.target.trim().toLowerCase()
  if (target && target !== '_self') return false
  if (!input.href) return false
  let next: URL
  let current: URL
  try {
    current = new URL(input.currentHref)
    next = new URL(input.href, current)
  } catch {
    return false
  }
  if (next.protocol !== 'http:' && next.protocol !== 'https:') return false
  if (next.origin !== current.origin) return false
  return next.pathname !== current.pathname || next.search !== current.search
}

/**
 * The browser's Back and Forward buttons on a page with unsaved work (owner decision 23 Nov, site audit before launch).
 * Pure state machine; `useUnsavedChangesGuard` wires it to the browser's Navigation API (`window.navigation`) and
 * `popstate`. UI only: nothing is written and no business rule is involved.
 *
 * Why the Navigation API and not a history entry pushed on top of the page (the trick #419 removed): the browser tells
 * the page, before a Back / Forward goes anywhere, exactly which entry it is going to (`navigate` event, type
 * `traverse`). No entry is ever added, so nothing is left behind and Back never "does nothing" afterwards; a long-press
 * jump of several steps is one event, so Cancel stays on this page and OK goes exactly where the person chose.
 *
 * Two cases, both for a traversal inside the app (same document — every soft page of the Next.js app router):
 *   - the browser lets the page cancel it (`cancelable`): Cancel → `preventDefault()`, nothing moves;
 *   - the browser does not (Chrome allows one cancel per user interaction, so a second Back straight after a Cancel is
 *     not cancelable): the question is still asked; Cancel lets the browser's URL move, stops the `popstate` before
 *     Next.js sees it (so the page and its photos stay mounted) and traverses straight back to this page's entry by its
 *     key. That return is not asked about and its `popstate` is stopped too.
 * Not asked (`allow`): anything that is not a traversal (links and the command palette have their own check), a
 * traversal to another document (leaving the app or a full page load: the page's own `beforeunload` asks — never both),
 * a traversal to this same route (only the `#hash` differs), and when nothing would be lost.
 */

export type TraverseInput = {
  /** `NavigateEvent.navigationType`. */
  navigationType: string
  /** `NavigateEvent.destination.sameDocument`. */
  sameDocument: boolean
  /** `NavigateEvent.cancelable`. */
  cancelable: boolean
  /** `NavigateEvent.destination.key`. */
  destinationKey: string
  /** `NavigateEvent.destination.url`. */
  destinationUrl: string
  /** `navigation.currentEntry.key` when the event fires (the entry the person is leaving), or null. */
  currentKey: string | null
  /** `location.href` when the event fires. */
  currentUrl: string
}

export type TraverseDecision = 'allow' | 'prevent' | 'restore'

export type PopStateDecision =
  | { action: 'pass' }
  | { action: 'swallow' }
  | { action: 'swallowAndReturn'; key: string }

export type BackNavigationGuard = {
  /** Called for every `navigate` event. `ask` returns true when it is fine to leave (no unsaved work, or OK). */
  onNavigate(input: TraverseInput, ask: () => boolean): TraverseDecision
  /** Called for every `popstate`, in the capture phase, before Next.js's own listener. */
  onPopState(): PopStateDecision
  /** A return to this page is under way; the listeners must stay until it has finished. */
  busy(): boolean
}

function sameRoute(a: string, b: string): boolean {
  try {
    const x = new URL(a)
    const y = new URL(b, x)
    return x.origin === y.origin && x.pathname === y.pathname && x.search === y.search
  } catch {
    return false
  }
}

export function createBackNavigationGuard(): BackNavigationGuard {
  /** After a non-cancelable traversal the person said Cancel to: the entry to return to (its popstate not yet seen). */
  let restoreKey: string | null = null
  /** Our own traversal back to this page is in flight (its popstate not yet seen). */
  let returningKey: string | null = null

  return {
    onNavigate(input, ask) {
      if (input.navigationType !== 'traverse') {
        // A new navigation replaces a traversal that never reached popstate (aborted): forget it.
        restoreKey = null
        return 'allow'
      }
      if (returningKey && input.destinationKey === returningKey) return 'allow'
      // Any other traversal supersedes one still pending.
      restoreKey = null
      returningKey = null
      if (!input.sameDocument) return 'allow'
      if (sameRoute(input.currentUrl, input.destinationUrl)) return 'allow'
      if (ask()) return 'allow'
      if (input.cancelable) return 'prevent'
      if (!input.currentKey) return 'allow'
      restoreKey = input.currentKey
      return 'restore'
    },
    onPopState() {
      if (restoreKey) {
        const key = restoreKey
        restoreKey = null
        returningKey = key
        return { action: 'swallowAndReturn', key }
      }
      if (returningKey) {
        returningKey = null
        return { action: 'swallow' }
      }
      return { action: 'pass' }
    },
    busy() {
      return Boolean(restoreKey || returningKey)
    },
  }
}

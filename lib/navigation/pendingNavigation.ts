/** A new navigation starts only when none is pending (a second click while the first is on its way is ignored). */
export function navigationMayStart(pendingHref: string | null | undefined): boolean {
  return !pendingHref
}

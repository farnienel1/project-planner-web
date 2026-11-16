/**
 * Pay strip (review #342 item 4): the roster can load before the signed-in person is known, and the pay-profile read
 * needs them (`refreshPayProfiles` returns without reading). This waits, once per organisation, for a signed-in person
 * and then reloads the roster so the overlay runs. Until then the pay gate stays `loading` — never `ready` on a
 * stripped roster.
 */
type ViewerStore = {
  getState: () => { user: unknown }
  subscribe: (listener: (state: { user: unknown }) => void) => () => void
}

const waiting = new Set<string>()

export function rerunWhenViewerArrives(input: {
  organizationId: string
  authStore: ViewerStore
  /** Whether the roster of this organisation is still the one listed (a company switch cancels the re-run). */
  stillListed: () => boolean
  reload: () => void
}): void {
  const { organizationId, authStore } = input
  if (!organizationId || authStore.getState().user || waiting.has(organizationId)) return
  waiting.add(organizationId)
  const stop = authStore.subscribe((state) => {
    if (!state.user) return
    stop()
    waiting.delete(organizationId)
    if (input.stillListed()) input.reload()
  })
}

/** Tests only. */
export function resetViewerWaitsForTests(): void {
  waiting.clear()
}

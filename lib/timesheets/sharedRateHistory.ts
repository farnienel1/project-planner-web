/**
 * The one shared pay-history listener used by Edit User pages (`watchOperativeDayRateHistory`). Its own module, with
 * no store imports, so the auth store can stop it on every organisation change and sign-out without an import cycle.
 */
import { createSharedListener } from '@/lib/firebase/sharedListener'
import { captureOrganizationContext } from '@/lib/canonical/engine'

export type SharedRateHistoryKeyParts = { organizationId: string; epoch: number; viewerId: string; plan: unknown }

export const sharedRateHistoryListener = createSharedListener<unknown>()

/** The key names the organisation, its context epoch, the viewer and the query plan; any change starts a new listener. */
export function sharedRateHistoryKey(parts: SharedRateHistoryKeyParts): string {
  return JSON.stringify([parts.organizationId, parts.epoch, parts.viewerId, parts.plan])
}

/** True when `key` was made for the organisation context that is open now (same organisation and epoch). */
export function sharedRateHistoryKeyIsCurrent(key: string, context = captureOrganizationContext()): boolean {
  try {
    const [organizationId, epoch] = JSON.parse(key) as [string, number]
    return organizationId === context.organizationId && epoch === context.epoch
  } catch {
    return false
  }
}

/** Organisation switch: stop the listener unless it belongs to the organisation context open now. */
export function resetSharedRateHistoryOutsideCurrentOrganization(): void {
  sharedRateHistoryListener.resetUnless((key) => sharedRateHistoryKeyIsCurrent(key))
}

/** Sign-out and tests: stop it now. */
export function resetSharedRateHistoryListener(): void {
  sharedRateHistoryListener.reset()
}

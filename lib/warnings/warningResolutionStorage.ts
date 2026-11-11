import { collection, getDocs, onSnapshot, type QuerySnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  approvedWarningKeys,
  parseWarningResolutionDocument,
  resolvedWarningKeys,
  warningResolutionRecords,
} from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

/**
 * `organizations/{orgId}/warningResolutions`, read through the rulebook (1.8.0): every key is put in its shared form
 * (`warningResolutionRecords` / `sharedWarningResolutionKey`: older iOS `mgr-clash-…-{seconds}-{i}` and
 * `materials-…-{epoch}` keys hide the same rows as the day-key forms), then `resolvedWarningKeys` /
 * `approvedWarningKeys` decide.
 */
function recordsOf(snapshot: QuerySnapshot) {
  return warningResolutionRecords(
    snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })),
    organizationZoneOr()
  )
}

/** Keys of warnings approved or removed on any device (`resolvedWarningKeys`). */
export async function loadResolvedWarningKeys(organizationId: string): Promise<string[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'warningResolutions'))
  return resolvedWarningKeys(recordsOf(snapshot))
}

/**
 * Live `resolvedWarningKeys` (rulebook §5: warnings refresh when a resolution changes on any device). A refused or
 * failed listener leaves the last keys alone. Returns the unsubscribe.
 */
export function watchResolvedWarningKeys(
  organizationId: string,
  onKeys: (keys: string[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'organizations', organizationId, 'warningResolutions'),
    (snapshot) => onKeys(resolvedWarningKeys(recordsOf(snapshot))),
    (error) => onError?.(error)
  )
}

/**
 * Live `resolvedKeys` and `approvedKeys` together (rulebook §1 live rule, 1.39.0 My Schedule clash marker): one
 * listener on `warningResolutions`. A refused or failed listener leaves the last keys alone. Returns the unsubscribe.
 */
export function watchWarningResolutionKeys(
  organizationId: string,
  onKeys: (keys: { resolvedKeys: string[]; approvedKeys: string[] }) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'organizations', organizationId, 'warningResolutions'),
    (snapshot) => {
      const records = recordsOf(snapshot)
      onKeys({ resolvedKeys: resolvedWarningKeys(records), approvedKeys: approvedWarningKeys(records) })
    },
    (error) => onError?.(error)
  )
}

/**
 * One read of `warningResolutions`: `resolvedKeys` (approved and dismissed, what hides a row —
 * `resolvedWarningKeys`) and `approvedKeys` (approvals only, what counts as an approved clash —
 * `approvedWarningKeys`).
 */
export async function loadWarningResolutionKeys(
  organizationId: string
): Promise<{ resolvedKeys: string[]; approvedKeys: string[] }> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'warningResolutions'))
  const records = recordsOf(snapshot)
  return { resolvedKeys: resolvedWarningKeys(records), approvedKeys: approvedWarningKeys(records) }
}

export type WarningResolutionDoc = { id: string; resolutionKey: string; status: string; resolvedAt: Date | null }

/** Every `warningResolutions` row (`parseWarningResolutionDocument`), for screens that list approvals. */
export async function loadWarningResolutions(organizationId: string): Promise<WarningResolutionDoc[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'warningResolutions'))
  const zone = organizationZoneOr()
  const out: WarningResolutionDoc[] = []
  for (const entry of snapshot.docs) {
    const parsed = parseWarningResolutionDocument(entry.id, entry.data() as Record<string, unknown>, { timeZone: zone })
    if (!parsed) continue
    out.push({
      id: parsed.id,
      resolutionKey: parsed.resolutionKey,
      status: parsed.status ?? '',
      resolvedAt: parsed.resolvedAtMs != null ? new Date(parsed.resolvedAtMs) : null,
    })
  }
  return out
}

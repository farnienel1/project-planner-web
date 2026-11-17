import { notificationRelatedIdFor, warningResolutionWriteFields, writeMetadataFields } from '@/lib/canonical'

/**
 * A permanent warning dismissal, the document iOS writes (`WarningResolutionStore.dismiss` →
 * `warningResolutionWriteFields`): `organizations/{orgId}/warningResolutions/{resolutionKey}` with status `dismissed`.
 * Readers (`warningResolutionRecords` → `resolvedWarningKeys` → `isWarningActive`) then hide the row on both apps,
 * so the Warnings count and the Home badge drop too. The caller adds `resolvedAt` / `updatedAt` as server times.
 *
 * Owner bug 17 Nov: web's materials cut-off Dismiss only hid the card on this page and wrote nothing, so the count
 * stayed and the card came back on refresh. Null when the key or the user is missing (nothing to write).
 */
export function warningDismissDocument(input: {
  resolutionKey: string
  dismissedByUserId: string
}): { documentId: string; fields: Record<string, unknown> } | null {
  const write = warningResolutionWriteFields({
    resolutionKey: input.resolutionKey,
    status: 'dismissed',
    resolvedByUserId: input.dismissedByUserId,
  })
  if (!write) return null
  return {
    documentId: write.documentId,
    fields: { ...write.fields, ...(writeMetadataFields(input.dismissedByUserId, 'web') ?? {}) },
  }
}

/**
 * The resolved keys with one more key added (once, compared without case as every reader does). Pure, so a
 * `setState(prev => withResolvedKey(prev, key))` never drops keys a listener delivered while the write was running.
 */
export function withResolvedKey(keys: readonly string[], key: string): string[] {
  const want = key.trim().toLowerCase()
  if (!want || keys.some((existing) => existing.trim().toLowerCase() === want)) return [...keys]
  return [...keys, key]
}

/**
 * A card's Dismiss: write the dismissal first (`dismiss`, which throws on a refused or failed write), and only then
 * tell the admins (`notify`, the `warning_removed` notice, `relatedId` = the warning key per rulebook §13 via
 * `notificationRelatedIdFor`). A failed write sends no notice and rethrows; a failed notice never undoes the write.
 */
export async function dismissThenNotify(input: {
  resolutionKey: string
  dismiss: (resolutionKey: string) => Promise<void>
  notify: (relatedId: string | null) => Promise<unknown>
}): Promise<void> {
  await input.dismiss(input.resolutionKey)
  try {
    await input.notify(notificationRelatedIdFor('warning_removed', input.resolutionKey))
  } catch {
    // The dismissal is saved; a failed notice never undoes it.
  }
}

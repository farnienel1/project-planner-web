import { warningResolutionWriteFields, writeMetadataFields } from '@/lib/canonical'

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

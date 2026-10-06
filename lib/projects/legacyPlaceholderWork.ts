/**
 * Early organisation setup wrote Firestore rows with the document id INITIAL-PLACEHOLDER.
 * iOS FirebaseBackend.loadProjects / loadSmallWorks skip that id, and saveProjectWithValidation
 * refuses to write it. The client row uses the same id; iOS drops it because it is not a UUID.
 * These are not jobs. Do not list them and do not write them back.
 */
export const LEGACY_PLACEHOLDER_DOCUMENT_ID = 'INITIAL-PLACEHOLDER'

export function isLegacyPlaceholderDocumentId(id: string | null | undefined): boolean {
  return (id || '').trim().toUpperCase() === LEGACY_PLACEHOLDER_DOCUMENT_ID
}

export function withoutLegacyPlaceholderDocuments<T extends { id: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isLegacyPlaceholderDocumentId(row.id))
}

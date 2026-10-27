/**
 * Early organisation setup wrote Firestore rows with the document id INITIAL-PLACEHOLDER.
 * iOS FirebaseBackend.loadProjects / loadSmallWorks skip that id, and saveProjectWithValidation
 * refuses to write it. The client row uses the same id; iOS drops it because it is not a UUID.
 * These are not jobs. Do not list them and do not write them back.
 */
import { isLegacyPlaceholderDocumentId } from '@/lib/canonical'

export { LEGACY_PLACEHOLDER_DOCUMENT_ID, isLegacyPlaceholderDocumentId } from '@/lib/canonical'

export function withoutLegacyPlaceholderDocuments<T extends { id: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isLegacyPlaceholderDocumentId(row.id))
}

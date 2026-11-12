/**
 * The pure part of the projects / small works listeners (`projectStore`): a listener snapshot → the jobs the store
 * holds. No Firebase import, so the data-parity fixture (rulebook 1.38.0 §27) runs this exact code in tests.
 */
import type { Project } from '@/types'
import { projectFromJobDocument } from '@/lib/ios-parity/converters'
import { retainScopedRows, type RetainOptions } from '@/lib/staff/rosterRetain'
import { isLegacyPlaceholderDocumentId, withoutLegacyPlaceholderDocuments } from '@/lib/projects/legacyPlaceholderWork'
import type { OrgCollectionDoc } from '@/lib/firebase/orgCollectionMerge'

/**
 * A job document as the web `Project`. Reading is the rulebook's `parseJobDocument` (§1): ids in stored case,
 * the client id as stored (never a fresh id), start day `startDate` else `createdAt`, end day `endDate` else the start.
 */
export function mapProjectDoc(
  docId: string,
  data: Record<string, unknown>,
  organizationId: string,
  collection?: 'projects' | 'smallWorks'
): Project {
  const project = projectFromJobDocument(docId, data, organizationId)
  // Rulebook 1.11.0 `jobKind`: the collection decides the kind, never `jobType`.
  return collection ? { ...project, collection } : project
}

/**
 * Rulebook 1.21.0 §21: every job document the reader accepts, live or not (the placeholder never). A plan's parts
 * are exact queries, so in plan mode a job that left them leaves the list now; otherwise `retainScopedRows`
 * (a cache snapshot never empties or shortens the list; in-app deletes stay gone).
 */
export function jobsFromListenerDocs(input: {
  organizationId: string
  kind: 'projects' | 'smallWorks'
  docs: readonly OrgCollectionDoc[]
  meta?: RetainOptions
  previous: readonly Project[]
  planMode: boolean
}): Project[] {
  const mapped = input.docs
    .filter((entry) => !isLegacyPlaceholderDocumentId(entry.id))
    .map((entry) => mapProjectDoc(entry.id, entry.data, input.organizationId, input.kind))
  return withoutLegacyPlaceholderDocuments(
    input.planMode ? mapped : retainScopedRows(`${input.kind}:${input.organizationId}`, input.previous, mapped, input.meta)
  )
}

import { CLIENT_ERRORS_COLLECTION, parseClientErrorDocument, type ClientErrorRecord } from '@/lib/canonical'
import { firestoreRunQuery, restFieldsToPlain, structuredQuery } from '@/lib/owner/firestoreRest'

/** The newest reports the Errors page reads (the collection keeps 30 days; TTL deletes older ones). */
export const CLIENT_ERRORS_READ_MAX = 1000

/**
 * Reads the newest `clientErrors` with the owner's own token (the security rules let only the platform owner read
 * them). Newest first; filtering and grouping are done by `clientErrorGroups`.
 */
export async function readClientErrors(idToken: string, limit = CLIENT_ERRORS_READ_MAX): Promise<ClientErrorRecord[]> {
  const rows = await firestoreRunQuery(
    idToken,
    structuredQuery(CLIENT_ERRORS_COLLECTION, undefined, {
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: Math.max(1, Math.min(CLIENT_ERRORS_READ_MAX, Math.floor(limit))),
    })
  )
  return rows.map((row) => parseClientErrorDocument(row.id, restFieldsToPlain(row.fields)))
}

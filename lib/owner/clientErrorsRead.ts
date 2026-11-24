import { CLIENT_ERRORS_COLLECTION, parseClientErrorDocument, type ClientErrorRecord } from '@/lib/canonical'
import { firestoreRunQuery, restAnd, restEqual, restFieldsToPlain, structuredQuery } from '@/lib/owner/firestoreRest'

/** The newest reports the Errors page reads (the collection keeps 30 days; TTL deletes older ones). */
export const CLIENT_ERRORS_READ_MAX = 1000

/**
 * Reads the newest `clientErrors` with the owner's own token (the security rules let only the platform owner read
 * them), filtered by platform and / or organisation in the query itself (so the 1,000 are the newest of the filtered
 * reports; composite indexes in `firestore.indexes.json`). Grouping is `clientErrorGroups`.
 */
export async function readClientErrors(
  idToken: string,
  filter: { platform?: string | null; organizationId?: string | null } = {},
  limit = CLIENT_ERRORS_READ_MAX
): Promise<ClientErrorRecord[]> {
  const where = restAnd([
    ...(filter.platform ? [restEqual('platform', filter.platform)] : []),
    ...(filter.organizationId != null ? [restEqual('organizationId', filter.organizationId)] : []),
  ])
  const rows = await firestoreRunQuery(
    idToken,
    structuredQuery(CLIENT_ERRORS_COLLECTION, where, {
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: Math.max(1, Math.min(CLIENT_ERRORS_READ_MAX, Math.floor(limit))),
    })
  )
  return rows.map((row) => parseClientErrorDocument(row.id, restFieldsToPlain(row.fields)))
}

/** The organisations that appear in the newest reports (for the filter), read without a filter. */
export async function readClientErrorOrganisations(idToken: string): Promise<string[]> {
  const records = await readClientErrors(idToken, {}, CLIENT_ERRORS_READ_MAX)
  return [...new Set(records.map((record) => record.organizationId))].sort()
}

import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken, firestoreRunQuery, restFieldsToPlain, structuredQuery } from '@/lib/owner/firestoreRest'
import { loadOwnerDirectory } from '@/lib/owner/directoryServer'
import { AUDIT_FEED_READ, commandCentre } from '@/lib/owner/commandCentre'
import { CONSOLE_PERIODS, resolveConsolePeriod, type ConsolePeriodId } from '@/lib/analytics/consolePeriod'
import type { PlainDoc } from '@/lib/owner/directory'
import { OWNER_READ_FAILED_MESSAGE, includeTestDataParam, ownerJson, ownerReadGuard, refreshParam } from '@/lib/owner/ownerReadRoute'

export const runtime = 'nodejs'

/** The newest audit entries (the owner reads `adminAuditLog`; ordered by `at`, a single-field index). */
async function readNewestAuditEntries(token: string): Promise<PlainDoc[]> {
  const rows = await firestoreRunQuery(
    token,
    structuredQuery('adminAuditLog', undefined, { orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }], limit: AUDIT_FEED_READ })
  )
  return rows.map((row) => ({ id: row.id, data: restFieldsToPlain(row.fields) }))
}

/**
 * GET /api/owner/overview?period=&includeTestData=&refresh= — the Overview page (spec §4.1): headline figures,
 * organisations needing attention and the live feed. Read-only. Organisations and people come from the cached
 * directory (60 s, the same rows as the Organisations and People routes); the audit entries are read each time.
 */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-overview', 60)
  if (!isFirebaseUser(owner)) return owner
  const raw = request.nextUrl.searchParams.get('period') || 'month'
  if (!CONSOLE_PERIODS.some((item) => item.id === raw)) return jsonError('Unknown period.', 400)
  const token = bearerToken(request)
  const nowMs = Date.now()
  try {
    const [directory, audit] = await Promise.all([
      loadOwnerDirectory(token, { refresh: refreshParam(request) }),
      // The feed's owner actions are not worth failing the page for: the page says when they could not be read.
      readNewestAuditEntries(token).then(
        (entries) => ({ entries, error: null as string | null }),
        (error: unknown) => {
          console.error('[owner/overview] audit', error)
          return { entries: [] as PlainDoc[], error: 'Owner actions could not be read.' }
        }
      ),
    ])
    const range = resolveConsolePeriod(raw as ConsolePeriodId, new Date(nowMs))
    const result = commandCentre({
      orgRows: directory.orgRows,
      peopleRows: directory.peopleRows,
      auditEntries: audit.entries,
      range,
      includeTestData: includeTestDataParam(request),
      nowMs,
    })
    return ownerJson({
      period: raw,
      range: { start: range.start.toISOString(), end: range.end.toISOString(), label: range.label },
      ...result,
      auditError: audit.error,
      truncated: directory.truncated,
      documentsRead: (directory.fromCache ? 0 : directory.documentsRead) + audit.entries.length,
      fromCache: directory.fromCache,
      countedAt: new Date(nowMs).toISOString(),
      directoryReadAt: directory.cachedAt,
    })
  } catch (error) {
    console.error('[owner/overview]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

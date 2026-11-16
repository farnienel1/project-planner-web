import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { ownerCountsFromParts, readOwnerCountParts } from '@/lib/owner/ownerCounts'
import { OWNER_READ_FAILED_MESSAGE, includeTestDataParam, ownerJson, ownerReadGuard } from '@/lib/owner/ownerReadRoute'

export const runtime = 'nodejs'

/** GET /api/owner/counts?includeTestData= — headline counts from `count()` aggregations (no documents downloaded). */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-counts')
  if (!isFirebaseUser(owner)) return owner
  try {
    const parts = await readOwnerCountParts(bearerToken(request))
    return ownerJson({ ...ownerCountsFromParts(parts, includeTestDataParam(request)), countedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[owner/counts]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { SEARCH_MIN_LENGTH, ownerSearch } from '@/lib/owner/directory'
import { loadOwnerDirectory } from '@/lib/owner/directoryServer'
import { OWNER_READ_FAILED_MESSAGE, includeTestDataParam, ownerJson, ownerReadGuard, searchParam } from '@/lib/owner/ownerReadRoute'

export const runtime = 'nodejs'

/** GET /api/owner/search?q= — ⌘K: organisations and people by name, email, organisation id or user id (top 10 each). */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-search', 240)
  if (!isFirebaseUser(owner)) return owner
  const q = searchParam(request)
  if (q instanceof NextResponse) return q
  if (q.length < SEARCH_MIN_LENGTH) return ownerJson({ query: q, organisations: [], people: [], truncated: false })
  try {
    const data = await loadOwnerDirectory(bearerToken(request))
    return ownerJson({ ...ownerSearch(data.orgRows, data.peopleRows, q, includeTestDataParam(request)), truncated: data.truncated })
  } catch (error) {
    console.error('[owner/search]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

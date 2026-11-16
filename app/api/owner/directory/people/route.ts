import { NextRequest, NextResponse } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { OWNER_PEOPLE_FILTERS, OWNER_PEOPLE_SORTS, oneOf, selectOwnerPeople } from '@/lib/owner/directory'
import { loadOwnerDirectory } from '@/lib/owner/directoryServer'
import { OWNER_READ_FAILED_MESSAGE, includeTestDataParam, ownerJson, ownerReadGuard, searchParam } from '@/lib/owner/ownerReadRoute'

export const runtime = 'nodejs'

/**
 * GET /api/owner/directory/people?q=&filter=&sort=&cursor=&limit=&includeTestData= — one page of people: one row per
 * email across every organisation (rulebook `rosterPeople`). Emails are masked; Auth facts come with the person page.
 */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-directory-people')
  if (!isFirebaseUser(owner)) return owner
  const q = searchParam(request)
  if (q instanceof NextResponse) return q
  const params = request.nextUrl.searchParams
  try {
    const data = await loadOwnerDirectory(bearerToken(request))
    const page = selectOwnerPeople(data.peopleRows, {
      q,
      filter: oneOf(params.get('filter'), OWNER_PEOPLE_FILTERS, 'all'),
      sort: oneOf(params.get('sort'), OWNER_PEOPLE_SORTS, 'name'),
      includeTestData: includeTestDataParam(request),
      cursor: params.get('cursor'),
      limit: Number(params.get('limit') || 0),
    })
    return ownerJson({ ...page, truncated: data.truncated, documentsRead: data.documentsRead })
  } catch (error) {
    console.error('[owner/directory/people]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

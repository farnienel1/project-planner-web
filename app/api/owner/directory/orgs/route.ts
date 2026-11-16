import { NextRequest, NextResponse } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { OWNER_ORG_FILTERS, OWNER_ORG_SORTS, oneOf, selectOwnerOrgs } from '@/lib/owner/directory'
import { loadOwnerOrganisations } from '@/lib/owner/directoryServer'
import { OWNER_READ_FAILED_MESSAGE, includeTestDataParam, ownerJson, ownerReadGuard, searchParam } from '@/lib/owner/ownerReadRoute'

export const runtime = 'nodejs'

/** GET /api/owner/directory/orgs?q=&filter=&sort=&cursor=&limit=&includeTestData= — one page of organisation rows. */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-directory-orgs')
  if (!isFirebaseUser(owner)) return owner
  const q = searchParam(request)
  if (q instanceof NextResponse) return q
  const params = request.nextUrl.searchParams
  try {
    const data = await loadOwnerOrganisations(bearerToken(request))
    const page = selectOwnerOrgs(data.orgRows, {
      q,
      filter: oneOf(params.get('filter'), OWNER_ORG_FILTERS, 'all'),
      sort: oneOf(params.get('sort'), OWNER_ORG_SORTS, 'name'),
      includeTestData: includeTestDataParam(request),
      cursor: params.get('cursor'),
      limit: Number(params.get('limit') || 0),
    })
    return ownerJson({ ...page, truncated: data.truncated, documentsRead: data.documentsRead })
  } catch (error) {
    console.error('[owner/directory/orgs]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

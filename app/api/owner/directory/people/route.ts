import { NextRequest, NextResponse } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { OWNER_PEOPLE_FILTERS, OWNER_PEOPLE_SORTS, oneOf, selectOwnerPeople } from '@/lib/owner/directory'
import { loadOwnerDirectory } from '@/lib/owner/directoryServer'
import { CONSOLE_PERIODS, resolveConsolePeriod, type ConsolePeriodId } from '@/lib/analytics/consolePeriod'
import { OWNER_READ_FAILED_MESSAGE, includeTestDataParam, ownerJson, ownerReadGuard, refreshParam, searchParam } from '@/lib/owner/ownerReadRoute'

export const runtime = 'nodejs'

/**
 * GET /api/owner/directory/people?q=&filter=&sort=&cursor=&limit=&includeTestData=&seen=&joined= — one page of people: one row per
 * email across every organisation (rulebook `rosterPeople`). Emails are masked; Auth facts come with the person page.
 */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-directory-people')
  if (!isFirebaseUser(owner)) return owner
  const q = searchParam(request)
  if (q instanceof NextResponse) return q
  const params = request.nextUrl.searchParams
  // Owner console PR 5: `seen` / `joined` take a console period id, resolved exactly as the Overview resolves it, so
  // the list opened from an Overview tile has the tile's figure as its total.
  const windows: { seen: ReturnType<typeof resolveConsolePeriod> | null; joined: ReturnType<typeof resolveConsolePeriod> | null } = {
    seen: null,
    joined: null,
  }
  const now = new Date()
  for (const key of ['seen', 'joined'] as const) {
    const raw = params.get(key)
    if (!raw) continue
    if (!CONSOLE_PERIODS.some((item) => item.id === raw)) return jsonError('Unknown period.', 400)
    windows[key] = resolveConsolePeriod(raw as ConsolePeriodId, now)
  }
  try {
    const data = await loadOwnerDirectory(bearerToken(request), { refresh: refreshParam(request) })
    const page = selectOwnerPeople(data.peopleRows, {
      q,
      filter: oneOf(params.get('filter'), OWNER_PEOPLE_FILTERS, 'all'),
      sort: oneOf(params.get('sort'), OWNER_PEOPLE_SORTS, 'name'),
      includeTestData: includeTestDataParam(request),
      cursor: params.get('cursor'),
      limit: Number(params.get('limit') || 0),
      seenIn: windows.seen,
      joinedIn: windows.joined,
    })
    return ownerJson({
      ...page,
      seenLabel: windows.seen?.label ?? null,
      joinedLabel: windows.joined?.label ?? null, truncated: data.truncated, documentsRead: data.fromCache ? 0 : data.documentsRead, fromCache: data.fromCache, cachedAt: data.cachedAt })
  } catch (error) {
    console.error('[owner/directory/people]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

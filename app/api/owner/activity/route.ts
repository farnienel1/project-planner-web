import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { readOwnerActivityCounts } from '@/lib/owner/activityCounts'
import { CONSOLE_PERIODS, type ConsolePeriodId } from '@/lib/analytics/consolePeriod'
import { OWNER_READ_FAILED_MESSAGE, includeTestDataParam, ownerJson, ownerReadGuard } from '@/lib/owner/ownerReadRoute'

export const runtime = 'nodejs'

/**
 * GET /api/owner/activity?period=&includeTestData= — bookings made, projects / small works created and tasks completed
 * per console period, from `count()` aggregations of each organisation's records (no documents downloaded).
 */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-activity', 30)
  if (!isFirebaseUser(owner)) return owner
  const raw = request.nextUrl.searchParams.get('period') || 'month'
  if (!CONSOLE_PERIODS.some((item) => item.id === raw)) return jsonError('Unknown period.', 400)
  try {
    const result = await readOwnerActivityCounts(bearerToken(request), {
      period: raw as ConsolePeriodId,
      includeTestData: includeTestDataParam(request),
    })
    return ownerJson({
      period: raw,
      values: result.values,
      organisationsCounted: result.organisationsCounted,
      failedOrganisations: result.failedOrganisations,
      ranges: result.ranges.map((range) => ({ id: range.id, start: range.start.toISOString(), end: range.end.toISOString() })),
      countedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[owner/activity]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { requireOwnerSession, type OwnerSession } from '@/lib/owner/requireOwner'

/** Shared start of every owner read route: rate limit (per IP), then the owner guard (PLAN A3). */
export async function ownerReadGuard(request: NextRequest, scope: string, limit = 120): Promise<OwnerSession | NextResponse> {
  const limited = enforceRateLimit(request, scope, limit, 60 * 1000)
  if (limited) return limited
  return requireOwnerSession(request)
}

export function ownerJson(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}

/** "Include test data" from the query string: only the literal `1` / `true` turns it on. */
export function includeTestDataParam(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get('includeTestData') || ''
  return raw === '1' || raw === 'true'
}

export const OWNER_QUERY_MAX = 200

/** The search text, or a 400 when it is too long. */
export function searchParam(request: NextRequest): string | NextResponse {
  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  if (q.length > OWNER_QUERY_MAX) return jsonError(`Search text is too long (at most ${OWNER_QUERY_MAX} characters).`, 400)
  return q
}

export const OWNER_READ_FAILED_MESSAGE = 'Could not read the platform data. Sign in again as the owner, then try again.'

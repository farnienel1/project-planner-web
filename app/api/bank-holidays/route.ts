import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, isFirebaseUser, jsonError, requireFirebaseUser } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

/** Signed-in proxy for Nager.Date. The public API has no CORS header, so the browser cannot call it. */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, 'bank-holidays', 60, 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const year = Number(request.nextUrl.searchParams.get('year'))
  const country = (request.nextUrl.searchParams.get('country') || '').trim().toUpperCase()
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return jsonError('Invalid year', 400)
  if (!/^[A-Z]{2}$/.test(country)) return jsonError('Invalid country', 400)

  const upstream = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
  if (!upstream.ok) return jsonError('Bank holidays did not load.', 502)
  const payload = await upstream.json()
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=3600' } })
}
